import { redirect } from "next/navigation";

export default async function SeniorVetServicesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const editId = (await searchParams).edit;
  redirect(editId ? `/staff/services?edit=${encodeURIComponent(editId)}` : "/staff/services");
}
