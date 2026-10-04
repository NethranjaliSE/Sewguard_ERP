"use client";

import React from "react";
import {
  RoleProvider,
  useRole,
  ROLE_LABELS,
  type AppRole,
} from "@/app/context/RoleContext";

// ─── Role icons ──────────────────────────────────────────────────────

const ROLE_ICONS: Record<AppRole, React.ReactNode> = {
  cutting_supervisor: (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
    </svg>
  ),
  cutting_verifier: (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  ),
  sewing_supervisor: (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path
        fillRule="evenodd"
        d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

const ROLE_COLORS: Record<AppRole, string> = {
  cutting_supervisor: "bg-blue-600 text-white hover:bg-blue-700",
  cutting_verifier: "bg-emerald-600 text-white hover:bg-emerald-700",
  sewing_supervisor: "bg-violet-600 text-white hover:bg-violet-700",
};

const ROLE_INACTIVE: string =
  "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300";

// ─── Navbar ──────────────────────────────────────────────────────────

function Navbar() {
  const { role, setRole, roleLabel } = useRole();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                ApparelFlow ERP
              </h1>
              <p className="text-xs text-slate-500 -mt-0.5">
                Gatekeeper Verification
              </p>
            </div>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 mr-1 hidden sm:inline">
              Active Role:
            </span>
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`
                  inline-flex items-center gap-1.5
                  px-3 py-1.5
                  rounded-lg
                  text-sm font-medium
                  transition-all duration-150
                  cursor-pointer
                  ${role === r ? ROLE_COLORS[r] : ROLE_INACTIVE}
                `.trim()}
                aria-pressed={role === r}
                title={`Switch to ${ROLE_LABELS[r]}`}
              >
                {ROLE_ICONS[r]}
                <span className="hidden md:inline">{ROLE_LABELS[r]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current role indicator bar */}
      <div
        className={`h-0.5 transition-all duration-300 ${
          role === "cutting_supervisor"
            ? "bg-blue-600"
            : role === "cutting_verifier"
            ? "bg-emerald-600"
            : "bg-violet-600"
        }`}
      />
    </header>
  );
}

// ─── ClientProviders (wraps RoleProvider + Navbar) ────────────────────

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </RoleProvider>
  );
}
