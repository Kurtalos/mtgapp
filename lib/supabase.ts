import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase client is optional on purpose.
 *
 * If the environment variables are missing the app runs in local mode instead
 * of crashing on boot, which means `npm run dev` works out of the box and the
 * build never depends on secrets.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

export const ROOMS_TABLE = "rooms";
