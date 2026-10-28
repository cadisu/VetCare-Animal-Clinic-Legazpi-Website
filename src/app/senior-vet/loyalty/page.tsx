import { redirect } from "next/navigation";

export default async function SeniorLoyaltyRedirect({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; reward?: string }>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  if (query.notice) params.set("notice", query.notice);
  if (query.error) params.set("error", query.error);
  if (query.reward) params.set("reward", query.reward);
  const suffix = params.toString();
  redirect(suffix ? `/staff/loyalty?${suffix}` : "/staff/loyalty");
}
