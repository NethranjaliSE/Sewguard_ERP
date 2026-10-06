import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

// ─── GET /api/orders ─────────────────────────────────────────────────
// Returns orders with recipe info and verification items.
// Enforces role-based query scoping: Sewing Supervisor can NEVER see
// PENDING_VERIFICATION or REJECTED orders (enforced at database query level).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if ("errorResponse" in auth) {
      return auth.errorResponse;
    }

    const { searchParams } = request.nextUrl;
    const requestedStatus = searchParams.get("status") as OrderStatus | null;

    // Build query filter with strict server-side RBAC scoping
    const where: Record<string, unknown> = {};

    if (auth.role === "sewing_supervisor") {
      // SEWING SUPERVISOR ISOLATION:
      // Can ONLY query VERIFIED or SEWING_IN_PROGRESS orders.
      // Any attempt to request PENDING_VERIFICATION or REJECTED is blocked at DB level.
      if (
        requestedStatus &&
        requestedStatus !== OrderStatus.VERIFIED &&
        requestedStatus !== OrderStatus.SEWING_IN_PROGRESS
      ) {
        return Response.json(
          {
            error: "Forbidden",
            message:
              "Sewing Supervisors cannot access orders that are not verified for sewing.",
          },
          { status: 403 }
        );
      }

      where.status = requestedStatus
        ? requestedStatus
        : { in: [OrderStatus.VERIFIED, OrderStatus.SEWING_IN_PROGRESS] };
    } else {
      if (requestedStatus) {
        where.status = requestedStatus;
      }
    }

    const orders = await prisma.cuttingOrder.findMany({
      where,
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
    console.error("[GET /api/orders] Error:", error);
    return Response.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// ─── POST /api/orders ────────────────────────────────────────────────
// Creates a new CuttingOrder with verification items scaled by targetQty * piecesPerGarment.
// Server validates all fields and restricts creation strictly to cutting_supervisor.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ["cutting_supervisor"]);
    if ("errorResponse" in auth) {
      return auth.errorResponse;
    }

    const body = await request.json();
    const { recipeId, targetQty, fabricRollId, actualFabricYards } = body;

    // ── Input validation ──────────────────────────────────────────
    if (!recipeId || targetQty == null || !fabricRollId || actualFabricYards == null) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message:
            "Missing required fields: recipeId, targetQty, fabricRollId, actualFabricYards",
        },
        { status: 422 }
      );
    }

    const parsedQty = Number(targetQty);
    if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message: "targetQty must be a positive integer greater than zero.",
        },
        { status: 422 }
      );
    }

    const parsedActualFabric = Number(actualFabricYards);
    if (isNaN(parsedActualFabric) || parsedActualFabric <= 0) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message: "actualFabricYards must be a positive number greater than zero.",
        },
        { status: 422 }
      );
    }

    const trimmedRollId = String(fabricRollId).trim();
    if (trimmedRollId.length === 0) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message: "fabricRollId cannot be empty.",
        },
        { status: 422 }
      );
    }

    // ── Fetch recipe & components ─────────────────────────────────
    const recipe = await prisma.recipe.findUnique({
      where: { id: String(recipeId) },
      include: { components: true },
    });

    if (!recipe) {
      return Response.json(
        { error: "Not Found", message: "Recipe not found." },
        { status: 404 }
      );
    }

    // Expected fabric formula: targetQty × standard fabric yards per garment
    const expectedFabricYards = parseFloat(
      (parsedQty * recipe.stdFabricYards).toFixed(2)
    );

    // Generate readable order number: ORD-XXXX
    const count = await prisma.cuttingOrder.count();
    const orderNo = `ORD-${String(count + 1).padStart(4, "0")}`;

    // ── Create order + verification items atomically ────────
    const order = await prisma.cuttingOrder.create({
      data: {
        orderNo,
        recipeId: recipe.id,
        targetQty: parsedQty,
        fabricRollId: trimmedRollId,
        actualFabricYards: parsedActualFabric,
        expectedFabricYards,
        status: OrderStatus.PENDING_VERIFICATION,
        createdById: auth.user.id,
        verificationItems: {
          create: recipe.components.map((comp) => ({
            recipeComponentId: comp.id,
            // Formula: targetQty × piecesPerGarment
            expectedQty: (comp.piecesPerGarment || comp.expectedQty) * parsedQty,
          })),
        },
      },
      include: {
        recipe: { include: { components: true } },
        verificationItems: { include: { recipeComponent: true } },
        createdBy: {
          select: { id: true, name: true, role: true, email: true },
        },
      },
    });

    return Response.json({ order }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/orders] Error:", error);
    return Response.json(
      { error: "Internal Server Error", message: "Failed to create cutting order" },
      { status: 500 }
    );
  }
}
