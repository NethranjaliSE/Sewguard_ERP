import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, ComponentStatus } from "@prisma/client";

// ─── POST /api/orders/[id]/verify ────────────────────────────────────
// Handles APPROVE and REJECT actions for cutting order verification.
// Creates an immutable VerificationLog entry (audit trail).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    const body = await request.json();
    const { action, role, items, rejectionNote } = body as {
      action: "APPROVE" | "REJECT";
      role: string;
      items?: Array<{ verificationItemId: string; actualQty: number }>;
      rejectionNote?: string;
    };

    // ── Role guard ────────────────────────────────────────────────
    if (role !== "cutting_verifier") {
      return Response.json(
        { error: "Forbidden: Only a cutting_verifier can verify orders." },
        { status: 403 }
      );
    }

    // ── Validate action ───────────────────────────────────────────
    if (!action || !["APPROVE", "REJECT"].includes(action)) {
      return Response.json(
        { error: 'Invalid action. Must be "APPROVE" or "REJECT".' },
        { status: 400 }
      );
    }

    // ── Fetch order ───────────────────────────────────────────────
    const order = await prisma.cuttingOrder.findUnique({
      where: { id: orderId },
      include: {
        verificationItems: { include: { recipeComponent: true } },
        verificationLog: true,
      },
    });

    if (!order) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status !== OrderStatus.PENDING_VERIFICATION) {
      return Response.json(
        { error: `Order has already been ${order.status.toLowerCase()}.` },
        { status: 409 }
      );
    }

    if (order.verificationLog) {
      return Response.json(
        { error: "This order already has a verification log entry." },
        { status: 409 }
      );
    }

    // ── REJECT path ───────────────────────────────────────────────
    if (action === "REJECT") {
      if (!rejectionNote || String(rejectionNote).trim().length === 0) {
        return Response.json(
          { error: "A rejection note is required when rejecting an order." },
          { status: 400 }
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.cuttingOrder.update({
          where: { id: orderId },
          data: { status: OrderStatus.REJECTED },
        });

        const log = await tx.verificationLog.create({
          data: {
            cuttingOrderId: orderId,
            action: "REJECTED",
            rejectionNote: String(rejectionNote).trim(),
            snapshotData: order.verificationItems.map((vi) => ({
              component: vi.recipeComponent.componentName,
              expectedQty: vi.expectedQty,
              actualQty: vi.actualQty,
              status: vi.status,
            })),
          },
        });

        return { order: updatedOrder, log };
      });

      return Response.json(
        { message: "Order rejected.", ...result },
        { status: 200 }
      );
    }

    // ── APPROVE path ──────────────────────────────────────────────
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: "Verification items with actual quantities are required for approval." },
        { status: 400 }
      );
    }

    // Build a map from the submitted items
    const submittedMap = new Map(
      items.map((i) => [i.verificationItemId, i.actualQty])
    );

    // ── Server-side recalculation ─────────────────────────────────
    // We NEVER trust the client's status calculations.
    const recalculated = order.verificationItems.map((vi) => {
      const actualQty = submittedMap.get(vi.id);

      if (actualQty == null || typeof actualQty !== "number" || actualQty < 0) {
        throw new Error(
          `Invalid or missing actual_qty for component "${vi.recipeComponent.componentName}" (item ${vi.id}).`
        );
      }

      let status: ComponentStatus;
      if (actualQty < vi.expectedQty) {
        status = ComponentStatus.SHORTAGE;
      } else if (actualQty === vi.expectedQty) {
        status = ComponentStatus.MATCH;
      } else {
        status = ComponentStatus.EXCESS;
      }

      return {
        ...vi,
        actualQty,
        status,
      };
    });

    // ── SERVER-SIDE HARD STOP ─────────────────────────────────────
    // If ANY component has a SHORTAGE, we REFUSE to approve.
    const hasShortage = recalculated.some(
      (item) => item.status === ComponentStatus.SHORTAGE
    );

    if (hasShortage) {
      const shortages = recalculated
        .filter((i) => i.status === ComponentStatus.SHORTAGE)
        .map(
          (i) =>
            `${i.recipeComponent.componentName}: expected ${i.expectedQty}, got ${i.actualQty}`
        );

      return Response.json(
        {
          error: "Cannot approve: one or more components have a SHORTAGE.",
          shortages,
        },
        { status: 422 }
      );
    }

    // ── Calculate wastage percentage ──────────────────────────────
    // wastage_pct = ((Actual Fabric - Expected Fabric) / Expected Fabric) * 100
    const wastagePct =
      order.expectedFabricYards > 0
        ? parseFloat(
            (
              ((order.actualFabricYards - order.expectedFabricYards) /
                order.expectedFabricYards) *
              100
            ).toFixed(2)
          )
        : 0;

    // ── Persist everything in a transaction ───────────────────────
    const result = await prisma.$transaction(async (tx) => {
      // Update each verification item with recalculated values
      for (const item of recalculated) {
        await tx.verificationItem.update({
          where: { id: item.id },
          data: {
            actualQty: item.actualQty,
            status: item.status,
          },
        });
      }

      // Update order status
      const updatedOrder = await tx.cuttingOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.VERIFIED },
        include: {
          verificationItems: { include: { recipeComponent: true } },
          recipe: true,
        },
      });

      // Create immutable audit trail log
      const log = await tx.verificationLog.create({
        data: {
          cuttingOrderId: orderId,
          action: "APPROVED",
          wastagePct,
          snapshotData: recalculated.map((item) => ({
            component: item.recipeComponent.componentName,
            expectedQty: item.expectedQty,
            actualQty: item.actualQty,
            status: item.status,
          })),
        },
      });

      return { order: updatedOrder, log };
    });

    return Response.json(
      {
        message: "Order approved and verified.",
        wastagePct,
        ...result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/orders/[id]/verify] Error:", error);

    if (error instanceof Error && error.message.includes("Invalid or missing")) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json(
      { error: "Internal server error during verification." },
      { status: 500 }
    );
  }
}
