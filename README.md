# Resilia

**The zero-dependency, decorator-based resilience stack for TypeScript.**

**Resilia** helps you build "unbreakable" Node.js applications by wrapping your critical methods in a professional-grade resilience stack. With a single `@Resilient` decorator, you gain a **Circuit Breaker**, **Bulkhead**, and **Exponential Retry** strategy—all pre-configured and fully observable.

---

## Features

* **Decorator-First DX:** Protect any class method with one line of code.
* **Circuit Breaker:** Prevent cascading failures with a sliding-window state machine (Closed, Open, Half-Open).
* **Bulkhead:** Limit concurrency and manage overflow queues to protect system resources.
* **Smart Retries:** Automatic retries with **Exponential Backoff** and **Jitter** to prevent "thundering herd" issues.
* **Full Observability:** Event-driven architecture with built-in counters and gauges for Prometheus/Grafana integration.
* **Zero Dependencies:** Extremely lightweight and fast.

---

## Installation

```bash
npm install resilia reflect-metadata

```

Make sure you have these flags enabled in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}

```

---

## Quick Start

Simply tag your database calls or external API requests. Resilia handles the rest.

```typescript
import { Resilient } from 'resilia';

class PaymentService {
  @Resilient({
    concurrency: 5,        // Max 5 simultaneous requests
    queue: 10,             // Max 10 waiting in line
    maxRetries: 3,         // Try 3 times before failing
    errorThreshold: 0.5,   // Trip circuit if >50% fail
    sleepWindowMs: 30000   // Rest for 30s when tripped
  })
  async processTransaction(id: string) {
    return await db.payments.create({ id });
  }
}

```

---

## The Resilience Stack

Resilia executes your code through a three-layer "Matryoshka" security model:

### 1. The Circuit Breaker (Outer Layer)

Acts as a safety switch. If your service starts failing (e.g., the database is down), the circuit flips to **OPEN**.

* **Closed**: Everything is healthy.
* **Open**: Requests are "short-circuited" immediately to save resources.
* **Half-Open**: One "test" request is allowed through to check if the system recovered.

### 2. The Retry Strategy (Middle Layer)

Handles transient glitches. If a request fails, Resilia waits using **Exponential Backoff** (delaying longer each time) before trying again. It adds **Jitter** (randomness) to ensure multiple retrying services don't hit your server at the exact same millisecond.

### 3. The Bulkhead (Inner Layer)

Isolates resources. Even if one part of your app is slow, it won't crash the whole process. It limits how many copies of a specific function can run at once and provides a waiting room (queue) for the overflow.

---

## Observability & Events

Resilia is designed to be monitored. Every component is an `EventEmitter`, allowing you to hook into the system health in real-time.

```typescript
import { resilienceRegistry } from 'resilia';

resilienceRegistry.forEach(({ breaker, bulkhead }, key) => {
    // Alert when a circuit trips
    breaker.on('state:changed', (event) => {
        console.error(`🚨 ALERT: ${key} changed from ${event.from} to ${event.to}`);
    });

    // Send metrics to your dashboard
    bulkhead.on('request:rejected', () => {
        metrics.increment(`bulkhead_overflow_${key}`);
    });
});

```

### Metrics Snapshot

You can also grab a health snapshot at any time:

```typescript
const stats = bulkhead.getMetrics();
// { activeCount: 5, queueLength: 2, totalAccepted: 100, totalRejected: 1 }

```

---

## Configuration Reference

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `concurrency` | `number` | `10` | Max concurrent executions allowed for this method. |
| `queue` | `number` | `20` | Max requests that can wait if concurrency is full. |
| `maxRetries` | `number` | `3` | Number of retry attempts for transient errors. |
| `backoffMs` | `number` | `1000` | Initial delay for the exponential backoff. |
| `errorThreshold` | `number` | `0.5` | Percentage of failures (0.0 to 1.0) that trips the circuit. |
| `sleepWindowMs` | `number` | `30000` | How long the circuit stays OPEN before testing recovery. |

---

## Contributing

Contributions are welcome! If you have ideas for new resilience patterns (like Rate Limiting or Timeouts), feel free to open an issue or a PR.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with ❤️ for the Node.js community.** *Star this repo if it helped you sleep better at night!* ⭐


