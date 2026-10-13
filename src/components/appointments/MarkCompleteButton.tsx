import { markAppointmentCompletedAction } from "@/app/actions/appointments";
import { buttonClass } from "@/components/ui/button-styles";
import { canStaffCompleteAppointment, type AppointmentListRow } from "@/lib/appointments/constants";

export function MarkCompleteButton({
  appointment,
  day,
  returnTo,
}: {
  appointment: AppointmentListRow;
  day?: string;
  returnTo?: string;
}) {
  if (!canStaffCompleteAppointment(appointment)) return null;

  return (
    <form action={markAppointmentCompletedAction} className="mt-3">
      <input type="hidden" name="appointmentId" value={appointment.id} />
      {day && <input type="hidden" name="day" value={day} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <button type="submit" className={buttonClass("secondary", "md")}>
        Mark service as finished
      </button>
    </form>
  );
}
