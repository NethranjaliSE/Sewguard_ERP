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
  cutting_supervisor: "bg-[#2563EB] text-white shadow-xs",
  cutting_verifier: "bg-emerald-600 text-white shadow-xs",
  sewing_supervisor: "bg-indigo-600 text-white shadow-xs",
};

const ROLE_INACTIVE =
  "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300";

// ─── Navbar ──────────────────────────────────────────────────────────

function Navbar() {
  const { role, setRole, roleLabel } = useRole();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-[#0F172A] text-white shadow-sm font-black text-lg tracking-wider">
              AF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#0F172A] leading-tight">
                  ApparelFlow ERP
                </h1>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-[#64748B] font-medium">
                Gatekeeper Verification System
              </p>
            </div>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-500">Active Persona:</span>
              <span className="text-xs font-semibold text-slate-800">
                {roleLabel}
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => {
                const isActive = role === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`
                      inline-flex items-center gap-1.5
                      px-2.5 py-1.5
                      rounded-md
                      text-xs font-semibold
                      transition-all duration-150
                      cursor-pointer
                      ${isActive ? ROLE_COLORS[r] : ROLE_INACTIVE}
                    `.trim()}
                    aria-pressed={isActive}
                    title={`Switch to ${ROLE_LABELS[r]}`}
                  >
                    {ROLE_ICONS[r]}
                    <span className="hidden sm:inline">{ROLE_LABELS[r]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Role Color Accent Bar */}
      <div
        className={`h-0.5 transition-all duration-300 ${
          role === "cutting_supervisor"
            ? "bg-[#2563EB]"
            : role === "cutting_verifier"
            ? "bg-emerald-600"
            : "bg-indigo-600"
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
