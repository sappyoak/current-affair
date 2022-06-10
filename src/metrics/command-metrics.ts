import { IConfiguration } from "../config"
import { RollingCounterWindow, RollingPercentileWindow } from './rolling-window'
import { Counters, Timings } from './metric-types'

export type CommandMetricsOptions = Pick<IConfiguration, 'name' | 'group' | 'rollingWindowDuration' | 'rollingBucketCount'>

export class CommandMetrics {
    public commandName: string
    public commandGroup: string
    public rollingWindowDuration: number
    public rollingBucketCount: number

    protected rollingCounterWindow: RollingCounterWindow
    protected rollingPercentileWindow: RollingPercentileWindow

    public constructor(options: CommandMetricsOptions) {
        this.commandName = options.name
        this.commandGroup = options.group
        this.rollingWindowDuration = options.rollingWindowDuration
        this.rollingBucketCount = options.rollingBucketCount
        
        // It might be good to be able to pass different durations and bucket counts for these separate windows
        this.rollingCounterWindow = new RollingCounterWindow(this.rollingWindowDuration, this.rollingBucketCount)
        this.rollingPercentileWindow = new RollingPercentileWindow(this.rollingWindowDuration, this.rollingBucketCount)
    }

    public getHealthStats() {
        const sum = this.rollingCounterWindow.getCurrentWindowSum()
        const errorCount = sum[Counters.ExecutionFailure] + sum[Counters.ExecutionTimeout] + sum[Counters.SemaphoreRejection] + sum[Counters.CommandFailure] + sum[Counters.ShortCircuits]
        const total = errorCount + sum[Counters.CommandSuccess]

        let errorPercentage = 0
        if (total > 0) {
            errorPercentage = errorCount / (total * 100)
        }

        return { count: total, errorPercentage }
    }

    public incrementCounter(key: Counters) {
        this.rollingCounterWindow.getCurrentBucket().update(key)
    }

    public getCurrentCount(key?: Counters) {
        return this.rollingCounterWindow.getRollingCount(key)
    }

    public getRollingSum(key?: Counters) {
        return this.rollingCounterWindow.getCurrentWindowSum(key)
    }

    public getCumulativeSum(key?: Counters) {
        return this.rollingCounterWindow.getCumulativeSum(key)
    }

    public addTiming(key: Timings, timing: number) {
        this.rollingPercentileWindow.getCurrentBucket().update(timing)
    }

    public getCurrentTimings(key?: Timings) {
        const timings = this.rollingPercentileWindow.getCurrentBucket()
        return key ? timings[key] : timings
    }
}