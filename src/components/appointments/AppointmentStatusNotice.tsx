import { Alert } from "@/components/ui/Alert";
import { appointmentStatusError, appointmentStatusNotice } from "@/lib/appointments/transitions";

export function AppointmentStatusNotice({
  notice,
  statusError,
  completed,
}: {
  notice?: string;
  statusError?: string;
  /** Older completion redirects used this flag. */
  completed?: string;
}) {
  const success = appointmentStatusNotice(notice) ?? (completed === "1" ? appointmentStatusNotice("completed") : null);
  const error = appointmentStatusError(statusError);
  if (!success && !error) return null;

  return (
    <div className="mt-4 space-y-3">
      {success && <Alert variant="success">{success}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
