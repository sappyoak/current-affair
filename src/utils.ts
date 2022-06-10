import { TaskCancelledError, TaskTimeoutError } from "./errors"

export function createTimer() {
    const startTime = process.hrtime.bigint()
    return () => Number(process.hrtime.bigint() - startTime) / 1000000
}

export function createChildAbortController(signal?: globalThis.AbortSignal) {
    const controller = new AbortController()

    if (!signal) {
        return controller
    }

    if (signal.aborted) {
        controller.abort(signal.reason)
        return controller
    }

    signal.addEventListener('abort', () => {
        controller.abort(signal.reason)
    }, { once: true })

    return controller
}

export async function handlePromiseTimeout(promiseFn, timeout: number, controller: globalThis.AbortController) {
    if (controller.signal.aborted) {
        throw new TaskCancelledError()
    }

    if (timeout === Number.POSITIVE_INFINITY) {
        return await promiseFn()
    }

    const timer = setTimeout(() => {
        controller.abort('TIMEOUT')
        throw new TaskTimeoutError(`Task timed out after ${timeout}ms`)
    }, timeout)

    try {
        return await promiseFn()
    } finally {
        clearTimeout(timer)
    }
}