import { Alert } from "@/components/ui/Alert";
import { inventoryErrorText, inventoryNoticeText } from "@/lib/inventory/notices";

export function InventoryNotice({ notice, error }: { notice?: string; error?: string }) {
  const success = inventoryNoticeText(notice);
  const failure = inventoryErrorText(error);
  if (!success && !failure) return null;
  return (
    <div className="mb-6 space-y-3">
      {success && <Alert variant="success">{success}</Alert>}
      {failure && <Alert variant="error">{failure}</Alert>}
    </div>
  );
}
