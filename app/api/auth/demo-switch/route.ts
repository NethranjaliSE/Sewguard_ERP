import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  type AppRole,
} from "@/lib/auth";

const ALLOWED_ROLES: AppRole[] = [
  "cutting_supervisor",
  "cutting_verifier",
  "sewing_supervisor",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const role = body?.role as AppRole | undefined;

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message: "Invalid role specified for demo switch.",
        },
        { status: 422 }
      );
    }

    // Look up the corresponding seeded demo user from the database
    const demoUser = await prisma.user.findFirst({
      where: { role: role as Role },
      orderBy: { createdAt: "asc" },
    });

    if (!demoUser) {
      return Response.json(
        {
          error: "Not Found",
          message: `Demo user for role "${role}" not found in database. Please run npm run prisma:seed.`,
        },
        { status: 404 }
      );
    }

    // Issue genuine signed session token for the demo user
    const token = createSessionToken(demoUser.id);
    const cookieOptions = getSessionCookieOptions();

    const response = Response.json(
      {
        message: `Authenticated as ${demoUser.name}`,
        user: {
          id: demoUser.id,
          name: demoUser.name,
          email: demoUser.email,
          role: demoUser.role,
        },
      },
      { status: 200 }
    );

    // Set HTTP-only session cookie
    response.headers.set(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=${
        cookieOptions.path
      }; Max-Age=${cookieOptions.maxAge}; ${
        cookieOptions.httpOnly ? "HttpOnly; " : ""
      }${cookieOptions.secure ? "Secure; " : ""}SameSite=${
        cookieOptions.sameSite
      }`
    );

    return response;
  } catch (error) {
    console.error("[POST /api/auth/demo-switch] Error:", error);
    return Response.json(
      { error: "Internal Server Error", message: "Failed to switch demo session." },
      { status: 500 }
    );
  }
}
