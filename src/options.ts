import { randomUUID } from 'node:crypto'

export interface IBreakerOptions {
    /** Whether the breaker is enabled upon construction and will start monitoring actions
     *  Default: true */
    enabled: boolean
    /** The time in milliseconds to wait before transitioning to the half-open state and 
     *  and trying the action again. Default: 30000 (30 seconds) */
    halfOpenTimeout: number
    /** The duration of the window in milliseconds that the breaker will use for sampling
     *  Default: 10000 (10 seconds) */
    windowLifetime: number
    /** The number of distinct intervals the windowLifetime should be divided into for sampling
     *  If the {windowLifetime} is 10000 and the {sampleCount} is 10, then there will be 10
     *  1000ms intervals that are sampled
     *  Default: 10 */
    sampleCount: number
    /** The percentage at which to open the circuit and start short-circuiting requests to either failing
     *  or a fallback. Default: 50 */
    errorThreshold: number
    /** A function that will be called when ever an error occurs in the circuit. When this returns
     *  true, this is recorded as an "acceptable failure" such as a 404 or 403 where these errors should
     *  not bring the breaker closer to flipping. The Default is that ALL errors will be counted
     *  Default: (error: Error) => false */
    errorFilter: (error: Error) => boolean
    /** An optional name to be provided to the breaker. This is supplied as an identifier to an AsyncResource from 
     *  'node:async_hooks' to correlate and track events as well as identifier this breaker in metrics.
     *  Default: crypto.randomUUID() */
    name?: string
    /** An optional string to be provided to the breaker to coorelate related requests together in metrics.
     *  This is useful for when you want to measure a collection of endpoints or services together.
     *  Default: IBreakerOptions.name */
    group?: string
    /** An optional function to be called in the event of an error, normally when the breaker is open to
     *  return data from a more reliable, but potentially slower source or provide an alternative response
     *  Default: null */
    fallback?: (error: Error) => unknown
}

export function createBreakerOptions(passedOptions: Partial<IBreakerOptions> = {}): IBreakerOptions {
    const options = {
        enabled: true,
        halfOpenTimeout: 30000,
        windowLifetime: 10000,
        sampleCount: 10,
        errorThreshold: 50,
        errorFilter: error => false,
        fallback: null,
        ...passedOptions
    }

    options.name = options.name ?? randomUUID()
    options.group = options.group ?? options.name

    return options
}