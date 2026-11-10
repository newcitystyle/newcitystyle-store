"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getNeonOwnerAuthClient } from "@/lib/ncs-neon-owner-auth-client";

/**
 * OCT 16 NEON ADMIN BRIDGE.
 * - PostgREST BUSINESS reads and guarded CRUD -> same-origin owner-cookie Neon API.
 * - Supabase Auth and Storage -> existing owner auth provider (unchanged).
 * - Existing POS uses lib/supabase.ts, NOT this client. No bill replay.
 */
const OWNER_URL =
  process.env.NEXT_PUBLIC_NCS_OWNER_AUTH_URL ||
  process.env.NEXT_PUBLIC_NCS_AUTH_SUPABASE_URL ||
  "https://uskpoaszucenqxlzgmcy.supabase.co";
const OWNER_KEY =
  process.env.NEXT_PUBLIC_NCS_OWNER_AUTH_ANON_KEY ||
  process.env.NEXT_PUBLIC_NCS_AUTH_SUPABASE_PUBLISHABLE_KEY;

let bridgeClient: SupabaseClient | null = null;
function getBridgeClient(): SupabaseClient {
  if (bridgeClient) return bridgeClient;
  if (!OWNER_KEY || !OWNER_URL.startsWith("https://")) {
    throw new Error("NEON_ADMIN_OWNER_AUTH_CONFIGURATION_MISSING");
  }
  bridgeClient = createClient(OWNER_URL, OWNER_KEY, {
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const inputUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const original = new URL(inputUrl);
        const ownerOrigin = new URL(OWNER_URL).origin;
        if (original.origin !== ownerOrigin || !original.pathname.startsWith("/rest/v1/")) {
          return globalThis.fetch(input, init);
        }
        const target = new URL(
          `/api/ncs-core-cloud/v1/admin/neon-rest${original.pathname.slice("/rest/v1".length)}`,
          window.location.origin,
        );
        target.search = original.search;
        const headers = new Headers(init?.headers);
        headers.delete("apikey");
        headers.delete("authorization");
        const method = (init?.method || "GET").toUpperCase();
        return globalThis.fetch(target, {
          ...init,
          method,
          headers,
          credentials: "same-origin",
          cache: "no-store",
        });
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return bridgeClient;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_unused, property) {
    const client =
      property === "from" || property === "rpc"
        ? getBridgeClient()
        : getNeonOwnerAuthClient();
    if (!client) throw new Error("NCS_OWNER_AUTH_CONNECTION_NOT_CONFIGURED");
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
