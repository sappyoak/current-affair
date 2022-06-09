import { EventEmitter } from 'node:events'

import { IConfiguration, createConfiguration } from './config'
import { CircuitBreaker } from './circuit-breaker'
import { Executor } from './executor'
import { Metrics } from './Metrics'
import { Semaphore } from './semaphore'

export class Command extends EventEmitter {
    protected config: IConfiguration
    protected name: string
    protected group: string
    protected commandState
    protected executor: Executor
    protected metrics: Metrics
    protected semaphore: Semaphore
    protected circuitBreaker: CircuitBreaker

    public constructor(options: Partial<IConfiguration>) {
        super()

        this.config = createConfiguration(options)
        this.name = this.config.name
        this.group = this.config.group

        this.executor = new Executor(this.config.actionTimeout, this.config.errorFilter)
        this.metrics = new Metrics({
            rollingWindowDuration: this.config.rollingWindowDuration,
            rollingBucketCount: this.config.rollingBucketCount,
            calculateRollingPercentile: this.config.calculateRollingPercentile,
            percentiles: this.config.percentiles,
            snapshotInterval: this.config.snapshotInterval
        })

        this.semaphore = new Semaphore(this.config.maxActionConcurrency, this.config.maxActionQueueSize)
        this.circuitBreaker = new CircuitBreaker(this.config.actionVolumeThreshold, this.config.errorThresholdPercentage, this.config.sleepWindow)
    }
}