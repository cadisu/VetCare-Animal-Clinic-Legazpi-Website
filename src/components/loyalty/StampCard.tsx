import { stampSlots } from "@/lib/loyalty/card";
import type { LoyaltyStampReward } from "@/lib/loyalty/types";

export function StampCard({
  count,
  limit,
  rewards = [],
}: {
  count: number;
  limit: number;
  rewards?: LoyaltyStampReward[];
}) {
  const slots = stampSlots(count, limit);
  return (
    <div className="overflow-x-auto">
    <ol
      className="grid w-full gap-2"
      style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(2.75rem, 1fr))` }}
      aria-label={`${count} of ${limit} stamps`}
    >
      {slots.map((filled, index) => {
        const stamp = index + 1;
        const names = stamp <= limit
          ? rewards.filter((reward) => reward.milestone === stamp).map((reward) => reward.name)
          : [];
        const rewardReached = filled && names.length > 0;
        return (
          <li
            key={index}
            className={`mx-auto flex aspect-square w-full max-w-16 items-center justify-center rounded-full border bg-white ${
              rewardReached || filled ? "border-brand" : "border-line"
            }`}
          >
            <span className="sr-only">
              {rewardReached
                ? `Reward reached, ${names.join(", ")}, stamp ${stamp}`
                : `${filled ? "Filled stamp" : "Empty stamp"} ${stamp}`}
            </span>
            <img
              src="/VetCare_Logo.png"
              alt=""
              className={`h-3/5 w-3/5 object-contain ${filled ? "" : "opacity-30"}`}
            />
          </li>
        );
      })}
    </ol>
    </div>
  );
}
