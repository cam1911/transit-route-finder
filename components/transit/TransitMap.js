"use client";

import { MarkerClusterer } from "@googlemaps/markerclusterer";
import {
  AdvancedMarker,
  Circle,
  ControlPosition,
  Map as GoogleMap,
  Polyline,
  useAdvancedMarkerRef,
  useMap,
} from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useMemo, useState } from "react";
import { routeName } from "./TransitUI";

const DEFAULT_CENTER = { lat: 32.7767, lng: -96.797 };
const CLUSTER_THRESHOLD = 75;
const MILES_PER_LATITUDE_DEGREE = 69;

function primaryMode(routes) {
  if (routes.some((route) => route.type === "RAIL")) return "rail";
  if (routes.some((route) => route.type === "STREETCAR")) return "streetcar";
  if (routes.some((route) => route.type === "BUS")) return "bus";
  return "other";
}

function boundsForPoints(points) {
  if (!points.length) return null;
  return points.reduce(
    (bounds, point) => ({
      north: Math.max(bounds.north, point.lat),
      south: Math.min(bounds.south, point.lat),
      east: Math.max(bounds.east, point.lng),
      west: Math.min(bounds.west, point.lng),
    }),
    {
      north: points[0].lat,
      south: points[0].lat,
      east: points[0].lng,
      west: points[0].lng,
    },
  );
}

function radiusBounds(position, radiusMiles) {
  const latitudeDelta = radiusMiles / MILES_PER_LATITUDE_DEGREE;
  const longitudeScale = Math.cos((position.lat * Math.PI) / 180);
  const longitudeDelta = radiusMiles / (MILES_PER_LATITUDE_DEGREE * longitudeScale);
  return {
    north: position.lat + latitudeDelta,
    south: position.lat - latitudeDelta,
    east: position.lng + longitudeDelta,
    west: position.lng - longitudeDelta,
  };
}

function MapCamera({ location, radius, selectedStop, routePaths }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const routePoints = routePaths.flat();
    if (routePoints.length) {
      const points = location ? [location.position, ...routePoints] : routePoints;
      map.fitBounds(boundsForPoints(points), 72);
      return;
    }

    if (selectedStop) {
      const points = [{ lat: selectedStop.latitude, lng: selectedStop.longitude }];
      if (location) points.unshift(location.position);
      map.fitBounds(boundsForPoints(points), 150);
      return;
    }

    if (location) {
      map.fitBounds(radiusBounds(location.position, radius), 72);
      return;
    }

    map.setCenter(DEFAULT_CENTER);
    map.setZoom(11);
  }, [location, map, radius, routePaths, selectedStop]);

  return null;
}

function StopMarker({ stop, selected, onSelect, setMarkerRef }) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  useEffect(() => {
    setMarkerRef(marker, stop.id);
    return () => setMarkerRef(null, stop.id);
  }, [marker, setMarkerRef, stop.id]);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: stop.latitude, lng: stop.longitude }}
      title={stop.name}
      clickable
      zIndex={selected ? 40 : 20}
      onClick={() => onSelect(stop)}
    >
      <div
        className={`transit-stop-marker transit-stop-marker--${primaryMode(stop.routes)}${selected ? " is-selected" : ""}`}
      >
        <span className="transit-stop-marker__core">
          {stop.routes.length > 1 ? String(Math.min(stop.routes.length, 9)) : ""}
        </span>
        <span className="transit-stop-tooltip">
          <strong>{stop.name}</strong>
          <span>{stop.routes.slice(0, 3).map(routeName).join(" · ") || "Transit stop"}</span>
        </span>
      </div>
    </AdvancedMarker>
  );
}

function StopMarkers({ stops, selectedStop, onSelect }) {
  const map = useMap();
  const shouldCluster = stops.length >= CLUSTER_THRESHOLD;
  const [markers, setMarkers] = useState({});
  const clusterer = useMemo(
    () => (map && shouldCluster ? new MarkerClusterer({ map, markers: [] }) : null),
    [map, shouldCluster],
  );

  const setMarkerRef = useCallback((marker, id) => {
    setMarkers((current) => {
      if ((current[id] || null) === marker) return current;
      const next = { ...current };
      if (marker) next[id] = marker;
      else delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!clusterer) return undefined;
    clusterer.clearMarkers(true);
    clusterer.addMarkers(Object.values(markers));
    return undefined;
  }, [clusterer, markers]);

  useEffect(() => {
    if (!clusterer) return undefined;
    return () => {
      clusterer.clearMarkers();
      clusterer.setMap(null);
    };
  }, [clusterer]);

  return stops.map((stop) => (
    <StopMarker
      key={stop.id}
      stop={stop}
      selected={String(stop.id) === String(selectedStop?.id)}
      onSelect={onSelect}
      setMarkerRef={setMarkerRef}
    />
  ));
}

export default function TransitMap({
  location,
  radius,
  stops,
  selectedStop,
  routeDetail,
  activeDirection,
  routeColor,
  onSelectStop,
}) {
  const routeShapes = useMemo(() => {
    const shapes = routeDetail?.shapes || [];
    if (!activeDirection?.shapes?.length) return shapes;
    const shapeIds = new Set(activeDirection.shapes.map(String));
    return shapes.filter((shape) => shapeIds.has(String(shape.id || shape.shapeId)));
  }, [activeDirection, routeDetail]);
  const routePaths = useMemo(
    () => routeShapes.map((shape) => shape.points.map(([lat, lng]) => ({ lat, lng }))),
    [routeShapes],
  );
  const visibleStops = routeDetail && selectedStop ? [selectedStop] : stops;

  return (
    <section className="absolute inset-0" aria-label="Transit map">
      <GoogleMap
        className="h-full w-full"
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={11}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID"}
        reuseMaps
        clickableIcons={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        gestureHandling="greedy"
        zoomControlOptions={{ position: ControlPosition.RIGHT_CENTER }}
        internalUsageAttributionIds={["gmp_git_agentskills_v1"]}
      >
        <MapCamera location={location} radius={radius} selectedStop={selectedStop} routePaths={routePaths} />
        {location && (
          <>
            <AdvancedMarker position={location.position} title={location.formattedAddress} zIndex={100}>
              <div className="destination-map-marker">
                <span className="destination-map-marker__dot" />
                <span className="destination-map-marker__label">Address</span>
              </div>
            </AdvancedMarker>
            <Circle
              center={location.position}
              radius={radius * 1609.344}
              fillColor="#0f766e"
              fillOpacity={0.055}
              strokeColor="#0f766e"
              strokeOpacity={0.48}
              strokeWeight={1.5}
              clickable={false}
            />
          </>
        )}
        <StopMarkers
          key={visibleStops.length >= CLUSTER_THRESHOLD ? "clustered" : "plain"}
          stops={visibleStops}
          selectedStop={selectedStop}
          onSelect={onSelectStop}
        />
        {routePaths.map((path, index) => (
          <Polyline
            key={routeShapes[index]?.id || routeShapes[index]?.shapeId || index}
            path={path}
            strokeColor={routeColor || "#0f766e"}
            strokeOpacity={0.94}
            strokeWeight={6}
            zIndex={30}
            clickable={false}
          />
        ))}
      </GoogleMap>
    </section>
  );
}
