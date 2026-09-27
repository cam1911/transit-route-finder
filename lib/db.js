import { Pool } from "pg";

// Module state is reused by warm Next.js server processes. Creating one pool per
// request would waste connections and can exhaust a hosted database quickly.
let pool;

export function getPool() {
  // Both names are accepted so the data layer works with Supabase and generic Postgres.
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    const error = new Error("PostGIS is not configured. Set SUPABASE_DB_URL and run the documented migration and GTFS import.");
    error.status = 503;
    throw error;
  }

  if (!pool) {
    // A small bounded pool is suitable for this read-heavy app and server runtime.
    pool = new Pool({ connectionString, connectionTimeoutMillis: 10000, max: 10 });
    // Idle-client errors happen outside an individual query and must be observed here.
    pool.on("error", (error) => console.error("Unexpected PostgreSQL pool error:", error.message));
  }
  return pool;
}