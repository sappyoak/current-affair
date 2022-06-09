import { TaskCancelledError, TaskTimeoutError } from "./errors"

export class Executor {
    public constructor(
        private readonly actionTimeout: number,
        private readonly errorFilter: (error: Error) => boolean
    ) {}

    public async execute(fn, controller: globalThis.AbortController) {
        if (controller.signal.aborted) {
            return { handled: true, success: false, value: new TaskCancelledError() }
        }
        
        if (this.actionTimeout === Number.POSITIVE_INFINITY) {
            return this._execute(fn, controller.signal)
        }

        const timer = setTimeout(() => controller.abort('TIMEOUT'), this.actionTimeout)
        
        try {
            let result = await this._execute(fn, controller.signal)            
            if (controller.signal.aborted && controller.signal?.reason === 'TIMEOUT') {
                result = { handled: false, success: false, value: new TaskTimeoutError(`Task timed out after ${this.actionTimeout}ms`)}
            }
            return result
        } finally {
            clearTimeout(timer)
        }
    }

    private async _execute(fn, signal) {
        // The operation was manually aborted. This should not count as a failure
        if (signal.aborted) {
            return { handled: true, success: false, value: new TaskCancelledError() }
        }

        try {
            const result = await fn()
            return { success: true, value: result }
        } catch (error) {
            const handled = this.errorFilter(error)
            return { handled, success: false, value: error }
        }
    }
}