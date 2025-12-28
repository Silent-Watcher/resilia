import { Resilient } from "../src";


// A Mock Database that is intentionally unreliable
class MockDatabase {
	public callCount = 0;

	async query(shouldFail: boolean, delay: number = 50) {
		this.callCount++;
		await new Promise(res => setTimeout(res, delay));
		if (shouldFail) {
			throw new Error("Database Connection Timeout!");
		}
		return "Data Success";
	}
}

// The Service using your package
class UserService {
	private db = new MockDatabase();

	@Resilient({
		concurrencyLimit: 2,
		queueLimit: 2,
		maxRetries: 2,
		errorThreshold: 0.5,
		sleepWindowMs: 2000,
		baseDelayMs: 100,
		capDelayMs: 1000
	})
	async getUserData(fail: boolean) {
		return await this.db.query(fail);
	}

	getCallCount() { return this.db.callCount; }
}

async function runVerification() {
	const service = new UserService();
	console.log("Starting Resilia Verification...\n");

	// TEST 1: Verify Success and Concurrency
	console.log("--- Test 1: Successful Parallel Requests ---");
	const results = await Promise.all([
		service.getUserData(false),
		service.getUserData(false)
	]);
	console.log("Results:", results);
	console.log("Total DB Calls:", service.getCallCount()); // Should be 2

	// TEST 2: Verify Retry Logic
	console.log("\n--- Test 2: Triggering Retries ---");
	try {
		// This will fail 1 time + 2 retries = 3 calls
		await service.getUserData(true);
	} catch (e) {
		console.log("Caught expected error after retries.");
	}
	console.log("Total DB Calls (should be 5):", service.getCallCount());

	// TEST 3: Verify Circuit Breaker Tripping
	console.log("\n--- Test 3: Tripping the Circuit ---");
	// We need to push failure rate above 50%
	for (let i = 0; i < 3; i++) {
		try { await service.getUserData(true); } catch { }
	}

	try {
		console.log("Attempting call while circuit should be OPEN...");
		await service.getUserData(false);
	} catch (e: any) {
		if (e.message.includes("OPEN")) {
			console.log("Circuit Breaker working: Blocked request while OPEN.");
		}
	}

	// TEST 4: Verify Recovery (Half-Open)
	console.log("\n--- Test 4: Testing Recovery (Waiting for Sleep Window) ---");
	await new Promise(res => setTimeout(res, 2500)); // Wait for sleepWindowMs

	const recoveryResult = await service.getUserData(false);
	console.log("Recovery Result:", recoveryResult);
	console.log("Circuit is back to CLOSED");
}

runVerification().catch(console.error);
