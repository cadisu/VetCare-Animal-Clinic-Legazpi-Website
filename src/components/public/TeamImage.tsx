"use client";

import { useState } from "react";

const FALLBACK = "/team-images/placeholder.svg";

/** Override slug → filename under public/team-images/ when a real photo is ready. */
const TEAM_IMAGE_FILES: Partial<Record<string, string>> = {
  "dr-carmela-dawn-r-de-guzman-dvm" : "Dr_Carmela_Dawn.jpg",
  "dr-merlyn-p-castelo-dvm" : "Dr_Merlyn.jpg",
  "dr-john-kenneth-p-adan-dvm" : "Dr_Adan.jpg",
  "fyona-mari-basco" : "Fyona_Mari.jpg",
  "katrina-v-barra" : "Katrina-Barra.jpg",
  "renz-mark" : "Renz_Mark.jpg",
  "rk-marie-amor" : "Rk_marie.jpg",
  "steve-o-bradley" : "steve_cat.jpg",
  "richard" : "Richard.jpg"
};

function teamSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function teamImagePath(name: string): string {
  const slug = teamSlug(name);
  if (!slug) return FALLBACK;
  const file = TEAM_IMAGE_FILES[slug] ?? `${slug}.svg`;
  return `/team-images/${file}`;
}

export function TeamImage({ name }: { name: string }) {
  const [src, setSrc] = useState(() => teamImagePath(name));

  return (
    <img
      src={src}
      alt=""
      className="h-28 w-28 rounded-full object-cover"
      onError={() => {
        if (src !== FALLBACK) setSrc(FALLBACK);
      }}
    />
  );
}
