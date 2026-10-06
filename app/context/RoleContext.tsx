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

export interface RoleContextValue {
  role: AppRole;
  setRole: (role: AppRole) => void;
  roleLabel: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  cutting_supervisor: "Cutting Supervisor",
  cutting_verifier: "Cutting Verifier",
  sewing_supervisor: "Sewing Supervisor",
};

function getInitialRole(): AppRole {
  if (typeof window === "undefined") return "cutting_supervisor";

  // Check document cookie first
  const match = document.cookie.match(/(?:^|; )app_role=([^;]*)/);
  if (match && match[1]) {
    const val = decodeURIComponent(match[1]) as AppRole;
    if (ROLE_LABELS[val]) return val;
  }

  // Fallback to localStorage
  const saved = localStorage.getItem("app_role") as AppRole | null;
  if (saved && ROLE_LABELS[saved]) return saved;

  return "cutting_supervisor";
}

// ─── Context ─────────────────────────────────────────────────────────

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<AppRole>(getInitialRole);

  const setRole = useCallback((newRole: AppRole) => {
    setRoleState(newRole);
    if (typeof window !== "undefined") {
      document.cookie = `app_role=${encodeURIComponent(
        newRole
      )}; path=/; max-age=86400; SameSite=Lax`;
      localStorage.setItem("app_role", newRole);
    }
  }, []);

  // Ensure cookie is synced on mount
  useEffect(() => {
    document.cookie = `app_role=${encodeURIComponent(
      role
    )}; path=/; max-age=86400; SameSite=Lax`;
  }, [role]);

  const roleLabel = ROLE_LABELS[role];

  return (
    <RoleContext.Provider value={{ role, setRole, roleLabel }}>
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

export { ROLE_LABELS };
