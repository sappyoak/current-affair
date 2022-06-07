export enum ErrorCodes {
    CircuitBroken = 'ECIRCUITBROKEN',
    DetachedBreaker = 'EBREAKERDETACH'
}

export class InternalError extends Error {
    public readonly name: string
    public code: ErrorCodes
    
    constructor(message: string) {
        super(message)

        this.name = this.constructor.name
    }
}

export class CircuitBrokenError extends InternalError {
    constructor(message: string = '') {
        super(`Execution halted because the circuit breaker is open ${message}`)

        this.code = ErrorCodes.CircuitBroken
    }
}

export class DetachedBreakerError extends InternalError {
    constructor(message: string = '') {
        super(`Execution halted because the circuit breaker is detached. ${message}`)
        
        this.code = ErrorCodes.DetachedBreaker
    }
}