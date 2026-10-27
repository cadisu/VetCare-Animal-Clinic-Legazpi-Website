"use client";

import { useEffect, useId, useRef } from "react";

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="fixed inset-0 m-auto h-fit w-[min(calc(100%-1.5rem),36rem)] max-h-[min(90vh,44rem)] overflow-y-auto rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-ink/50"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm font-semibold text-brand">
          Close
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
