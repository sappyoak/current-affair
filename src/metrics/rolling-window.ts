import { IRotatingBucket, RotatingCounterBucket, RotatingPercentileBucket } from "./bucket"
import { CumulativeSum } from "./cumulative-sum"
import { CounterMetrics, TimingMetrics, Counters, Timings } from "./metric-types"

type PassedBucketType<T> = T extends RotatingCounterBucket
    ? IRotatingBucket<CounterMetrics, number[]>
    : T extends RotatingPercentileBucket
    ? IRotatingBucket<TimingMetrics, number[][]>
    : never

export abstract class RollingWindow<T>  {
    protected readonly windowDuration: number
    protected readonly bucketCount: number
    protected readonly bucketLifetime: number

    protected buckets: PassedBucketType<T>[]
    protected currentBucketIndex: number = 0

    public constructor(windowDuration: number, bucketCount: number) {
        this.windowDuration = windowDuration
        this.bucketCount = bucketCount
        this.bucketLifetime = this.windowDuration / this.bucketCount

        this.initializeBuckets()
    }

    public abstract initializeBuckets()
    public abstract onRoll(data: PassedBucketType<T>['data'])
    public abstract onFlush(data: PassedBucketType<T>['data'])

    public getCurrentBucket(): PassedBucketType<T> {
        const currentTime = Date.now()
        const currentBucket = this.buckets[this.currentBucketIndex]

        if (currentTime < (currentBucket.startedAt + this.bucketLifetime)) {
            return currentBucket
        }

        if (currentTime > (currentBucket.startedAt + this.windowDuration)) {
            this.flush()
            return this.getCurrentBucket()
        }

        return this.roll(currentTime)
    }

    private roll(currentTime: number) {
        const currentBucket = this.buckets[this.currentBucketIndex]
        this.onRoll(currentBucket.collect())

        this.currentBucketIndex = (this.currentBucketIndex + 1) % this.bucketCount
        
        const nextBucket = this.buckets[this.currentBucketIndex]
        nextBucket.initialize(currentTime)
        return nextBucket
    }

    private flush() {
        const currentBucket = this.buckets[this.currentBucketIndex]
        this.onFlush(currentBucket.collect())
        currentBucket.recycle()
        this.currentBucketIndex = 0
    }
}

export class RollingCounterWindow extends RollingWindow<RotatingCounterBucket> {
    public cumulativeSum: CumulativeSum = new CumulativeSum()

    public initializeBuckets() {
        for (let i = 0; i < this.bucketCount; i++) {
            this.buckets.push(new RotatingCounterBucket(0))
        }
    }

    public onRoll(data: RotatingCounterBucket['data']) {
        this.cumulativeSum.addBucket(data)
    }

    public onFlush(data: RotatingCounterBucket['data']) {
        this.cumulativeSum.refreshCurrentWindow(data)
    }

    public getRollingCount(key?: Counters) {
        const bucket = this.getCurrentBucket()
        return key ? bucket[key] : bucket
    }

    public getCurrentWindowSum(key?: Counters) {
        const sum = this.cumulativeSum.currentWindowSum
        return key ? sum[key] : sum
    }

    public getCumulativeSum(key?: Counters) {
        const sum = this.cumulativeSum.cumulativeSum
        return key ? sum[key] : sum
    }
}

// @TODO this needs a histogram
export class RollingPercentileWindow extends RollingWindow<RotatingPercentileBucket> {
    public initializeBuckets() {
        for (let i = 0; i < this.bucketCount; i++) {
            this.buckets.push(new RotatingPercentileBucket(0))
        }
    }

    public onRoll(data: RotatingPercentileBucket['data']) {}
    public onFlush(data: RotatingPercentileBucket['data']) {}

    public getRollingTimings(key?: Timings) {
        const timings = this.getCurrentBucket()
        return key ? timings[key] : timings
    }
}