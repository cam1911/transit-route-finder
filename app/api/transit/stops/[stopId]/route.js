import { NextResponse } from "next/server";
import { getDataSource, getStop } from "../../../../../lib/gtfs";

// Square brackets define a dynamic App Router segment. Next.js supplies the
// actual URL value through the asynchronous `params` object.
export async function GET(_request, { params }) {
  try {
    const { stopId } = await params;
    const stop = await getStop(stopId);
    // A missing domain record maps to an HTTP 404 rather than an empty success.
    if (!stop) return NextResponse.json({ error: "Stop not found" }, { status: 404 });
    return NextResponse.json({ ...stop, dataSource: getDataSource() });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}