"use client";

import React, { useState } from "react";
import {
  RoleProvider,
  useRole,
  ROLE_LABELS,
  type AppRole,
} from "@/app/context/RoleContext";
import RoleSwitchModal from "@/components/auth/RoleSwitchModal";

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

// ─── Navbar ──────────────────────────────────────────────────────────

function Navbar() {
  const { user, role, authenticated, logout, logoutAndPrepareSwitch } =
    useRole();
  const [requestedRole, setRequestedRole] = useState<AppRole | null>(null);

  const handleRoleTabClick = (targetRole: AppRole) => {
    if (!authenticated || !role) {
      return;
    }

    // If clicking the current authenticated role, do nothing
    if (role === targetRole) {
      return;
    }

    // Non-active role clicked: trigger confirmation modal
    setRequestedRole(targetRole);
  };

  const handleConfirmSwitch = async () => {
    if (requestedRole) {
      const target = requestedRole;
      setRequestedRole(null);
      await logoutAndPrepareSwitch(target);
    }
  };

  const handleCancelSwitch = () => {
    setRequestedRole(null);
  };

  return (
    <>
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

            {/* Right Section: User Info, Role Indicators, Logout */}
            <div className="flex items-center gap-3">
              {authenticated && user ? (
                <>
                  {/* User Profile */}
                  <div className="hidden md:flex flex-col items-end mr-1 text-right">
                    <span className="text-xs font-bold text-[#0F172A] leading-none">
                      {user.name}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight mt-0.5 font-mono">
                      {user.email}
                    </span>
                  </div>

                  {/* Active Role Indicator Tabs */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => {
                      const isActive = role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => handleRoleTabClick(r)}
                          className={`
                            inline-flex items-center gap-1.5
                            px-2.5 py-1.5
                            rounded-md
                            text-xs font-semibold
                            transition-all duration-150
                            cursor-pointer
                            ${
                              isActive
                                ? "bg-[#2563EB] text-white shadow-xs"
                                : "bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#EFF6FF] hover:border-[#93C5FD] hover:text-[#2563EB]"
                            }
                          `.trim()}
                          aria-pressed={isActive}
                          title={
                            isActive
                              ? `Active Session: ${ROLE_LABELS[r]}`
                              : `Switch to ${ROLE_LABELS[r]} (requires logout & re-authentication)`
                          }
                        >
                          {ROLE_ICONS[r]}
                          <span className="hidden sm:inline">
                            {ROLE_LABELS[r]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Neutral Outline Logout Button */}
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#475569] bg-white hover:bg-slate-50 hover:text-red-600 border border-[#E2E8F0] transition-colors cursor-pointer"
                    title="Sign out of current session"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    Authentication Required
                  </span>
                </div>
              )}
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
              : role === "sewing_supervisor"
              ? "bg-indigo-600"
              : "bg-slate-300"
          }`}
        />
      </header>

      {/* Confirmation Modal when non-active role tab is clicked */}
      {role && requestedRole && (
        <RoleSwitchModal
          isOpen={!!requestedRole}
          onClose={handleCancelSwitch}
          onConfirm={() => void handleConfirmSwitch()}
          currentRole={role}
          requestedRole={requestedRole}
          currentUserName={user?.name}
          currentUserEmail={user?.email}
        />
      )}
    </>
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
