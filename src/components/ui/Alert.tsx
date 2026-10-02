type AlertProps = {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
};

const styles = {
  error: "border-accent/30 bg-red-50 text-accent-dark",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-brand/20 bg-brand-soft text-brand-dark",
} as const;

export function Alert({ variant = "info", children }: AlertProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${styles[variant]}`}
    >
      {children}
    </div>
  );
}
