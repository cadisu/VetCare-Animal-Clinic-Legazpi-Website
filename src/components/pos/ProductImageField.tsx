"use client";

import { useState } from "react";

export function ProductImageField({ currentUrl }: { currentUrl: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const shown = remove ? null : preview || currentUrl;

  return (
    <div className="space-y-2">
      <label htmlFor="image" className="text-sm font-medium text-ink">
        Image <span className="font-normal text-muted">(optional, JPG, PNG, or WEBP, up to 2 MB)</span>
      </label>
      {shown && <img src={shown} alt="" className="h-24 w-24 rounded-lg object-cover" />}
      <input
        id="image"
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="block w-full text-sm"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setRemove(false);
          setPreview(file ? URL.createObjectURL(file) : null);
        }}
      />
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
