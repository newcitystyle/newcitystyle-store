"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Auth-only client. NEVER route business PostgREST traffic through this client.
let ownerClient: SupabaseClient | null = null;
export function getNeonOwnerAuthClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_NCS_OWNER_AUTH_URL || "https://uskpoaszucenqxlzgmcy.supabase.co";
  const key = process.env.NEXT_PUBLIC_NCS_OWNER_AUTH_ANON_KEY;
  if (!key || !url.startsWith("https://")) return null;
  if (!ownerClient) ownerClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "ncs-neon-cloud-owner-auth-session-v1"
    }
  });
  return ownerClient;
}
