import type { Metadata } from "next";
import Link from "next/link";
import { StampCard } from "@/components/loyalty/StampCard";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { nextMilestone, stampsRemaining } from "@/lib/loyalty/card";
import { getClientCard } from "@/lib/loyalty/server";
import type { LoyaltyGrantView } from "@/lib/loyalty/types";
import { formatClinicDateTime, formatPeso } from "@/lib/pos/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Loyalty" };

function rewardEffect(grant: LoyaltyGrantView): string {
  if (grant.type === "DISCOUNT") return `${formatPeso(grant.discountAmount ?? 0)} off`;
  return "Free service";
}

function grantState(grant: LoyaltyGrantView): string {
  if (grant.status === "AVAILABLE") return "Ready to use";
  if (grant.status === "REDEEMED") return "Redeemed";
  if (grant.status === "EXPIRED") return "Expired";
  return "No longer available";
}

export default async function ClientLoyaltyPage() {
  await requireRole(["CLIENT"]);
  const supabase = await createClient();
  const card = await getClientCard(supabase);
  const limit = card.program?.stampLimit ?? 12;
  const next = nextMilestone(card.stampCount, card.milestones, limit);
  const remaining = stampsRemaining(card.stampCount, card.milestones, limit);
  const unlocked = card.grants.filter((grant) => grant.status === "AVAILABLE");
  const used = card.grants.filter((grant) => grant.status !== "AVAILABLE");

  return (
    <>
      <DashboardHeading
        title={card.program?.name ?? "Loyalty card"}
        subtitle={card.program?.description ?? "Stamps from completed visits at the clinic."}
      />
      {card.program && !card.program.isActive && (
        <p className="mb-6 rounded-lg bg-highlight px-4 py-3 text-sm text-ink">
          The loyalty program is not active right now. Stamps you already earned stay on this card.
        </p>
      )}

      <section className={panelPaddingClass()}>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          {card.stampCount} / {limit} stamps
        </p>
        <div className="mt-4">
          <StampCard count={card.stampCount} limit={limit} rewards={card.rewardMarks} />
        </div>
        <p className="mt-4 text-sm text-ink">
          {card.stampCount === 0
            ? "No stamps yet. A stamp is added after an eligible visit is completed and paid."
            : remaining === 0
              ? "This card is full."
              : `${remaining} stamp${remaining === 1 ? "" : "s"} to ${next ? `the ${next}-stamp reward` : "a full card"}.`}
        </p>
        {card.program?.cyclePolicy === "CONTINUE" ? (
          <p className="mt-2 text-sm text-muted">Redeeming a reward keeps your current stamps. A full card starts a new one on the next visit.</p>
        ) : (
          <p className="mt-2 text-sm text-muted">Redeeming a reward starts a new card at zero. Rewards you already unlocked stay available.</p>
        )}
      </section>

      <section className={`${panelPaddingClass()} mt-6`}>
        <h2 className="text-base font-semibold text-ink">Unlocked rewards</h2>
        {unlocked.length === 0 ? (
          <p className="mt-3 text-sm text-muted">You have no rewards waiting. Ask the clinic to apply one when you pay.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {unlocked.map((grant) => (
              <li key={grant.id} className="rounded-lg border border-line px-4 py-3">
                <p className="font-medium text-ink">{grant.name}</p>
                <p className="text-sm text-muted">
                  {rewardEffect(grant)} · unlocked at {grant.milestone} stamps
                  {grant.expiresAt ? ` · use by ${formatClinicDateTime(grant.expiresAt)}` : ""}
                </p>
                {grant.description && <p className="mt-1 text-sm text-ink">{grant.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${panelPaddingClass()} mt-6`}>
        <h2 className="text-base font-semibold text-ink">Earlier rewards</h2>
        {used.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No redeemed or expired rewards yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {used.map((grant) => (
              <li key={grant.id} className="rounded-lg border border-line px-4 py-3">
                <p className="font-medium text-ink">{grant.name}</p>
                <p className="text-sm text-muted">{grantState(grant)} · {rewardEffect(grant)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${panelPaddingClass()} mt-6`}>
        <h2 className="text-base font-semibold text-ink">History</h2>
        {card.history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Stamp and reward activity will show up here.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {card.history.map((row) => (
              <li key={row.id} className="py-3 text-sm">
                <p className="font-medium text-ink">{row.label}</p>
                <p className="text-muted">{formatClinicDateTime(row.at)}</p>
                {row.detail && <p className="text-ink">{row.detail}</p>}
              </li>
            ))}
          </ul>
        )}
        <Link href="/client" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
          Back to dashboard
        </Link>
      </section>
    </>
  );
}
