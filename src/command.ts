import { EventEmitter } from 'node:events'

import { IConfiguration, createConfiguration } from './config'
import { CircuitBreaker } from './circuit-breaker'
import { CircuitOpenError, SemaphoreFullError, TaskCancelledError, TaskTimeoutError } from './errors'
import { Executor } from './executor'
import { CommandMetrics, Counters } from './metrics'
import { Semaphore } from './semaphore'
import { createChildAbortController, handlePromiseTimeout } from './utils'

export class Command extends EventEmitter {
    protected config: IConfiguration
    protected name: string
    protected group: string
    protected commandState
    protected executor: Executor
    protected metrics: CommandMetrics
    protected semaphore: Semaphore
    protected circuitBreaker: CircuitBreaker

    public constructor(options: Partial<IConfiguration>) {
        super()

        this.config = createConfiguration(options)
        this.name = this.config.name
        this.group = this.config.group

        this.executor = new Executor(this.config.actionTimeout, this.config.errorFilter)
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
        
        try {
            const { count, errorPercentage } = this.metrics.getHealthStats()
            
            if (!this.circuitBreaker.isAllowingRequests(count, errorPercentage)) {
                throw new CircuitOpenError()
            }

            const result = await this.semaphore.runOrSchedule(() => this.executor.execute(fn, controller), controller)
            
            if (!result.success && !result.handled) {
                throw result.value
            }

            this.metrics.incrementCounter(Counters.CommandSuccess)
            this.circuitBreaker.onExecuteComplete(true)
            return result
        } catch (error) {
            // If a task was cancelled we shouldn't do anything further
            if (error instanceof TaskCancelledError) {
                return
            }

            this.metrics.incrementCounter(Counters.CommandFailure)
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

        try {
            const result = await handlePromiseTimeout(() => this.config.fallback(error), this.config.fallbackTimeout, controller)
            this.metrics.incrementCounter(Counters.FallbackSuccess)
            return result
        } catch (innerError) {
            this.metrics.incrementCounter(Counters.FallbackFailure)
            if (innerError instanceof TaskTimeoutError) {
                this.metrics.incrementCounter(Counters.FallbackTimeout)
            }
            throw innerError
        }
    }
}