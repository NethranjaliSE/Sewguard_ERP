# ApparelFlow ERP — Cutting Operations & Gatekeeper Verification Terminal

**Company:** WEBTEZZA (PVT) LTD  
**Assessment:** Software Engineering Intern — Full-Stack / React / Next.js  
**Technology Stack:** Next.js 16 (App Router + Turbopack), React 19, TypeScript, Prisma ORM 5.22, PostgreSQL (Supabase), Tailwind CSS v4.

---

## 1. Overview

**ApparelFlow ERP** is a production-quality garment manufacturing ERP module designed to eliminate garment component shortages before cutting batches enter assembly lines. It enforces a strict **Gatekeeper Verification Hard Stop**:

$$\text{CUTTING ORDER} \longrightarrow \text{PENDING VERIFICATION} \longrightarrow \text{COUNT VERIFICATION} \longrightarrow \text{HARD STOP CHECK} \longrightarrow \text{VERIFIED} \longrightarrow \text{SEWING QUEUE} \longrightarrow \text{SEWING IN PROGRESS}$$

### The Cardinal Business Rule
> **A batch with ANY RED / SHORTAGE component must NEVER be approved and must NEVER appear in the Sewing Queue.**  
> This rule is enforced on the **SERVER** via database state inspection and business logic, independent of frontend status flags or client tampering.

---

## 2. Authentication & Demo Personas

The system features an enterprise-grade authentication and session system with strict server-side Role-Based Access Control (RBAC).

### Evaluator Demo Credentials

The database is seeded with exactly three demo accounts with secure bcrypt password hashes:

| Role | Email | Password | Allowed Operations | Restricted Operations |
| :--- | :--- | :--- | :--- | :--- |
| **Cutting Supervisor** (`cutting_supervisor`) | `supervisor@apparelfow.com` | `Supervisor@123` | Create cutting orders, select BOM recipes, track cutting batches | Cannot verify/approve/reject batches, cannot access Sewing Queue, cannot start sewing |
| **Cutting Verifier** (`cutting_verifier`) | `verifier@apparelfow.com` | `Verifier@123` | Physical count entry, Gatekeeper reconciliation terminal, approve valid batches, reject invalid batches | Cannot create orders, cannot edit recipes, cannot access Sewing Queue, cannot start sewing |
| **Sewing Supervisor** (`sewing_supervisor`) | `sewing@apparelfow.com` | `Sewing@123` | View verified sewing queue, inspect audit logs, start sewing assembly | Cannot access pending/rejected batches, cannot create orders, cannot verify batches |

> **Note:** The login endpoint also supports the alternate domain spelling `apparelflow.com` automatically.

### Architecture & Security Boundary
- **Backend as Security Boundary**: Active sessions are authenticated via an **HTTP-only secure cookie** (`app_session`). The frontend NEVER changes the authenticated role locally.
- **Single Source of Truth**: The session cookie stores a cryptographically signed user ID (HMAC-SHA256). For every protected request, the server reads the user ID and queries the PostgreSQL database directly (`users.role`) to resolve the active role.
- **Header Role Tabs Behavior**: The header highlights the current authenticated role (solid blue `#2563EB` badge). Clicking any inactive role tab does **NOT** switch roles. Instead, it triggers a `RoleSwitchModal` dialog.
- **Role Switch Flow (Evaluator-Friendly)**:
  1. Operator clicks a non-active role tab (e.g. Cutting Verifier).
  2. A confirmation modal appears showing current account and requested role.
  3. Clicking **Cancel** closes the modal and keeps the current role.
  4. Clicking **Logout & Switch** invalidates the current session (`POST /api/auth/logout`), presents the login screen, and preselects the requested demo role credentials.
  5. The user explicitly signs in to establish a new authenticated backend session.
- **Client Role Tampering Immunity**: Any role submitted in frontend request bodies (e.g. `{ "role": "cutting_verifier" }`) is strictly ignored. If an authenticated Cutting Supervisor submits a verification approval, the server enforces their database role and immediately rejects the call with **HTTP 403 Forbidden**.


---

## 3. Core Business & Quality Logic

