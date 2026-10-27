import { stampSlots } from "@/lib/loyalty/card";

export function StampCard({
  count,
  limit,
}: {
  count: number;
  limit: number;
}) {
  const slots = stampSlots(count, limit);
  return (
    <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label={`${count} of ${limit} stamps`}>
      {slots.map((filled, index) => (
        <li
          key={index}
          className={`flex aspect-square items-center justify-center rounded-full border text-sm font-semibold ${
            filled
              ? "border-brand bg-brand text-white"
              : "border-line bg-white text-muted"
          }`}
        >
          <span className="sr-only">{filled ? "Filled stamp" : "Empty stamp"} {index + 1}</span>
          <span aria-hidden="true">{filled ? "●" : "○"}</span>
        </li>
      ))}
    </ol>
  );
}
