export enum ErrorCodes {
    TaskCancelled = 'ETASKCANCEL',
    TaskTimeout = 'ETASKTIMEOUT',
    SephamoreFull = 'ESEPHAMOREFULL'
}

export class InternalError extends Error {
    public readonly name: string
    public code: ErrorCodes
    
    constructor(message: string) {
        super(message)

        this.name = this.constructor.name
    }
}

export class TaskCancelledError extends InternalError {
    constructor(message: string = '') {
        super(`The Task was canceled ${message}`)

        this.code = ErrorCodes.TaskCancelled
    }
}

export class TaskTimeoutError extends InternalError {
    constructor(message: string) {
        super(message)
        
        this.code = ErrorCodes.TaskTimeout
    }
}

export class SemaphoreFullError extends InternalError {
    constructor(message: string) {
        super(message)

        this.code = ErrorCodes.SephamoreFull
    }
}