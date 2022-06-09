declare global {
    interface AbortSignal {
        reason: any
    }
    interface AbortController {
        abort(reason?: any): AbortSignal
    }
}

export {}