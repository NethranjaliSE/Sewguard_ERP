"use client";

import { useRole } from "@/app/context/RoleContext";
import SupervisorView from "@/components/dashboard/SupervisorView";
import VerifierView from "@/components/dashboard/VerifierView";
import SewingView from "@/components/dashboard/SewingView";

export default function DashboardPage() {
  const { role } = useRole();

  return (
    <>
      {role === "cutting_supervisor" && <SupervisorView />}
      {role === "cutting_verifier" && <VerifierView />}
      {role === "sewing_supervisor" && <SewingView />}
    </>
  );
}
