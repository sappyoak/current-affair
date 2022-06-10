import { EventEmitter } from 'node:events'

import { IConfiguration, createConfiguration } from './config'
import { CircuitBreaker } from './circuit-breaker'
import { Executor } from './executor'
import { CommandMetrics, Counters } from './metrics'
import { Semaphore } from './semaphore'
import { createChildAbortController } from './utils'

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
                // @TODO CircuitOpenError
                throw 'circuit-open'
            }

            const result = await this.semaphore.runOrSchedule(() => this.executor.execute(fn, controller), controller)
        
            if (!result.success && !result.handled) {
                throw result.value
            }

            this.metrics.incrementCounter(Counters.CommandSuccess)
            this.circuitBreaker.onExecuteComplete(true)
            return result
        } catch (error) {
            this.metrics.incrementCounter(Counters.CommandFailure)
            this.circuitBreaker.onExecuteComplete(false)
            this.handleError(error)
        } finally {
            controller.abort()
        }
    }

    public handleError(error) {
        // Check error for instances of different errors to increment metrics and then handle fallback. 
        // Fallback might be more useful to implement in a different place. 
    }
}