export interface IBucket {
    actionAttempts: number
    failures: number
    fallbacks: number
    successes: number
    shortCircuits: number
    healthChecksPassed: number
    healthChecksFailed: number
    totalActions: number
    percentiles: Record<number, number>
    latency: number[]
}

export function createBucket(): IBucket {
    return {
        actionAttempts: 0,
        failures: 0,
        fallbacks: 0,
        successes: 0,
        shortCircuits: 0,
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        totalActions: 0,
        percentiles: {},
        latency: []
    }
}