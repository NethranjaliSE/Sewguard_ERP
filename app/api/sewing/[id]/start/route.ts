import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

// ─── POST /api/sewing/[id]/start ──────────────────────────────────────
// Transitions order status: VERIFIED → SEWING_IN_PROGRESS
// Strictly enforces server-side role check (sewing_supervisor only)
// and valid state machine transition (must be VERIFIED).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request, ["sewing_supervisor"]);
    if ("errorResponse" in auth) {
      return auth.errorResponse;
    }

    const { id: orderId } = await params;

    const order = await prisma.cuttingOrder.findUnique({
      where: { id: orderId },
      include: { recipe: true },
    });

    if (!order) {
      return Response.json(
        { error: "Not Found", message: "Cutting order not found." },
        { status: 404 }
      );
    }

    // State machine check: order must be in VERIFIED status
    if (order.status !== OrderStatus.VERIFIED) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message: `Cannot start sewing assembly. Order must be in "VERIFIED" status, but is currently "${order.status}".`,
        },
        { status: 422 }
      );
    }

    const updatedOrder = await prisma.cuttingOrder.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SEWING_IN_PROGRESS,
      },
      include: {
        recipe: true,
        verificationItems: { include: { recipeComponent: true } },
        verificationLog: {
          include: {
            verifiedBy: {
              select: { id: true, name: true, role: true, email: true },
            },
          },
        },
      },
    });

    return Response.json(
      {
        message: "Sewing assembly started successfully.",
        order: updatedOrder,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/sewing/[id]/start] Error:", error);
    return Response.json(
      {
        error: "Internal Server Error",
        message: "Failed to start sewing assembly.",
      },
      { status: 500 }
    );
  }
}
