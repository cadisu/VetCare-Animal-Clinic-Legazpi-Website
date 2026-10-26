import Link from "next/link";
import { buttonClass } from "@/components/ui/button-styles";

export function InventorySectionLinks({ current }: { current: "inventory" | "history" }) {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <Link href="/staff/inventory" className={buttonClass(current === "inventory" ? "primary" : "outline")}>
        Inventory
      </Link>
      <Link href="/staff/inventory/history" className={buttonClass(current === "history" ? "primary" : "outline")}>
        Movement history
      </Link>
      <Link href="/staff/products" className={buttonClass("outline")}>
        Products
      </Link>
    </div>
  );
}
