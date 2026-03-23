# 🛡️ FluentGuard

**An Isomorphic, Declarative Guard Boundary for Access Control**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Stop scattering `if` checks across your codebase. **FluentGuard** lets you declare security rules once and enforce them everywhere — APIs, background jobs, UI states — with a single readable line.

```javascript
// ❌ Before: Imperative spaghetti
function releasePayment(user, context) {
  if (user.role !== 'worker') throw new Error('Not a worker');
  if (user.balance < context.amount) throw new Error('Low balance');
  if (user.assignedJobId !== context.jobId) throw new Error('Wrong job');
  // ... finally, do the thing
}

// ✅ After: Declarative, composable, testable
const releasePayment = guard.workerCanPay((user, context) => {
  database.transfer(user.id, context.amount);
});
```

---

## 📦 Installation

```bash
npm install fluentguard
```

```bash
yarn add fluentguard
```

```bash
pnpm add fluentguard
```

---

## 🚀 Quick Start

### 1. Define Your Rules

Create a centralized access control schema:

```typescript
// access.rules.ts
import { createSchema, Rule } from 'fluentguard';

export const { guard, rules } = createSchema({

  workerCanPay: Rule.all([
    {
      name: 'isWorker',
      check: (u) => u.role === 'worker',
      message: () => 'User must hold the Worker role.'
    },
    {
      name: 'hasBalance',
      check: (u, ctx) => u.balance >= ctx.amount,
      message: (u, ctx) => `Balance $${u.balance} is below required $${ctx.amount}.`
    },
    {
      name: 'isAssigned',
      check: (u, ctx) => u.assignedJobId === ctx.jobId,
      message: () => 'Worker is not assigned to this job.'
    }
  ])

});
```

### 2. Guard Your Functions

```typescript
import { guard } from './access.rules';

// Wrap any function — if any rule fails, execution never reaches the body
const releasePayment = guard.workerCanPay((user, context) => {
  database.transfer(user.id, context.amount);
  return 'Payment released!';
});

// Usage
try {
  await releasePayment(currentUser, { amount: 500, jobId: 'abc-123' });
} catch (error) {
  console.log(error.reason);      // "Worker is not assigned to this job."
  console.log(error.failedAtRule); // "isAssigned"
}
```

---

## 📖 API Reference

### `createSchema(schema)`

Creates a frozen schema and returns a `guard` proxy and `rules` reference.

```typescript
const { guard, rules } = createSchema({
  ruleName: Rule.all([...]),
  anotherRule: Rule.any([...]),
});
```

| Return      | Description |
|-------------|-------------|
| `guard`     | A Proxy object — access any rule name as a method to wrap functions |
| `rules`     | The frozen, immutable schema object for reference |

---

### `Rule.all(validators[])`

**All** validators must pass. Short-circuits on first failure.

```typescript
const adminWithBalance = Rule.all([
  { check: (u) => u.role === 'admin', message: () => 'Must be admin' },
  { check: (u, c) => u.balance >= c.cost, message: () => 'Insufficient funds' },
]);
```

### `Rule.any(validators[])`

**At least one** validator must pass. Reports the last failure if none pass.

```typescript
const adminOrModerator = Rule.any([
  { check: (u) => u.role === 'admin', message: () => 'Not an admin' },
  { check: (u) => u.role === 'moderator', message: () => 'Not a moderator' },
]);
```

### `Rule.not(validator)`

**Inverts** a single validator — passes when the check *fails*.

```typescript
const notBanned = Rule.not({
  name: 'isBanned',
  check: (u) => u.banned === true,
  message: () => 'User is banned'
});
```

### `RuleBuilder` — Fluent Chaining

For more readable, English-like rule definitions, use the `RuleBuilder`:

```typescript
import { RuleBuilder } from 'fluentguard';

// Chain conditions fluently — reads like a sentence
const rule = RuleBuilder
  .where(isWorker)
  .and(hasBalance)
  .andNot(isSuspended)
  .or(isAdmin)
  .build();

// Equivalent to: (isWorker AND hasBalance AND NOT isSuspended) OR (isAdmin)
```

| Method | Behavior |
|--------|----------|
| `.where(v)` | Starts the chain with validator `v` |
| `.and(v)` | Adds `v` to the current AND group |
| `.andNot(v)` | Adds the inverse of `v` to the current AND group |
| `.or(v)` | Starts a new OR branch with `v` |
| `.build()` | Compiles into a standard `Rule` — works with `createSchema()` |

Use it in your schema just like any other rule:

```typescript
const { guard } = createSchema({
  canTransact: RuleBuilder
    .where(isKYCVerified)
    .and(hasBalance)
    .andNot(isFlagged)
    .or(isComplianceOfficer)
    .build()
});
```

Wraps `fn` so that the named rule is evaluated **before** execution.

```typescript
const secureFn = guard.workerCanPay(myFunction);
await secureFn(user, context); // Throws RuleDeniedError if rules fail
```

**Options:**

| Option           | Type                                      | Description |
|------------------|-------------------------------------------|-------------|
| `resolveUser`    | `(args: any[]) => any`                    | Custom extractor to pull `user` from any argument shape |
| `resolveContext` | `(args: any[]) => any`                    | Custom extractor to pull `context` from any argument shape |
| `subjects`       | `Record<string, (args: any[]) => any>`    | Multi-actor map — first key = user, rest merge into context |

#### Custom Argument Extraction

Perfect for Express/Next.js handlers where `user` lives in `req.session`:

```typescript
const secureHandler = guard.workerCanPay(handler, {
  resolveUser: (args) => args[0].session.user,       // req.session.user
  resolveContext: (args) => ({ amount: args[0].body.amount })  // req.body
});

// Express route
app.post('/pay', secureHandler);
```

