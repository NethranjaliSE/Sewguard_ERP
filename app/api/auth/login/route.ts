import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Bad Request", message: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return Response.json(
        {
          error: "Unprocessable Entity",
          message: "Email and password are required.",
        },
        { status: 422 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Look up user by email (case-insensitive with domain spelling tolerance)
    const altEmail1 = cleanEmail.replace("@apparelfow.com", "@apparelflow.com");
    const altEmail2 = cleanEmail.replace("@apparelflow.com", "@apparelfow.com");

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanEmail, mode: "insensitive" } },
          { email: { equals: altEmail1, mode: "insensitive" } },
          { email: { equals: altEmail2, mode: "insensitive" } },
        ],
      },
    });

    if (!user || !user.passwordHash) {
      return Response.json(
        {
          error: "Unauthorized",
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return Response.json(
        {
          error: "Unauthorized",
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    // Generate signed session token with userId
    const token = createSessionToken(user.id);
    const cookieOptions = getSessionCookieOptions();

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const response = Response.json(
      {
        message: "Authenticated successfully",
        user: safeUser,
      },
      { status: 200 }
    );

    // Set secure HTTP-only session cookie
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
    console.error("[POST /api/auth/login] Error:", error);
    return Response.json(
      { error: "Internal Server Error", message: "Failed to authenticate." },
      { status: 500 }
    );
  }
}
