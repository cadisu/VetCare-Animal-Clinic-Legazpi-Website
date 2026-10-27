"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { listClientRewardOptions } from "@/lib/loyalty/server";
import { loyaltyErrorCode } from "@/lib/loyalty/notices";
import type { ClientRewardOption } from "@/lib/loyalty/types";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

function fail(code: string): never {
  redirect(`/senior-vet/loyalty?error=${code}`);
}

function readIds(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .map((value) => String(value))
    .filter((value) => isUuid(value));
}

export async function saveLoyaltyProgramAction(formData: FormData): Promise<void> {
  await requireRole(["SENIOR_VET"]);
  const stampLimit = Number(String(formData.get("stampLimit") ?? ""));
  const validityPolicy = String(formData.get("cyclePolicy") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("loyalty_save_program", {
    p_name: String(formData.get("name") ?? ""),
    p_description: String(formData.get("description") ?? ""),
    p_is_active: String(formData.get("isActive") ?? "false") === "true",
    p_stamp_limit: Number.isInteger(stampLimit) ? stampLimit : 0,
    p_cycle_policy: validityPolicy,
    p_service_ids: readIds(formData, "serviceId"),
  });
  if (error) fail(loyaltyErrorCode(error.message));
  revalidatePath("/senior-vet/loyalty");
  revalidatePath("/client/loyalty");
  redirect("/senior-vet/loyalty?notice=saved");
}

export async function saveLoyaltyRewardAction(formData: FormData): Promise<void> {
  await requireRole(["SENIOR_VET"]);
  const rewardId = String(formData.get("rewardId") ?? "").trim();
  const milestone = Number(String(formData.get("milestone") ?? ""));
  const discount = String(formData.get("discount") ?? "").trim();
  const validity = String(formData.get("validityDays") ?? "").trim();
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("loyalty_save_reward", {
    p_reward_id: isUuid(rewardId) ? rewardId : null,
    p_name: String(formData.get("name") ?? ""),
    p_description: String(formData.get("description") ?? ""),
    p_reward_type: String(formData.get("rewardType") ?? ""),
    p_milestone: Number.isInteger(milestone) ? milestone : 0,
    p_service_id: isUuid(serviceId) ? serviceId : null,
    p_discount: discount === "" ? null : Number(discount),
    p_is_active: String(formData.get("isActive") ?? "true") === "true",
    p_allow_repeat: String(formData.get("allowRepeat") ?? "false") === "true",
    p_validity_days: validity === "" ? null : Number(validity),
  });
  if (error) fail(loyaltyErrorCode(error.message));
  revalidatePath("/senior-vet/loyalty");
  revalidatePath("/client/loyalty");
  redirect("/senior-vet/loyalty?notice=reward-saved");
}

export async function setLoyaltyRewardActiveAction(formData: FormData): Promise<void> {
  await requireRole(["SENIOR_VET"]);
  const rewardId = String(formData.get("rewardId") ?? "");
  const active = String(formData.get("isActive") ?? "false") === "true";
  if (!isUuid(rewardId)) fail("generic");
  const supabase = await createClient();
  const { error } = await supabase.rpc("loyalty_set_reward_active", {
    p_reward_id: rewardId,
    p_is_active: active,
  });
  if (error) fail(loyaltyErrorCode(error.message));
  revalidatePath("/senior-vet/loyalty");
  revalidatePath("/client/loyalty");
  redirect(`/senior-vet/loyalty?notice=${active ? "reward-on" : "reward-off"}`);
}

export async function listClientRewardsAction(clientId: string): Promise<ClientRewardOption[]> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  if (!isUuid(clientId)) return [];
  const supabase = await createClient();
  return listClientRewardOptions(supabase, clientId);
}
