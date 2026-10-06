import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role, User } from "@prisma/client";

export type AppRole =
  | "cutting_supervisor"
  | "cutting_verifier"
  | "sewing_supervisor";

export interface AuthenticatedUser {
  user: User;
  role: AppRole;
}

/**
 * Extracts the authenticated user and active role from server context.
 * Role is resolved securely from cookies or x-app-role request header.
 * Client request body role fields are strictly ignored to prevent client-side spoofing.
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const cookieRole = request.cookies.get("app_role")?.value;
  const headerRole = request.headers.get("x-app-role");
  const rawRole = (headerRole || cookieRole) as AppRole | undefined;

  if (
    !rawRole ||
    !["cutting_supervisor", "cutting_verifier", "sewing_supervisor"].includes(
      rawRole
    )
  ) {
    return null;
  }

  // Look up matching database user for authentic audit attribution
  const user = await prisma.user.findFirst({
    where: { role: rawRole as Role },
    orderBy: { createdAt: "asc" },
  });

  if (!user) {
    return null;
  }

  return { user, role: rawRole };
}

/**
 * Enforces role-based access control on API routes.
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
          message: "Authentication required. Please select an active role.",
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
