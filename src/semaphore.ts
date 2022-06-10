import { TaskCancelledError, SemaphoreFullError } from './errors'

interface QueueItem<T> {
    controller: globalThis.AbortController,
    fn,
    resolve(value: T): void
    reject(error: Error): void
}

export class Semaphore {
    private active: number = 0
    private queue: QueueItem<unknown>[] = []

    public constructor(
        private readonly maxActionConcurrency: number,
        private readonly maxActionQueueSize: number
    ) {}

    public get availableLocks() {
        return this.maxActionConcurrency - this.active
    }

    public get availableQueueSlots() {
        return this.queue.length - this.maxActionQueueSize
    }

    public async runOrSchedule(fn, controller: globalThis.AbortController) {
        // Short-circuit if action has already been canceled
        if (controller.signal.aborted) {
            throw new TaskCancelledError()
        }
        
        if (this.active < this.maxActionConcurrency) {
            this.active++
            try {
                return await fn(controller)
            } finally {
                this.active--
                this.dequeue()
            }
        }

        if (this.queue.length < this.maxActionQueueSize) {
            return this.schedule(fn, controller)
        }

        throw new SemaphoreFullError(`The semaphore is at capacity and queue is full. ${this.maxActionConcurrency} active requests and ${this.maxActionQueueSize} queued items`)
    }

    private dequeue() {
        const item = this.queue.shift()
        if (!item) {
            return
        }

        Promise.resolve()
            .then(() => this.runOrSchedule(item.fn, item.controller))
            .then(item.resolve)
            .catch(item.reject)
    }

    private schedule(fn, controller) {
        let resolve: (value) => void
        let reject: (error: Error) => void

        const promise = new Promise((res, rej) => {
            resolve = res
            reject = rej
        })

        this.queue.push({ controller, fn, resolve, reject })
        return promise
    }
}