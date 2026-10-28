import type { Metadata } from "next";
import { saveLoyaltyProgramAction } from "@/app/actions/loyalty";
import { LoyaltyRewards } from "@/components/loyalty/LoyaltyRewards";
import { Alert } from "@/components/ui/Alert";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { FormField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { loyaltyErrorText, loyaltyNoticeText } from "@/lib/loyalty/notices";
import { getLoyaltyProgram, listLoyaltyRewards } from "@/lib/loyalty/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Loyalty" };

const fieldNote = "text-sm text-muted";

export default async function StaffLoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; reward?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const supabase = await createClient();
  const [program, rewards, servicesResult] = await Promise.all([
    getLoyaltyProgram(supabase),
    listLoyaltyRewards(supabase),
    supabase.from("services").select("id, name, is_active").order("sort_order", { ascending: true }),
  ]);
  const services = (servicesResult.data ?? []) as { id: string; name: string; is_active: boolean }[];
  const notice = loyaltyNoticeText(query.notice);
  const error = loyaltyErrorText(query.error);

  return (
    <LoyaltyRewards
      rewards={rewards}
      services={services.map((service) => ({ id: service.id, name: service.name }))}
      serviceNames={Object.fromEntries(services.map((service) => [service.id, service.name]))}
      initialRewardId={query.reward}
    >
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <div className="mt-4"><Alert variant="error">{error}</Alert></div>}

      <div>
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
      </div>
    </LoyaltyRewards>
  );
}
