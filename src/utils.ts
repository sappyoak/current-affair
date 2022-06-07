export function createTimer() {
    const startTime = process.hrtime.bigint()
    return () => Number(process.hrtime.bigint() - startTime) / 1000000
}

