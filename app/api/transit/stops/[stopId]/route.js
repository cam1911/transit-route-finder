import { NextResponse } from "next/server";
import { getDataSource, getStop } from "../../../../../lib/gtfs";

export async function GET(_request, { params }) {
  try {
    const { stopId } = await params;
    const stop = await getStop(stopId);
    if (!stop) return NextResponse.json({ error: "Stop not found" }, { status: 404 });
    return NextResponse.json({ ...stop, dataSource: getDataSource() });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}