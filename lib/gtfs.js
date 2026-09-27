import fs from "node:fs";
import path from "node:path";
import { getPool } from "./db";

// This module is the application's data-access boundary. Its exported functions
// return the same objects from either bundled JSON or PostgreSQL/PostGIS.
const DATA_DIR = path.join(process.cwd(), "data", "dart");
const DATABASE_CONFIGURED = Boolean(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL);
const USE_JSON = process.env.GTFS_DATA_SOURCE === "json"
  || (process.env.GTFS_DATA_SOURCE !== "postgres" && !DATABASE_CONFIGURED);

// API responses expose this for diagnostics without exposing credentials.
export function getDataSource() {
  return USE_JSON ? "local-json" : "postgis";
}

function readJson() {
  // Synchronous reads are acceptable for the small development snapshot and are
  // avoided in production when the PostGIS source is selected.
  const file = path.join(DATA_DIR, "routes.json");
  if (!fs.existsSync(file)) throw new Error("DART data is missing. Run npm run import:dart first.");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readStopsJson() {
  const file = path.join(DATA_DIR, "stops.json");
  if (!fs.existsSync(file)) throw new Error("DART stop data is missing. Run npm run import:local -- dart first.");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  // Haversine measures great-circle distance between two latitude/longitude points.
  const R = 3958.7613;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function pointToSegmentDistanceMiles(p, a, b) {
  // For the JSON fallback, project a tiny local area to miles and find the
  // closest point on each route-line segment.
  const latScale = 69.0;
  const lngScale = 69.0 * Math.cos((p.lat * Math.PI) / 180);
  const px = p.lng * lngScale, py = p.lat * latScale;
  const ax = a[1] * lngScale, ay = a[0] * latScale;
  const bx = b[1] * lngScale, by = b[0] * latScale;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function geometryDistanceMiles(lat, lng, points) {
  // A polyline's distance is the smallest distance to any of its segments.
  if (!points?.length) return Infinity;
  let best = haversineMiles(lat, lng, points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    best = Math.min(best, pointToSegmentDistanceMiles({ lat, lng }, points[i - 1], points[i]));
  }
  return best;
}

function transitType(routeType) {
  // Normalize standard and extended GTFS route_type numbers into UI categories.
  if (routeType === 0 || (routeType >= 900 && routeType < 1000)) return "STREETCAR";
  if (routeType === 3 || (routeType >= 200 && routeType < 300) || (routeType >= 700 && routeType < 800)) return "BUS";
  if (routeType === 4 || (routeType >= 500 && routeType < 600)) return "FERRY";
  if (routeType === 5 || routeType === 6 || routeType === 7) return "CABLE";
  if (routeType === 11 || (routeType >= 800 && routeType < 900)) return "TROLLEYBUS";
  if ((routeType >= 600 && routeType < 700) || (routeType >= 1000 && routeType < 1100)) return "AIR";
  if (routeType === 12) return "MONORAIL";
  if (routeType === 1 || routeType === 2 || (routeType >= 100 && routeType < 200) || (routeType >= 300 && routeType < 500)) return "RAIL";
  return "OTHER";
}

function routeSummary(route) {
  return {
    id: route.id,
    shortName: route.shortName,
    longName: route.longName,
    type: transitType(Number(route.routeType)),
    color: route.color,
  };
}

function pointsFromGeoJson(geometry) {
  // GeoJSON stores [longitude, latitude]; Google Maps paths use {lat, lng}.
  return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

export async function nearbyRoutes(lat, lng, radiusMiles) {
  if (USE_JSON) {
    return readJson()
      .map((route) => ({
        ...route,
        type: null,
        distanceMiles: geometryDistanceMiles(lat, lng, route.representativeShape),
      }))
      .filter((route) => route.distanceMiles <= radiusMiles)
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }

  // PostGIS geography calculations use meters and account for Earth's curvature.
  const radiusMeters = radiusMiles * 1609.344;
  const result = await getPool().query(`
    WITH property AS (
      SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS location
    )
    SELECT r.id, r.short_name AS "shortName", r.long_name AS "longName",
      r.color, r.route_type AS "routeType",
      MIN(ST_Distance(rs.geometry::geography, property.location)) / 1609.344 AS "distanceMiles"
    FROM routes r
    JOIN route_shapes rs ON rs.route_id = r.id
    CROSS JOIN property
    WHERE ST_DWithin(rs.geometry::geography, property.location, $3)
    GROUP BY r.id
    ORDER BY "distanceMiles", r.id
  `, [lng, lat, radiusMeters]);

  return result.rows.map((route) => ({ ...route, type: transitType(route.routeType) }));
}

export async function nearbyStops(lat, lng, radiusMiles) {
  if (USE_JSON) {
    return readStopsJson()
      .map((stop) => ({
        ...stop,
        distanceMiles: haversineMiles(lat, lng, stop.latitude, stop.longitude),
        routes: [...new Map(stop.services.map((service) => [service.id, routeSummary(service)])).values()],
      }))
      .filter((stop) => stop.distanceMiles <= radiusMiles)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .map(({ services: _services, ...stop }) => stop);
  }

  const radiusMeters = radiusMiles * 1609.344;
  // The CTE first narrows stops with the GiST-backed ST_DWithin predicate, then
  // joins services only for that small nearby set.
  const result = await getPool().query(`
    WITH property AS (
      SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS location
    ), nearby AS (
      SELECT s.id, s.name, s.latitude, s.longitude,
        ST_Distance(s.location, property.location) / 1609.344 AS distance_miles
      FROM stops s
      CROSS JOIN property
      WHERE ST_DWithin(s.location, property.location, $3)
    )
    SELECT nearby.id, nearby.name, nearby.latitude, nearby.longitude,
      nearby.distance_miles AS "distanceMiles",
      COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
        'id', r.id,
        'shortName', r.short_name,
        'longName', r.long_name,
        'routeType', r.route_type,
        'color', r.color
      )) FILTER (WHERE r.id IS NOT NULL), '[]'::jsonb) AS routes
    FROM nearby
    LEFT JOIN stop_times st ON st.stop_id = nearby.id
    LEFT JOIN trips t ON t.id = st.trip_id
    LEFT JOIN routes r ON r.id = t.route_id
    GROUP BY nearby.id, nearby.name, nearby.latitude, nearby.longitude, nearby.distance_miles
    ORDER BY nearby.distance_miles, nearby.name
  `, [lng, lat, radiusMeters]);

  return result.rows.map((stop) => ({
    ...stop,
    routes: stop.routes.map(routeSummary),
  }));
}

export async function getStop(stopId) {
  if (USE_JSON) {
    const stop = readStopsJson().find((item) => String(item.id) === String(stopId));
    if (!stop) return null;
    // Multiple trips can repeat a route/direction at one stop. Group them into
    // the compact route structure expected by the UI.
    const groupedRoutes = new Map();
    for (const service of stop.services) {
      if (!groupedRoutes.has(service.id)) {
        groupedRoutes.set(service.id, { ...routeSummary(service), directions: [] });
      }
      const route = groupedRoutes.get(service.id);
      const key = `${service.directionId || "unknown"}\u0000${service.headsign || ""}`;
      if (!route.directions.some((direction) => direction.key === key)) {
        route.directions.push({
          key,
          id: service.directionId || "unknown",
          headsign: service.headsign,
        });
      }
    }
    return {
      id: stop.id,
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      routes: [...groupedRoutes.values()].map((route) => ({
        ...route,
        directions: route.directions.map(({ key: _key, ...direction }) => direction),
      })),
    };
  }

  // $1 is a parameter placeholder. Passing values separately prevents SQL injection.
  const result = await getPool().query(`
    SELECT s.id AS "stopId", s.name AS "stopName", s.latitude, s.longitude,
      r.id AS "routeId", r.short_name AS "shortName", r.long_name AS "longName",
      r.route_type AS "routeType", r.color,
      COALESCE(t.direction_id, 'unknown') AS "directionId",
      COALESCE(t.headsign, '') AS headsign
    FROM stops s
    LEFT JOIN stop_times st ON st.stop_id = s.id
    LEFT JOIN trips t ON t.id = st.trip_id
    LEFT JOIN routes r ON r.id = t.route_id
    WHERE s.id = $1
    GROUP BY s.id, s.name, s.latitude, s.longitude, r.id, r.short_name,
      r.long_name, r.route_type, r.color, t.direction_id, t.headsign
    ORDER BY r.short_name, r.id, t.direction_id, t.headsign
  `, [stopId]);
  if (!result.rows.length) return null;

  const groupedRoutes = new Map();
  for (const row of result.rows) {
    if (!row.routeId) continue;
    if (!groupedRoutes.has(row.routeId)) {
      groupedRoutes.set(row.routeId, {
        id: row.routeId,
        shortName: row.shortName,
        longName: row.longName,
        type: transitType(row.routeType),
        color: row.color,
        directions: [],
      });
    }
    groupedRoutes.get(row.routeId).directions.push({ id: row.directionId, headsign: row.headsign });
  }
  const stop = result.rows[0];
  return {
    id: stop.stopId,
    name: stop.stopName,
    latitude: stop.latitude,
    longitude: stop.longitude,
    routes: [...groupedRoutes.values()],
  };
}

export async function getRoute(routeId) {
  if (USE_JSON) {
    const route = readJson().find((item) => String(item.id) === String(routeId));
    return route ? { ...route, type: null, agency: { id: "dart", name: "DART" }, directions: [] } : null;
  }

  const pool = getPool();
  const routeResult = await pool.query(`
    SELECT r.id, r.short_name AS "shortName", r.long_name AS "longName", r.color,
      r.route_type AS "routeType", r.agency_id AS "agencyId", a.name AS "agencyName"
    FROM routes r JOIN agencies a ON a.id = r.agency_id
    WHERE r.id = $1
  `, [routeId]);
  const route = routeResult.rows[0];
  if (!route) return null;

  // Geometry is converted to GeoJSON in PostgreSQL so Node receives plain JSON.
  const shapeResult = await pool.query(`
    SELECT rs.shape_id AS "shapeId", sc.feed_shape_id AS "feedShapeId",
      ST_AsGeoJSON(rs.geometry)::json AS geometry,
      COALESCE(json_agg(json_build_object('id', v.direction_id, 'headsign', v.headsign))
        FILTER (WHERE v.route_id IS NOT NULL), '[]'::json) AS variants
    FROM route_shapes rs
    JOIN shape_catalog sc ON sc.id = rs.shape_id
    LEFT JOIN route_shape_variants v ON v.route_id = rs.route_id AND v.shape_id = rs.shape_id
    WHERE rs.route_id = $1
    GROUP BY rs.route_id, rs.shape_id, sc.feed_shape_id, rs.geometry
    ORDER BY sc.feed_shape_id
  `, [routeId]);

  const stopResult = await pool.query(`
    SELECT DISTINCT t.direction_id AS "directionId", COALESCE(t.headsign, '') AS headsign,
      t.shape_id AS "shapeId", st.stop_sequence AS sequence,
      s.id, s.name, s.latitude, s.longitude
    FROM trips t
    JOIN stop_times st ON st.trip_id = t.id
    JOIN stops s ON s.id = st.stop_id
    WHERE t.route_id = $1 AND t.shape_id IS NOT NULL
    ORDER BY t.direction_id, headsign, t.shape_id, st.stop_sequence
  `, [routeId]);

  // Reassemble normalized SQL rows into nested directions and ordered stops for
  // straightforward React rendering.
  const directions = new Map();
  for (const row of stopResult.rows) {
    const id = row.directionId || "unknown";
    const key = `${id}\u0000${row.headsign}`;
    if (!directions.has(key)) directions.set(key, { id, headsign: row.headsign, shapes: [], stops: [] });
    const direction = directions.get(key);
    if (!direction.shapes.includes(row.shapeId)) direction.shapes.push(row.shapeId);
    direction.stops.push({
      id: row.id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      sequence: row.sequence,
      shapeId: row.shapeId,
    });
  }

  return {
    id: route.id,
    shortName: route.shortName,
    longName: route.longName,
    type: transitType(route.routeType),
    color: route.color,
    agency: { id: route.agencyId, name: route.agencyName },
    shapes: shapeResult.rows.map((shape) => ({
      shapeId: shape.feedShapeId,
      points: pointsFromGeoJson(shape.geometry),
    })),
    directions: [...directions.values()],
  };
}
