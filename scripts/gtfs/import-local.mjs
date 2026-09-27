import fs from "node:fs/promises";
import path from "node:path";
import { feeds } from "./feeds.mjs";
import { parseGtfs } from "./parse.mjs";
import { validateGtfs } from "./validate.mjs";

// This lightweight ETL path creates the committed JSON fallback. It is useful for
// local development because it requires neither Supabase nor PostGIS.
const feed = feeds[process.argv[2] || "dart"];
if (!feed) throw new Error(`Unknown GTFS feed: ${process.argv[2]}`);

const response = await fetch(process.env.GTFS_FEED_URL || feed.feedUrl);
if (!response.ok) throw new Error(`GTFS download failed: HTTP ${response.status}`);
const tables = validateGtfs(parseGtfs(Buffer.from(await response.arrayBuffer())));

// Index related tables by ID before joining them in JavaScript.
const routeById = new Map(tables.routes.map((route) => [route.route_id, {
  id: route.route_id,
  shortName: route.route_short_name || route.route_id,
  longName: route.route_long_name || "",
  routeType: Number(route.route_type),
  color: /^[0-9a-f]{6}$/i.test(route.route_color || "") ? `#${route.route_color}` : null,
}]));
const tripById = new Map(tables.trips.map((trip) => [trip.trip_id, trip]));
const servicesByStop = new Map();

for (const stopTime of tables.stop_times) {
  // Walk the GTFS relationships stop_time -> trip -> route and group the service
  // variants available at each stop.
  const trip = tripById.get(stopTime.trip_id);
  if (!trip) continue;
  const route = routeById.get(trip.route_id);
  if (!route) continue;
  if (!servicesByStop.has(stopTime.stop_id)) servicesByStop.set(stopTime.stop_id, new Map());
  const services = servicesByStop.get(stopTime.stop_id);
  const key = `${route.id}\u0000${trip.direction_id || ""}\u0000${trip.trip_headsign || ""}`;
  if (!services.has(key)) {
    services.set(key, {
      ...route,
      directionId: trip.direction_id || null,
      headsign: trip.trip_headsign || "",
    });
  }
}

// Emit only the fields the runtime JSON data source needs.
const stops = tables.stops.map((stop) => ({
  id: stop.stop_id,
  name: stop.stop_name,
  latitude: Number(stop.stop_lat),
  longitude: Number(stop.stop_lon),
  services: [...(servicesByStop.get(stop.stop_id)?.values() || [])],
}));

const outputDirectory = path.join(process.cwd(), "data", feed.id);
await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(path.join(outputDirectory, "stops.json"), JSON.stringify(stops));
console.log(`Wrote ${stops.length} stops with GTFS route services to ${outputDirectory}`);