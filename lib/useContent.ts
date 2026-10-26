"use client";

import { useEffect, useState } from "react";
import { mergeContent, type ContentBundle } from "@/lib/content";

let cache: ContentBundle | null = null;
let inFlight: Promise<ContentBundle> | null = null;

export function invalidateContent() {
  cache = null;
  inFlight = null;
}

async function loadContent(): Promise<ContentBundle> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = fetch("/api/content", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const custom = (await response.json()) as Parameters<typeof mergeContent>[0];
        cache = mergeContent(custom);
        return cache;
      })
      .catch(() => {
        // Offline or the endpoint is missing: bundled content still works.
        cache = mergeContent(null);
        return cache;
      });
  }
  return inFlight;
}

/**
 * Planes, schemes and role classes: bundled defaults merged with whatever the
 * admin has added. Fetched once per session and shared between mounts.
 */
export function useContent(): ContentBundle {
  const [bundle, setBundle] = useState<ContentBundle>(
    () => cache ?? mergeContent(null),
  );

  useEffect(() => {
    let alive = true;
    void loadContent().then((value) => {
      if (alive) setBundle(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return bundle;
}
