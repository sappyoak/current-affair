import { IBreakerOptions } from './options'

type FailureReason<ReturnType> = Error | ReturnType
type InvocationDuration = { duration: number }

export type InvokerResponse<ReturnType> = InvocationDuration & ({ handled: boolean, reason: FailureReason<ReturnType> } | { success: ReturnType })

export class Invoker {
    constructor(
        private readonly errorFilter: IBreakerOptions['errorFilter'] = () => false
    ) {}
    
    private startTiming() {
        const start = process.hrtime.bigint()
        return () => Number(process.hrtime.bigint() - start) / 1000000
    }

    public async invoke<T extends unknown[], U>(
        fn: (...args: T) => PromiseLike<U> | U,
        ...args: T
    ): Promise<InvokerResponse<U>> {
        const getDuration = this.startTiming()
        
        try {
            const value = await fn(...args)
            const duration = getDuration()
            return { duration, success: value }
        } catch (error) {
            return { duration: getDuration(), handled: this.errorFilter(error), reason: error }
        }
    }
}
