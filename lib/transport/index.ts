import { isSupabaseConfigured } from "@/lib/supabase";
import { CloudTransport } from "./cloud";
import { LocalTransport } from "./local";
import { SelfHostedTransport } from "./selfhosted";
import type { RoomTransport } from "./types";

export type BackendChoice = "selfhosted" | "supabase" | "local";

/**
 * Which backend to use.
 *
 *   NEXT_PUBLIC_BACKEND = selfhosted | supabase | local
 *
 * Default is "auto": use Supabase if it is configured, otherwise the backend
 * bundled with this app. "local" is kept as an explicit escape hatch for a
 * single tablet at the table with no server involved at all.
 */
export function backendChoice(): BackendChoice {
  const configured = (process.env.NEXT_PUBLIC_BACKEND ?? "").trim().toLowerCase();
  if (configured === "selfhosted" || configured === "supabase" || configured === "local") {
    return configured;
  }
  return isSupabaseConfigured ? "supabase" : "selfhosted";
}

let singleton: RoomTransport | null = null;

export function getTransport(): RoomTransport {
  if (!singleton) {
    switch (backendChoice()) {
      case "supabase":
        singleton = new CloudTransport();
        break;
      case "local":
        singleton = new LocalTransport();
        break;
      default:
        singleton = new SelfHostedTransport();
    }
  }
  return singleton;
}

export function backendLabel(): string {
  switch (backendChoice()) {
    case "supabase":
      return "Cloud rooms";
    case "local":
      return "Local rooms";
    default:
      return "Self-hosted";
  }
}

export function resetTransportForTests() {
  singleton = null;
}

export * from "./types";
