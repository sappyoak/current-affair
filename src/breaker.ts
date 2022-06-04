// @TODO: Fix this. Can't add new top-level methods to 3rd-party modules in
//        User land code. Would rather not have a custom implementation of
//        this when one exists in node core. Will just fork and submit a PR to @types/node
//        if it isn't already in progress for v18.
// @ts-ignore
import { EventEmitterAsyncResource } from 'node:events'

import { IBreakerOptions, createBreakerOptions } from './options'

export class Breaker extends EventEmitterAsyncResource {
    readonly options: IBreakerOptions
    readonly name: string
    readonly group: string

    constructor(passedOptions: Partial<IBreakerOptions> = {}) {
        const options = createBreakerOptions(passedOptions)
        super({ captureRejections: true, name: options.name })

        this.options = options
        this.name = options.name
        this.group = options.group
    }
}