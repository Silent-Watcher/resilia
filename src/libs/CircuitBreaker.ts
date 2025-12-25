import EventEmitter from "node:events";

enum CircuitState {
    Open,
    Closed,
    HalfOpen
}

interface HealthBucket {
    successes: number;
    failures: number;
    timestamp: number; // To know when this bucket expires
}


export class CircuitBreaker extends EventEmitter {
    private state: CircuitState = CircuitState.Closed
    private buckets: HealthBucket[] = []


    constructor(
        private threshold: number = 0.5, // 50% failure rate
        private sleepWindowMs: number = 30000, // 30s to stay Open
        private minRequests: number = 10,
        private lastTripTime: number = 0
    ) {
        super();
    }


    public async execute<T>(task: () => Promise<T>): Promise<T> {
        this.updateState();

        if (this.state === CircuitState.Open) {
            throw new Error("Circuit is OPEN: Request rejected to protect the system.");
        }

        try {
            const result = await task();
            this.record(true);
            return result;
        } catch (error) {
            this.record(false);
            throw error;
        }
    }

    public record(success: boolean) {
        const bucket = this.getActiveBucket();

        if (this.state === CircuitState.HalfOpen) {
            if (success) {
                this.state = CircuitState.Closed;
                this.buckets = [];
                console.log("Circuit is CLOSED System recovered!");
            } else {
                this.state = CircuitState.Open;
                this.lastTripTime = Date.now(); // Reset the clock for a new rest period
                console.warn("Test failed. Circuit back to OPEN.");
            }
            this.emit('state:changed', {
                from: CircuitState.HalfOpen,
                to: CircuitState[this.state],
                timestamp: Date.now()
            })
            return;
        }

        if (success) {
            bucket.successes++;
        } else {
            bucket.failures++
        }

        this.checkThreshold();
    }

    // to check if the request is allowed
    public isOpen(): boolean {
        return this.state === CircuitState.Open;
    }

    private getActiveBucket(): HealthBucket {
        const now = Date.now();

        const bucketDurationMs = 1000;

        const lastBucket = this.buckets[this.buckets.length - 1];

        if (lastBucket && now < lastBucket.timestamp + bucketDurationMs) {
            return lastBucket;
        }

        const newBucket: HealthBucket = { failures: 0, successes: 0, timestamp: now }
        this.buckets.push(newBucket);

        const windowSizeMs = 30000;
        this.buckets = this.buckets.filter(b => now - windowSizeMs < b.timestamp)

        return newBucket

    }

    private checkThreshold() {
        if (this.state !== CircuitState.Closed) return;

        const totals = this.buckets.reduce((acc, b) => ({

            s: acc.s + b.successes,
            f: acc.f + b.failures

        }), { s: 0, f: 0 })

        const totalRequest = totals.s + totals.f;

        if (totalRequest > this.minRequests) {
            const errorRate = totals.f / totalRequest
            if (errorRate > this.threshold) {
                this.trip();
            }
        }
    }

    private trip() {
        const oldState = this.state;
        this.state = CircuitState.Open;
        this.lastTripTime = Date.now();
        console.warn("Circuit Breaker TRIP! State is now OPEN.");
        this.emit('state:changed', {
            from: oldState,
            to: CircuitState.Open,
            timestamp: Date.now()
        })
    }

    private updateState() {
        const oldState = this.state;
        if (this.state === CircuitState.Open && Date.now() - this.lastTripTime > this.sleepWindowMs) {
            this.state = CircuitState.HalfOpen
            console.log("Circuit is HALF-OPEN. Testing the waters...");
            this.emit('state:changed', {
                from: oldState,
                to: CircuitState.HalfOpen,
                timestamp: Date.now()
            })
        }

    }
}
