import { BulkHead } from "./libs/BulkHead";
import { CircuitBreaker } from "./libs/CircuitBreaker";
import { withRetry } from "./utils/retry";

const resilienceRegistry = new Map<string, {
	breaker: CircuitBreaker,
	bulkhead: BulkHead
}>


export function Resilient(config: {
	concurrencyLimit: number,
	queueLimit: number,
	errorThreshold: number,
	sleepWindowMs: number,
	maxRetries: number,
	baseDelayMs: number;
	capDelayMs: number;
}) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value

		descriptor.value = async function (...args: any[]) {
			const key = `${target.constructor.name}:${propertyKey}`


			if (!resilienceRegistry.has(key)) {
				resilienceRegistry.set(key, {
					breaker: new CircuitBreaker(config.errorThreshold, config.sleepWindowMs),
					bulkhead: new BulkHead(config.concurrencyLimit, config.queueLimit
					)
				})
				console.log(`Resilience layer initialized for ${key}`);
			}

			const { breaker, bulkhead } = resilienceRegistry.get(key)!

			return await breaker.execute(() =>
				withRetry(() =>
					bulkhead.run(() =>
						originalMethod.apply(this, args)),
					{
						baseDelayMs: config.baseDelayMs,
						capDelayMs: config.capDelayMs,
						maxRetries: config.maxRetries
					}))
		}

		return descriptor;
	}
}
