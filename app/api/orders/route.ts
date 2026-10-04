import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

// ─── GET /api/orders ─────────────────────────────────────────────────
// Accepts an optional ?status= query parameter to filter orders.
// Returns orders with their recipe info and verification items.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const statusFilter = searchParams.get("status") as OrderStatus | null;

    const where = statusFilter ? { status: statusFilter } : {};

    const orders = await prisma.cuttingOrder.findMany({
      where,
      include: {
        recipe: {
          include: {
            components: true,
          },
        },
        verificationItems: {
          include: {
            recipeComponent: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, role: true },
        },
        verificationLog: true,
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
// Creates a new CuttingOrder with its VerificationItems pre-populated
// from the Recipe components, scaled by targetQty.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipeId, targetQty, fabricRollId, actualFabricYards, role } = body;

    // ── Role guard ────────────────────────────────────────────────
    if (role !== "cutting_supervisor") {
      return Response.json(
        { error: "Forbidden: Only a cutting_supervisor can create orders." },
        { status: 403 }
      );
    }

    // ── Input validation ──────────────────────────────────────────
    if (!recipeId || !targetQty || !fabricRollId || actualFabricYards == null) {
      return Response.json(
        { error: "Missing required fields: recipeId, targetQty, fabricRollId, actualFabricYards" },
        { status: 400 }
      );
    }

    if (typeof targetQty !== "number" || targetQty < 1) {
      return Response.json(
        { error: "targetQty must be a positive integer." },
        { status: 400 }
      );
    }

    if (typeof actualFabricYards !== "number" || actualFabricYards <= 0) {
      return Response.json(
        { error: "actualFabricYards must be a positive number." },
        { status: 400 }
      );
    }

    // ── Fetch recipe & components ─────────────────────────────────
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { components: true },
    });

    if (!recipe) {
      return Response.json(
        { error: "Recipe not found." },
        { status: 404 }
      );
    }

    // Calculate expected fabric yards (sum of component quantities × targetQty as proxy)
    // In a real system this would use a fabric consumption rate per component.
    // Here we use a simplified heuristic: 1.5 yards per component piece × targetQty
    const totalExpectedPieces = recipe.components.reduce(
      (sum, c) => sum + c.expectedQty,
      0
    );
    const expectedFabricYards = parseFloat(
      (totalExpectedPieces * targetQty * 0.25).toFixed(2)
    );

    // ── Create order + verification items in a transaction ────────
    const order = await prisma.cuttingOrder.create({
      data: {
        recipeId,
        targetQty: Math.floor(targetQty),
        fabricRollId: String(fabricRollId).trim(),
        actualFabricYards: Number(actualFabricYards),
        expectedFabricYards,
        status: OrderStatus.PENDING_VERIFICATION,
        verificationItems: {
          create: recipe.components.map((comp) => ({
            recipeComponentId: comp.id,
            expectedQty: comp.expectedQty * Math.floor(targetQty),
          })),
        },
      },
      include: {
        recipe: { include: { components: true } },
        verificationItems: { include: { recipeComponent: true } },
      },
    });

    return Response.json({ order }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/orders] Error:", error);
    return Response.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
