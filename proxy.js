import { updateSession } from "./utils/supabase/middleware";

// Next.js runs this before matching requests. Next 16 renamed the middleware
// convention to "proxy" to emphasize that it is a network boundary.
export async function proxy(request) {
  return updateSession(request);
}

export const config = {
  // Static assets and public transit APIs do not need Supabase session refresh.
  matcher: [
    "/((?!api/transit|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
