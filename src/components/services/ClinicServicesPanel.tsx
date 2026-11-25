import { upsertServiceFormAction } from "@/app/actions/services";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { Alert } from "@/components/ui/Alert";
import { FormField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { createClient } from "@/lib/supabase/server";

export async function ClinicServicesPanel({ editId }: { editId?: string }) {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });
  const editing = editId ? (services ?? []).find((s) => s.id === editId) : null;

  return (
    <>
      <DashboardHeading title="Clinic services" />
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold">All services</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(services ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                <span>
                  {s.name}{" "}
                  <span className="text-xs text-slate-500">
                    {s.is_active ? "active" : "inactive"} · {s.is_bookable ? "bookable" : "not bookable"}
                  </span>
                </span>
                <a href={`/staff/services?edit=${s.id}`} className="text-brand hover:underline">
                  Edit
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold">{editing ? "Edit service" : "Add service"}</h2>
          <form action={upsertServiceFormAction} className="mt-4 space-y-4">
            {editing && <input type="hidden" name="serviceId" value={editing.id} />}
            <FormField label="Name" name="name" required defaultValue={editing?.name ?? ""} />
            <TextAreaField label="Description" name="description" defaultValue={editing?.description ?? ""} />
            <SelectField label="Category" name="category" defaultValue={editing?.category ?? "OTHER"}>
              <option value="CONSULTATION">Consultation</option>
              <option value="VACCINATION">Vaccination</option>
              <option value="PREVENTION">Prevention</option>
              <option value="GROOMING">Grooming</option>
              <option value="SURGERY">Surgery</option>
              <option value="OTHER">Other</option>
            </SelectField>
            <SelectField
              label="Requires veterinarian"
              name="requiresVeterinarian"
              defaultValue={editing?.requires_veterinarian ? "true" : "false"}
            >
              <option value="true">Yes</option>
              <option value="false">No (clinic-wide slots)</option>
            </SelectField>
            <SelectField label="Active" name="isActive" defaultValue={editing?.is_active !== false ? "true" : "false"}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </SelectField>
            <SelectField
              label="Bookable online"
              name="isBookable"
              defaultValue={editing?.is_bookable !== false ? "true" : "false"}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </SelectField>
            <FormField
              label="Price (optional)"
              name="price"
              hint="Required before this service can be added to a bill."
              defaultValue={editing?.price ?? ""}
            />
            <FormField
              label="Duration minutes (optional)"
              name="durationMinutes"
              defaultValue={editing?.duration_minutes ?? ""}
            />
            <FormField label="Sort order" name="sortOrder" defaultValue={String(editing?.sort_order ?? 0)} />
            <SubmitButton>{editing ? "Save changes" : "Add service"}</SubmitButton>
          </form>
          {!editing && (
            <div className="mt-4">
              <Alert variant="info">Existing services can be edited here.</Alert>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
