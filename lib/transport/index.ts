import { isSupabaseConfigured } from "@/lib/supabase";
import { CloudTransport } from "./cloud";
import { LocalTransport } from "./local";
import type { RoomTransport } from "./types";

let singleton: RoomTransport | null = null;

export function getTransport(): RoomTransport {
  if (!singleton) {
    singleton = isSupabaseConfigured ? new CloudTransport() : new LocalTransport();
  }
  return singleton;
}

export function resetTransportForTests() {
  singleton = null;
}

export * from "./types";
