import { NextResponse } from "next/server";
import { parseNearbySearchParams } from "../../../../../lib/api/nearby-request";
import { getDataSource, nearbyStops } from "../../../../../lib/gtfs";

// GET /api/transit/stops/nearby is the first application API called after a
// user chooses an address.
export async function GET(request) {
  // Validate untrusted query-string input before it reaches filesystem or SQL code.
  const params = parseNearbySearchParams(request);
  if (params.error === "coordinates") {
    return NextResponse.json({ error: "Valid lat and lng are required" }, { status: 400 });
  }
  if (params.error === "radius") {
    return NextResponse.json({ error: "radiusMiles must be between 0 and 25" }, { status: 400 });
  }

  try {
    // The response shape is identical whether lib/gtfs uses JSON or PostGIS.
    return NextResponse.json({
      stops: await nearbyStops(params.lat, params.lng, params.radiusMiles),
      dataSource: getDataSource(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
