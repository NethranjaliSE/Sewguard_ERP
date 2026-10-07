"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────

export type AppRole =
  | "cutting_supervisor"
  | "cutting_verifier"
  | "sewing_supervisor";

export interface SafeUser {
  id: string;
  name: string;
  email: string | null;
  role: AppRole;
}

export interface RoleContextValue {
  user: SafeUser | null;
  role: AppRole | null;
  roleLabel: string;
  loading: boolean;
  authenticated: boolean;
  preselectedRole: AppRole | null;
  setPreselectedRole: (role: AppRole | null) => void;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  logoutAndPrepareSwitch: (targetRole: AppRole) => Promise<void>;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  cutting_supervisor: "Cutting Supervisor",
  cutting_verifier: "Cutting Verifier",
  sewing_supervisor: "Sewing Supervisor",
};

// ─── Context ─────────────────────────────────────────────────────────

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [preselectedRole, setPreselectedRole] = useState<AppRole | null>(null);

  // Fetch the active authenticated user on initial mount asynchronously
  useEffect(() => {
    let isMounted = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted) {
          setUser(data?.user || null);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[RoleContext] Error fetching current user:", err);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Standard email/password login
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (res.ok && data.user) {
          setUser(data.user);
          setPreselectedRole(null);
          return { success: true };
        }

        return {
          success: false,
          error: data.message || "Invalid credentials provided.",
        };
      } catch (err) {
        console.error("[RoleContext] Login failed:", err);
        return {
          success: false,
          error: "A network error occurred. Please try again.",
        };
      }
    },
    []
  );

  // Invalidate server session and reset client state
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("[RoleContext] Logout request error:", err);
    } finally {
      setUser(null);
    }
  }, []);

  // Logout current session and set target role to pre-fill on login screen
  const logoutAndPrepareSwitch = useCallback(
    async (targetRole: AppRole) => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (err) {
        console.error("[RoleContext] Logout error during role switch:", err);
      } finally {
        setUser(null);
        setPreselectedRole(targetRole);
      }
    },
    []
  );

  // Derive role strictly from authenticated server user
  const role = user?.role || null;
  const roleLabel = role ? ROLE_LABELS[role] : "Unauthenticated";
  const authenticated = !!user;

  return (
    <RoleContext.Provider
      value={{
        user,
        role,
        roleLabel,
        loading,
        authenticated,
        preselectedRole,
        setPreselectedRole,
        login,
        logout,
        logoutAndPrepareSwitch,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a <RoleProvider>");
  }
  return context;
}
