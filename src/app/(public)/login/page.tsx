import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { Alert } from "@/components/ui/Alert";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Login" };

const MESSAGES: Record<string, { variant: "error" | "success" | "info"; text: string }> = {
  inactive: {
    variant: "error",
    text: "Your account is inactive. Please contact the clinic to reactivate it.",
  },
  "no-profile": {
    variant: "error",
    text: "Your account is not set up correctly. Please contact the clinic.",
  },
  "link-invalid": {
    variant: "error",
    text: "That link is invalid or has expired. Please try again.",
  },
  config: {
    variant: "error",
    text: "The system is not configured yet. Please contact the clinic administrator.",
  },
  "password-updated": {
    variant: "success",
    text: "Your password has been updated. Please log in with your new password.",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const params = await searchParams;

  // Already signed in? Go straight to the right dashboard.
  const session = await getSession().catch(() => null);
  if (session?.profile && session.profile.status === "ACTIVE") {
    redirect(ROLE_HOME[session.profile.role]);
  }

  const notice = MESSAGES[params.error ?? ""] ?? MESSAGES[params.message ?? ""];

  return (
    <AuthCard
      title="Welcome back"
      description="Log in to manage your pets and appointments."
      footer={
        <p>
          New to the clinic?{" "}
          <Link href="/register" className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      {notice && (
        <div className="mb-5">
          <Alert variant={notice.variant}>{notice.text}</Alert>
        </div>
      )}
      <LoginForm next={params.next} />
    </AuthCard>
  );
}
