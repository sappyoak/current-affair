// @TODO: Fix this. Can't add new top-level methods to 3rd-party modules in
//        User land code. Would rather not have a custom implementation of
//        this when one exists in node core. Will just fork and submit a PR to @types/node
//        if it isn't already in progress for v18.
// @ts-ignore
import { EventEmitterAsyncResource } from 'node:events'

import { IBreakerOptions, createBreakerOptions } from './options'

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

export class Breaker extends EventEmitterAsyncResource {
    readonly options: IBreakerOptions
    readonly name: string
    readonly group: string

    protected enabled: boolean
    protected lastOpenedAt: number
    protected healthCheckInterval: NodeJS.Timer
    protected state: number = BreakerStates.Closed

    constructor(passedOptions: Partial<IBreakerOptions> = {}) {
        const options = createBreakerOptions(passedOptions)
        super({ captureRejections: true, name: options.name })

        this.options = options
        this.name = options.name
        this.group = options.group
        this.enabled = options.enabled

        this.setupHealthCheck()
    }

    public open(): void {
        if (this.state === BreakerStates.Detached || this.state === BreakerStates.Open) {
            return
        }

        this.state = BreakerStates.Open
        this.lastOpenedAt = Date.now()
    }   

    public close(): void {
        if (this.state === BreakerStates.Closed || this.state === BreakerStates.Detached) {
            return
        }

        this.state = BreakerStates.Closed
    }

    public detach(): { attach: () => void } {
        this.state = BreakerStates.Detached
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval)
        }

        let attached = false
        return {
            attach: () => {
                if (attached) return
                attached = true

                if (this.state === BreakerStates.Detached) {
                    this.state = BreakerStates.Closed
                    this.setupHealthCheck()
                }
            }
        }
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
            } catch (error) {
                this.open()
            }
        }

        this.healthCheckInterval = setInterval(runCheck, this.options.healthCheckInterval)
    }
}