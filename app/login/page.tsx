"use client";

import LoginForm from "@/components/auth/LoginForm";
import { useRole } from "@/app/context/RoleContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { authenticated, loading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && authenticated) {
      router.push("/");
    }
  }, [authenticated, loading, router]);

  return <LoginForm />;
}
