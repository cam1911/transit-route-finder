import { Pool } from "pg";
import { feeds } from "./feeds.mjs";
import { parseGtfs } from "./parse.mjs";
import { validateGtfs } from "./validate.mjs";

const INSERT_BATCH_SIZE = 500;

function requireDatabaseUrl() {
  const value = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!value) {
    throw new Error("Set SUPABASE_DB_URL in .env.local to your Supabase PostgreSQL connection string before importing.");
  }
  return value;
}

async function insertRows(client, table, columns, rows, geographyColumns = []) {
  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
    const chunk = rows.slice(offset, offset + INSERT_BATCH_SIZE);
    const values = [];
    const tuples = chunk.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(row[column]);
        const marker = `$${values.length}`;
        return geographyColumns.includes(column) ? `${marker}::geography` : marker;
      });
      return `(${placeholders.join(", ")})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${tuples.join(", ")}`,
      values,
    );
  }
}

function normalize(feed, tables) {
  const agencies = tables.agency.length
    ? tables.agency.map((row) => ({
      id: row.agency_id ? `${feed.id}:${row.agency_id}` : feed.id,
      sourceId: row.agency_id || "",
      name: row.agency_name || feed.name,
      url: row.agency_url || null,
      timezone: row.agency_timezone || feed.timezone || null,
      lang: row.agency_lang || feed.lang || null,
    }))
    : [{ id: feed.id, sourceId: "", name: feed.name, url: null, timezone: feed.timezone || null, lang: feed.lang || null }];
  const agencyBySource = new Map(agencies.map((agency) => [agency.sourceId, agency.id]));
  const defaultAgencyId = agencies.length === 1 ? agencies[0].id : null;
  const agencyForRoute = (route) => {
    const id = route.agency_id ? agencyBySource.get(route.agency_id) : defaultAgencyId;
    if (!id) throw new Error(`Cannot map route ${route.route_id} to an agency in this feed.`);
    return id;
  };

  const routes = tables.routes.map((row) => {
    const agencyId = agencyForRoute(row);
    return {
      id: `${agencyId}:${row.route_id}`,
      agency_id: agencyId,
      feed_route_id: row.route_id,
      short_name: row.route_short_name || null,
      long_name: row.route_long_name || null,
      route_type: Number(row.route_type),
      color: /^[0-9a-f]{6}$/i.test(row.route_color || "") ? `#${row.route_color}` : null,
      text_color: /^[0-9a-f]{6}$/i.test(row.route_text_color || "") ? `#${row.route_text_color}` : null,
    };
  });
  const routeBySource = new Map(routes.map((route) => [route.feed_route_id, route.id]));
  const defaultStopAgencyId = defaultAgencyId || agencies[0].id;
  const stops = tables.stops.map((row) => {
    const latitude = Number(row.stop_lat);
    const longitude = Number(row.stop_lon);
    return {
      id: `${feed.id}:${row.stop_id}`,
      agency_id: defaultStopAgencyId,
      feed_stop_id: row.stop_id,
      name: row.stop_name,
      latitude,
      longitude,
      location: `SRID=4326;POINT(${longitude} ${latitude})`,
    };
  });
  const shapeIds = new Set(tables.shapes.map((row) => row.shape_id));
  const shapeCatalog = [...shapeIds].map((shapeId) => ({
    id: `${feed.id}:${shapeId}`,
    agency_id: defaultStopAgencyId,
    feed_shape_id: shapeId,
  }));
  const shapes = tables.shapes.map((row) => {
    const latitude = Number(row.shape_pt_lat);
    const longitude = Number(row.shape_pt_lon);
    return {
      shape_id: `${feed.id}:${row.shape_id}`,
      sequence: Number(row.shape_pt_sequence),
      latitude,
      longitude,
      location: `SRID=4326;POINT(${longitude} ${latitude})`,
    };
  });
  const trips = tables.trips.map((row) => ({
    id: `${feed.id}:${row.trip_id}`,
    feed_trip_id: row.trip_id,
    route_id: routeBySource.get(row.route_id),
    service_id: row.service_id,
    shape_id: row.shape_id ? `${feed.id}:${row.shape_id}` : null,
    direction_id: row.direction_id || null,
    headsign: row.trip_headsign || null,
  }));
  const stopTimes = tables.stop_times.map((row) => ({
    trip_id: `${feed.id}:${row.trip_id}`,
    stop_id: `${feed.id}:${row.stop_id}`,
    arrival_time: row.arrival_time || null,
    departure_time: row.departure_time || null,
    stop_sequence: Number(row.stop_sequence),
  }));

  const variants = new Map();
  for (const trip of trips) {
    if (!trip.shape_id) continue;
    const key = `${trip.route_id}\u0000${trip.shape_id}`;
    if (!variants.has(key)) variants.set(key, { route_id: trip.route_id, shape_id: trip.shape_id, directions: new Set() });
    variants.get(key).directions.add(`${trip.direction_id || ""}\u0000${trip.headsign || ""}`);
  }
  const routeShapes = [...variants.values()];
  return {
    agencies,
    routes,
    stops,
    shapeCatalog,
    shapes,
    trips,
    stopTimes,
    routeShapes,
    shapeVariants: routeShapes.flatMap((routeShape) => [...routeShape.directions].map((key) => {
      const [direction_id, headsign] = key.split("\u0000");
      return { route_id: routeShape.route_id, shape_id: routeShape.shape_id, direction_id, headsign };
    })),
  };
}

