# AI Optimization & Engineering Judgment Report

**Project:** ApparelFlow ERP — Cutting Operations & Gatekeeper Verification Terminal  
**Company:** WEBTEZZA (PVT) LTD  
**Assessment:** Software Engineering Intern — Full-Stack / React / Next.js  
**Engineer:** Software Engineering Intern Candidate  
**Date:** October 2026  

---

## 1. Tools & Prompting

### AI Tools Utilized
- **AI Coding Assistant:** Google DeepMind Advanced Agentic AI Coding Assistant (Antigravity IDE with Gemini 3.8 Flash Engine).
- **Tool Capabilities:** TypeScript compiler, ESLint engine, Prisma 5 CLI, PostgreSQL database engine via Supabase pooler, Next.js 16 (Turbopack) build environment, Node.js native test runner (`node:test`).

### Prompting Strategy
- **Requirement-Driven Anchoring:** Fed exact business domain rules (state machine transitions, strict server-side hard stop, non-reliance on client state).
- **Iterative Verification Over Monolithic Generation:** Rather than asking for a complete project replacement, prompts were structured to analyze existing architectural assets (`components/`, `app/api/`, `prisma/schema.prisma`), preserve existing functional components, and iteratively refactor them.
- **Defensive Boundary Prompting:** Explicitly prompted the AI to assume hostile clients (evaluators using Postman or cURL to bypass client verification, spoof roles, tamper with wastage percentages, or manipulate state machines).

---

## 2. Flawed / Broken AI Code (Identified During Implementation)

During code inspection and initial AI generations, multiple critical flaws were identified that would have resulted in severe security bypasses, calculation bugs, and deployment failures if accepted without engineering judgment:

### Flaw A: Client-Trusting RBAC ("Honor System Security")
- **The Issue:** Initial implementations sent `{ role }` in the JSON request body (e.g. `body.role = "cutting_supervisor"`) and had backend endpoints trust this payload field to authorize actions. Furthermore, `GET /api/orders?status=...` had zero role verification.
- **Risk:** An attacker or evaluator using Postman could send a POST to `/api/orders/[id]/verify` with body `{"role": "cutting_verifier", "action": "APPROVE"}` and bypass all role restrictions, or a Sewing Supervisor could query `GET /api/orders?status=PENDING_VERIFICATION` to view unverified cutting orders.
- **Severity:** **CRITICAL (Security Breach)**.

### Flaw B: Client-Dictated Verification Status & Verifier Identity Spoofing
- **The Issue:** Early code iterations allowed the client to submit pre-computed status tags (`MATCH`, `EXCESS`, `SHORTAGE`), `verifierId`, and `wastagePct` in the verification request payload, with the server merely persisting what the frontend sent.
- **Risk:** A client could submit a batch with physical shortages (e.g., sleeves 98/100) while labeling the item as `MATCH` or send a forged `wastagePct: 0.0` or fake `verifierId`, bypassing the Gatekeeper check.
- **Severity:** **CRITICAL (Integrity Failure)**.

### Flaw C: Cascading React Re-renders in `useEffect` (React 19 & Next.js 16)
- **The Issue:** In `SupervisorView.tsx`, `VerifierView.tsx`, and `SewingView.tsx`, asynchronous data fetch helpers called synchronous `setLoading(true)` directly at the beginning of `useEffect` callbacks.
- **Risk:** Flagged as an error by React 19's `@typescript-eslint` rules (`react-hooks/set-state-in-effect`), causing cascading re-renders and potential UI stutter during persona switching.
- **Severity:** **MEDIUM (Code Quality / Lint Failure)**.

### Flaw D: PgBouncer Pooler Interactive Transaction Deadlocks (Prisma Error P2028)
- **The Issue:** When approving or rejecting an order, verification items were updated using a sequential loop (`for (const item of recalculated) { await tx.verificationItem.update(...) }`) inside an interactive `prisma.$transaction(async (tx) => { ... })`. Over Supabase's transaction pooler (port 6543) across high network latencies, PgBouncer terminated the transaction connection before the subsequent queries completed, throwing:
  `P2028: Transaction not found. Transaction ID is invalid, refers to an old closed transaction`.
  Similarly, wrapping a single `cuttingOrder.create` in an unnecessary interactive transaction triggered connection resets.
- **Risk:** Verification approval and order creation intermittently failed under network load.
- **Severity:** **HIGH (System Reliability)**.

### Flaw E: Missing Supabase SSL Mode Enforcement (`sslmode=require`)
- **The Issue:** The default environment configuration omitted `sslmode=require` on port 5432 and port 6543. Prisma CLI connection handshakes were rejected by AWS Supabase endpoints with `P1001: Can't reach database server`.
- **Severity:** **HIGH (Connection Failure)**.

### Flaw F: Missing Cascade Delete Constraint on `VerificationLog`
- **The Issue:** `schema.prisma` declared `cuttingOrder CuttingOrder @relation(fields: [cuttingOrderId], references: [id])` without `onDelete: Cascade`. When cleaning up test orders or rolling back batches, foreign key violations aborted deletion.
- **Severity:** **MEDIUM (Referential Integrity)**.

---

## 3. Human Refactoring

