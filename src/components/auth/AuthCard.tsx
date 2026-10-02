export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="bg-brand-soft">
      <div className="mx-auto flex max-w-7xl justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-2 text-slate-600">{description}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-slate-200 pt-6 text-center text-sm">{footer}</div>}
        </div>
      </div>
    </section>
  );
}