async function insertFeed(client, feed, data) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`gtfs-import:${feed.id}`]);
    await client.query("DELETE FROM agencies WHERE feed_id = $1", [feed.id]);
    await insertRows(client, "agencies", ["id", "feed_id", "name", "url", "timezone", "lang"],
      data.agencies.map((row) => ({ ...row, feed_id: feed.id })));
    await insertRows(client, "routes", ["id", "agency_id", "feed_route_id", "short_name", "long_name", "route_type", "color", "text_color"], data.routes);
    await insertRows(client, "stops", ["id", "agency_id", "feed_stop_id", "name", "latitude", "longitude", "location"], data.stops, ["location"]);
    await insertRows(client, "shape_catalog", ["id", "agency_id", "feed_shape_id"], data.shapeCatalog);
    await insertRows(client, "shapes", ["shape_id", "sequence", "latitude", "longitude", "location"], data.shapes, ["location"]);
    await insertRows(client, "trips", ["id", "feed_trip_id", "route_id", "service_id", "shape_id", "direction_id", "headsign"], data.trips);
    await insertRows(client, "stop_times", ["trip_id", "stop_id", "arrival_time", "departure_time", "stop_sequence"], data.stopTimes);

    await client.query("CREATE TEMP TABLE import_route_shapes (route_id TEXT, shape_id TEXT) ON COMMIT DROP");
    await insertRows(client, "import_route_shapes", ["route_id", "shape_id"], data.routeShapes);
    await client.query(`
      INSERT INTO route_shapes (route_id, shape_id, geometry)
      SELECT imports.route_id, imports.shape_id,
        ST_SetSRID(ST_MakeLine(points.location::geometry ORDER BY points.sequence), 4326)::geometry(LineString, 4326)
      FROM import_route_shapes imports
      JOIN shapes points ON points.shape_id = imports.shape_id
      GROUP BY imports.route_id, imports.shape_id
      HAVING COUNT(*) > 1
    `);
    await insertRows(client, "route_shape_variants", ["route_id", "shape_id", "direction_id", "headsign"], data.shapeVariants);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function importFeed(feed) {
  const connectionString = requireDatabaseUrl();
  const feedUrl = process.env.GTFS_FEED_URL || feed.feedUrl;
  if (!feedUrl) throw new Error(`No feedUrl configured for agency ${feed.id}.`);

  console.log(`Downloading ${feedUrl}`);
  const response = await fetch(feedUrl);
  if (!response.ok) throw new Error(`GTFS download failed: HTTP ${response.status}`);
  const tables = validateGtfs(parseGtfs(Buffer.from(await response.arrayBuffer())));
  const data = normalize(feed, tables);
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    const client = await pool.connect();
    try {
      await insertFeed(client, feed, data);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  console.log(`Imported ${data.routes.length} routes, ${data.stops.length} stops, ${data.trips.length} trips, and ${data.shapes.length} shape points for ${feed.id}.`);
}

const requestedFeed = process.argv[2];
if (requestedFeed === "--help" || requestedFeed === "-h") {
  console.log("Usage: npm run import:gtfs -- <feed-id> (configured feeds: dart; GTFS_FEED_URL may override the feed URL)");
} else if (requestedFeed !== undefined || process.argv[1]?.endsWith("/import.mjs")) {
  const feed = feeds[requestedFeed || "dart"];
  if (!feed) {
    console.error(`Unknown GTFS feed: ${requestedFeed}. Configured feeds: ${Object.keys(feeds).join(", ")}`);
    process.exitCode = 1;
  } else {
    importFeed(feed).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}