export enum CircuitState {
    Closed,
    Open,
    HalfOpen
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.Closed
    private lastOpenedAt: number
    private isPendingClose: boolean

    public constructor(
        private actionVolumeThreshold: number,
        private errorThresholdPercentage: number,
        private sleepWindow: number
    ) {}
    
    public inspect() {
        return {
            lastOpened: this.lastOpenedAt,
            isPendingClose: this.isPendingClose,
            state: this.state,
        }
    }
    
    public isAllowingRequests(commandCount: number, errorPercentage: number) {
        if (this.state === CircuitState.Open) {
            if (Date.now() - this.lastOpenedAt > this.sleepWindow) {
                this.state = CircuitState.HalfOpen
                // this.state can be updated and changed by the time this execution resolves, so we additionally
                // set this instance property that won't be modified so we can know to close/open on the next
                // success or failure
                this.isPendingClose = true
                return true
            }
            return false
        }

        if (commandCount < this.actionVolumeThreshold) {
            return true
        }

        if (errorPercentage > this.errorThresholdPercentage) {
            this.state = CircuitState.Open
            this.lastOpenedAt = Date.now()
            return false
        }

        return this.state === CircuitState.Closed
    }

    public onExecuteComplete(success: boolean) {
        if (this.isPendingClose) {
            (success ? this.close() : this.open())
            this.isPendingClose = false
        }
    }

    public open() {
        this.state = CircuitState.Open
        this.lastOpenedAt = Date.now()
    }

    public close() {
        this.state = CircuitState.Closed
    }
}