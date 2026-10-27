import type { Metadata } from "next";
import Link from "next/link";
import {
  saveLoyaltyProgramAction,
  saveLoyaltyRewardAction,
  setLoyaltyRewardActiveAction,
} from "@/app/actions/loyalty";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { Alert } from "@/components/ui/Alert";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { FormField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { loyaltyErrorText, loyaltyNoticeText } from "@/lib/loyalty/notices";
import { getLoyaltyProgram, listLoyaltyRewards } from "@/lib/loyalty/server";
import { formatPeso } from "@/lib/pos/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Loyalty" };

const fieldNote = "text-sm text-muted";

export default async function SeniorLoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; reward?: string }>;
}) {
  await requireRole(["SENIOR_VET"]);
  const query = await searchParams;
  const supabase = await createClient();
  const [program, rewards, servicesResult] = await Promise.all([
    getLoyaltyProgram(supabase),
    listLoyaltyRewards(supabase),
    supabase.from("services").select("id, name, is_active").order("sort_order", { ascending: true }),
  ]);
  const services = (servicesResult.data ?? []) as { id: string; name: string; is_active: boolean }[];
  const serviceName = new Map(services.map((service) => [service.id, service.name]));
  const editing = rewards.find((reward) => reward.id === query.reward) ?? null;
  const notice = loyaltyNoticeText(query.notice);
  const error = loyaltyErrorText(query.error);

  return (
    <>
      <DashboardHeading
        title="Loyalty card"
        subtitle="Choose which completed visits earn a stamp, and which milestones unlock a reward."
      />
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <div className="mt-4"><Alert variant="error">{error}</Alert></div>}

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">Program</h2>
          <p className={`mt-2 ${fieldNote}`}>
            The card starts at 12 stamps. Deactivating the program stops new stamps. It does not delete history.
          </p>
          <form action={saveLoyaltyProgramAction} className="mt-4 space-y-4">
            <FormField label="Name" name="name" required defaultValue={program?.name ?? "VetCare Loyalty"} />
            <TextAreaField label="Description" name="description" defaultValue={program?.description ?? ""} />
            <FormField
              label="Stamp limit"
              name="stampLimit"
              type="number"
              min={1}
              max={36}
              required
              defaultValue={program?.stampLimit ?? 12}
            />
            <SelectField label="Status" name="isActive" defaultValue={program?.isActive ? "true" : "false"}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </SelectField>
            <SelectField label="When a reward is redeemed" name="cyclePolicy" defaultValue={program?.cyclePolicy ?? "RESET_ON_REDEEM"}>
              <option value="RESET_ON_REDEEM">Reset the open card to zero</option>
              <option value="CONTINUE">Keep the stamps and start a new card only when this one is full</option>
            </SelectField>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Eligible services</legend>
              <p className={`mt-1 ${fieldNote}`}>A paid visit earns one stamp after it is completed, if one of these services is on the bill.</p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {services.map((service) => (
                  <li key={service.id}>
                    <label className="flex items-start gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        name="serviceId"
                        value={service.id}
                        defaultChecked={program?.serviceIds.includes(service.id) ?? false}
                        className="mt-1"
                      />
                      <span>
                        {service.name}
                        {!service.is_active && <span className="text-muted"> · inactive</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            {program?.isActive ? (
              <ConfirmSubmitButton confirmMessage="Save these loyalty settings? Existing client stamps and unlocked rewards stay as they are.">
                Save program
              </ConfirmSubmitButton>
            ) : (
              <SubmitButton>Save program</SubmitButton>
            )}
          </form>
        </section>

        <section className={panelPaddingClass()}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">{editing ? "Edit reward" : "Add reward"}</h2>
            {editing && (
              <Link href="/senior-vet/loyalty" className="text-sm font-semibold text-brand hover:underline">
                New reward
              </Link>
            )}
          </div>
          <form action={saveLoyaltyRewardAction} className="mt-4 space-y-4">
            {editing && <input type="hidden" name="rewardId" value={editing.id} />}
            <FormField label="Name" name="name" required defaultValue={editing?.name ?? ""} />
            <TextAreaField label="Description" name="description" defaultValue={editing?.description ?? ""} />
            <SelectField label="Type" name="rewardType" defaultValue={editing?.type ?? "FREE_SERVICE"}>
              <option value="FREE_SERVICE">Free service</option>
              <option value="DISCOUNT">Peso discount</option>
            </SelectField>
            <FormField
              label="Stamps required"
              name="milestone"
              type="number"
              min={1}
              max={36}
              required
              defaultValue={editing?.milestone ?? 12}
            />
            <SelectField label="Service" name="serviceId" defaultValue={editing?.serviceId ?? ""}>
              <option value="">None</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </SelectField>
            <FormField
              label="Discount amount"
              name="discount"
              hint="Used for peso discounts. Leave blank for a free service."
              defaultValue={editing?.discountAmount ?? ""}
            />
            <FormField
              label="Valid for days"
              name="validityDays"
              hint="Counted from the moment the client unlocks the reward. Leave blank if it does not expire."
              defaultValue={editing?.validityDays ?? ""}
            />
            <SelectField label="Status" name="isActive" defaultValue={editing?.isActive !== false ? "true" : "false"}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </SelectField>
            <SelectField label="Repeat in the same cycle" name="allowRepeat" defaultValue={editing?.allowRepeat ? "true" : "false"}>
              <option value="false">Once per cycle</option>
              <option value="true">Again after it is redeemed</option>
            </SelectField>
            <SubmitButton>{editing ? "Save reward" : "Add reward"}</SubmitButton>
          </form>
        </section>
      </div>

      <section className={`${panelPaddingClass()} mt-8`}>
        <h2 className="text-base font-semibold text-ink">Milestones</h2>
        {rewards.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No rewards yet. Add the first milestone beside the program settings.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {rewards.map((reward) => (
              <li key={reward.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-ink">
                    {reward.milestone} stamps · {reward.name}
                  </p>
                  <p className="text-sm text-muted">
                    {reward.type === "FREE_SERVICE"
                      ? `Free ${serviceName.get(reward.serviceId ?? "") ?? "service"}`
                      : `${formatPeso(reward.discountAmount ?? 0)} discount`}
                    {reward.serviceId && reward.type === "DISCOUNT"
                      ? ` on ${serviceName.get(reward.serviceId) ?? "a service"}`
                      : ""}
                    {" · "}
                    {reward.isActive ? "Active" : "Inactive"}
                    {reward.validityDays ? ` · ${reward.validityDays} days once unlocked` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/senior-vet/loyalty?reward=${reward.id}`} className="text-sm font-semibold text-brand hover:underline">
                    Edit
                  </Link>
                  <form action={setLoyaltyRewardActiveAction}>
                    <input type="hidden" name="rewardId" value={reward.id} />
                    <input type="hidden" name="isActive" value={reward.isActive ? "false" : "true"} />
                    {reward.isActive ? (
                      <ConfirmSubmitButton confirmMessage="Deactivate this reward? Clients keep stamps and rewards they already unlocked.">
                        Deactivate
                      </ConfirmSubmitButton>
                    ) : (
                      <SubmitButton>Activate</SubmitButton>
                    )}
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
