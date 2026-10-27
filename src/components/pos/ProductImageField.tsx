"use client";

import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button-styles";
import { ProductIcon } from "@/components/ui/icons";

export function ProductImageField({ currentUrl }: { currentUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const shown = remove ? null : preview || currentUrl;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">
        Image <span className="font-normal text-muted">(optional, JPG, PNG, or WEBP, up to 2 MB)</span>
      </p>
      {shown ? (
        <img src={shown} alt="" className="h-24 w-24 rounded-lg object-cover" />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-highlight text-brand">
          <ProductIcon className="h-8 w-8" />
        </div>
      )}
      <input
        ref={inputRef}
        id="image"
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setRemove(false);
          setPreview(file ? URL.createObjectURL(file) : null);
        }}
      />
      <button type="button" className={buttonClass("outline")} onClick={() => inputRef.current?.click()}>
        Choose image
      </button>
      {currentUrl && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="removeImage"
            value="true"
            checked={remove}
            onChange={(event) => setRemove(event.target.checked)}
          />
          Remove the current image
        </label>
      )}
    </div>
  );
}
