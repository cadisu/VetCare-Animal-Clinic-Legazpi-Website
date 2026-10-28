"use client";

import { useState, type ReactNode } from "react";
import { saveLoyaltyRewardAction, setLoyaltyRewardActiveAction } from "@/app/actions/loyalty";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { Dialog } from "@/components/ui/Dialog";
import { FormField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClass } from "@/components/ui/button-styles";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import type { LoyaltyRewardView } from "@/lib/loyalty/types";
import { formatPeso } from "@/lib/pos/money";

type ServiceOption = { id: string; name: string };

export function LoyaltyRewards({
  rewards,
  services,
  serviceNames,
  initialRewardId,
  children,
}: {
  rewards: LoyaltyRewardView[];
  services: ServiceOption[];
  serviceNames: Record<string, string>;
  initialRewardId?: string;
  children?: ReactNode;
}) {
  const initial = rewards.find((reward) => reward.id === initialRewardId) ?? null;
  const [open, setOpen] = useState(Boolean(initial));
  const [editing, setEditing] = useState<LoyaltyRewardView | null>(initial);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(reward: LoyaltyRewardView) {
    setEditing(reward);
    setOpen(true);
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Loyalty card</h1>
        <div className="mt-2">
          <button type="button" className={buttonClass("primary")} onClick={openNew}>
            Add reward
          </button>
        </div>
      </div>
      {children}
      <section className={`${panelPaddingClass()} mt-8`}>
      <h2 className="text-base font-semibold text-ink">Milestones</h2>
      {rewards.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No rewards yet. Add the first milestone.</p>
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
                    ? `Free ${serviceNames[reward.serviceId ?? ""] ?? "service"}`
                    : `${formatPeso(reward.discountAmount ?? 0)} discount`}
                  {reward.serviceId && reward.type === "DISCOUNT"
                    ? ` on ${serviceNames[reward.serviceId] ?? "a service"}`
                    : ""}
                  {" · "}
                  {reward.isActive ? "Active" : "Inactive"}
                  {reward.validityDays ? ` · ${reward.validityDays} days once unlocked` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={buttonClass("outline")} onClick={() => openEdit(reward)}>
                  Edit
                </button>
                <form action={setLoyaltyRewardActiveAction}>
                  <input type="hidden" name="rewardId" value={reward.id} />
                  <input type="hidden" name="isActive" value={reward.isActive ? "false" : "true"} />
                  {reward.isActive ? (
                    <ConfirmSubmitButton confirmMessage="Deactivate this reward? Clients keep stamps and rewards they already unlocked.">
                      Deactivate
                    </ConfirmSubmitButton>
                  ) : (
                    <button type="submit" className={buttonClass("outline")}>
                      Activate
                    </button>
                  )}
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      </section>

      <Dialog open={open} title={editing ? "Edit reward" : "Add reward"} onClose={() => setOpen(false)}>
        <form key={editing?.id ?? "new"} action={saveLoyaltyRewardAction} className="space-y-4">
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
      </Dialog>
    </>
  );
}
