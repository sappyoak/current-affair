import { CounterMetrics, TimingMetrics, COUNTER_KEYS, TIMING_KEYS } from "./metric-types"

export interface IRotatingBucket<T, U> {
    startedAt: number
    data: U
    initialize(startTime: number): void
    collect(): U
    update<K extends keyof T>(key: K, value?: number): void
    recycle(): void
}

export abstract class RotatingBucket<T, U> implements IRotatingBucket<T, U> {
    public startedAt: number
    public data: U

    public constructor(startTime: number) {
        this.initialize(startTime)
    }
    
    abstract initialize(startTime: number): void
    abstract update<K extends keyof T>(key: K, value?: number)

    public collect() {
        return this.data
    }

    public recycle() {
        this.initialize(0)
    }
}

export class RotatingCounterBucket extends RotatingBucket<CounterMetrics, number[]> {
    public initialize(startTime: number) {
        this.startedAt = startTime
        this.data = new Array(COUNTER_KEYS.length).fill(0)
    }

    public update(key: keyof CounterMetrics) {
        this.data[key]++
    }
}

export class RotatingPercentileBucket extends RotatingBucket<TimingMetrics, number[][]> {
    public initialize(startTime: number) {
        this.startedAt = startTime
        this.data = new Array(TIMING_KEYS.length).fill([])
    }

    public update(key: keyof TimingMetrics, value: number) {
        this.data[key].push(value)
    }
}