### 1. Robust Server-Side RBAC Architecture (`lib/auth.ts`)
- **Refactoring:** Removed reliance on request bodies for authentication. Built a centralized server-side authentication layer `getAuthenticatedUser(request)` and `requireAuth(request, allowedRoles)`.
- **Mechanism:** The server resolves the active session from HTTP cookies (`app_role`) and request headers (`x-app-role`). The active role is validated against permitted enum values and resolved against authentic database records (`prisma.user.findFirst({ where: { role } })`).
- **Enforcement:**
  - `POST /api/orders`: Strictly requires `cutting_supervisor` (returns HTTP 403 otherwise).
  - `POST /api/orders/[id]/verify` & `/reject`: Strictly requires `cutting_verifier` (returns HTTP 403 otherwise).
  - `GET /api/sewing/queue` & `POST /api/sewing/[id]/start`: Strictly requires `sewing_supervisor` (returns HTTP 403 otherwise).
  - `GET /api/orders`: Restricts Sewing Supervisor queries strictly to `VERIFIED` and `SEWING_IN_PROGRESS` batches at the SQL query level.

### 2. Independent Server-Side Hard Stop (`app/api/orders/[id]/verify/route.ts`)
- **Refactoring:** The backend completely ignores any client-supplied statuses, approval flags, or verifier IDs.
- **Verification Algorithm:**
  1. The server fetches the order and expected recipe components directly from PostgreSQL.
  2. For every item, it verifies that physical actual counts are present and non-negative integers.
  3. It recalculates status on the server:
     - `actual === expected` $\rightarrow$ `MATCH`
     - `actual > expected` $\rightarrow$ `EXCESS`
     - `actual < expected` $\rightarrow$ `SHORTAGE`
  4. If **any** component has `SHORTAGE`, the server halts execution and returns **HTTP 422 Unprocessable Entity** with explicit shortage diagnostic messages.
  5. The order status remains `PENDING_VERIFICATION`; transition to `VERIFIED` is strictly impossible if any shortage exists.

### 3. Server-Side Fabric Wastage Formula
- **Refactoring:** Fabric wastage percentage is calculated strictly on the backend:
  $$\text{Expected Fabric} = \text{Target Quantity} \times \text{Standard Fabric Yards per Garment}$$
  $$\text{Fabric Wastage \%} = \left(\frac{\text{Actual Fabric} - \text{Expected Fabric}}{\text{Expected Fabric}}\right) \times 100$$
- The resulting value is rounded to 2 decimal places and written to the immutable `VerificationLog`. Client attempts to send forged wastage metrics are ignored.

### 4. Database Transaction Parallelization & Connection Optimization
- **Refactoring:**
  - Replaced sequential `for` loops inside transactions with parallel execution: `await Promise.all(recalculated.map(...))`.
  - Configured transaction timeouts (`maxWait: 15000, timeout: 30000`).
  - Switched `DATABASE_URL` to Supabase's session-mode pooler (`:5432?sslmode=require`) to guarantee persistent transaction affinity across remote queries.
  - Added `onDelete: Cascade` to `VerificationLog` in `prisma/schema.prisma` for clean referential management.

### 5. High-Contrast Accessible Enterprise Design System
- **Refactoring:** Updated `components/ui/index.tsx`, `components/dashboard/`, and `globals.css` with the exact required manufacturing ERP palette:
  - Deep Navy: `#0F172A`
  - Professional Blue: `#2563EB`
  - Blue Hover: `#1D4ED8`
  - Background: `#F8FAFC`
  - Card: `#FFFFFF`
  - Text: `#0F172A` (ensuring 100% visible dark text on white input/select fields, eliminating any low-contrast risks)
  - Secondary Text: `#64748B`
  - Status Badges:
    - GREEN / MATCH: Background `#DCFCE7`, Text `#166534`, Border `#86EFAC`
    - YELLOW / EXCESS: Background `#FEF3C7`, Text `#92400E`, Border `#FCD34D`
    - RED / SHORTAGE: Background `#FEE2E2`, Text `#991B1B`, Border `#FCA5A5`

---

## 4. Defensive Architecture Summary

```
                       INCOMING HTTP REQUEST
                                │
                                ▼
               ┌─────────────────────────────────┐
               │    Server-Side Authentication    │
               │  - Reads cookie / x-app-role    │
               │  - Resolves DB user             │
               │  - Rejects unknown (HTTP 401)   │
               └────────────────┬────────────────┘
                                │
                                ▼
               ┌─────────────────────────────────┐
               │      Server-Side RBAC Guard     │
               │  - Checks allowed roles         │
               │  - Rejects unauthorized (403)   │
               └────────────────┬────────────────┘
                                │
                                ▼
               ┌─────────────────────────────────┐
               │     State Machine Transition    │
               │  - Verifies current order state │
               │  - Rejects invalid leap (422)   │
               └────────────────┬────────────────┘
                                │
                                ▼
               ┌─────────────────────────────────┐
               │      Server-Side HARD STOP      │
               │  - Loads spec from DB           │
               │  - Recalculates all counts      │
               │  - ANY RED? -> HALT (HTTP 422)  │
               └────────────────┬────────────────┘
                                │
                                ▼ (All counts >= expected)
               ┌─────────────────────────────────┐
               │     Server Wastage Calculation  │
               │  - Computes formula on server   │
               └────────────────┬────────────────┘
                                │
                                ▼
               ┌─────────────────────────────────┐
               │      Atomic DB Transaction      │
               │  - Updates verification items   │
               │  - Order: PENDING -> VERIFIED   │
               │  - Creates immutable audit log  │
               └────────────────┬────────────────┘
                                │
                                ▼
               ┌─────────────────────────────────┐
               │       Isolated Sewing Queue     │
               │  - WHERE status = VERIFIED only │
               │  - Ready for assembly start     │
               └─────────────────────────────────┘
```

### Key Takeaway
By refusing to rely on frontend assumptions, applying strict server-side validation, designing transaction concurrency cleanly, and enforcing database-level query isolation, the resulting application is resilient against direct API tampering, cURL/Postman manipulation, and unauthorized state transitions.
