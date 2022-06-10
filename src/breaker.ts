import { IBreakerOptions, createBreakerOptions } from './config'

export class Breaker {
    readonly options: IBreakerOptions
    readonly name: string
    readonly group: string

    protected enabled: boolean
    protected healthCheckInterval: NodeJS.Timer
    protected halfOpenPromise: Promise<any>

    constructor(passedOptions: Partial<IBreakerOptions> = {}) {
        const options = createBreakerOptions(passedOptions)

        this.options = options
        this.name = options.name
        this.group = options.group
        this.enabled = options.enabled
    }
}