import { uid } from "@/lib/room/random";

/**
 * Storage keys, frozen at the app's original name on purpose.
 *
 * The app is now called Cards with Kurt & Friends, but these strings identify
 * *this player* to the server. Renaming them would hand everyone a fresh id on
 * their next visit — mid-game they would appear as a new person, or be pushed
 * to spectator because the game had already started. Internal, never rendered.
 */
const ID_KEY = "manatable:playerId";
const NAME_KEY = "manatable:displayName";

/**
 * A shared backend needs a *stable* id: you refresh, your phone sleeps, or the
 * browser discards the tab, and you must come back as the same player rather
 * than appearing as a stranger (or being pushed out to spectator because the
 * game has already started). Local mode wants the opposite — each tab is a
 * separate seat, which is what makes "open two tabs and play against yourself"
 * work when there is no server at all.
 *
 * Read straight from env rather than importing the transport registry, so this
 * module stays dependency-free and cannot form an import cycle with it.
 */
const sharedBackend = process.env.NEXT_PUBLIC_BACKEND !== "local";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return sharedBackend ? window.localStorage : window.sessionStorage;
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
