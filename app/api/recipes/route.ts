import { prisma } from "@/lib/prisma";

// ─── GET /api/recipes ────────────────────────────────────────────────
// Returns all recipes with their component breakdowns.
export async function GET() {
  try {
    const recipes = await prisma.recipe.findMany({
      include: {
        components: {
          orderBy: { componentName: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return Response.json({ recipes }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/recipes] Error:", error);
    return Response.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}
