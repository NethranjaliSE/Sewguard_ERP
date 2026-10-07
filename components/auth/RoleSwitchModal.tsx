"use client";

import React from "react";
import { type AppRole, ROLE_LABELS } from "@/app/context/RoleContext";
import { Button } from "@/components/ui";

interface RoleSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentRole: AppRole;
  requestedRole: AppRole;
  currentUserName?: string;
  currentUserEmail?: string | null;
}

const ROLE_FUNCTIONS: Record<AppRole, string> = {
  cutting_supervisor: "supervisor functions and order creation",
  cutting_verifier: "verification terminal and Gatekeeper inspection",
  sewing_supervisor: "sewing queue and line start functions",
};

export default function RoleSwitchModal({
  isOpen,
  onClose,
  onConfirm,
  currentRole,
  requestedRole,
  currentUserName,
  currentUserEmail,
}: RoleSwitchModalProps) {
  if (!isOpen) return null;

  const currentLabel = ROLE_LABELS[currentRole];
  const requestedLabel = ROLE_LABELS[requestedRole];
  const targetFunction = ROLE_FUNCTIONS[requestedRole];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-role-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-[#E2E8F0]">
        {/* Header Icon + Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB] border border-blue-100">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
          <div>
            <h2
              id="switch-role-title"
              className="text-base font-bold text-[#0F172A]"
            >
              Switch Role
            </h2>
            <p className="text-xs text-[#64748B]">
              Role change requires authenticated session change
            </p>
          </div>
        </div>

        {/* Current vs Requested Role Card */}
        <div className="my-4 rounded-lg bg-slate-50 border border-slate-200/80 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Currently signed in as:</span>
            <span className="font-bold text-slate-800">{currentLabel}</span>
          </div>

          {(currentUserEmail || currentUserName) && (
            <div className="text-[11px] text-slate-500 font-mono bg-white px-2.5 py-1 rounded border border-slate-200 truncate">
              {currentUserEmail || currentUserName}
            </div>
          )}

          <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Requested role:</span>
            <span className="font-bold text-[#2563EB]">{requestedLabel}</span>
          </div>
        </div>

        {/* Dynamic Explanation */}
        <p className="text-xs text-slate-600 leading-relaxed mb-6">
          You are currently signed in as{" "}
          <strong className="text-slate-900 font-semibold">{currentLabel}</strong>.
          To access {targetFunction}, you must log out and sign in with a{" "}
          <strong className="text-slate-900 font-semibold">{requestedLabel}</strong>{" "}
          account.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onConfirm}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] cursor-pointer font-semibold"
          >
            Logout & Switch
          </Button>
        </div>
      </div>
    </div>
  );
}
