export const SMS_FLASH: Record<string, string> = {
  rescheduled: "The appointment was rescheduled. Any text message is tracked separately and does not change the visit.",
  requested: "Your reschedule request was submitted. The appointment time stays the same until the clinic approves it.",
  withdrawn: "The reschedule request was withdrawn. The appointment time is unchanged.",
  approved: "The reschedule request was approved.",
  rejected: "The reschedule request was rejected. The original appointment is unchanged.",
  retried: "The retry was recorded. Refresh the status before assuming the message was sent.",
  reminder_sent: "The reminder was submitted. Pending means UniSMS accepted it. Reported sent does not mean the phone received it.",
  template: "The reminder message was saved. Messages already created keep their original text.",
};

export function smsFlashMessage(code: string | undefined): string | null {
  if (!code) return null;
  return SMS_FLASH[code] ?? null;
}
