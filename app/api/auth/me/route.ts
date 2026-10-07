import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return Response.json(
        {
          error: "Unauthorized",
          message: "No active session found.",
        },
        { status: 401 }
      );
    }

    return Response.json(
      {
        user: {
          id: auth.user.id,
          name: auth.user.name,
          email: auth.user.email,
          role: auth.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/auth/me] Error:", error);
    return Response.json(
      { error: "Internal Server Error", message: "Failed to fetch session." },
      { status: 500 }
    );
  }
}
