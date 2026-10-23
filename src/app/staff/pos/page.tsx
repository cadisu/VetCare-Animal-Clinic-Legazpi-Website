import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PosNotice } from "@/components/pos/PosNotice";
import { PosRegister, type RegisterItem, type RegisterLine } from "@/components/pos/PosRegister";
import { PosSectionLinks } from "@/components/pos/PosSectionLinks";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";
import { getProductImageUrls } from "@/lib/pos/images";
import { getPosBill, listBilledServiceIds, listSellableProducts, listSellableServices } from "@/lib/pos/server";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "POS" };

function asMoney(value: number | string): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export default async function PosHomePage({
  searchParams,
}: {
  searchParams: Promise<{ bill?: string; notice?: string; error?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const supabase = await createClient();
  const billId = query.bill && isUuid(query.bill) ? query.bill : "";
  const bill = billId ? await getPosBill(supabase, billId) : null;
  if (bill && bill.status !== "OPEN") redirect(`/staff/pos/${bill.id}`);

  const [services, products] = await Promise.all([
    listSellableServices(supabase),
    listSellableProducts(supabase),
  ]);
  const images = await getProductImageUrls(
    supabase,
    products.map((product) => product.image_path),
  );
  const catalog: RegisterItem[] = [
    ...services.map((service) => ({
      itemType: "SERVICE" as const,
      id: service.id,
      name: service.name,
      category: service.category,
      price: asMoney(service.price),
      stock: null,
      unit: null,
      imageUrl: null,
      requiresVeterinarian: service.requires_veterinarian,
    })),
    ...products.map((product) => ({
      itemType: "PRODUCT" as const,
      id: product.id,
      name: product.name,
      category: product.category,
      price: asMoney(product.price),
      stock: product.quantity_on_hand,
      unit: product.unit,
      imageUrl: product.image_path ? images[product.image_path] ?? null : null,
      requiresVeterinarian: false,
    })),
  ];
  const initialLines: RegisterLine[] = (bill?.items ?? []).flatMap((item) => {
    const id = item.item_type === "SERVICE" ? item.service_id : item.product_id;
    if (!id) return [];
    const match = catalog.find((entry) => entry.itemType === item.item_type && entry.id === id);
    return [
      {
        key: item.id,
        itemType: item.item_type,
        id,
        name: item.description,
        category: match?.category ?? item.item_type,
        price: asMoney(item.unit_price),
        stock: match?.stock ?? null,
        unit: match?.unit ?? null,
        imageUrl: match?.imageUrl ?? null,
        requiresVeterinarian: match?.requiresVeterinarian ?? false,
        quantity: item.quantity,
        petId: item.pet_id,
      },
    ];
  });
  const blockedServiceIds = bill?.appointment_id
    ? await listBilledServiceIds(supabase, bill.appointment_id, bill.id)
    : [];

  return (
    <>
      <DashboardHeading
        title="Point of sale"
        subtitle="Sell services and products. A customer and a visit are optional."
      />
      <PosNotice notice={query.notice} error={query.error} />
      <PosSectionLinks current="pos" />
      <PosRegister
        catalog={catalog}
        initialLines={initialLines}
        initialTransactionId={bill?.id ?? null}
        initialClientId={bill?.client_id ?? null}
        initialClientName={bill?.client_id ? bill.client_name : null}
        initialPetId={bill?.pet_id ?? null}
        initialAppointmentId={bill?.appointment_id ?? null}
        initialWalkInName={bill?.walk_in_name ?? null}
        initialWalkInContact={bill?.walk_in_contact ?? null}
        blockedServiceIds={blockedServiceIds}
      />
    </>
  );
}
