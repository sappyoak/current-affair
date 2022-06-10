import { EventEmitter } from 'node:events'

import { IConfiguration, createConfiguration } from './config'
import { CircuitBreaker } from './circuit-breaker'
import { CircuitOpenError, SemaphoreFullError, TaskCancelledError, TaskTimeoutError } from './errors'
import { CommandMetrics, Counters, Timings } from './metrics'
import { Semaphore } from './semaphore'
import { createChildAbortController, createTimer, handlePromiseTimeout } from './utils'

export class Command extends EventEmitter {
    protected config: IConfiguration
    protected name: string
    protected group: string
    protected commandState
    protected metrics: CommandMetrics
    protected semaphore: Semaphore
    protected circuitBreaker: CircuitBreaker

    public constructor(options: Partial<IConfiguration>) {
        super()

        this.config = createConfiguration(options)
        this.name = this.config.name
        this.group = this.config.group
        this.metrics = new CommandMetrics({
            name: this.name,
            group: this.group,
            rollingWindowDuration: this.config.rollingWindowDuration,
            rollingBucketCount: this.config.rollingBucketCount
        })

        this.semaphore = new Semaphore(this.config.maxActionConcurrency, this.config.maxActionQueueSize)
        this.circuitBreaker = new CircuitBreaker(this.config.actionVolumeThreshold, this.config.errorThresholdPercentage, this.config.sleepWindow)
    }


    async execute(fn, signal) {
        const controller = createChildAbortController(signal)
        const timer = createTimer()

        try {
            const { count, errorPercentage } = this.metrics.getHealthStats()
            
            if (!this.circuitBreaker.isAllowingRequests(count, errorPercentage)) {
                throw new CircuitOpenError()
            }

            const result = await this.semaphore.runOrSchedule(() => this._execute(fn, controller), controller)
                
            if (!result.success && !result.handled) {
                throw result.value
            }

            this.metrics.incrementCounter(Counters.CommandSuccess)
            this.metrics.addTiming(Timings.CommandTiming, timer())
            this.circuitBreaker.onExecuteComplete(true)
            return result
        } catch (error) {
            // If a task was cancelled we shouldn't do anything further
            if (error instanceof TaskCancelledError) {
                return
            }

            this.metrics.incrementCounter(Counters.CommandFailure)
            this.metrics.addTiming(Timings.CommandTiming, timer())
            this.circuitBreaker.onExecuteComplete(false)
            return await this.handleError(error, controller)
        } finally {
            controller.abort()
        }
    }

    public handleError(error: Error, controller: globalThis.AbortController) {
        if (error instanceof TaskTimeoutError) {
            this.metrics.incrementCounter(Counters.ExecutionTimeout)
        } else if (error instanceof SemaphoreFullError) {
            this.metrics.incrementCounter(Counters.SemaphoreRejection)
        } else if (error instanceof CircuitOpenError) {
            this.metrics.incrementCounter(Counters.ShortCircuits)
        }

        if (typeof this.config?.fallback === 'function') {
            return this.attemptFallback(error, controller)
        }
        
        throw error
    }

    private async attemptFallback(error: Error, controller) {
        // If this was canceled after an error has been thrown in the main function, just return the original 
        // error
        if (controller.signal.aborted) {
            throw error
        }

        const timer = createTimer()

        try {
            const result = await handlePromiseTimeout(() => this.config.fallback(error), this.config.fallbackTimeout, controller)
            this.metrics.incrementCounter(Counters.FallbackSuccess)
            this.metrics.addTiming(Timings.FallbackTiming, timer())
            return result
        } catch (innerError) {
            this.metrics.incrementCounter(Counters.FallbackFailure)
            this.metrics.addTiming(Timings.FallbackTiming, timer())
            if (innerError instanceof TaskTimeoutError) {
                this.metrics.incrementCounter(Counters.FallbackTimeout)
            }
            throw innerError
        }
    }

    private async _execute(fn, controller: globalThis.AbortController) {
        const timer = createTimer()

        return await handlePromiseTimeout(async () => {
            if (controller.signal.aborted) {
                throw new TaskCancelledError()
            } 

            try {
                const result = await fn()
                this.metrics.addTiming(Timings.ExecutionTiming, timer())
                return { success: true, value: result }
            } catch (error) {
                this.metrics.addTiming(Timings.ExecutionTiming, timer())
                return { handled: this.config.errorFilter(error), success: false, value: error }
            }

        }, this.config.actionTimeout, controller)
    }
}