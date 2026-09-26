import { NextResponse } from "next/server";
import { getDataSource, nearbyStops } from "../../../../../lib/gtfs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const lat = Number(latParam);
  const lng = Number(lngParam);
  const radiusMiles = Number(searchParams.get("radiusMiles") || 1);

  if (latParam === null || lngParam === null || !Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Valid lat and lng are required" }, { status: 400 });
  }
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 25) {
    return NextResponse.json({ error: "radiusMiles must be between 0 and 25" }, { status: 400 });
  }

  try {
    return NextResponse.json({
      stops: await nearbyStops(lat, lng, radiusMiles),
      dataSource: getDataSource(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}