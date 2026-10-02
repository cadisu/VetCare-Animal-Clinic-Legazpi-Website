import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Alert } from "@/components/ui/Alert";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reset Password" };

export default async function ResetPasswordPage() {
  // The emailed link signs the user in temporarily (via /auth/callback) so they can set a new password.
  const session = await getSession().catch(() => null);

  if (!session) {
    return (
      <AuthCard title="Reset link expired">
        <Alert variant="error">
          This reset link is invalid or has expired. Please request a new one.
        </Alert>
        <Link
          href="/forgot-password"
          className="mt-5 inline-block text-sm font-semibold text-brand hover:underline"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="Enter a new password for your account.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
