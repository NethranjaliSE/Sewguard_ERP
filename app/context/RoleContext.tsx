"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
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

// ─── Context ─────────────────────────────────────────────────────────

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<AppRole>("cutting_supervisor");

  const setRole = useCallback((newRole: AppRole) => {
    setRoleState(newRole);
  }, []);

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
