import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Create Account" };

export default async function RegisterPage() {
  const session = await getSession().catch(() => null);
  if (session?.profile && session.profile.status === "ACTIVE") {
    redirect(ROLE_HOME[session.profile.role]);
  }

  return (
    <AuthCard
      title="Create your account"
      description="Register as a pet owner to book appointments and keep your pets' records in one place."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
