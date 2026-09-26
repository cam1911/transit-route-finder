import { NextResponse } from "next/server";
import { getDataSource, getRoute } from "../../../../../lib/gtfs";

export async function GET(_request, { params }) {
  try {
    const { routeId } = await params;
    const route = await getRoute(routeId);
    if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });
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
