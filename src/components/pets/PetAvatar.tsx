import { PawIcon } from "@/components/ui/icons";

export function PetAvatar({
  url,
  name,
  className = "size-20",
}: {
  url?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-brand ${className}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
        <img src={url} alt={`Photo of ${name}`} className="size-full object-cover" />
      ) : (
        <PawIcon className="size-1/2" />
      )}
    </div>
  );
}
