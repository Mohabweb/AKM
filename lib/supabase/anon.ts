import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/** Cookie-less client for public storefront reads. RLS applies as the `anon` role. Safe in any server component.
 *  The no-op lock stops separate "use cache" calls from waiting on each other's auth lock (Next 16 forbids that).
 *  This client never signs anyone in, so the lock protects nothing. */
export function anonClient() {
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
  });
}