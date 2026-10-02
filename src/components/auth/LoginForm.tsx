"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: FormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}

      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />

      <div className="text-right text-sm">
        <Link href="/forgot-password" className="font-medium text-brand hover:underline">
          Forgot password?
        </Link>
      </div>

      <SubmitButton pendingText="Logging in...">Log in</SubmitButton>
    </form>
  );
}
