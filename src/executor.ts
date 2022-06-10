import { TaskCancelledError } from "./errors"
import { handlePromiseTimeout } from "./utils"

export class Executor {
    public constructor(
        private readonly actionTimeout: number,
        private readonly errorFilter: (error: Error) => boolean
    ) {}

    public async execute(fn, controller: globalThis.AbortController) {
        if (controller.signal.aborted) {
            throw new TaskCancelledError()
        }
        
        return await handlePromiseTimeout(() => this._execute(fn, controller.signal), this.actionTimeout, controller)
    }

    private async _execute(fn, signal) {
        if (signal.aborted) {
            throw new TaskCancelledError()
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