export interface IBucket {
    executionTotal: number
    executionSuccess: number
    executionFailure: number
    executionTimeout: number
    executionTimings: number[]
    semaphoreRejections: number
    semaphoreQueued: number
    shortCircuits: number
    fallbackTotal: number
    fallbackSuccess: number
    fallbackFailure: number
    fallbackTimeout: number
    fallbackTimings: number[]
    commandTotal: number
    commandSuccess: number
    commandFailure: number
    commandTimings: number[]
}

export class Metrics {
    private readonly rollingWindowDuration: number
    private readonly rollingBucketCount: number
    private readonly calculateRollingPercentile: boolean
    private readonly percentiles: number[]

    private bucketRotationInterval: NodeJS.Timer
    private buckets: IBucket[]

    public constructor(options) {
        this.rollingWindowDuration = options.rollingWindowDuration
        this.rollingBucketCount = options.rollingBucketCount
        this.calculateRollingPercentile = options.calculateRollingPercentile
        this.percentiles = options.percentiles
        
        this.populateBuckets()
    }

    // @TODO Think of some ways to restrict the frequency of these calls. Few options, but need to test
    public collectHealthEventSums() {
        const { errorCount, totalCount } = this.buckets.reduce((acc, curr) => {
            acc.errorCount += curr.commandFailure
            acc.totalCount += curr.commandTotal
            return acc
        }, { errorCount: 0, totalCount: 0 })

        return {
            errorCount,
            errorPercentage: errorCount > 0 ? (errorCount / (totalCount * 100)) : 0,
            totalCount,
        }
    }

    public recordSuccess(type: string, timing?: number) {
        this.getActiveBucket()[`${type}Success`]++
        timing && this.updateTiming(type, timing)
    }

    public recordFailure(type: string, timing?: number) {
        this.getActiveBucket()[`${type}Failure`]++
        timing && this.updateTiming(type, timing)
    }

    public updateTiming(type: string, timing: number) {
        this.getActiveBucket()[`${type}Timings`].push(timing)
    }

    public increment(type: keyof IBucket) {
        this.getActiveBucket()[type]++
    }

    public getActiveBucket(): IBucket {
        return this.buckets[0]
    }

    private populateBuckets() {
        for (let i = 0; i < this.rollingBucketCount; i++) {
            this.buckets.push(this.createBucket())
        }
        this.startRotation()
    }

    private startRotation() {
        this.bucketRotationInterval = setInterval(() => {
            this.buckets.pop()
            this.buckets.unshift(this.createBucket())
        }, Math.floor(this.rollingWindowDuration / this.rollingBucketCount))
        this.bucketRotationInterval.unref()
    }

    private stopRotation() {
        clearInterval(this.bucketRotationInterval)
        this.bucketRotationInterval = null
    }

    private resetBuckets() {
        this.stopRotation()
        this.buckets = []
        this.populateBuckets()
    }

    private createBucket(): IBucket {
        return {
            executionTotal: 0,
            executionSuccess: 0,
            executionFailure: 0,
            executionTimeout: 0,
            executionTimings: [],
            semaphoreRejections: 0,
            semaphoreQueued: 0,
            shortCircuits: 0,
            fallbackTotal: 0,
            fallbackSuccess: 0,
            fallbackFailure: 0,
            fallbackTimeout: 0,
            fallbackTimings: [],
            commandTotal: 0,
            commandSuccess: 0,
            commandFailure: 0,
            commandTimings: []
        }
    }
}