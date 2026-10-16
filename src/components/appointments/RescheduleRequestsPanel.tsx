import Link from "next/link";
import { approveRescheduleRequestAction, rejectRescheduleRequestAction } from "@/app/actions/reschedule";
import { FlashNotice } from "@/components/appointments/FlashNotice";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass } from "@/components/ui/panel-styles";
import { formatTime12 } from "@/lib/appointments/constants";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

type PendingRequest = {
  id: string;
  appointment_id: string;
  reason: string | null;
  pet_name: string;
  service_name: string;
  client_name: string;
  current_slot_date: string;
  current_start_time: string;
  requested_slot_date: string;
  requested_start_time: string;
};

export async function RescheduleRequestsPanel({
  homePath,
  flash,
  flashError,
}: {
  homePath: "/staff/appointments" | "/senior-vet/appointments";
  flash?: string;
  flashError?: string;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_pending_reschedule_requests");
  const requests = (Array.isArray(data) ? data : []) as PendingRequest[];
  const listPath = `${homePath}/requests`;

  return (
    <>
      <h2 className="text-lg font-semibold text-ink">Reschedule requests</h2>
      <p className="mt-1 text-sm text-muted">Approving checks the new time again. A full slot is not booked.</p>
      <FlashNotice flash={flash} flashError={flashError} />
      <ul className="mt-6 space-y-3">
        {requests.length === 0 ? (
          <li className="text-sm text-muted">No requests are waiting for review.</li>
        ) : (
          requests.map((request) => (
            <li key={request.id} className={panelClass("p-5")}>
              <p className="text-sm font-semibold text-ink">{request.pet_name} · {request.service_name}</p>
              <p className="mt-1 text-sm text-muted">{request.client_name}</p>
              <p className="mt-3 text-sm">
                {formatDate(request.current_slot_date)} at {formatTime12(request.current_start_time)}
                {" → "}
                {formatDate(request.requested_slot_date)} at {formatTime12(request.requested_start_time)}
              </p>
              {request.reason && <p className="mt-2 text-sm text-muted">Reason: {request.reason}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <form action={approveRescheduleRequestAction}>
                  <input type="hidden" name="appointmentId" value={request.appointment_id} />
                  <input type="hidden" name="requestId" value={request.id} />
                  <input type="hidden" name="returnTo" value={listPath} />
                  <button type="submit" className={buttonClass("primary", "md")}>Approve</button>
                </form>
                <form action={rejectRescheduleRequestAction}>
                  <input type="hidden" name="appointmentId" value={request.appointment_id} />
                  <input type="hidden" name="requestId" value={request.id} />
                  <input type="hidden" name="returnTo" value={listPath} />
                  <button type="submit" className={buttonClass("outline", "md")}>Reject</button>
                </form>
                <Link href={`${homePath}/${request.appointment_id}`} className={buttonClass("ghost", "md")}>
                  Open appointment
                </Link>
              </div>
            </li>
          ))
        )}
      </ul>
    </>
  );
}
