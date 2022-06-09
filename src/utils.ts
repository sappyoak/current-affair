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
