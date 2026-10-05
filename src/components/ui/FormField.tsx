import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FieldBaseProps = {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
  /** Shown after the label, e.g. "(optional)". */
  labelNote?: string;
};

type FormFieldProps = FieldBaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;
type TextAreaFieldProps = FieldBaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name">;
type SelectFieldProps = FieldBaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "name"> & { children: ReactNode };

function controlClass(hasError: boolean, extra: string) {
  return `block w-full rounded-lg border bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 ${
    hasError ? "border-accent" : "border-slate-300"
  } ${extra}`;
}

function FieldFrame({
  inputId,
  label,
  labelNote,
  hint,
  errors,
  children,
}: {
  inputId: string;
  label: string;
  labelNote?: string;
  hint?: string;
  errors?: string[];
  children: ReactNode;
}) {
  const hasError = Boolean(errors?.length);
  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
        {labelNote && <span className="ml-1 font-normal text-slate-500">{labelNote}</span>}
      </label>
      {children}
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

function a11yProps(inputId: string, hint?: string, errors?: string[]) {
  const hasError = Boolean(errors?.length);
  const describedBy =
    [hint ? `${inputId}-hint` : "", hasError ? `${inputId}-error` : ""].filter(Boolean).join(" ") ||
    undefined;
  return { "aria-invalid": hasError || undefined, "aria-describedby": describedBy };
}

export function FormField({
  label,
  labelNote,
  name,
  errors,
  hint,
  id,
  className = "",
  ...rest
}: FormFieldProps) {
  const inputId = id ?? name;
  return (
    <FieldFrame inputId={inputId} label={label} labelNote={labelNote} hint={hint} errors={errors}>
      <input
        id={inputId}
        name={name}
        {...a11yProps(inputId, hint, errors)}
        className={controlClass(Boolean(errors?.length), `min-h-11 ${className}`)}
        {...rest}
      />
    </FieldFrame>
  );
}

export function TextAreaField({
  label,
  labelNote,
  name,
  errors,
  hint,
  id,
  className = "",
  rows = 3,
  ...rest
}: TextAreaFieldProps) {
  const inputId = id ?? name;
  return (
    <FieldFrame inputId={inputId} label={label} labelNote={labelNote} hint={hint} errors={errors}>
      <textarea
        id={inputId}
        name={name}
        rows={rows}
        {...a11yProps(inputId, hint, errors)}
        className={controlClass(Boolean(errors?.length), `py-2.5 ${className}`)}
        {...rest}
      />
    </FieldFrame>
  );
}

export function SelectField({
  label,
  labelNote,
  name,
  errors,
  hint,
  id,
  className = "",
  children,
  ...rest
}: SelectFieldProps) {
  const inputId = id ?? name;
  return (
    <FieldFrame inputId={inputId} label={label} labelNote={labelNote} hint={hint} errors={errors}>
      <select
        id={inputId}
        name={name}
        {...a11yProps(inputId, hint, errors)}
        className={controlClass(Boolean(errors?.length), `min-h-11 ${className}`)}
        {...rest}
      >
        {children}
      </select>
    </FieldFrame>
  );
}