### 1. Server-Side Hard Stop (`/api/orders/[id]/verify`)
- The server recalculates each component's status by comparing actual physical counts against expected counts:
  - $\text{Actual} = \text{Expected} \implies \text{MATCH (GREEN 🟢)}$
  - $\text{Actual} > \text{Expected} \implies \text{EXCESS (YELLOW 🟡)}$
  - $\text{Actual} < \text{Expected} \implies \text{SHORTAGE (RED 🔴)}$
- If **any** component has a `SHORTAGE`:
  - Approval button is disabled in the UI with a high-visibility warning card detailing the missing pieces.
  - Any direct API approval attempt (via Postman, cURL, or forged requests) is rejected with **HTTP 422 Unprocessable Entity**.
  - The order status remains `PENDING_VERIFICATION`.

### 2. Mandatory Rejection Reason
- Rejecting a batch requires an explicit, non-empty rejection reason.
- Submitting an empty reason returns **HTTP 422 Unprocessable Entity**.
- On rejection, order status transitions to `REJECTED`, and an immutable `VerificationLog` is recorded.

### 3. Server-Side Fabric Wastage Formula
- Expected fabric yards are calculated from standard garment consumption:
  $$\text{Expected Fabric Yards} = \text{Target Quantity} \times \text{Standard Fabric Yards per Garment}$$
- Fabric wastage percentage is computed on the backend:
  $$\text{Fabric Wastage \%} = \left(\frac{\text{Actual Fabric Used} - \text{Expected Fabric Yards}}{\text{Expected Fabric Yards}}\right) \times 100$$
- Displayed with standard wastage tolerance caps (e.g. 5.0% for Blouses, 8.0% for Crop Tops).

### 4. Sewing Queue Isolation
- The Sewing Queue endpoint (`GET /api/sewing/queue` and `GET /api/orders?status=VERIFIED`) enforces role authorization and strictly queries only `VERIFIED` and `SEWING_IN_PROGRESS` batches.
- Clicking **Start Sewing Assembly** transitions order status: $\text{VERIFIED} \longrightarrow \text{SEWING\_IN\_PROGRESS}$.

---

## 4. Database Schema & Seed Data

### Relational Models (`prisma/schema.prisma`)
- `User`: Pre-seeded demo operators with authentic roles.
- `Recipe`: Garment recipes with code, category, standard fabric consumption, and wastage caps.
- `RecipeComponent`: Components and pieces-per-garment specifications.
- `CuttingOrder`: Order runs with roll ID, quantities, yardage, status, and creator foreign keys.
- `VerificationItem`: Order component counts, expected quantities, and status.
- `VerificationLog`: Immutable audit trail recording verifier ID, decision, rejection note, component snapshot, wastage percentage, and timestamps.

### Seeded Recipes
1. **Casual Blouse** (`REC-BL01`):
   - Category: Blouse, Std Fabric: 1.8 yds/piece, Wastage Cap: 5.0%
   - Components: Front Body Panel (1), Back Body Panel (1), Sleeves (2), Collar & Stand (1), Sleeve Cuffs (2)
2. **Crop Top** (`REC-CT02`):
   - Category: Crop Top, Std Fabric: 1.1 yds/piece, Wastage Cap: 8.0%
   - Components: Front Chest Panel (1), Back Support Panel (1), Neck Binding Strip (1), Hem Elastic Casing (1), Side Strap Accents (2)

### Seeded Demo Accounts
- **Cutting Supervisor:** `supervisor@apparelflow.com` (Ali Khan)
- **Cutting Verifier:** `verifier@apparelflow.com` (Sara Ahmed)
- **Sewing Supervisor:** `sewing@apparelflow.com` (Bilal Hussain)

---

## 5. Development & Verification Commands

### 1. Run Automated Test Suite
Executes the comprehensive Node.js native test suite testing all business rules and RBAC boundaries:
```bash
npm test
```
All 8 automated tests pass:
- **TEST 1:** All GREEN components approved by Cutting Verifier $\implies$ `VERIFIED`
- **TEST 2:** At least one RED component blocks approval with `HTTP 422`
- **TEST 3:** Rejecting without reason fails with `HTTP 422`
- **TEST 4:** Cutting Supervisor cannot approve verification (`HTTP 403`)
- **TEST 5:** Sewing Queue returns only `VERIFIED` orders
- **TEST 6:** Cutting Verifier & Sewing Supervisor cannot create cutting orders (`HTTP 403`)
- **TEST 7:** Sewing Supervisor can start sewing $\implies$ `SEWING_IN_PROGRESS`
- **TEST 8:** Server-side wastage calculation matches mathematical formula

