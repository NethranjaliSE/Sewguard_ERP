import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { OrderStatus } from "@prisma/client";

// ─── GET /api/orders/[id] ────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if ("errorResponse" in auth) {
      return auth.errorResponse;
    }

    const { id: orderId } = await params;

    const order = await prisma.cuttingOrder.findUnique({
      where: { id: orderId },
      include: {
        recipe: {
          include: {
            components: {
              orderBy: { componentName: "asc" },
            },
          },
        },
        verificationItems: {
          include: {
            recipeComponent: true,
          },
          orderBy: {
            recipeComponent: { componentName: "asc" },
          },
        },
        createdBy: {
          select: { id: true, name: true, role: true, email: true },
        },
        verificationLog: {
          include: {
            verifiedBy: {
              select: { id: true, name: true, role: true, email: true },
            },
          },
        },
      },
    });

    if (!order) {
      return Response.json(
        { error: "Not Found", message: "Cutting order not found." },
        { status: 404 }
      );
    }

    // Sewing supervisor cannot inspect non-verified/rejected orders
    if (
      auth.role === "sewing_supervisor" &&
      order.status !== OrderStatus.VERIFIED &&
      order.status !== OrderStatus.SEWING_IN_PROGRESS
    ) {
      return Response.json(
        {
          error: "Forbidden",
          message: "Sewing Supervisors can only inspect verified sewing batches.",
        },
        { status: 403 }
      );
    }

    return Response.json({ order }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/orders/[id]] Error:", error);
    return Response.json(
      { error: "Internal Server Error", message: "Failed to fetch order" },
      { status: 500 }
    );
  }
}
