import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

export type AppRole =
  | "cutting_supervisor"
  | "cutting_verifier"
  | "sewing_supervisor";

export interface SafeUser {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  createdAt?: Date;
}

export interface AuthenticatedUser {
  user: SafeUser;
  role: AppRole;
}

export const SESSION_COOKIE_NAME = "app_session";
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    return "apparelflow-gatekeeper-session-secret-key-32chars-min";
  }
  return secret;
}

interface SessionPayload {
  userId: string;
  iat: number;
  exp: number;
}

/**
 * Creates a cryptographically signed session token for the user ID.
 */
export function createSessionToken(userId: string): string {
  const payload: SessionPayload = {
    userId,
    iat: Date.now(),
    exp: Date.now() + SESSION_EXPIRY_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Validates a session token using HMAC-SHA256 and constant-time comparison.
 */
export function verifySessionToken(token: string): { userId: string } | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(data)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8")
    ) as SessionPayload;

    if (!payload.userId || payload.exp < Date.now()) {
      return null;
    }

    return { userId: payload.userId };
  } catch {
    return null;
  }
}

/**
 * Returns standardized HTTP-only cookie configuration.
 */
export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_EXPIRY_MS / 1000),
  };
}

/**
 * Hashes a plaintext password using bcrypt with salt rounds = 10.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Extracts the session token from cookies or the Authorization header.
 */
function extractToken(request: NextRequest | Request): string | null {
  // 1. Try NextRequest cookies API
  if ("cookies" in request && typeof request.cookies?.get === "function") {
    const cookie = request.cookies.get(SESSION_COOKIE_NAME);
    if (cookie?.value) return cookie.value;
  }

  // 2. Try raw Cookie header
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(
      new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`)
    );
    if (match?.[1]) return decodeURIComponent(match[1]);
  }

  // 3. Try Authorization: Bearer <token> header (convenient for API testing/cURL)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Resolves the authenticated user from the server session and loads their
 * actual role directly from the PostgreSQL database (the single source of truth).
 *
 * Client-submitted role fields in request bodies, queries, or headers are
 * NEVER trusted.
 */
export async function getAuthenticatedUser(
  request: NextRequest | Request
): Promise<AuthenticatedUser | null> {
  const token = extractToken(request);
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  // Single Source of Truth: Look up user in database
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    role: user.role as AppRole,
  };
}

/**
 * Enforces server-side authentication and role-based access control (RBAC).
 * Returns either the AuthenticatedUser or an appropriate HTTP 401/403 Response.
 */
export async function requireAuth(
  request: NextRequest,
  allowedRoles?: AppRole[]
): Promise<AuthenticatedUser | { errorResponse: Response }> {
  const auth = await getAuthenticatedUser(request);

  if (!auth) {
    return {
      errorResponse: Response.json(
        {
          error: "Unauthorized",
          message: "Authentication required. Please sign in with your credentials.",
        },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    return {
      errorResponse: Response.json(
        {
          error: "Forbidden",
          message: `Role "${auth.role}" does not have permission to perform this action.`,
        },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/**
 * Convenience helper enforcing a specific single role.
 */
export async function requireRole(
  request: NextRequest,
  role: AppRole
): Promise<AuthenticatedUser | { errorResponse: Response }> {
  return requireAuth(request, [role]);
}
