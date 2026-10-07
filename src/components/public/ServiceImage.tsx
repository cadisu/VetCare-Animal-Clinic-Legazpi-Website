"use client";

import { useState } from "react";

const FALLBACK = "/service-images/placeholder.svg";

/** Override slug → filename under public/service-images/ (e.g. custom JPG names). */
const SERVICE_IMAGE_FILES: Partial<Record<string, string>> = {
  consultation: "consultationImage.jpg",
  "multivalent-vaccine": "multivalent.jpg",
  "anti-rabies-vaccine": "antiRabies2.jpg",
  "deworming": "Deworming.jpg",
  "tick-and-flea-heartworm-prevention": "tick and flea prevention.jpg",
  "grooming": "Grooming.jpg",
  "surgery": "surgery.jpg"
};

function serviceSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Resolves image path from service name; add entries to SERVICE_IMAGE_FILES or use {slug}.svg placeholders. */
export function serviceImagePath(name: string): string {
  const slug = serviceSlug(name);
  if (!slug) return FALLBACK;
  const file = SERVICE_IMAGE_FILES[slug] ?? `${slug}.svg`;
  return `/service-images/${file}`;
}

export function ServiceImage({ name, className }: { name: string; className?: string }) {
  const [src, setSrc] = useState(() => serviceImagePath(name));

  return (
    <img
      src={src}
      alt={name}
      className={className ?? "size-full object-cover"}
      onError={() => {
        if (src !== FALLBACK) setSrc(FALLBACK);
      }}
    />
  );
}
