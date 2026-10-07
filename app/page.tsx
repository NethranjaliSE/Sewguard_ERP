"use client";

import { useRole } from "@/app/context/RoleContext";
import SupervisorView from "@/components/dashboard/SupervisorView";
import VerifierView from "@/components/dashboard/VerifierView";
import SewingView from "@/components/dashboard/SewingView";
import LoginForm from "@/components/auth/LoginForm";
import { Button } from "@/components/ui";

export default function DashboardPage() {
  const { role, loading, authenticated, logout } = useRole();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent mb-3" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Verifying authenticated session...
        </span>
      </div>
    );
  }

  // If not authenticated, present the professional login view
  if (!authenticated || !role) {
    return <LoginForm />;
  }

  // Role-based UI visibility
  if (role === "cutting_supervisor") {
    return <SupervisorView />;
  }

  if (role === "cutting_verifier") {
    return <VerifierView />;
  }

  if (role === "sewing_supervisor") {
    return <SewingView />;
  }

  // Fallback for unauthorized / unrecognized roles
  return (
    <div className="max-w-md mx-auto my-16 bg-white p-8 rounded-xl border border-red-200 shadow-sm text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
      <p className="text-xs text-slate-500 mb-6">
        You do not have permission to access this section of ApparelFlow ERP.
      </p>
      <Button variant="secondary" size="md" onClick={() => void logout()}>
        Return to Login
      </Button>
    </div>
  );
}
