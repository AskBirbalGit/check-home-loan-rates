/* =============================================================================
   supabase.ts  —  Browser Supabase client (publishable / anon key).
   -----------------------------------------------------------------------------
   The publishable key is a public, browser-safe key (it's already NEXT_PUBLIC_).
   Writes are guarded by RLS policies on the server (see supabase/schema.sql):
   anon may INSERT and UPDATE loan_leads but cannot SELECT, so the table is
   write-only from the public side. This needs no server-only secret, which
   keeps the Vercel deploy as a static client app with no extra env config.

   Returns null if env vars are missing so logging degrades gracefully (the
   calculator must never break because analytics is misconfigured).
============================================================================= */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[supabase] env vars missing — lead logging disabled.");
    }
    client = null;
    return client;
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
