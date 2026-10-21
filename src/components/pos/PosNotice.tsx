import { Alert } from "@/components/ui/Alert";
import { posErrorText, posNoticeText } from "@/lib/pos/notices";

export function PosNotice({ notice, error }: { notice?: string; error?: string }) {
  const success = posNoticeText(notice);
  const failure = posErrorText(error);
  if (!success && !failure) return null;
  return (
    <div className="mb-6 space-y-3">
      {success && <Alert variant="success">{success}</Alert>}
      {failure && <Alert variant="error">{failure}</Alert>}
    </div>
  );
}
