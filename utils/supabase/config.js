// Centralizing environment validation gives browser, server, and middleware
// clients the same configuration contract and the same useful failure message.
export function getSupabaseConfig() {
  // NEXT_PUBLIC_ variables are intentionally embedded in browser JavaScript.
  // A publishable key is safe to expose; authorization must still be enforced by RLS.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, publishableKey };
}