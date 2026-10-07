try {
  process.loadEnvFile?.();
} catch {}

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { OrderStatus, User } from "@prisma/client";
import { POST as createOrder } from "../app/api/orders/route";
import { POST as verifyOrder } from "../app/api/orders/[id]/verify/route";
import { GET as getSewingQueue } from "../app/api/sewing/queue/route";
import { POST as startSewing } from "../app/api/sewing/[id]/start/route";
import { GET as getAuthMe } from "../app/api/auth/me/route";
import { POST as authLogout } from "../app/api/auth/logout/route";
import { POST as authLogin } from "../app/api/auth/login/route";
import { createSessionToken } from "../lib/auth";

interface VerificationItemRef {
  id: string;
  expectedQty: number;
}

interface OrderRef {
  id: string;
  status: OrderStatus;
  expectedFabricYards: number;
  verificationItems: VerificationItemRef[];
}

describe("ApparelFlow ERP — Enterprise RBAC & Gatekeeper API Test Suite", () => {
  let testRecipeId: string;
  let supervisorUser: User | null = null;
  let verifierUser: User | null = null;
  let sewingUser: User | null = null;

  let supervisorToken: string;
  let verifierToken: string;
  let sewingToken: string;

  before(async () => {
    // Ensure base recipes and seeded users exist
    const recipe = await prisma.recipe.findFirst({
      where: { name: "Casual Blouse" },
      include: { components: true },
    });
    assert.ok(recipe, "Casual Blouse recipe must exist in database");
    testRecipeId = recipe.id;

    supervisorUser = await prisma.user.findFirst({
      where: { role: "cutting_supervisor" },
    });
    verifierUser = await prisma.user.findFirst({
      where: { role: "cutting_verifier" },
    });
    sewingUser = await prisma.user.findFirst({
      where: { role: "sewing_supervisor" },
    });

    assert.ok(supervisorUser, "Supervisor user must exist");
    assert.ok(verifierUser, "Verifier user must exist");
    assert.ok(sewingUser, "Sewing user must exist");

    // Generate genuine cryptographic session tokens
    supervisorToken = createSessionToken(supervisorUser.id);
    verifierToken = createSessionToken(verifierUser.id);
    sewingToken = createSessionToken(sewingUser.id);
  });

  after(async () => {
    // Clean up test orders created with ROLL-TEST-*
    const testOrders = await prisma.cuttingOrder.findMany({
      where: { fabricRollId: { startsWith: "ROLL-TEST-" } },
      select: { id: true },
    });
    const ids = testOrders.map((o) => o.id);
    if (ids.length > 0) {
      await prisma.verificationLog.deleteMany({
        where: { cuttingOrderId: { in: ids } },
      });
      await prisma.verificationItem.deleteMany({
        where: { cuttingOrderId: { in: ids } },
      });
      await prisma.cuttingOrder.deleteMany({
        where: { id: { in: ids } },
      });
    }
  });

  // ── TEST 1: Unauthenticated request to protected API returns HTTP 401 ─
  test("TEST 1: Unauthenticated request to protected API returns HTTP 401", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 50,
        fabricRollId: "ROLL-TEST-UNAUTH",
        actualFabricYards: 90.0,
      }),
    });

    const res = await createOrder(unauthReq);
    assert.equal(res.status, 401, "Unauthenticated request must return 401 Unauthorized");
    const data = await res.json();
    assert.equal(data.error, "Unauthorized");
  });

  // ── TEST 2: Cutting Supervisor calls verification approval API -> returns HTTP 403 ─
  test("TEST 2: Cutting Supervisor calls verification approval API -> returns HTTP 403 Forbidden", async () => {
    // Create order first
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `app_session=${supervisorToken}`,
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 50,
        fabricRollId: "ROLL-TEST-002",
        actualFabricYards: 90.0,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201);
    const { order }: { order: OrderRef } = await createRes.json();

    // Supervisor attempts to verify
    const verifyReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `app_session=${supervisorToken}`, // Authenticated as supervisor
        },
        body: JSON.stringify({
          action: "APPROVE",
          items: order.verificationItems.map((vi) => ({
            verificationItemId: vi.id,
            actualQty: vi.expectedQty,
          })),
        }),
      }
    );

    const verifyRes = await verifyOrder(verifyReq, {
      params: Promise.resolve({ id: order.id }),
    });

    assert.equal(verifyRes.status, 403, "Supervisor attempting verification must return 403 Forbidden");
    const errorData = await verifyRes.json();
    assert.equal(errorData.error, "Forbidden");
  });

  // ── TEST 3: Cutting Verifier calls verification API -> allowed to approve valid batch ─
  test("TEST 3: Cutting Verifier calls verification API -> allowed to proceed and approves valid batch", async () => {
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `app_session=${supervisorToken}`,
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 50,
        fabricRollId: "ROLL-TEST-003",
        actualFabricYards: 92.5,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201);
    const { order }: { order: OrderRef } = await createRes.json();

    // Verifier approves all matching counts
    const verifyReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `app_session=${verifierToken}`, // Authenticated as verifier
        },
        body: JSON.stringify({
          action: "APPROVE",
          items: order.verificationItems.map((vi) => ({
            verificationItemId: vi.id,
            actualQty: vi.expectedQty,
          })),
        }),
      }
    );

    const verifyRes = await verifyOrder(verifyReq, {
      params: Promise.resolve({ id: order.id }),
    });

    assert.equal(verifyRes.status, 200, "Verifier approval of valid batch must succeed");
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.order.status, OrderStatus.VERIFIED);
  });

  // ── TEST 4: Sewing Supervisor calls verification API -> returns HTTP 403 ─
  test("TEST 4: Sewing Supervisor calls verification API -> returns HTTP 403 Forbidden", async () => {
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `app_session=${supervisorToken}`,
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 30,
        fabricRollId: "ROLL-TEST-004",
        actualFabricYards: 54.0,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201);
    const { order }: { order: OrderRef } = await createRes.json();

    const verifyReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `app_session=${sewingToken}`, // Authenticated as sewing supervisor
        },
        body: JSON.stringify({
          action: "APPROVE",
          items: order.verificationItems.map((vi) => ({
            verificationItemId: vi.id,
            actualQty: vi.expectedQty,
          })),
        }),
      }
    );

    const verifyRes = await verifyOrder(verifyReq, {
      params: Promise.resolve({ id: order.id }),
    });

    assert.equal(verifyRes.status, 403, "Sewing Supervisor calling verify must return 403");
  });

  // ── TEST 5: Cutting Verifier calls sewing queue -> returns HTTP 403 ─
  test("TEST 5: Cutting Verifier calls sewing queue -> returns HTTP 403 Forbidden", async () => {
    const queueReq = new NextRequest("http://localhost:3000/api/sewing/queue", {
      headers: {
        Cookie: `app_session=${verifierToken}`,
      },
    });

    const queueRes = await getSewingQueue(queueReq);
    assert.equal(queueRes.status, 403, "Verifier accessing sewing queue must return 403");
  });

  // ── TEST 6: Sewing Supervisor calls sewing queue -> returns HTTP 200 with isolated orders ─
  test("TEST 6: Sewing Supervisor calls sewing queue -> returns HTTP 200 with strictly verified batches", async () => {
    const queueReq = new NextRequest("http://localhost:3000/api/sewing/queue", {
      headers: {
        Cookie: `app_session=${sewingToken}`,
      },
    });

    const queueRes = await getSewingQueue(queueReq);
    assert.equal(queueRes.status, 200);
    const { orders }: { orders: Array<{ status: OrderStatus }> } = await queueRes.json();
    assert.ok(Array.isArray(orders));

    for (const ord of orders) {
      assert.ok(
        ord.status === OrderStatus.VERIFIED ||
          ord.status === OrderStatus.SEWING_IN_PROGRESS,
        "Sewing queue must only contain VERIFIED or SEWING_IN_PROGRESS orders"
      );
    }
  });

  // ── TEST 7: Unauthenticated user attempts sewing queue -> returns HTTP 401 ─
  test("TEST 7: Unauthenticated user attempts sewing queue -> returns HTTP 401 Unauthorized", async () => {
    const queueReq = new NextRequest("http://localhost:3000/api/sewing/queue");
    const queueRes = await getSewingQueue(queueReq);
    assert.equal(queueRes.status, 401, "Unauthenticated access to sewing queue must return 401");
  });

  // ── TEST 8: Client-Side Role Tampering Resistance ─────────────────
  test("TEST 8: Authenticated user attempting to spoof role in request body is rejected with 403", async () => {
    // 1. Create order
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `app_session=${supervisorToken}`,
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 40,
        fabricRollId: "ROLL-TEST-SPOOF",
        actualFabricYards: 72.0,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201);
    const { order }: { order: OrderRef } = await createRes.json();

    // 2. Supervisor sends request with body { "role": "cutting_verifier" }
    const spoofReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `app_session=${supervisorToken}`, // Session is Cutting Supervisor
        },
        body: JSON.stringify({
          action: "APPROVE",
          role: "cutting_verifier", // MALICIOUS CLIENT SPOOF ATTEMPT
          verifierId: "fake-verifier-id",
          items: order.verificationItems.map((vi) => ({
            verificationItemId: vi.id,
            actualQty: vi.expectedQty,
          })),
        }),
      }
    );

    const spoofRes = await verifyOrder(spoofReq, {
      params: Promise.resolve({ id: order.id }),
    });

    assert.equal(
      spoofRes.status,
      403,
      "Server MUST ignore client request body role and enforce database role from session (HTTP 403)"
    );
  });

  // ── TEST 9: Business Hard Stop — Shortage blocks approval with HTTP 422 ─
  test("TEST 9: Server-Side Hard Stop — RED component shortage blocks approval with HTTP 422", async () => {
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `app_session=${supervisorToken}`,
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 50,
        fabricRollId: "ROLL-TEST-009",
        actualFabricYards: 91.0,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201);
    const { order }: { order: OrderRef } = await createRes.json();

    // Verifier attempts to approve with a count shortage on item 0
    const items = order.verificationItems.map((vi, index) => ({
      verificationItemId: vi.id,
      actualQty: index === 0 ? vi.expectedQty - 3 : vi.expectedQty,
    }));

    const verifyReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `app_session=${verifierToken}`,
        },
        body: JSON.stringify({
          action: "APPROVE",
          items,
        }),
      }
    );

    const verifyRes = await verifyOrder(verifyReq, {
      params: Promise.resolve({ id: order.id }),
    });

    assert.equal(verifyRes.status, 422, "Approval with shortage must return 422 Unprocessable Entity");
    const errorData = await verifyRes.json();
    assert.ok(
      errorData.message.includes("shortage") ||
        errorData.message.includes("Cannot approve"),
      "Message must describe shortage blocker"
    );
  });

  // ── TEST 10: Rejecting without a reason fails with HTTP 422 ───────
  test("TEST 10: Rejecting without a reason fails with HTTP 422", async () => {
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `app_session=${supervisorToken}`,
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 30,
        fabricRollId: "ROLL-TEST-010",
        actualFabricYards: 55.0,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201);
    const { order }: { order: OrderRef } = await createRes.json();

    const rejectReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `app_session=${verifierToken}`,
        },
        body: JSON.stringify({
          action: "REJECT",
          rejectionNote: "   ",
        }),
      }
    );

    const rejectRes = await verifyOrder(rejectReq, {
      params: Promise.resolve({ id: order.id }),
    });

    assert.equal(rejectRes.status, 422, "Empty rejection note must fail with 422");
  });

  // ── TEST 11: Sewing Supervisor starts sewing on VERIFIED batch ───
  test("TEST 11: Sewing Supervisor can start sewing on VERIFIED batch -> transitions to SEWING_IN_PROGRESS", async () => {
    // Create and verify an order
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `app_session=${supervisorToken}`,
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 50,
        fabricRollId: "ROLL-TEST-011",
        actualFabricYards: 90.0,
      }),
    });

    const createRes = await createOrder(createReq);
    const { order }: { order: OrderRef } = await createRes.json();

    // Verify it
    const verifyReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `app_session=${verifierToken}`,
        },
        body: JSON.stringify({
          action: "APPROVE",
          items: order.verificationItems.map((vi) => ({
            verificationItemId: vi.id,
            actualQty: vi.expectedQty,
          })),
        }),
      }
    );
    await verifyOrder(verifyReq, { params: Promise.resolve({ id: order.id }) });

    // Sewing supervisor starts sewing
    const startReq = new NextRequest(
      `http://localhost:3000/api/sewing/${order.id}/start`,
      {
        method: "POST",
        headers: {
          Cookie: `app_session=${sewingToken}`,
        },
      }
    );

    const startRes = await startSewing(startReq, {
      params: Promise.resolve({ id: order.id }),
    });

    assert.equal(startRes.status, 200);
    const data = await startRes.json();
    assert.equal(data.order.status, OrderStatus.SEWING_IN_PROGRESS);
  });

  // ── TEST 12: Server-side wastage calculation matches formula ──────
  test("TEST 12: Server-side wastage calculation matches formula: ((actual - expected)/expected)*100", async () => {
    // 50 garments × 1.8 yds = 90.0 yds expected. Actual = 92.5 yds. Wastage = 2.78%
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `app_session=${supervisorToken}`,
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 50,
        fabricRollId: "ROLL-TEST-012",
        actualFabricYards: 92.5,
      }),
    });

    const createRes = await createOrder(createReq);
    const { order }: { order: OrderRef } = await createRes.json();

    const verifyReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `app_session=${verifierToken}`,
        },
        body: JSON.stringify({
          action: "APPROVE",
          items: order.verificationItems.map((vi) => ({
            verificationItemId: vi.id,
            actualQty: vi.expectedQty,
          })),
        }),
      }
    );

    const verifyRes = await verifyOrder(verifyReq, {
      params: Promise.resolve({ id: order.id }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.wastagePct, 2.78);
  });

  // ── TEST 13: GET /api/auth/me returns authenticated role from database session ───
  test("TEST 13: GET /api/auth/me returns authenticated role strictly from session", async () => {
    const meReq = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: {
        Cookie: `app_session=${supervisorToken}`,
      },
    });

    const meRes = await getAuthMe(meReq);
    assert.equal(meRes.status, 200, "Authenticated session must return HTTP 200");
    const { user }: { user: { role: string; email: string } } = await meRes.json();
    assert.equal(user.role, "cutting_supervisor", "Role must be cutting_supervisor");
    assert.ok(user.email.includes("supervisor"));
  });

  // ── TEST 14: POST /api/auth/logout invalidates session cookie ────
  test("TEST 14: POST /api/auth/logout clears and invalidates session cookie", async () => {
    const logoutRes = await authLogout();
    assert.equal(logoutRes.status, 200);
    const setCookie = logoutRes.headers.get("Set-Cookie");
    assert.ok(setCookie, "Set-Cookie header must be present on logout");
    assert.ok(setCookie.includes("Max-Age=0"), "Cookie must be expired immediately (Max-Age=0)");
  });

  // ── TEST 15: GET /api/auth/me without session cookie returns HTTP 401 ────
  test("TEST 15: GET /api/auth/me without session cookie returns HTTP 401 Unauthorized", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/auth/me");
    const unauthRes = await getAuthMe(unauthReq);
    assert.equal(unauthRes.status, 401, "Unauthenticated session check must return 401");
  });

  // ── TEST 16: Explicit login as Cutting Verifier authenticates and returns cutting_verifier role ─
  test("TEST 16: Explicit login as Cutting Verifier sets authenticated role to cutting_verifier", async () => {
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "verifier@apparelfow.com",
        password: "Verifier@123",
      }),
    });

    const loginRes = await authLogin(loginReq);
    assert.equal(loginRes.status, 200, "Verifier login must succeed with HTTP 200");
    const data = await loginRes.json();
    assert.equal(data.user.role, "cutting_verifier");
    const setCookie = loginRes.headers.get("Set-Cookie");
    assert.ok(setCookie && setCookie.includes("app_session"), "Login must issue app_session cookie");
  });
});

