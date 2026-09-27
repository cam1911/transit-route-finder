// Define the subset of the GTFS schema that downstream normalization depends on.
const REQUIRED_COLUMNS = {
  routes: ["route_id", "route_type"],
  stops: ["stop_id", "stop_name", "stop_lat", "stop_lon"],
  trips: ["route_id", "service_id", "trip_id"],
  stop_times: ["trip_id", "stop_id", "stop_sequence"],
  shapes: ["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence"],
};

function numberInRange(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

export function validateGtfs(tables) {
  // Collect related errors before throwing so a feed maintainer can fix several
  // problems in one pass instead of rerunning once per missing field.
  const errors = [];
  for (const [name, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const rows = tables[name];
    if (!rows?.length) {
      errors.push(`${name}.txt contains no rows`);
      continue;
    }
    for (const column of columns) {
      if (!(column in rows[0])) errors.push(`${name}.txt is missing column ${column}`);
    }
  }
  if (errors.length) throw new Error(`Invalid GTFS feed:\n- ${errors.join("\n- ")}`);

  // Sets make uniqueness and foreign-key-style membership checks inexpensive.
  const routeIds = new Set(tables.routes.map((row) => row.route_id));
  const stopIds = new Set(tables.stops.map((row) => row.stop_id));
  const tripIds = new Set(tables.trips.map((row) => row.trip_id));
  const shapeIds = new Set(tables.shapes.map((row) => row.shape_id));

  if (routeIds.size !== tables.routes.length) errors.push("routes.txt contains duplicate route_id values");
  if (stopIds.size !== tables.stops.length) errors.push("stops.txt contains duplicate stop_id values");
  if (tripIds.size !== tables.trips.length) errors.push("trips.txt contains duplicate trip_id values");

  for (const row of tables.routes) {
    if (!Number.isInteger(Number(row.route_type))) errors.push(`Invalid route_type for route ${row.route_id}`);
  }
  for (const row of tables.stops) {
    if (!numberInRange(row.stop_lat, -90, 90) || !numberInRange(row.stop_lon, -180, 180)) {
      errors.push(`Invalid coordinates for stop ${row.stop_id}`);
      break;
    }
  }
  for (const row of tables.trips) {
    if (!routeIds.has(row.route_id)) errors.push(`Trip ${row.trip_id} references missing route ${row.route_id}`);
    if (row.shape_id && !shapeIds.has(row.shape_id)) errors.push(`Trip ${row.trip_id} references missing shape ${row.shape_id}`);
  }
  for (const row of tables.stop_times) {
    if (!tripIds.has(row.trip_id)) errors.push(`Stop time references missing trip ${row.trip_id}`);
    if (!stopIds.has(row.stop_id)) errors.push(`Stop time references missing stop ${row.stop_id}`);
    if (!Number.isInteger(Number(row.stop_sequence))) errors.push(`Invalid stop_sequence for trip ${row.trip_id}`);
  }
  for (const row of tables.shapes) {
    if (!numberInRange(row.shape_pt_lat, -90, 90) || !numberInRange(row.shape_pt_lon, -180, 180)) {
      errors.push(`Invalid coordinates for shape ${row.shape_id}`);
      break;
    }
    if (!Number.isInteger(Number(row.shape_pt_sequence))) errors.push(`Invalid shape sequence for ${row.shape_id}`);
  }

  // Some bad references can repeat thousands of times; de-duplicate the report.
  if (errors.length) throw new Error(`Invalid GTFS feed:\n- ${[...new Set(errors)].join("\n- ")}`);
  return tables;
}