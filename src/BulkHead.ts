import EventEmitter from "node:events";

export class BulkHead extends EventEmitter {

    private queue: Array<() => void> = [];
    private concurrencyLimit: number;
    private activeCount: number = 0;
    private queueLimit: number;

    private totalAccepted = 0;
    private totalRejected = 0;

    constructor(concurrencyLimit: number, queueLimit: number = 1000) {
        super()
        this.concurrencyLimit = concurrencyLimit;
        this.queueLimit = queueLimit;
    }


    public async run<T>(task: () => Promise<T>, waitTimeoutMs = 5000): Promise<T> {

        const waitTime = performance.now();

        // If we've reached the limit, we must wait
        if (this.activeCount >= this.concurrencyLimit) {

            // Check if the line is already too long
            if (this.queue.length >= this.queueLimit) {

                this.totalRejected++;
                this.emit('request:rejected', {
                    reason: 'Queue Full',
                    totalRejected: this.totalRejected
                });
                throw new Error("Bulkhead capacity exceeded: Server Busy");
            }

            await new Promise<T | void>((resolve, reject) => {

                const timeoutId = setTimeout(() => {

                    this.totalRejected++;
                    this.emit('request:timeout', {
                        reason: 'Timeout',
                        totalRejected: this.totalRejected
                    });


                    this.queue = this.queue.filter(task => task !== wrappedResolve);
                    reject(new Error("Bulkhead timeout"));

                }, waitTimeoutMs);

                const wrappedResolve = () => {
                    const waitDuration = performance.now() - waitTime;
                    console.log(`Queue wait time: ${waitDuration.toFixed(2)}ms`);
                    clearTimeout(timeoutId);
                    resolve();
                }

                this.queue.push(wrappedResolve);

                this.emit('request:queued', {
                    queueLength: this.queue.length + 1
                })
            });
        }

        const executionTime = performance.now();
        this.activeCount++;
        this.totalAccepted++;

        this.emit('request:accepted', {
            activeCount: this.activeCount
        });

        try {
            return await task(); // Execute the actual database work
        } finally {
            const executionDuration = performance.now() - executionTime;
            console.log(`Execution time: ${executionDuration.toFixed(2)}ms`);
            // What happens when the work is done?
            this.activeCount--;

            this.emit('request:completed', {
                activeCount: this.activeCount
            });

            if (this.queue.length > 0) {
                const nextInLine = this.queue.shift();
                if (nextInLine) {
                    nextInLine(); // Allow the next task to proceed
                }
            }
        }
    }


    public stats() {
        return {
            activeCount: this.activeCount,
            queueLength: this.queue.length,
            concurrencyLimit: this.concurrencyLimit,
            queueLimit: this.queueLimit,
            totalAccepted: this.totalAccepted,
            totalRejected: this.totalRejected
        }
    }
}
