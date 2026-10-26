"use client";

import { useEffect, useState } from "react";
import { loadPlaneArt, loadSchemeArt, type CardArt } from "./scryfall";

const planesCache: { value: Record<string, CardArt> | null } = { value: null };
const schemesCache: { value: Record<string, CardArt> | null } = { value: null };

/** Lazily pulls plane art once per session. Failures are silent. */
export function usePlaneArt(enabled = true) {
  const [art, setArt] = useState<Record<string, CardArt> | null>(planesCache.value);
  useEffect(() => {
    if (!enabled || planesCache.value) {
      setArt(planesCache.value);
      return;
    }
    let alive = true;
    void loadPlaneArt().then((value) => {
      planesCache.value = value;
      if (alive) setArt(value);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return art;
}

export function useSchemeArt(enabled = true) {
  const [art, setArt] = useState<Record<string, CardArt> | null>(schemesCache.value);
  useEffect(() => {
    if (!enabled || schemesCache.value) {
      setArt(schemesCache.value);
      return;
    }
    let alive = true;
    void loadSchemeArt().then((value) => {
      schemesCache.value = value;
      if (alive) setArt(value);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return art;
}

export function schemeNames(map: Record<string, CardArt> | null): string[] {
  if (!map) return [];
  return Object.values(map)
    .map((card) => card.name)
    .sort((a, b) => a.localeCompare(b));
}
