import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabaseConfig } from "./config";

// Middleware has separate incoming-request and outgoing-response cookie jars.
// Supabase may refresh tokens, so both must stay synchronized.
export async function updateSession(request) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Update the request seen by downstream Server Components.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        // Also send the refreshed values back to the browser.
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getUser verifies the token with Supabase and triggers refresh when needed.
  await supabase.auth.getUser();
  return response;
}