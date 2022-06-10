export enum Counters {
    ExecutionSuccess,
    ExecutionFailure,
    ExecutionTimeout,
    FallbackSuccess,
    FallbackFailure,
    FallbackTimeout,
    CommandSuccess,
    CommandFailure,
    CommandTimeout,
    ShortCircuits,
    SemaphoreRejection,
    SemaphoreQueued
}

// Hardcoding values kind of sucks, probably a better option but them being consecutive is nice
// that way we don't have sparse arrays and it will making creating Fenwick Tree's easier later
export enum Timings {
    ExecutionTiming = 12,
    FallbackTiming = 13,
    CommandTiming = 14
}

export type CounterMetrics = {
    [K in Counters]: number
}

export type TimingMetrics = {
    [K in Timings]: number[]
}

export type CombinedMetrics = CounterMetrics & TimingMetrics

export interface IHistogramMetrics {
    minimum: number | null
    maximum: number | null
    average: number | null
    median: number | null
    sum: number
    count: number
    percentiles?: Record<number, number>
    stddev?: number
    variance?: number
}

export const COUNTER_KEYS: Counters[] = [
    Counters.ExecutionSuccess,
    Counters.ExecutionFailure,
    Counters.ExecutionTimeout,
    Counters.FallbackSuccess,
    Counters.FallbackFailure,
    Counters.FallbackTimeout,
    Counters.CommandSuccess,
    Counters.CommandFailure,
    Counters.CommandTimeout,
    Counters.ShortCircuits,
    Counters.SemaphoreRejection,
    Counters.SemaphoreRejection
]

export const TIMING_KEYS: Timings[] = [
    Timings.ExecutionTiming,
    Timings.FallbackTiming,
    Timings.CommandTiming
]
