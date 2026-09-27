import { NextResponse } from "next/server";
import { getDataSource, nearbyRoutes } from "../../../../lib/gtfs";

// A named HTTP-method export makes this file a Next.js Route Handler.
// This legacy endpoint returns route lines near a coordinate; the UI now starts
// with nearby stops instead.
export async function GET(request) {
  // URLSearchParams values are strings, so convert and validate at the HTTP edge.
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const lat = Number(latParam);
  const lng = Number(lngParam);
  const radiusMiles = Number(searchParams.get("radiusMiles") || 1);

  if (latParam === null || lngParam === null || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 25) {
    return NextResponse.json({ error: "radiusMiles must be between 0 and 25" }, { status: 400 });
  }

  try {
    // Business/data-access logic stays in lib/gtfs so this handler only speaks HTTP.
    return NextResponse.json({
      routes: await nearbyRoutes(lat, lng, radiusMiles),
      dataSource: getDataSource(),
    });
  } catch (error) {
    // Data-layer errors may attach an HTTP status (for example, 503 when no DB exists).
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