### 2. Run Lint
```bash
npm run lint
```
Passes with **0 errors and 0 warnings**.

### 3. Production Build
```bash
npm run build
```
Turbopack builds all static pages and dynamic API routes successfully.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Manual Evaluation Walkthrough

Follow this step-by-step scenario to verify all personas:

### SCENARIO A: Cutting Supervisor (Create Order)
1. In the top navbar, select **Cutting Supervisor**.
2. Select Recipe **Casual Blouse (REC-BL01)**.
3. Notice the right panel dynamically updates:
   - Std Fabric: 1.8 yds/garment, Wastage Cap: 5.0%
   - Shows all 5 components and required pieces per garment.
4. Enter:
   - Target Quantity: `50` (Notice expected batch yardage dynamically computes $50 \times 1.8 = 90.0$ yds, and expected component quantities scale).
   - Fabric Roll ID: `FAB-ROLL-882`
   - Actual Fabric Used: `92` yds.
5. Click **Create Cutting Order**.
6. The order is created in `PENDING_VERIFICATION` status with auto-generated order number (e.g. `ORD-0003`).

### SCENARIO B: Cutting Verifier (Green Approval)
1. Switch persona to **Cutting Verifier**.
2. Find the newly created order in the pending list and click **Open Verification Terminal**.
3. Telemetry displays:
   - Expected: 90 yds, Actual: 92 yds, Wastage: +2.22%, Status: Within Cap.
4. Enter matching physical counts:
   - Front Body Panel: `50`
   - Back Body Panel: `50`
   - Sleeves: `100`
   - Collar & Stand: `50`
   - Sleeve Cuffs: `100`
5. All badges turn **🟢 MATCH**.
6. The **Approve Batch** button is active. Click **Approve Batch**.
7. Order is verified and approved. An immutable `VerificationLog` is created in the database.

### SCENARIO C: Cutting Verifier (Shortage Hard Stop & Rejection)
1. Switch back to **Cutting Supervisor** and create another order:
   - Recipe: **Casual Blouse**
   - Target Qty: `50`, Roll: `FAB-ROLL-883`, Actual Fabric: `90` yds.
2. Switch to **Cutting Verifier** and open the terminal.
3. Enter counts with a shortage on Sleeves:
   - Front Body: `50`, Back Body: `50`, Sleeves: `98`, Collar: `50`, Cuffs: `100`.
4. Sleeves badge shows **🔴 SHORTAGE (Missing: 2 pcs)**.
5. The **SHORTAGE DETECTED — APPROVAL BLOCKED** warning banner appears.
6. The **Approve Batch** button is disabled. (Direct POST attempts to `/api/orders/[id]/verify` return `HTTP 422`).
7. Click **Reject Batch…**.
8. Attempting to submit without a note is blocked with validation.
9. Enter note: `"2 sleeve pieces missing due to fabric flaw on roll."`
10. Click **Confirm Rejection & Return**. The order transitions to `REJECTED` and is returned for re-cutting.

### SCENARIO D: Sewing Supervisor (Sewing Queue & Assembly)
1. Switch persona to **Sewing Supervisor**.
2. Notice the Sewing Queue displays **ONLY** verified orders.
   - Pending and rejected batches do NOT appear.
3. Inspect order telemetry: Recipe, Batch Quantity, Fabric Roll, Verifier Name, Verification Timestamp, Fabric Wastage %, and verified BOM breakdown.
4. Click **Start Sewing Assembly →**.
5. Order status transitions from `VERIFIED` to `SEWING_IN_PROGRESS`.
6. Refresh the browser; all statuses, audit records, and transitions persist reliably in PostgreSQL.

---

## 7. AI Optimization Report

Please review [AI_OPTIMIZATION_REPORT.md](file:///d:/SewGuard_ERP/apparelflow-erp/AI_OPTIMIZATION_REPORT.md) for detailed documentation on:
- AI tools & prompting methodology
- Flawed / broken AI-generated code identified (client-side RBAC bypass, P2028 PgBouncer deadlock, cascading React 19 re-renders)
- Human engineering refactoring applied
- Defensive architecture diagrams and implementation
