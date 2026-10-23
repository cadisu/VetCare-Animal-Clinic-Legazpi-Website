"use client";

import { useMemo, useState, useTransition } from "react";
import {
  loadClientSaleContextAction,
  savePosCartAction,
  searchPosClientsAction,
  voidPosAction,
} from "@/app/actions/pos";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass } from "@/components/ui/panel-styles";
import { cashChange, formatPeso, lineSubtotal, transactionTotals } from "@/lib/pos/money";

export type RegisterItem = {
  itemType: "SERVICE" | "PRODUCT";
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number | null;
  unit: string | null;
  imageUrl: string | null;
  requiresVeterinarian: boolean;
};

export type RegisterLine = RegisterItem & {
  key: string;
  quantity: number;
  petId: string | null;
};

type ClientHit = { id: string; fullName: string; email: string };
type PetChoice = { id: string; name: string };
type VisitChoice = {
  id: string;
  label: string;
  petId: string;
  petName: string;
  serviceId: string;
  serviceName: string;
  serviceBlocked: boolean;
};

const fieldClass =
  "block min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function PosRegister({
  catalog,
  initialLines,
  initialTransactionId,
  initialClientId,
  initialClientName,
  initialPetId,
  initialAppointmentId,
  initialWalkInName,
  initialWalkInContact,
  blockedServiceIds,
}: {
  catalog: RegisterItem[];
  initialLines: RegisterLine[];
  initialTransactionId: string | null;
  initialClientId: string | null;
  initialClientName: string | null;
  initialPetId: string | null;
  initialAppointmentId: string | null;
  initialWalkInName: string | null;
  initialWalkInContact: string | null;
  blockedServiceIds: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"catalog" | "cart">("catalog");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [lines, setLines] = useState<RegisterLine[]>(initialLines);
  const [mode, setMode] = useState<"walk-in" | "client">(initialClientId ? "client" : "walk-in");
  const [walkInName, setWalkInName] = useState(initialWalkInName ?? (initialClientId ? "" : "Walk In"));
  const [walkInContact, setWalkInContact] = useState(initialWalkInContact ?? "");
  const [clientQuery, setClientQuery] = useState("");
  const [clientHits, setClientHits] = useState<ClientHit[]>([]);
  const [clientId, setClientId] = useState<string | null>(initialClientId);
  const [clientName, setClientName] = useState(initialClientName);
  const [pets, setPets] = useState<PetChoice[]>([]);
  const [visits, setVisits] = useState<VisitChoice[]>([]);
  const [petId, setPetId] = useState<string | null>(initialPetId);
  const [appointmentId, setAppointmentId] = useState<string | null>(initialAppointmentId);
  const [blocked, setBlocked] = useState<string[]>(blockedServiceIds);
  const [tendered, setTendered] = useState("");
  const [pending, startTransition] = useTransition();

  const categories = ["All", "Services", "Products", ...new Set(catalog.map((item) => item.category))];
  const visible = catalog.filter((item) => {
    const matchesCategory =
      category === "All" ||
      (category === "Services" && item.itemType === "SERVICE") ||
      (category === "Products" && item.itemType === "PRODUCT") ||
      item.category === category;
    const haystack = `${item.name} ${item.category}`.toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  });
  const totals = transactionTotals(lines.map((line) => lineSubtotal(line.price, line.quantity)));
  const tenderedAmount = Number(tendered);
  const change = Number.isFinite(tenderedAmount) ? cashChange(totals.total, tenderedAmount) : null;
  const needsClinicalNote = lines.some((line) => line.requiresVeterinarian);
  const selectedVisit = visits.find((visit) => visit.id === appointmentId);

  const cartPayload = useMemo(
    () =>
      lines.map((line) => ({
        itemType: line.itemType,
        serviceId: line.itemType === "SERVICE" ? line.id : null,
        productId: line.itemType === "PRODUCT" ? line.id : null,
        petId: line.petId,
        quantity: line.quantity,
      })),
    [lines],
  );

  function addItem(item: RegisterItem) {
    if (item.itemType === "SERVICE" && appointmentId && blocked.includes(item.id)) {
      setError("That service is already on a bill for this visit.");
      setPanel("cart");
      return;
    }
    if (item.itemType === "PRODUCT" && (item.stock ?? 0) < 1) {
      setError("That product is out of stock.");
      return;
    }
    setError(null);
    setLines((current) => {
      const existing = current.find((line) => line.itemType === item.itemType && line.id === item.id);
      if (existing) {
        const next = existing.quantity + 1;
        if (item.stock !== null && next > item.stock) return current;
        return current.map((line) => (line.key === existing.key ? { ...line, quantity: next } : line));
      }
      return [
        ...current,
        {
          ...item,
          key: `${item.itemType}-${item.id}`,
          quantity: 1,
          petId: item.itemType === "SERVICE" ? petId : null,
        },
      ];
    });
    setPanel("cart");
  }

  function chooseClient(client: ClientHit) {
    setClientId(client.id);
    setClientName(client.fullName);
    setClientHits([]);
    setPetId(null);
    setAppointmentId(null);
    setBlocked([]);
    startTransition(async () => {
      const context = await loadClientSaleContextAction(client.id, initialTransactionId);
      setPets(context.pets);
      setVisits(context.visits);
    });
  }

  function chooseVisit(visitId: string) {
    const visit = visits.find((item) => item.id === visitId);
    setAppointmentId(visitId || null);
    if (!visit) return;
    setPetId(visit.petId);
    setBlocked(visit.serviceBlocked ? [visit.serviceId] : []);
    const service = catalog.find((item) => item.itemType === "SERVICE" && item.id === visit.serviceId);
    if (!service || visit.serviceBlocked) return;
    setLines((current) => {
      if (current.some((line) => line.itemType === "SERVICE" && line.id === service.id)) return current;
      return [...current, { ...service, key: `SERVICE-${service.id}`, quantity: 1, petId: visit.petId }];
    });
  }

  function submit(pay: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await savePosCartAction({
        transactionId: initialTransactionId,
        clientId: mode === "client" ? clientId : null,
        petId: mode === "client" ? petId : null,
        appointmentId: mode === "client" ? appointmentId : null,
        walkInName: mode === "walk-in" ? walkInName : "",
        walkInContact: mode === "walk-in" ? walkInContact : "",
        items: cartPayload,
        pay,
        amountTendered: pay && Number.isFinite(tenderedAmount) ? tenderedAmount : null,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:hidden">
        <button type="button" className={buttonClass(panel === "catalog" ? "primary" : "outline")} onClick={() => setPanel("catalog")}>
          Catalog
        </button>
        <button type="button" className={buttonClass(panel === "cart" ? "primary" : "outline")} onClick={() => setPanel("cart")}>
          Cart ({lines.length})
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.85fr)]">
        <section className={`${panelClass("p-4 sm:p-6")} ${panel === "cart" ? "hidden lg:block" : ""}`}>
          <label htmlFor="catalog-search" className="text-sm font-medium text-ink">
            Search
          </label>
          <input
            id="catalog-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Service or product name"
            className={`${fieldClass} mt-2`}
          />
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={buttonClass(category === item ? "primary" : "outline", "md", "shrink-0")}
              >
                {item}
              </button>
            ))}
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {visible.map((item) => {
              const out = item.itemType === "PRODUCT" && (item.stock ?? 0) < 1;
              return (
                <li key={`${item.itemType}-${item.id}`} className="rounded-xl border border-line p-3">
                  <div className="flex gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-highlight text-xs font-semibold text-brand">
                        {item.itemType === "SERVICE" ? "Service" : "Item"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{item.name}</p>
                      <p className="text-xs uppercase text-muted">{item.itemType === "SERVICE" ? "Service" : item.category}</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{formatPeso(item.price)}</p>
                      {item.itemType === "PRODUCT" && (
                        <p className="text-xs text-muted">
                          {item.stock} {item.unit} on hand{out ? " · out of stock" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={out}
                    onClick={() => addItem(item)}
                    className={buttonClass("primary", "md", "mt-3 w-full")}
                  >
                    Add
                  </button>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && <p className="mt-4 text-sm text-muted">No items match that search.</p>}
        </section>

        <section className={`${panelClass("p-4 sm:p-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto")} ${panel === "catalog" ? "hidden lg:block" : ""}`}>
          <h2 className="text-base font-semibold text-ink">Cart</h2>
          {lines.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Add a service or product from the catalog.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {lines.map((line) => (
                <li key={line.key} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{line.name}</p>
                      <p className="text-xs uppercase text-muted">{line.itemType === "SERVICE" ? "Service" : "Product"}</p>
                    </div>
                    <p className="font-semibold text-ink">{formatPeso(lineSubtotal(line.price, line.quantity))}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label htmlFor={`qty-${line.key}`} className="sr-only">
                      Quantity for {line.name}
                    </label>
                    <input
                      id={`qty-${line.key}`}
                      type="number"
                      min={1}
                      max={line.stock ?? 999}
                      value={line.quantity}
                      onChange={(event) => {
                        const quantity = Number(event.target.value);
                        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return;
                        if (line.stock !== null && quantity > line.stock) return;
                        setLines((current) => current.map((item) => (item.key === line.key ? { ...item, quantity } : item)));
                      }}
                      className={`${fieldClass} w-24`}
                    />
                    <button
                      type="button"
                      className={buttonClass("outline")}
                      onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatPeso(totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>{formatPeso(0)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Reward</dt><dd>{formatPeso(0)}</dd></div>
            <div className="flex justify-between text-base font-semibold text-ink">
              <dt>Amount due</dt><dd>{formatPeso(totals.total)}</dd>
            </div>
          </dl>
          {needsClinicalNote && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              A veterinarian service is in this cart. Payment does not create the clinical record. Record that on the visit.
            </p>
          )}
          {selectedVisit?.serviceBlocked && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {selectedVisit.serviceName} is already on another bill for this visit.
            </p>
          )}

          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={buttonClass(mode === "walk-in" ? "primary" : "outline")}
                onClick={() => {
                  setMode("walk-in");
                  setWalkInName((current) => (current.trim() ? current : "Walk In"));
                }}
              >
                Walk-in
              </button>
              <button type="button" className={buttonClass(mode === "client" ? "primary" : "outline")} onClick={() => setMode("client")}>
                Existing client
              </button>
            </div>
            {mode === "walk-in" ? (
              <>
                <label htmlFor="walk-in-name" className="text-sm font-medium text-ink">Customer name</label>
                <input id="walk-in-name" value={walkInName} onChange={(event) => setWalkInName(event.target.value)} className={fieldClass} />
                <label htmlFor="walk-in-contact" className="text-sm font-medium text-ink">Contact (optional)</label>
                <input id="walk-in-contact" value={walkInContact} onChange={(event) => setWalkInContact(event.target.value)} className={fieldClass} />
              </>
            ) : (
              <>
                <label htmlFor="client-search" className="text-sm font-medium text-ink">Find a client</label>
                <div className="flex gap-2">
                  <input id="client-search" value={clientQuery} onChange={(event) => setClientQuery(event.target.value)} className={fieldClass} />
                  <button
                    type="button"
                    className={buttonClass("outline")}
                    onClick={() => {
                      startTransition(async () => setClientHits(await searchPosClientsAction(clientQuery)));
                    }}
                  >
                    Search
                  </button>
                </div>
                {clientName && <p className="text-sm text-ink">Selected: {clientName}</p>}
                <ul className="space-y-1 text-sm">
                  {clientHits.map((client) => (
                    <li key={client.id}>
                      <button type="button" className="font-semibold text-brand" onClick={() => chooseClient(client)}>
                        {client.fullName}
                      </button>
                      <span className="text-muted"> · {client.email}</span>
                    </li>
                  ))}
                </ul>
                {clientId && (
                  <>
                    <label htmlFor="pet" className="text-sm font-medium text-ink">Pet (optional)</label>
                    <select id="pet" value={petId ?? ""} onChange={(event) => setPetId(event.target.value || null)} className={fieldClass}>
                      <option value="">No pet</option>
                      {pets.map((pet) => (
                        <option key={pet.id} value={pet.id}>{pet.name}</option>
                      ))}
                    </select>
                    <label htmlFor="visit" className="text-sm font-medium text-ink">Visit (optional)</label>
                    <select id="visit" value={appointmentId ?? ""} onChange={(event) => chooseVisit(event.target.value)} className={fieldClass}>
                      <option value="">No visit</option>
                      {visits.map((visit) => (
                        <option key={visit.id} value={visit.id}>{visit.label}</option>
                      ))}
                    </select>
                  </>
                )}
              </>
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <label htmlFor="tendered" className="text-sm font-medium text-ink">Cash received</label>
            <input
              id="tendered"
              inputMode="decimal"
              value={tendered}
              onChange={(event) => setTendered(event.target.value)}
              className={fieldClass}
            />
            <p className="text-sm text-muted">
              Change: {change === null ? "Enter at least the amount due." : formatPeso(change)}
            </p>
            {error && <p className="text-sm text-accent-dark">{error}</p>}
            <button type="button" disabled={pending || lines.length === 0} onClick={() => submit(false)} className={buttonClass("outline", "md", "w-full")}>
              {pending ? "Saving..." : "Save unpaid"}
            </button>
            <button
              type="button"
              disabled={pending || lines.length === 0 || change === null}
              onClick={() => submit(true)}
              className={buttonClass("primary", "md", "w-full")}
            >
              {pending ? "Recording..." : "Record full payment"}
            </button>
            <p className="text-xs text-muted">
              This records cash paid at the counter. It does not charge a card and it does not complete the visit.
              An unpaid bill does not change stock.
            </p>
            {initialTransactionId && (
              <form action={voidPosAction} className="space-y-2 border-t border-line pt-4">
                <label htmlFor="void-reason" className="text-sm font-medium text-ink">Void this unpaid bill</label>
                <textarea
                  id="void-reason"
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                  rows={2}
                  className={fieldClass}
                />
                <input type="hidden" name="transactionId" value={initialTransactionId} />
                <ConfirmSubmitButton
                  confirmMessage="Void this open bill? It will stay in the history."
                  pendingText="Voiding..."
                >
                  Void open bill
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
