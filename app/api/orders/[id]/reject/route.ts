import { NextRequest } from "next/server";
import { POST as verifyPost } from "../verify/route";

// ─── POST /api/orders/[id]/reject ────────────────────────────────────
// Convenience route delegating to verification terminal reject action.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const cloned = request.clone();
    const body = await cloned.json().catch(() => ({}));
    const newBody = { ...body, action: "REJECT" };

    const newRequest = new NextRequest(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(newBody),
    });

    return verifyPost(newRequest, context);
  } catch (error) {
    console.error("[POST /api/orders/[id]/reject] Error:", error);
    return Response.json(
      { error: "Internal Server Error", message: "Failed to process rejection" },
      { status: 500 }
    );
  }
}
