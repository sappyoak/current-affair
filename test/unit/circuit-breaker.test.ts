import test from 'ava'
import { setTimeout } from 'node:timers/promises'
import { CircuitBreaker, CircuitState } from "../../src/circuit-breaker";

test('Should not allow requests when the circuit is open', t => {
    const breaker = new CircuitBreaker(10, 50, 10000)
    breaker.open()
    t.false(breaker.isAllowingRequests(0, 0))
})

test('Should transition to half open state and allow a request after a window', async t => {
    const breaker = new CircuitBreaker(0, 50, 50)
    breaker.open()
    await setTimeout(150)

    t.true(breaker.isAllowingRequests(0, 0))
    const { isPendingClose, state } = breaker.inspect()

    t.true(isPendingClose)
    t.true(state === CircuitState.HalfOpen)
})

test('Should close this circuit if rate of errors is above set threshold', t => {
    const breaker = new CircuitBreaker(0, 50, 1000)
    t.false(breaker.isAllowingRequests(10, 70))
    t.true(breaker.inspect().state === CircuitState.Open)
})

test('Should allow request to be made regardless of error threshold if less than the min number of requests are made', t => {
    const breaker = new CircuitBreaker(10, 50, 1000)
    t.true(breaker.isAllowingRequests(1, 100))
    t.true(breaker.inspect().state === CircuitState.Closed)
})

test('Should close the circuit on a success while it is half open', async t => {
    const breaker = new CircuitBreaker(0, 50, 50)
    breaker.open()
    await setTimeout(150)

    breaker.onExecuteComplete(true)
    const { isPendingClose, state } = breaker.inspect()

    t.true(breaker.isAllowingRequests(1, 10))
    t.true(state === CircuitState.Closed)
    t.false(isPendingClose)
})

test('Should open the circut on a failure when it is half open', async t => {
    const breaker = new CircuitBreaker(0, 50, 50)
    breaker.open()
    await setTimeout(150)

    breaker.onExecuteComplete(false)
    const { isPendingClose, state } = breaker.inspect()

    t.false(breaker.isAllowingRequests(1, 10))
    t.true(state === CircuitState.Open)
    t.false(isPendingClose)
})