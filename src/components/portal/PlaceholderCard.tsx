import { panelPaddingClass } from "@/components/ui/panel-styles";

/** A dashboard card whose real content is built in a later phase. */
export function PlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className={panelPaddingClass()}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <span className="shrink-0 rounded-full bg-highlight px-2.5 py-0.5 text-xs font-medium text-muted">
          Coming soon
        </span>
      </div>
      <p className="mt-3 text-sm text-muted">{description}</p>
    </section>
  );
}

export function DashboardHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
    </div>
  );
}
