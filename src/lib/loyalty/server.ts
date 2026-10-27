import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientRewardOption,
  CyclePolicy,
  LoyaltyGrantStatus,
  LoyaltyGrantView,
  LoyaltyHistoryRow,
  LoyaltyProgramView,
  LoyaltyRewardType,
  LoyaltyRewardView,
} from "@/lib/loyalty/types";

type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  stamp_limit: number;
  is_active: boolean;
  cycle_policy: CyclePolicy;
};

type RewardRow = {
  id: string;
  name: string;
  description: string | null;
  reward_type: LoyaltyRewardType;
  milestone_stamps: number;
  service_id: string | null;
  discount_amount: number | string | null;
  is_active: boolean;
  allow_repeat: boolean;
  validity_days: number | null;
};

function money(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function isPolicy(value: string): value is CyclePolicy {
  return value === "RESET_ON_REDEEM" || value === "CONTINUE";
}

export async function getLoyaltyProgram(supabase: SupabaseClient): Promise<LoyaltyProgramView | null> {
  const { data } = await supabase.from("loyalty_programs").select("*").limit(1).maybeSingle();
  if (!data) return null;
  const program = data as ProgramRow;
  if (!isPolicy(program.cycle_policy)) return null;
  const { data: links } = await supabase
    .from("loyalty_program_services")
    .select("service_id")
    .eq("program_id", program.id);
  return {
    id: program.id,
    name: program.name,
    description: program.description,
    stampLimit: program.stamp_limit,
    isActive: program.is_active,
    cyclePolicy: program.cycle_policy,
    serviceIds: ((links ?? []) as { service_id: string }[]).map((link) => link.service_id),
  };
}

export async function listLoyaltyRewards(supabase: SupabaseClient): Promise<LoyaltyRewardView[]> {
  const { data } = await supabase
    .from("loyalty_rewards")
    .select("*")
    .order("milestone_stamps", { ascending: true });
  return ((data ?? []) as RewardRow[]).map((reward) => ({
    id: reward.id,
    name: reward.name,
    description: reward.description,
    type: reward.reward_type,
    milestone: reward.milestone_stamps,
    serviceId: reward.service_id,
    discountAmount: money(reward.discount_amount),
    isActive: reward.is_active,
    allowRepeat: reward.allow_repeat,
    validityDays: reward.validity_days,
  }));
}

export async function listClientRewardOptions(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ClientRewardOption[]> {
  const { data, error } = await supabase.rpc("loyalty_client_rewards", { p_client_id: clientId });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => {
    const reward = row as {
      grant_id: string;
      reward_name: string;
      reward_description: string | null;
      reward_type: LoyaltyRewardType;
      service_id: string | null;
      discount_amount: number | string | null;
      milestone_stamps: number;
      expires_at: string | null;
      held_by_transaction_id: string | null;
      held_reference: string | null;
    };
    return {
      grantId: reward.grant_id,
      name: reward.reward_name,
      description: reward.reward_description,
      type: reward.reward_type,
      serviceId: reward.service_id,
      discountAmount: money(reward.discount_amount),
      milestone: reward.milestone_stamps,
      expiresAt: reward.expires_at,
      heldByTransactionId: reward.held_by_transaction_id,
      heldReference: reward.held_reference,
    };
  });
}

export type ClientCard = {
  program: LoyaltyProgramView | null;
  stampCount: number;
  grants: LoyaltyGrantView[];
  history: LoyaltyHistoryRow[];
  milestones: number[];
};

export async function getClientCard(supabase: SupabaseClient): Promise<ClientCard> {
  const program = await getLoyaltyProgram(supabase);
  const rewards = await listLoyaltyRewards(supabase);
  const milestones = rewards.filter((reward) => reward.isActive).map((reward) => reward.milestone);

  const { data: cycle } = await supabase
    .from("loyalty_cycles")
    .select("id")
    .eq("status", "OPEN")
    .limit(1)
    .maybeSingle();
  const cycleId = (cycle as { id: string } | null)?.id ?? null;

  let stampCount = 0;
  if (cycleId) {
    const { count } = await supabase
      .from("loyalty_stamp_events")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", cycleId)
      .eq("event_type", "EARNED")
      .eq("status", "ACTIVE");
    stampCount = count ?? 0;
  }

  const { data: grantRows } = await supabase
    .from("loyalty_grants")
    .select("*")
    .order("unlocked_at", { ascending: false });
  const grants: LoyaltyGrantView[] = ((grantRows ?? []) as {
    id: string;
    reward_name: string;
    reward_description: string | null;
    reward_type: LoyaltyRewardType;
    status: LoyaltyGrantStatus;
    milestone_stamps: number;
    service_id: string | null;
    discount_amount: number | string | null;
    expires_at: string | null;
    unlocked_at: string;
  }[]).map((grant) => ({
    id: grant.id,
    name: grant.reward_name,
    description: grant.reward_description,
    type: grant.reward_type,
    status: grant.expires_at && grant.status === "AVAILABLE" && new Date(grant.expires_at).getTime() <= Date.now()
      ? "EXPIRED"
      : grant.status,
    milestone: grant.milestone_stamps,
    serviceId: grant.service_id,
    discountAmount: money(grant.discount_amount),
    expiresAt: grant.expires_at,
    unlockedAt: grant.unlocked_at,
  }));

  const [{ data: stampRows }, { data: redemptionRows }] = await Promise.all([
    supabase.from("loyalty_stamp_events").select("*").order("created_at", { ascending: false }).limit(40),
    supabase.from("loyalty_redemptions").select("*").order("created_at", { ascending: false }).limit(40),
  ]);

  const history: LoyaltyHistoryRow[] = [
    ...((stampRows ?? []) as {
      id: string;
      event_type: "EARNED" | "REVERSED";
      created_at: string;
      reason: string | null;
    }[]).map((event) => ({
      id: event.id,
      kind: event.event_type,
      label: event.event_type === "EARNED" ? "Stamp earned" : "Stamp reversed",
      at: event.created_at,
      detail: event.reason,
    })),
    ...((redemptionRows ?? []) as {
      id: string;
      status: "APPLIED" | "RESTORED";
      reward_label: string | null;
      reward_amount: number | string;
      created_at: string;
      restored_at: string | null;
      restore_note: string | null;
    }[]).flatMap((redemption) => {
      const rows: LoyaltyHistoryRow[] = [
        {
          id: redemption.id,
          kind: "REDEEMED",
          label: redemption.reward_label ? `Redeemed ${redemption.reward_label}` : "Reward redeemed",
          at: redemption.created_at,
          detail: null,
        },
      ];
      if (redemption.status === "RESTORED" && redemption.restored_at) {
        rows.push({
          id: `${redemption.id}-restored`,
          kind: "RESTORED",
          label: "Reward restored",
          at: redemption.restored_at,
          detail: redemption.restore_note,
        });
      }
      return rows;
    }),
  ].sort((left, right) => right.at.localeCompare(left.at));

  return { program, stampCount, grants, history, milestones };
}