---

### `guard.ruleName.safe(fn, options?)`

Same as above, but **never throws** for rule failures. Returns a result object instead.

```typescript
const safePay = guard.workerCanPay.safe(myFunction);

const result = await safePay(user, context);

if (result.success) {
  console.log(result.data); // Return value of myFunction
} else {
  console.log(result.error.reason); // "Must be a worker."
}
```

> **Note:** `.safe()` only catches `RuleDeniedError`. Unexpected runtime errors (e.g., `TypeError`, database failures) are re-thrown so they don't get silently swallowed.

---

### Validator Shape

Each validator in a rule array follows this structure:

```typescript
{
  name?: string;                          // Optional identifier for debugging
  check: (user, context) => boolean;      // Sync or async — return true to pass
  message: (user, context) => string;     // Human-readable rejection reason
}
```

- `check` can return a `Promise<boolean>` for async validations (e.g., database lookups).
- `message` receives the same `user` and `context` for dynamic error interpolation.

---

### `RuleDeniedError`

Thrown when a guard check fails. Extends `Error` with additional properties:

```typescript
{
  name: 'RuleDeniedError',
  message: string,            // Same as reason
  ruleName: string,           // Which schema rule failed (e.g., "workerCanPay")
  reason?: string,            // Human-readable message from the validator
  failedAtRule?: string       // The validator's `name` field (e.g., "isWorker")
}
```

---

## 🎯 Use Cases

### REST API Middleware

```typescript
import { guard } from './access.rules';

// Express
app.post('/api/payments', guard.workerCanPay(async (req, res) => {
  const result = await processPayment(req.body);
  res.json(result);
}, {
  resolveUser: (args) => args[0].user,
  resolveContext: (args) => args[0].body
}));
```

### UI Permission Checks

Use `.safe()` to toggle buttons without try/catch:

```typescript
// React component
const canPay = await guard.workerCanPay.safe(
  () => true,              // Dummy function — we only care about the check
)(currentUser, { amount: invoice.total });

return (
  <button disabled={!canPay.success}>
    {canPay.success ? 'Release Payment' : canPay.error.reason}
  </button>
);
```

### Background Jobs / Cron Tasks

```typescript
import { guard } from './access.rules';

const processRefund = guard.adminCanRefund(async (admin, context) => {
  await db.refund(context.orderId, context.amount);
  await notifyCustomer(context.customerId);
});

// Cron runner
cron.schedule('0 * * * *', async () => {
  for (const job of pendingRefunds) {
    try {
      await processRefund(systemAdmin, job);
    } catch (e) {
      logger.error(`Refund blocked: ${e.reason}`);
    }
  }
});
```

### Composing Complex Rules

```typescript
const { guard } = createSchema({

  // Must be admin AND have 2FA enabled
  sensitiveAction: Rule.all([
    { check: (u) => u.role === 'admin', message: () => 'Admin required' },
    { check: (u) => u.twoFactorEnabled, message: () => '2FA required' },
  ]),

  // Can be either admin OR the resource owner
  canEditResource: Rule.any([
    { check: (u) => u.role === 'admin', message: () => 'Not admin' },
    { check: (u, c) => u.id === c.ownerId, message: () => 'Not the owner' },
  ]),

  // Must NOT be a suspended user
  activeUser: Rule.not({
    name: 'isSuspended',
    check: (u) => u.suspended === true,
    message: () => 'Account is suspended'
  }),

});
```

### Multi-Actor Validation (Fintech Transfers)

Validate **multiple users** in one guard — e.g., sender AND receiver:

```typescript
const { guard } = createSchema({
  transfer: Rule.all([
    { check: (sender) => sender.role === 'worker', message: () => 'Sender must be a worker' },
    { check: (sender, ctx) => ctx.receiver.role === 'client', message: () => 'Receiver must be a client' },
    { check: (sender, ctx) => sender.balance >= ctx.amount, message: () => 'Insufficient balance' },
  ])
});

// Use `subjects` to map arguments to actors
const secureTransfer = guard.transfer(processTransfer, {
  subjects: {
    sender: (args) => args[0],     // first subject = user
    receiver: (args) => args[1],   // merged into context as ctx.receiver
  },
  resolveContext: (args) => ({ amount: args[2] })
});

await secureTransfer(senderUser, receiverUser, 500);
```

---

## 🔒 Security

FluentGuard includes built-in security hardening:

- **Prototype Pollution Protection** — The guard proxy blocks `__proto__`, `constructor`, and `prototype` access
- **Null User Rejection** — Throws immediately if user resolves to `null` or `undefined`
- **Immutable Schema** — Rules are frozen after creation via `Object.freeze` to prevent runtime tampering
- **Safe Error Boundaries** — `.safe()` only catches `RuleDeniedError`, re-throwing unexpected errors
- **Stack Trace Preservation** — `Error.captureStackTrace` points to the actual guard call site

---

## 🧪 Testing

```bash
npm test
```

Runs the full [Vitest](https://vitest.dev/) test suite (**29 tests**) covering:
- Rule logical builders (`.all`, `.any`, `.not`)
- Fluent chaining via `RuleBuilder`
- Multi-actor validation via `subjects`
- Guard proxy interception and function wrapping
- Custom argument extraction
- Security hardening (prototype pollution, null users, error boundaries)

---

## 🏗️ Building

```bash
npm run build
```

Outputs CJS, ESM, and TypeScript declarations to `dist/` via [tsup](https://tsup.egoist.dev/).

---

## 📄 License

MIT © FluentGuard
