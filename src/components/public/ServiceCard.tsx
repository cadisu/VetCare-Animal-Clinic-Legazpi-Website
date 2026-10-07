import { ServiceImage } from "@/components/public/ServiceImage";

type ServiceCardProps = {
  name: string;
  description?: string | null;
  headingLevel?: "h2" | "h3";
};

export function ServiceCard({ name, description, headingLevel = "h3" }: ServiceCardProps) {
  const Heading = headingLevel;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="aspect-[16/10] w-full bg-slate-100">
        <ServiceImage name={name} className="size-full object-cover" />
      </div>
      <div className="p-6">
        <Heading className="text-lg font-semibold">{name}</Heading>
        {description && <p className="mt-2 text-slate-600">{description}</p>}
      </div>
    </article>
  );
}
