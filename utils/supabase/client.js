import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

// Use this factory inside Client Components. The SSR client reads/writes the
// browser's auth cookies so it participates in the same session as the server.
export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}