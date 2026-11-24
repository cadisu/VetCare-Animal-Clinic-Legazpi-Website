"use client";

import { useState } from "react";
import { phoneEntryDigits } from "@/lib/validation/common";

function controlClass(hasError: boolean) {
  return `flex min-h-11 overflow-hidden rounded-lg border bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30 ${
    hasError ? "border-accent" : "border-line"
  }`;
}


function digitsFromTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) return digits.slice(2, 12);
  return digits.slice(0, 11);
}

export function PhoneNumberField({
  defaultValue,
  errors,
}: {
  defaultValue?: string;
  errors?: string[];
}) {
  const [digits, setDigits] = useState(() => phoneEntryDigits(defaultValue));
  const hasError = Boolean(errors?.length);
  const describedBy = hasError ? "contactNumber-error" : "contactNumber-hint";

  return (
    <div>
      <label htmlFor="contactNumber" className="mb-1.5 block text-sm font-medium text-ink">
        Contact no.
      </label>
      <div className={controlClass(hasError)}>
        <span className="flex items-center border-r border-line bg-highlight/60 px-3 text-sm font-semibold text-ink">
          +63
        </span>
        <input
          id="contactNumber"
          name="contactNumber"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          placeholder="917 123 4567"
          value={digits}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          onChange={(event) => setDigits(digitsFromTyping(event.target.value))}
          className="min-h-11 w-full bg-transparent px-3.5 text-base text-ink placeholder:text-muted/70 focus:outline-none"
        />
      </div>
      {hasError ? (
        <p id="contactNumber-error" className="mt-1.5 text-sm text-accent-dark">
          {errors![0]}
        </p>
      ) : (
        <p id="contactNumber-hint" className="mt-1.5 text-xs text-muted">
          Used for appointment reminders.
        </p>
      )}
    </div>
  );
}
