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

describe("ApparelFlow ERP — Gatekeeper & RBAC API Test Suite", () => {
  let testRecipeId: string;
  let supervisorUser: User | null = null;
  let verifierUser: User | null = null;
  let sewingUser: User | null = null;

  before(async () => {
    // Ensure base recipes and users exist
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

  // ── TEST 1: All GREEN components can be approved ─────────────────
  test("TEST 1: All GREEN components can be approved by authenticated Cutting Verifier -> order becomes VERIFIED", async () => {
    // 1. Create cutting order as supervisor
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-role": "cutting_supervisor",
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 50,
        fabricRollId: "ROLL-TEST-001",
        actualFabricYards: 92.5,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201, "Order creation must succeed");
    const { order }: { order: OrderRef } = await createRes.json();
    assert.equal(order.status, OrderStatus.PENDING_VERIFICATION);

    // 2. Approve as Cutting Verifier with all matching counts (GREEN)
    const items = order.verificationItems.map((vi) => ({
      verificationItemId: vi.id,
      actualQty: vi.expectedQty, // Exact match
    }));

    const verifyReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-role": "cutting_verifier",
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

    assert.equal(verifyRes.status, 200, "Approval must succeed");
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.order.status, OrderStatus.VERIFIED);
    assert.ok(verifyData.log, "VerificationLog entry must be created");
    assert.equal(verifyData.log.action, "APPROVED");

    // Check DB state directly
    const dbOrder = await prisma.cuttingOrder.findUnique({
      where: { id: order.id },
      include: { verificationLog: true },
    });
    assert.equal(dbOrder?.status, OrderStatus.VERIFIED);
    assert.equal(dbOrder?.verificationLog?.action, "APPROVED");
  });

  // ── TEST 2: Hard Stop — At least one RED component blocks approval ─
  test("TEST 2: At least one RED component blocks approval with HTTP 422 -> order does NOT become VERIFIED", async () => {
    // 1. Create order
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-role": "cutting_supervisor",
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 50,
        fabricRollId: "ROLL-TEST-002",
        actualFabricYards: 91.0,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201);
    const { order }: { order: OrderRef } = await createRes.json();

    // 2. Introduce shortage in one component (e.g. Sleeves expected 100, actual 98)
    const items = order.verificationItems.map((vi, index) => ({
      verificationItemId: vi.id,
      actualQty: index === 0 ? vi.expectedQty - 2 : vi.expectedQty, // First item is RED
    }));

    // 3. Attempt approval
    const verifyReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-role": "cutting_verifier",
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

    assert.equal(
      verifyRes.status,
      422,
      "Approval with RED component must return HTTP 422 Unprocessable Entity"
    );

    const errorData = await verifyRes.json();
    assert.ok(
      errorData.message.includes("shortage") ||
        errorData.error.includes("shortage") ||
        errorData.message.includes("Cannot approve"),
      "Error response must describe shortage blocker"
    );

    // Verify DB state did NOT change to VERIFIED
    const dbOrder = await prisma.cuttingOrder.findUnique({
      where: { id: order.id },
    });
    assert.equal(dbOrder?.status, OrderStatus.PENDING_VERIFICATION);
  });

  // ── TEST 3: Rejecting without a reason fails with HTTP 422 ────────
  test("TEST 3: Rejecting without a reason fails with HTTP 422", async () => {
    // 1. Create order
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-role": "cutting_supervisor",
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 30,
        fabricRollId: "ROLL-TEST-003",
        actualFabricYards: 55.0,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201);
    const { order }: { order: OrderRef } = await createRes.json();

    // 2. Reject with empty rejection note
    const rejectReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-role": "cutting_verifier",
        },
        body: JSON.stringify({
          action: "REJECT",
          rejectionNote: "   ", // whitespace only
        }),
      }
    );

    const rejectRes = await verifyOrder(rejectReq, {
      params: Promise.resolve({ id: order.id }),
    });

    assert.equal(
      rejectRes.status,
      422,
      "Rejecting without reason must return HTTP 422"
    );

    // 3. Reject with valid reason succeeds
    const validRejectReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-role": "cutting_verifier",
        },
        body: JSON.stringify({
          action: "REJECT",
          rejectionNote: "Severe fabric defect on front panel pattern",
        }),
      }
    );

    const validRejectRes = await verifyOrder(validRejectReq, {
      params: Promise.resolve({ id: order.id }),
    });

    assert.equal(validRejectRes.status, 200, "Valid rejection must succeed");
    const validRejectData = await validRejectRes.json();
    assert.equal(validRejectData.order.status, OrderStatus.REJECTED);
  });

  // ── TEST 4: Cutting Supervisor cannot approve verification ────────
  test("TEST 4: Cutting Supervisor cannot approve verification (returns HTTP 403)", async () => {
    // 1. Create order
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-role": "cutting_supervisor",
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 40,
        fabricRollId: "ROLL-TEST-004",
        actualFabricYards: 72.0,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201);
    const { order }: { order: OrderRef } = await createRes.json();

    // 2. Supervisor attempts direct verification
    const verifyReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-role": "cutting_supervisor", // UNAUTHORIZED ROLE
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

    assert.equal(
      verifyRes.status,
      403,
      "Cutting supervisor attempting verify must return HTTP 403 Forbidden"
    );
  });

  // ── TEST 5: Sewing Queue returns ONLY VERIFIED orders ─────────────
  test("TEST 5: Sewing Queue returns ONLY VERIFIED orders (pending and rejected never appear)", async () => {
    // Request sewing queue as sewing_supervisor
    const queueReq = new NextRequest("http://localhost:3000/api/sewing/queue", {
      headers: { "x-app-role": "sewing_supervisor" },
    });

    const queueRes = await getSewingQueue(queueReq);
    assert.equal(queueRes.status, 200);
    const { orders }: { orders: Array<{ status: OrderStatus }> } = await queueRes.json();

    assert.ok(Array.isArray(orders));
    // Verify that every single order returned is VERIFIED or SEWING_IN_PROGRESS
    for (const ord of orders) {
      assert.ok(
        ord.status === OrderStatus.VERIFIED ||
          ord.status === OrderStatus.SEWING_IN_PROGRESS,
        `Sewing queue returned invalid order status: ${ord.status}`
      );
      assert.notEqual(
        ord.status,
        OrderStatus.PENDING_VERIFICATION,
        "Pending verification orders must never appear in sewing queue"
      );
      assert.notEqual(
        ord.status,
        OrderStatus.REJECTED,
        "Rejected orders must never appear in sewing queue"
      );
    }
  });

  // ── TEST 6: Role Security — Verifier/Sewing cannot create orders ───
  test("TEST 6: Cutting Verifier and Sewing Supervisor cannot create cutting orders (returns HTTP 403)", async () => {
    const verifierReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-role": "cutting_verifier",
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 20,
        fabricRollId: "ROLL-TEST-006A",
        actualFabricYards: 36.0,
      }),
    });

    const verifierRes = await createOrder(verifierReq);
    assert.equal(
      verifierRes.status,
      403,
      "Verifier creating order must return 403"
    );

    const sewingReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-role": "sewing_supervisor",
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 20,
        fabricRollId: "ROLL-TEST-006B",
        actualFabricYards: 36.0,
      }),
    });

    const sewingRes = await createOrder(sewingReq);
    assert.equal(
      sewingRes.status,
      403,
      "Sewing supervisor creating order must return 403"
    );
  });

  // ── TEST 7: Sewing Supervisor starts sewing assembly ──────────────
  test("TEST 7: Sewing Supervisor can start sewing on VERIFIED batch -> transitions to SEWING_IN_PROGRESS", async () => {
    // Find or create a verified order
    let verifiedOrder = await prisma.cuttingOrder.findFirst({
      where: { status: OrderStatus.VERIFIED },
    });

    if (!verifiedOrder) {
      assert.ok(supervisorUser, "Supervisor user required");
      // Create and verify one
      const order = await prisma.cuttingOrder.create({
        data: {
          recipeId: testRecipeId,
          targetQty: 50,
          fabricRollId: "ROLL-TEST-007",
          actualFabricYards: 90.0,
          expectedFabricYards: 90.0,
          status: OrderStatus.VERIFIED,
          createdById: supervisorUser.id,
        },
      });
      verifiedOrder = order;
    }

    const startReq = new NextRequest(
      `http://localhost:3000/api/sewing/${verifiedOrder.id}/start`,
      {
        method: "POST",
        headers: {
          "x-app-role": "sewing_supervisor",
        },
      }
    );

    const startRes = await startSewing(startReq, {
      params: Promise.resolve({ id: verifiedOrder.id }),
    });

    assert.equal(startRes.status, 200, "Starting sewing assembly must succeed");
    const data = await startRes.json();
    assert.equal(data.order.status, OrderStatus.SEWING_IN_PROGRESS);
  });

  // ── TEST 8: Server-Side Wastage Calculation Formula ──────────────
  test("TEST 8: Server-side wastage calculation matches formula: ((actual - expected)/expected)*100", async () => {
    // Create order with 50 garments of Casual Blouse (1.8 yds/garment -> 90 yds expected)
    // Actual fabric used = 92.5 yds
    // Wastage = ((92.5 - 90.0) / 90.0) * 100 = 2.78%
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-role": "cutting_supervisor",
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        targetQty: 50,
        fabricRollId: "ROLL-TEST-008",
        actualFabricYards: 92.5,
      }),
    });

    const createRes = await createOrder(createReq);
    assert.equal(createRes.status, 201);
    const { order }: { order: OrderRef } = await createRes.json();
    assert.equal(order.expectedFabricYards, 90.0);

    // Verify all matching counts
    const verifyReq = new NextRequest(
      `http://localhost:3000/api/orders/${order.id}/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-role": "cutting_verifier",
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

    // Verify server calculated wastage
    assert.equal(verifyData.wastagePct, 2.78);
    assert.equal(verifyData.log.wastagePct, 2.78);
  });
});
