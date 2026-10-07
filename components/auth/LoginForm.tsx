"use client";

import React, { useState } from "react";
import { useRole, type AppRole, ROLE_LABELS } from "@/app/context/RoleContext";
import { Button } from "@/components/ui";

const DEMO_CREDENTIALS: Record<AppRole, { email: string; pass: string }> = {
  cutting_supervisor: {
    email: "supervisor@apparelfow.com",
    pass: "Supervisor@123",
  },
  cutting_verifier: {
    email: "verifier@apparelfow.com",
    pass: "Verifier@123",
  },
  sewing_supervisor: {
    email: "sewing@apparelfow.com",
    pass: "Sewing@123",
  },
};

export default function LoginForm() {
  const { login, preselectedRole, setPreselectedRole } = useRole();
  const [prevRole, setPrevRole] = useState(preselectedRole);
  const [email, setEmail] = useState(() =>
    preselectedRole && DEMO_CREDENTIALS[preselectedRole]
      ? DEMO_CREDENTIALS[preselectedRole].email
      : ""
  );
  const [password, setPassword] = useState(() =>
    preselectedRole && DEMO_CREDENTIALS[preselectedRole]
      ? DEMO_CREDENTIALS[preselectedRole].pass
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If a role was preselected via Logout & Switch, adjust credentials during render
  if (prevRole !== preselectedRole) {
    setPrevRole(preselectedRole);
    if (preselectedRole && DEMO_CREDENTIALS[preselectedRole]) {
      setEmail(DEMO_CREDENTIALS[preselectedRole].email);
      setPassword(DEMO_CREDENTIALS[preselectedRole].pass);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || "Authentication failed.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = (roleKey: AppRole) => {
    setPreselectedRole(roleKey);
    setEmail(DEMO_CREDENTIALS[roleKey].email);
    setPassword(DEMO_CREDENTIALS[roleKey].pass);
    setError(null);
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center py-6 px-4">
      <div className="w-full max-w-md">
        {/* Card Header */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F172A] text-white shadow-sm font-black text-xl mb-3">
              AF
            </div>
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
              ApparelFlow ERP
            </h1>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mt-1">
              Gatekeeper Verification System
            </p>
          </div>

          {/* Preselected Role Notification */}
          {preselectedRole && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-800 flex items-center justify-between">
              <div>
                <span className="font-semibold">Switching to:</span>{" "}
                {ROLE_LABELS[preselectedRole]}
              </div>
              <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-medium">
                Credentials filled
              </span>
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supervisor@apparelfow.com"
                className="w-full rounded-lg border border-[#E2E8F0] bg-slate-50 px-3.5 py-2 text-sm text-[#0F172A] placeholder-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-[#E2E8F0] bg-slate-50 px-3.5 py-2 text-sm text-[#0F172A] placeholder-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="w-full mt-2 font-semibold bg-[#2563EB] hover:bg-[#1D4ED8]"
            >
              Sign In
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-medium">
                Evaluator Demo Accounts
              </span>
            </div>
          </div>

          {/* Demo Credentials Helper */}
          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5 text-xs">
            <div className="font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>Seeded Accounts</span>
              <span className="text-[10px] text-slate-400">Click to load</span>
            </div>

            <div className="space-y-1.5">
              {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => {
                const creds = DEMO_CREDENTIALS[r];
                const isSelected = preselectedRole === r;

                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={`w-full flex items-center justify-between p-2 rounded transition-colors text-left cursor-pointer border ${
                      isSelected
                        ? "bg-blue-50 border-blue-300 text-blue-900"
                        : "hover:bg-slate-200/60 border-transparent text-slate-800"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">
                        {ROLE_LABELS[r]}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {creds.email}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono bg-white text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                      {creds.pass}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
