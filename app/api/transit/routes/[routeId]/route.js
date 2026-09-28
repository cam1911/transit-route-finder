import { NextResponse } from "next/server";
import { getDataSource, getRoute } from "../../../../../lib/gtfs";

// This dynamic route loads the heavier geometry and ordered-stop data only
// after the user expands a route, keeping the nearby-stops response small.
export async function GET(request, { params }) {
  try {
    const { routeId } = await params;
    const direction = {
      id: request.nextUrl.searchParams.get("directionId"),
      headsign: request.nextUrl.searchParams.get("headsign"),
    };
    const route = await getRoute(routeId, direction);
    if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });
    // Explicitly shape the public API instead of leaking database row details.
    return NextResponse.json({
      id: route.id,
      shortName: route.shortName,
      longName: route.longName,
      type: route.type,
      color: route.color,
      agency: route.agency,
      shapes: route.shapes,
      directions: route.directions,
      dataSource: getDataSource(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
