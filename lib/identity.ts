import { uid } from "@/lib/room/random";

const ID_KEY = "manatable:playerId";
const NAME_KEY = "manatable:displayName";

/**
 * Cloud mode needs a *stable* id: you refresh, or your phone sleeps, and you
 * must come back as the same player. Local mode wants the opposite — each tab
 * is a separate seat, which is what makes "open two tabs and play against
 * yourself" work for testing. So the storage depends on the backend.
 */
const cloudMode = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return cloudMode ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getPlayerId(): string {
  const store = storage();
  if (!store) return "server";
  let id = store.getItem(ID_KEY);
  if (!id) {
    id = uid("p");
    store.setItem(ID_KEY, id);
  }
  return id;
}

export function getSavedName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function saveName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_KEY, name.trim().slice(0, 24));
}
