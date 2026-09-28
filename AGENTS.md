<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Dallas Transit Nearby agent rules

## Required skills

- Load `.agents/skills/google-maps-platform/SKILL.md` before reviewing or
  changing Google Maps Platform code.
- Load `.agents/skills/next-dev-loop/SKILL.md` before validating changes to
  Next.js runtime behavior.
- Load `.agents/skills/supabase/SKILL.md` for every Supabase task.
- Also load
  `.agents/skills/supabase-postgres-best-practices/SKILL.md` before changing SQL,
  migrations, policies, indexes, database access, or Postgres configuration.

## Runtime verification

- Use Node.js 24 or newer, as pinned in `.node-version`.
- Reuse an existing `next dev` process. Next.js records its PID, URL, and port in
  `.next/dev/lock`; do not delete `.next` while that server is running.
- During development, use `/_next/mcp` for routes, logs, errors, compilation
  issues, and route metadata.
- Cross-check user-visible behavior with `agent-browser` and encode durable
  regressions as Playwright tests under `e2e/`.
- Run `npm run build` and the smallest relevant test command before completion.

## Data security

- Transit tables are server-only. Browser roles (`anon` and `authenticated`)
  must not receive table privileges or RLS policies for the GTFS schema.
- Never expose `SUPABASE_DB_URL`, secret keys, or service-role keys to client
  code. Only publishable values may use the `NEXT_PUBLIC_` prefix.
- Use parameterized SQL and preserve transactional GTFS imports.
- Any future user-owned table needs explicit least-privilege grants, RLS
  policies, and allow/deny pgTAP tests in the same change.

## Repository conventions

- Preserve the JSON GTFS fallback so the app and E2E tests can run without a
  database.
- Generated GTFS JSON and screenshots are data/assets, not hand-edited source.
- Keep the educational comments and `docs/LEARNING_ROADMAP.md` current when an
  architectural boundary changes.
