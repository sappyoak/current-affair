import { IConfiguration } from "../config"
import { RollingCounterWindow, RollingPercentileWindow } from './rolling-window'
import { Counters, Timings } from './metric-types'

type CommandMetricsOptionsKeys = 'name' | 'group' | 'rollingWindowDuration' | 'rollingBucketCount' | 'rollingPercentileWindowDuration' | 'rollingPercentileBucketCount'
export type CommandMetricsOptions = Pick<IConfiguration, CommandMetricsOptionsKeys>

export class CommandMetrics {
    public commandName: string
    public commandGroup: string

    protected rollingCounterWindow: RollingCounterWindow
    protected rollingPercentileWindow: RollingPercentileWindow

    public constructor(options: CommandMetricsOptions) {
        this.commandName = options.name
        this.commandGroup = options.group
        
        this.rollingCounterWindow = new RollingCounterWindow(options.rollingWindowDuration, options.rollingBucketCount)
        this.rollingPercentileWindow = new RollingPercentileWindow(options.rollingPercentileWindowDuration, options.rollingPercentileBucketCount)
    }

    public getHealthStats() {
        const sum = (this.rollingCounterWindow.getCurrentWindowSum() as number[])
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
        this.rollingPercentileWindow.getCurrentBucket().update(key, timing)
    }

    public getCurrentTimings(key?: Timings): number[] | number[][] {
        const timings = this.rollingPercentileWindow.getCurrentBucket()
        return key ? timings[key] : timings
    }
}