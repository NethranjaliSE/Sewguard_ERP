import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, ComponentStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

// ─── POST /api/orders/[id]/verify ────────────────────────────────────
// Handles Gatekeeper verification for Cutting Orders.
// Strictly enforces server-side role check (cutting_verifier only)
// and Server-Side Hard Stop on shortages (HTTP 422).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── 1 & 2: Server-side Authentication & RBAC Guard ────────────
    const auth = await requireAuth(request, ["cutting_verifier"]);
    if ("errorResponse" in auth) {
      return auth.errorResponse;
    }

    const { id: orderId } = await params;
    const body = await request.json();

    const { action, items, rejectionNote, rejectionReason } = body as {
      action?: "APPROVE" | "REJECT";
      items?: Array<{ verificationItemId?: string; id?: string; actualQty: number }>;
      rejectionNote?: string;
      rejectionReason?: string;
    };

    if (!action || !["APPROVE", "REJECT"].includes(action)) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message: 'Invalid action. Action must be "APPROVE" or "REJECT".',
        },
        { status: 422 }
      );
    }

    // ── 3: Load order from database ───────────────────────────────
    const order = await prisma.cuttingOrder.findUnique({
      where: { id: orderId },
      include: {
        recipe: { include: { components: true } },
        verificationItems: {
          include: { recipeComponent: true },
        },
        verificationLog: true,
      },
    });

    if (!order) {
      return Response.json(
        { error: "Not Found", message: "Cutting order not found." },
        { status: 404 }
      );
    }

    // State machine check: must be PENDING_VERIFICATION
    if (order.status !== OrderStatus.PENDING_VERIFICATION) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message: `Order cannot be verified because it is currently in "${order.status}" status.`,
        },
        { status: 422 }
      );
    }

    if (order.verificationLog) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message: "This order already has a verification log entry.",
        },
        { status: 422 }
      );
    }

    // ── REJECT PATH ───────────────────────────────────────────────
    if (action === "REJECT") {
      const reason = (rejectionNote || rejectionReason || "").trim();
      if (reason.length === 0) {
        return Response.json(
          {
            error: "Unprocessable Entity",
            message: "A rejection reason is required when rejecting a batch.",
          },
          { status: 422 }
        );
      }

      // Record any actual counts if provided alongside rejection
      const submittedMap = new Map<string, number>();
      if (Array.isArray(items)) {
        for (const it of items) {
          const key = it.verificationItemId || it.id;
          if (key && typeof it.actualQty === "number") {
            submittedMap.set(key, it.actualQty);
          }
        }
      }

      const result = await prisma.$transaction(
        async (tx) => {
          // Update items if counts were submitted
          const updatePromises: Promise<unknown>[] = [];
          for (const vi of order.verificationItems) {
            const act = submittedMap.get(vi.id);
            if (act != null && !isNaN(act) && act >= 0) {
              let status: ComponentStatus = ComponentStatus.MATCH;
              if (act < vi.expectedQty) status = ComponentStatus.SHORTAGE;
              else if (act > vi.expectedQty) status = ComponentStatus.EXCESS;

              updatePromises.push(
                tx.verificationItem.update({
                  where: { id: vi.id },
                  data: { actualQty: act, status },
                })
              );
            }
          }
          await Promise.all(updatePromises);

          const updatedOrder = await tx.cuttingOrder.update({
            where: { id: orderId },
            data: { status: OrderStatus.REJECTED },
            include: {
              recipe: true,
              verificationItems: { include: { recipeComponent: true } },
            },
          });

          const log = await tx.verificationLog.create({
            data: {
              cuttingOrderId: orderId,
              verifiedById: auth.user.id, // From server authentication context
              action: "REJECTED",
              decision: "REJECTED",
              rejectionNote: reason,
              snapshotData: order.verificationItems.map((vi) => ({
                component: vi.recipeComponent.componentName,
                expectedQty: vi.expectedQty,
                actualQty: submittedMap.get(vi.id) ?? vi.actualQty,
                status:
                  submittedMap.get(vi.id) != null
                    ? submittedMap.get(vi.id)! < vi.expectedQty
                      ? "SHORTAGE"
                      : submittedMap.get(vi.id)! === vi.expectedQty
                      ? "MATCH"
                      : "EXCESS"
                    : vi.status,
              })),
            },
          });

          return { order: updatedOrder, log };
        },
        {
          maxWait: 15000,
          timeout: 30000,
        }
      );

      return Response.json(
        {
          message: "Cutting batch rejected successfully.",
          ...result,
        },
        { status: 200 }
      );
    }

    // ── APPROVE PATH ──────────────────────────────────────────────
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message: "Verification items with actual counts are required for approval.",
        },
        { status: 422 }
      );
    }

    // Map submitted items by verificationItemId or id
    const submittedMap = new Map<string, number>();
    for (const it of items) {
      const key = it.verificationItemId || it.id;
      if (key && it.actualQty != null) {
        submittedMap.set(key, Number(it.actualQty));
      }
    }

    // Check all required components have been counted with valid non-negative integers
    for (const vi of order.verificationItems) {
      if (!submittedMap.has(vi.id)) {
        return Response.json(
          {
            error: "Unprocessable Entity",
            message: `Component "${vi.recipeComponent.componentName}" has not been counted.`,
          },
          { status: 422 }
        );
      }

      const val = submittedMap.get(vi.id)!;
      if (!Number.isInteger(val) || val < 0) {
        return Response.json(
          {
            error: "Unprocessable Entity",
            message: `Invalid count for "${vi.recipeComponent.componentName}". Actual quantity must be a non-negative integer.`,
          },
          { status: 422 }
        );
      }
    }

    // ── 5: Server-Side Status Recalculation (Independent of Client) ──
    const recalculated = order.verificationItems.map((vi) => {
      const actualQty = submittedMap.get(vi.id)!;

      let status: ComponentStatus;
      if (actualQty < vi.expectedQty) {
        status = ComponentStatus.SHORTAGE; // RED
      } else if (actualQty === vi.expectedQty) {
        status = ComponentStatus.MATCH; // GREEN
      } else {
        status = ComponentStatus.EXCESS; // YELLOW
      }

      return {
        id: vi.id,
        componentName: vi.recipeComponent.componentName,
        expectedQty: vi.expectedQty,
        actualQty,
        status,
        unit: vi.recipeComponent.unit,
      };
    });

    // ── 6: SERVER-SIDE HARD STOP ──────────────────────────────────
    // A batch with ANY RED / SHORTAGE component must NEVER be approved.
    const shortages = recalculated.filter(
      (item) => item.status === ComponentStatus.SHORTAGE
    );

    if (shortages.length > 0) {
      const shortageDetails = shortages.map(
        (s) =>
          `${s.componentName}: expected ${s.expectedQty}, actual ${s.actualQty} (missing ${
            s.expectedQty - s.actualQty
          } ${s.unit})`
      );

      return Response.json(
        {
          error: "Unprocessable Entity",
          message: "Cannot approve batch with shortage components",
          shortages: shortageDetails,
        },
        { status: 422 }
      );
    }

    // ── 7: Server-Side Wastage Calculation ────────────────────────
    // Expected fabric = targetQty × standard fabric yards per garment
    const stdYards = order.recipe.stdFabricYards || 1.5;
    const expectedFabricYards = parseFloat(
      (order.targetQty * stdYards).toFixed(2)
    );

    // Fabric Wastage % = ((Actual Fabric Used - Expected Fabric) / Expected Fabric) × 100
    const wastagePct =
      expectedFabricYards > 0
        ? parseFloat(
            (
              ((order.actualFabricYards - expectedFabricYards) /
                expectedFabricYards) *
              100
            ).toFixed(2)
          )
        : 0;

    // ── 8-12: Transactional Persistence & VerificationLog Creation ─
    const result = await prisma.$transaction(
      async (tx) => {
        // Update verification items concurrently
        await Promise.all(
          recalculated.map((item) =>
            tx.verificationItem.update({
              where: { id: item.id },
              data: {
                actualQty: item.actualQty,
                status: item.status,
              },
            })
          )
        );

        // Update order status: PENDING_VERIFICATION → VERIFIED
        const updatedOrder = await tx.cuttingOrder.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.VERIFIED,
            expectedFabricYards, // Ensure synced with formula
          },
          include: {
            recipe: { include: { components: true } },
            verificationItems: { include: { recipeComponent: true } },
            createdBy: {
              select: { id: true, name: true, role: true, email: true },
            },
          },
        });

        // Create immutable audit log
        const log = await tx.verificationLog.create({
          data: {
            cuttingOrderId: orderId,
            verifiedById: auth.user.id, // From authenticated server context
            action: "APPROVED",
            decision: "APPROVED",
            wastagePct,
            snapshotData: recalculated.map((item) => ({
              component: item.componentName,
              expectedQty: item.expectedQty,
              actualQty: item.actualQty,
              status: item.status,
            })),
          },
          include: {
            verifiedBy: {
              select: { id: true, name: true, role: true, email: true },
            },
          },
        });

        return { order: updatedOrder, log };
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );

    return Response.json(
      {
        message: "Cutting batch verified and approved successfully.",
        wastagePct,
        ...result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/orders/[id]/verify] Error:", error);
    return Response.json(
      {
        error: "Internal Server Error",
        message: "Verification failed due to an internal server error.",
      },
      { status: 500 }
    );
  }
}
