import { EventEmitter } from 'node:events'

import { IBreakerOptions, createBreakerOptions } from './options'
import { Invoker, InvokerResponse } from './invoker'
import { Stats } from './stats'

export enum BreakerStates {
    /** Normal Operation. Actions Execute normally */
    Closed,
    /** The Circuit is open, actions will fail when executed */
    Open,
    /** We are in a healing state after the designated {halfOpenTimeout}. Execution of one action
     *  is permitted to determine whether the breaker should transition to a closed (successful) or
     *  back to open open (failed) state */
    HalfOpen,
    /** The Breaker is removed from the success/failure context and is manually held in an open state
     *  where all actions will fail */
    Detached
}

export class Breaker extends EventEmitter{
    readonly options: IBreakerOptions
    readonly name: string
    readonly group: string

    protected enabled: boolean
    protected lastOpenedAt: number
    protected healthCheckInterval: NodeJS.Timer
    protected pendingHalfOpenPromise
    protected invoker: Invoker
    protected stats: Stats
    protected state: number = BreakerStates.Closed
    
    constructor(passedOptions: Partial<IBreakerOptions> = {}) {
        super({ captureRejections: true })

        const options = createBreakerOptions(passedOptions)
        this.options = options
        this.name = options.name
        this.group = options.group
        this.enabled = options.enabled

        this.invoker = new Invoker(options.errorFilter)
        this.stats = new Stats(options)

        this.setupHealthCheck()
    }

    public open(reason?: unknown): void {
        if (this.state === BreakerStates.Detached || this.state === BreakerStates.Open) {
            return
        }

        this.state = BreakerStates.Open
        this.lastOpenedAt = Date.now()
        this.stats.updateActiveBucket('shortCircuits')
        this.emit('open', { reason })
    }   

    public close(): void {
        if (this.state === BreakerStates.Closed || this.state === BreakerStates.Detached) {
            return
        }

        this.state = BreakerStates.Closed
        this.emit('close')
    }

    public detach(): { attach: () => void } {
        this.state = BreakerStates.Detached
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval)
        }
        
        this.emit('detached')

        let attached = false
        return {
            attach: () => {
                if (attached) return
                attached = true

                if (this.state === BreakerStates.Detached) {
                    this.state = BreakerStates.Closed
                    this.setupHealthCheck()
                    this.emit('attached')
                }
            }
        }
    }

    public async execute<T>(
        fn: (...args: unknown[]) => PromiseLike<T> | T
    ): Promise<T> {
        if (this.state !== BreakerStates.Detached) {
            this.stats.updateActiveBucket('actionAttempts')
        }

        switch (this.state) {
            case BreakerStates.Closed: {
                const result = await this.invoker.invoke(fn)
                if ('success' in result) {
                    this.stats.updateActiveBucket('successes', result.duration)
                } else {
                    // @TODO: Handle Fallback
                    this.stats.updateActiveBucket('failures', result.duration)
                    if (this.stats.isOverThreshold()) {
                        this.open()
                    }

                }

                return this.unwrapResponse(result)
            }

            case BreakerStates.HalfOpen: {
                await this.pendingHalfOpenPromise.catch(() => undefined)
                return this.execute(fn)
            }

            case BreakerStates.Open: {
                if (Date.now() - this.lastOpenedAt < this.options.halfOpenTimeout) {
                    this.stats.updateActiveBucket('shortCircuits')
                    throw new Error(`The Circuit is open`)
                }

                // Otherwise it is safe for us to move into the half open state
                this.pendingHalfOpenPromise = this.halfOpen(fn)
                this.state = BreakerStates.HalfOpen
                return this.pendingHalfOpenPromise
            }

            case BreakerStates.Detached: {
                throw new Error(`The Breaker is currently detached. Will Fail until reattached`)
            }

            default: {
                throw new Error(`Unexpected state value: ${this.state}`)
            }
        }
    }

    private async halfOpen<T>(
        fn: (...args: unknown[]) => PromiseLike<T> | T
    ): Promise<T> {
        try {
            const result = await this.invoker.invoke(fn)
            
            if ('success' in result) {
                this.stats.updateActiveBucket('successes', result.duration)
                this.close()
            } else {
                this.stats.updateActiveBucket('failures', result.duration)
                this.open(result?.reason)
            }

            return this.unwrapResponse(result)
        } catch (error) {
            // This is an error, but it realistically shouldn't be one we are meant to retry.
            // Consider this "successful" for now and revisit
            this.close()
            throw error
        }
    }

    private unwrapResponse<T>(response: InvokerResponse<T>) {
        if ('reason' in response) {
            throw response.reason
        }

        return response.success
    }

    private setupHealthCheck() {
        if (!this.options.healthCheck) {
            return
        }

        if (typeof this.options.healthCheck !== 'function') {
            throw new TypeError(`options.healthCheck needs to be a function. Received ${typeof this.options.healthCheck}`)
        }
        
        const runCheck = async () => {
            try {
                await this.options.healthCheck.apply(this)
                this.stats.updateActiveBucket('healthChecksPassed')
            } catch (error) {
                this.open()
                this.stats.updateActiveBucket('healthChecksFailed')
            }
        }

        this.healthCheckInterval = setInterval(runCheck, this.options.healthCheckInterval)
    }
}