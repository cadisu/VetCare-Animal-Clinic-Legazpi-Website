"use client";

import { useEffect, useState } from "react";
import { ProcessingScreen } from "@/components/ui/ProcessingScreen";

function requestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = input instanceof Request ? new Headers(input.headers) : new Headers();
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

/** Page loads and server actions. Prefetch and dev refresh stay quiet. */
function isAppRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = requestHeaders(input, init);
  if (headers.get("next-router-prefetch") === "1") return false;
  if (headers.get("next-router-segment-prefetch") === "1") return false;
  if (headers.get("next-hmr-refresh")) return false;
  if (headers.has("next-action")) return true;
  return headers.get("rsc") === "1";
}

/** Shows the logo spinner while Next.js is loading a page or running a server action. */
export function ProcessingWatcher() {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const original = window.fetch.bind(window);
    let count = 0;

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const tracked = isAppRequest(input, init);
      if (tracked) {
        count += 1;
        setPending(true);
      }
      try {
        return await original(input, init);
      } finally {
        if (tracked) {
          count -= 1;
          if (count <= 0) {
            count = 0;
            setPending(false);
          }
        }
      }
    }) as typeof window.fetch;

    return () => {
      window.fetch = original;
    };
  }, []);

  if (!pending) return null;
  return <ProcessingScreen />;
}
