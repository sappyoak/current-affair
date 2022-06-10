import { randomUUID } from 'node:crypto'

export interface IConfiguration {
    /** The time in milliseconds after which a running action should time out and attempt to perform fallback logic.
     *  This will be treated as an error by the circuit as whatever service it was attempting to interact
     *  with was taking too long to respond. Provide False to actionTimeout to prevent the action from timing out
     *  Default: 2500 */
    actionTimeout?: number
    /** Whether a circuit breaker will be enabled and used to track health and short-circuit if it trips
     *  Default: true */
    enabled: boolean
    /** The name of the circuit. This is used for metrics reporting and logging internally
     *  Default: crypto.randomUUID() */
    name?: string
    /** This property is used to group circuits under a shared name. This is useful when tracking across services
     *  and endpoints. Default: IConfiguration.name */
    group?: string
    /** An Optional Function that will be called whenever an error happens during the execution of an action. 
     *  This is called before any reporting is done by the circuit as an opportunity to determine whether this is
     *  a true failure or not. For instance, it might be incorrect to trip the breaker in the case of a 404 or 403
     *  status code. If a truthy value is returned from the function the circuit will treat this as a successful response
     *  and will not update any metrics related to failures 
     *  default: (error: Error) => false */
    errorFilter?: (error: Error) => boolean
    /** The minimum number of actions in a rolling window that will trip the circuit. For example, if this is 
     *  set to 15 and 14 actions are executed in the rolling window the circuit will not trip even if all 14 actions
     *  failed miserably. 
     *  Default: 10 */
    actionVolumeThreshold?: number
    /** The amount of time in milliseconds after tripping to reject requests before checking to see if we can close the circuit and
     *  start executing actions as normal
     *  Default: 10000 (10 seconds) */
    sleepWindow?: number
    /** The percentage at or above which the breaker should trip and start short-circuiting requests to the fallback
     *  logic. This can be used in tandem with actionVolumeThreshold where this threshold will take effect as soon
     *  as the minimum volumeThreshold is met
     *  Default: 50 */
    errorThresholdPercentage?: number
    /** The duration in milliseconds of the statistical rolling window. This is how long metrics are internally
     *  kept for the circuit to use. After this time period metrics are reset and the circuit has a clean slate
     *  (cumulative totals and metrics will be kept around longer, but they will not be used by the circuit).
     *  Default: 30000 (30 seconds) */
    rollingWindowDuration?: number
    /** This property sets the number of buckets the statical rolling window is divided into. Each bucket is a 
     *  span of time that will contain results about the state of the circuit and actions during that span. This 
     *  *MUST* evenly divide rollingWindowDuration (rollingWindowDuration % rollingBucketCount === 0) otherwise
     *  it will raise an exception. 
     *  Default: 10 */
    rollingBucketCount?: number
    /** This property indicates whether summary statistics such as latency should be tracked and calculated as
     *  percentiles. If this is false, all summary statistics are returned as -1
     *  Default: true */
    calculateRollingPercentile?: boolean
    /** This defines the percentiles that should be calculated and returned in metrics.
     *  Default: [0, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.995, 1] */
    percentiles?: number[]
    /** This property is the same as rollingWindowDuration but applies specifically to the rollingPercentile because
     *  sometimes you want that sample window to be a different length than the one used for determining failures.
     *  Default: rollingWindowDuration */
    rollingPercentileWindowDuration?: number
    /** This property is the same as rollingBucketCount but applies specifically to the rollingPercentile because 
     *  sometimes you want a different about of sample sets than the ones used for determining failures.
     *  Default: rollingBucketCount */
    rollingPercentileBucketCount?: number
    /** This property set the time to wait in milliseconds between allowing metric/health snapshots to be taken
     *  and published. For high-volume circuits this continual calculation can become CPU intensive, so this property
     *  allows you to control that frequency.
     *  Default: 1000 */
    snapshotInterval?: number
    /** The max number of concurrent actions that can be active at one time in a circuit. Once this threshold is met
     *  the action will be queued and ran when there are available locks.
     *  Default: 10 */
    maxActionConcurrency?: number
    /** The max number of actions to queue up when the concurrency limit has been reached. If this threshold is hit
     *  all additional requests will fail as if the circuit were in an open state
     *  default: 50 */
    maxActionQueueSize?: number
    /** When set to true, this will allow an action to be retried and will only report failure once a provided limit 
     *  has been reached. If a function is provided it will receive the error thrown by the action and should return a boolean
     *  for whether it is okay to retry or not
     *  Default: false */
    allowRetries?: boolean | ((error: Error) => boolean)
    /** The maximum number of retries allowed for an action. Default: 5 */
    maxRetries?: number
    /** Either a number or a function used to calculate the delay between retries. If a function it will receive the current
     *  retry attempt. Default: ExponentionalBackoff */
    delay?: number | ((attempts: number) => number)
    /** A function to be called when an error is throw in a circuit, or the circuit is open that should provide a fallback
     *  response in place of the original action. This might be pulling data from another source, a message to a user, etc. This
     *  function takes in the error that was throw with some meta information */
    fallback?: (error: Error) => unknown
    /** The time in milliseconds before the fallback function should timeout and throw an error. This defaults to IConfiguration.actionTimeout
     *  unless one is specifically provided. If False is passed the fallback will never timeout */
    fallbackTimeout?: number
    /** An optional function to be called periodically to determine the health of an endpoint outside of the reported metrics.
     *  This might be a ping or request to a monitor, etc. If this function fails or returns false then the circuit will be forced open. */
    healthCheck?: () => Promise<boolean>
    /** The interval at which to call the health check function */
    healthCheckInterval?: number
}

export function createConfiguration(passedOptions: Partial<IConfiguration> = {}) {
    const config = {
        enabled: true,
        errorFilter: (error: Error) => false,
        actionTimeout: 2500,
        actionVolumeThreshold: 10,
        maxActionConcurrency: 10,
        maxActionQueueSize: 50,
        sleepWindow: 10000,
        errorThresholdPercentage: 50,
        rollingWindowDuration: 30000,
        rollingBucketCount: 10,
        calculateRollingPercentile: true,
        percentiles: [0.0, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.995, 1],
        snapshotInterval: 1000,
        allowRetries: false,
        healthCheckInterval: 5000,
        ...passedOptions
    }

    if (!config.actionTimeout || config.actionTimeout === 0) {
        config.actionTimeout = Number.POSITIVE_INFINITY
    }
    
    config.name = config.name ?? randomUUID()
    config.group = config.group ?? config.name

    config.rollingPercentileWindowDuration = config.rollingPercentileWindowDuration ?? config.rollingWindowDuration
    config.rollingPercentileBucketCount = config.rollingPercentileBucketCount ?? config.rollingBucketCount
    
    return config
}