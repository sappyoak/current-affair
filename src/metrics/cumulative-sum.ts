import { COUNTER_KEYS } from "./metric-types";

export interface ICumulativeSum {
    cumulativeSum: number[]
    currentWindowSum: number[]
    addBucket(bucket: number[]): void
    refreshCurrentWindow(bucket: number[]): void
}

export class CumulativeSum implements ICumulativeSum {
    public cumulativeSum: number[] = new Array(COUNTER_KEYS.length).fill(0)
    public currentWindowSum: number[] = new Array(COUNTER_KEYS.length).fill(0)

    public addBucket(bucket: number[]) {
        for (let i = 0; i < bucket.length; i++) {
            this.currentWindowSum[i] += bucket[i]
        }
    }

    public refreshCurrentWindow(bucket: number[]) {
        for (let i = 0; i < COUNTER_KEYS.length; i++) {
            this.cumulativeSum[i] += (this.cumulativeSum[i] + bucket[i])
            this.currentWindowSum[i] = 0
        }
    }
}