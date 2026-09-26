import { Pool } from "pg";

let pool;

export function getPool() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    const error = new Error("PostGIS is not configured. Set SUPABASE_DB_URL and run the documented migration and GTFS import.");
    error.status = 503;
    throw error;
  }

  if (!pool) {
    pool = new Pool({ connectionString, connectionTimeoutMillis: 10000, max: 10 });
    pool.on("error", (error) => console.error("Unexpected PostgreSQL pool error:", error.message));
  }
  return pool;
}