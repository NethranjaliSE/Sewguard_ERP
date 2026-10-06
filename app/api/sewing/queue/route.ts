import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

// ─── GET /api/sewing/queue ───────────────────────────────────────────
// Returns only VERIFIED and in-progress sewing batches for the Sewing Supervisor.
// Strictly enforces server-side role check: only sewing_supervisor can access.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ["sewing_supervisor"]);
    if ("errorResponse" in auth) {
      return auth.errorResponse;
    }

    const { searchParams } = request.nextUrl;
    const requestedStatus = searchParams.get("status") as OrderStatus | null;

    // Database query strictly isolated to VERIFIED and SEWING_IN_PROGRESS
    const allowedStatuses: OrderStatus[] = [
      OrderStatus.VERIFIED,
      OrderStatus.SEWING_IN_PROGRESS,
    ];

    const targetStatus =
      requestedStatus && allowedStatuses.includes(requestedStatus)
        ? requestedStatus
        : { in: allowedStatuses };

    const orders = await prisma.cuttingOrder.findMany({
      where: {
        status: targetStatus,
      },
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
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ orders }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/sewing/queue] Error:", error);
    return Response.json(
      { error: "Internal Server Error", message: "Failed to fetch sewing queue" },
      { status: 500 }
    );
  }
}
