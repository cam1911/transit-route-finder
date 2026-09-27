function isCoordinate(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function parseNearbySearchParams(request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const lat = Number(latParam);
  const lng = Number(lngParam);
  const radiusMiles = Number(searchParams.get("radiusMiles") || 1);

  if (latParam === null || lngParam === null || !isCoordinate(lat, -90, 90) || !isCoordinate(lng, -180, 180)) {
    return { error: "coordinates" };
  }
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 25) {
    return { error: "radius" };
  }

  return { lat, lng, radiusMiles };
}
