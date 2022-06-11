import test from 'ava'

import { ErrorCodes, TaskCancelledError, SemaphoreFullError, Semaphore } from '../../src'

function createAbortablePromise(signal, time) {
    return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
            reject()
        }, { once: true })

        setTimeout(() => {
            resolve(true)
        }, time).unref()
    })
}

test('Should Throw a cancellation error when it receives a task that is cancelled', async t => {
    const semaphore = new Semaphore(2, 2)
    const controller = new AbortController()
    controller.abort()

    await t.throwsAsync(semaphore.runOrSchedule(() => {}, controller), {
        instanceOf: TaskCancelledError,
        code: ErrorCodes.TaskCancelled
    })
})

test('Should Add tasks to a queue when the semaphore is at capacity', t => {
    const semaphore = new Semaphore(1, 2)
    const controller = new AbortController()

    try {
        semaphore.runOrSchedule(createAbortablePromise(controller.signal, 10000), controller)
        semaphore.runOrSchedule(createAbortablePromise(controller.signal, 10000), controller)
    } catch (error) {}

    t.true(semaphore.availableLocks === 0)
    t.true(semaphore.availableQueueSlots === 1)
    controller.abort()
})

test('Should throw an error when the semaphore is at capacity and queue is full', async t => {
    const semaphore = new Semaphore(1, 1)
    const controller = new AbortController()

    try {
        semaphore.runOrSchedule(createAbortablePromise(controller.signal, 10000), controller)
        semaphore.runOrSchedule(createAbortablePromise(controller.signal, 10000), controller)
        await t.throwsAsync(semaphore.runOrSchedule(createAbortablePromise(controller.signal, 10000), controller), {
            instanceOf: SemaphoreFullError,
            code: ErrorCodes.SephamoreFull
        })
    } catch (error) {}
})

test('Should Dequeue an item once it finishes', async t => {
    const semaphore = new Semaphore(1, 1)
    const controller = new AbortController()
    
    const promise = semaphore.runOrSchedule(createAbortablePromise(controller.signal, 2000), controller)
    t.true(semaphore.availableLocks === 0)

    await promise.catch(() => {})
    t.true(semaphore.availableLocks === 1)
})