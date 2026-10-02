import type { InputHTMLAttributes } from "react";

type FormFieldProps = {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

export function FormField({ label, name, errors, hint, id, className = "", ...rest }: FormFieldProps) {
  const inputId = id ?? name;
  const hasError = Boolean(errors?.length);
  const describedBy =
    [hint ? `${inputId}-hint` : "", hasError ? `${inputId}-error` : ""].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={`block min-h-11 w-full rounded-lg border bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 ${
          hasError ? "border-accent" : "border-slate-300"
        } ${className}`}
        {...rest}
      />
      {hint && !hasError && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-accent-dark">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
