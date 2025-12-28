export async function withRetry<T>(operation: () => Promise<T>, opts: {
    maxRetries: number;
    baseDelayMs: number;
    capDelayMs: number;
}) {

    const { baseDelayMs, capDelayMs, maxRetries } = opts

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {

            if (attempt > maxRetries) {
                throw error;
            }

            const maxSleep = Math.min(capDelayMs, baseDelayMs * Math.pow(2, attempt))

            const sleepTime = Math.random() * maxSleep

            console.log(`Attempt ${attempt + 1} failed. Retrying in ${sleepTime.toFixed(0)}ms...`);
            await new Promise(resolve => setTimeout(resolve, sleepTime));

        }
    }

    throw new Error('Retry logic failed to return')

}


