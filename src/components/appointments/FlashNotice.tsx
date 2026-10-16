import { Alert } from "@/components/ui/Alert";
import { smsFlashMessage } from "@/lib/sms/notices";

export function FlashNotice({ flash, flashError }: { flash?: string; flashError?: string }) {
  const success = smsFlashMessage(flash);
  if (!success && !flashError) return null;
  return (
    <div className="mt-4 space-y-3">
      {success && <Alert variant="success">{success}</Alert>}
      {flashError && <Alert variant="error">{flashError}</Alert>}
    </div>
  );
}
