import Link from "next/link";
import { buttonClass } from "@/components/ui/button-styles";

export function PosSectionLinks({ current }: { current: "pos" | "history" }) {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <Link href="/staff/pos" className={buttonClass(current === "pos" ? "primary" : "outline")}>
        POS
      </Link>
      <Link
        href="/staff/pos/history"
        className={buttonClass(current === "history" ? "primary" : "outline")}
      >
        Transaction history
      </Link>
    </div>
  );
}
