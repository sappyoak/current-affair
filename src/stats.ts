import { IBreakerOptions } from "./options";
import { IBucket, createBucket } from './bucket'

export type StatsOptions = Pick<IBreakerOptions, 'windowLifetime' | 'sampleCount' | 'errorThreshold'>
export interface CollectedStats extends IBucket {
    averageLatency?: number
}

const percentiles = [0.0, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.995, 1]

export class Stats {
    protected rollingWindow: IBucket[] = []
    protected errorThreshold: number
    protected rotationInterval: NodeJS.Timer
    protected snapshotInterval: NodeJS.Timer

    constructor(options: StatsOptions) {
        this.errorThreshold = options.errorThreshold

        for (let i = 0; i < options.sampleCount; i++) {
            this.rollingWindow[i] = createBucket()
        }

        const rotationMS = Math.floor(options.windowLifetime / options.sampleCount)

        this.rotationInterval = setInterval(() => {
            this.rollingWindow.pop()
            this.rollingWindow.unshift(createBucket())
        }, rotationMS)

        this.snapshotInterval = setInterval(() => {
            // @TODO Handle calling snapshot event
        }, rotationMS)
    }

    public updateActiveBucket(propertyName: keyof IBucket, timing?: number) {
        const [bucket] = this.rollingWindow
        
        bucket[propertyName]++
        bucket.totalActions++

        if (timing || timing === 0) {
            bucket.latency.push(timing)    
        }
    }

    public getCurrentWindow() {
        return this.rollingWindow.slice()
    }

    public isOverThreshold() {
        const stats = this.collect()
        const errorRate = stats.failures / stats.actionAttempts * 100
        return errorRate > this.errorThreshold
    }

    public collect() {
        const collection = this.rollingWindow.reduce<CollectedStats>((prev, curr) => {
            if (!curr) return prev

            prev.actionAttempts += curr.actionAttempts
            prev.failures += curr.failures
            prev.fallbacks += curr.fallbacks
            prev.successes += curr.successes
            prev.shortCircuits += curr.shortCircuits
            prev.healthChecksPassed += curr.healthChecksPassed
            prev.healthChecksFailed += curr.healthChecksFailed
            prev.totalActions += curr.totalActions
            prev.latency.push(...(curr.latency || []))

            return prev
        }, { ...createBucket(), averageLatency: null })


        collection.latency.sort((a, b) => a - b)
        collection.averageLatency = this.calculateAverage(collection.latency) || 0

        for (const percentile of percentiles) {
            collection.percentiles[percentile] = this.getPercentileFromSortedCollection(percentile, collection.latency)
        }

        return collection
    }

    private calculateAverage(collection: number[]) {
        const sum = collection.reduce((a, b) => a + b, 0)
        return Math.round(sum / collection.length)
    }

    private getPercentileFromSortedCollection(percentile: number, collection: number[]) {
        if (percentile === 0) {
            return collection[0]
        }

        const index = Math.ceil(percentile * collection.length)
        return collection[index - 1]
    }
}

