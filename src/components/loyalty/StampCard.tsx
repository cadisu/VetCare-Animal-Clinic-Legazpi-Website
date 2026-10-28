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
    <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label={`${count} of ${limit} stamps`}>
      {slots.map((filled, index) => {
        const stamp = index + 1;
        const names = stamp <= limit
          ? rewards.filter((reward) => reward.milestone === stamp).map((reward) => reward.name)
          : [];
        const rewardReached = filled && names.length > 0;
        return (
          <li
            key={index}
            className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-full border text-sm font-semibold ${
              rewardReached
                ? "border-brand bg-white"
                : filled
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-muted"
            }`}
          >
            <span className="sr-only">
              {rewardReached
                ? `Reward reached, ${names.join(", ")}, stamp ${stamp}`
                : `${filled ? "Filled stamp" : "Empty stamp"} ${stamp}`}
            </span>
            {rewardReached ? (
              <img
                src="/VetCare_Logo.png"
                alt=""
                className="absolute left-[-23%] top-[-4%] w-[146%] max-w-none"
              />
            ) : (
              <span aria-hidden="true">{filled ? "●" : "○"}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
