"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import {
  MapView, SearchPanel, TransitStopPanel, TransitSummary, modeLabel, routeName,
} from "./transit/TransitUI";

const DEFAULT_CENTER = { lat: 32.7767, lng: -96.7970 };

function primaryMode(routes) {
  if (routes.some((route) => route.type === "RAIL")) return "rail";
  if (routes.some((route) => route.type === "STREETCAR")) return "streetcar";
  if (routes.some((route) => route.type === "BUS")) return "bus";
  return "other";
}

function splitAddress(place, fallback) {
  const formatted = place.formattedAddress || fallback;
  const parts = formatted.split(",").map((part) => part.trim());
  const title = place.displayName || parts[0] || fallback;
  return {
    title,
    subtitle: parts.filter((part) => part !== title).join(", ") || formatted,
  };
}

function uniqueRoutes(stops) {
  const routes = new Map();
  stops.forEach((stop) => stop.routes.forEach((route) => routes.set(route.id, route)));
  return [...routes.values()];
}

export default function TransitExplorer() {
  const mapRef = useRef(null);
  const googleRef = useRef(null);
  const mapInstance = useRef(null);
  const destinationMarkerRef = useRef(null);
  const circleRef = useRef(null);
  const routeLinesRef = useRef([]);
  const stopMarkersRef = useRef([]);
  const locationRef = useRef(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [radius, setRadius] = useState(1);
  const [location, setLocation] = useState(null);
  const [stops, setStops] = useState([]);
  const [selectedStop, setSelectedStop] = useState(null);
  const [stopDetail, setStopDetail] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeDetail, setRouteDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function initializeMap() {
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!key) {
        setError("Google Maps is not configured.");
        return;
      }
      try {
        const loader = new Loader({
          apiKey: key,
          version: "weekly",
          libraries: ["places", "marker"],
        });
        const google = await loader.load();
        if (cancelled) return;
        googleRef.current = google;
        mapInstance.current = new google.maps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: 11,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID",
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
        });
        setMapReady(true);
      } catch (error) {
        setError(`Google Maps failed to load: ${error.message}`);
      }
    }
    initializeMap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapReady || query.trim().length < 3 || location?.title === query.trim()) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSuggestion } = await googleRef.current.maps.importLibrary("places");
        const request = { input: query, includedRegionCodes: ["us"], language: "en-US" };
        const center = mapInstance.current?.getCenter();
        if (center) request.locationBias = { center, radius: 50000 };
        const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (!cancelled) {
          setSuggestions(result.suggestions.slice(0, 5));
          setSuggestionsOpen(true);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mapReady, query, location]);

  function clearRoute() {
    routeLinesRef.current.forEach((line) => line.setMap(null));
    routeLinesRef.current = [];
    setActiveRoute(null);
    setRouteDetail(null);
    stopMarkersRef.current.forEach(({ marker, element }) => {
      element.classList.remove("is-route-hidden");
      marker.gmpClickable = true;
    });
  }

  function showOnlySelectedStop() {
    const selectedStopId = String(selectedStop.id);
    stopMarkersRef.current.forEach(({ id, marker, element }) => {
      const isSelectedStop = String(id) === selectedStopId;
      element.classList.toggle("is-route-hidden", !isSelectedStop);
      marker.gmpClickable = isSelectedStop;
    });
  }

  function clearStops() {
    stopMarkersRef.current.forEach(({ marker }) => { marker.map = null; });
    stopMarkersRef.current = [];
  }

  function updateSelectedMarker(stopId) {
    stopMarkersRef.current.forEach(({ id, element }) => {
      element.classList.toggle("is-selected", id === stopId);
    });
  }

  function createDestinationMarker(position, title) {
    if (destinationMarkerRef.current) destinationMarkerRef.current.map = null;
    const element = document.createElement("div");
    element.className = "destination-map-marker";
    const dot = document.createElement("span");
    dot.className = "destination-map-marker__dot";
    const label = document.createElement("span");
    label.className = "destination-map-marker__label";
    label.textContent = "Home";
    element.append(dot, label);
    destinationMarkerRef.current = new googleRef.current.maps.marker.AdvancedMarkerElement({
      map: mapInstance.current,
      position,
      title,
      content: element,
      zIndex: 100,
    });
  }

  function createStopMarkers(stopResults) {
    clearStops();
    stopMarkersRef.current = stopResults.map((stop, index) => {
      const element = document.createElement("div");
      element.className = `transit-stop-marker transit-stop-marker--${primaryMode(stop.routes)}`;
      element.style.animationDelay = `${Math.min(index, 12) * 20}ms`;
      const core = document.createElement("span");
      core.className = "transit-stop-marker__core";
      core.textContent = stop.routes.length > 1 ? String(Math.min(stop.routes.length, 9)) : "";
      const tooltip = document.createElement("span");
      tooltip.className = "transit-stop-tooltip";
      const title = document.createElement("strong");
      title.textContent = stop.name;
      const services = document.createElement("span");
      services.textContent = stop.routes.slice(0, 3).map(routeName).join(" · ") || "Transit stop";
      tooltip.append(title, services);
      element.append(core, tooltip);
      const marker = new googleRef.current.maps.marker.AdvancedMarkerElement({
        map: mapInstance.current,
        position: { lat: stop.latitude, lng: stop.longitude },
        title: stop.name,
        content: element,
        gmpClickable: true,
        zIndex: 20,
      });
      marker.addListener("click", () => selectStop(stop));
      return {
        id: stop.id,
        marker,
        element,
      };
    });
  }

  async function loadStops(position, nextRadius) {
    setLoading(true);
    setError(null);
    setSelectedStop(null);
    setStopDetail(null);
    clearRoute();
    try {
      const response = await fetch(
        `/api/transit/stops/nearby?lat=${position.lat}&lng=${position.lng}&radiusMiles=${nextRadius}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load nearby stops.");
      setStops(data.stops || []);
      createStopMarkers(data.stops || []);
    } catch (error) {
      setStops([]);
      clearStops();
      setError(error.message || "Could not load nearby stops.");
    } finally {
      setLoading(false);
    }
  }

  async function commitPlace(place, fallback, needsFields = false) {
    if (needsFields) {
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "id"] });
    }
    if (!place.location) throw new Error("No matching location was found.");
    const position = { lat: place.location.lat(), lng: place.location.lng() };
    const address = splitAddress(place, fallback);
    const nextLocation = { ...address, position, formattedAddress: place.formattedAddress || fallback };
    locationRef.current = nextLocation;
    setLocation(nextLocation);
    setQuery(address.title);
    setSuggestions([]);
    setSuggestionsOpen(false);
    createDestinationMarker(position, nextLocation.formattedAddress);
    if (circleRef.current) circleRef.current.setMap(null);
    circleRef.current = new googleRef.current.maps.Circle({
      map: mapInstance.current,
      center: position,
      radius: radius * 1609.344,
      fillColor: "#0f766e",
      fillOpacity: 0.055,
      strokeColor: "#0f766e",
      strokeOpacity: 0.48,
      strokeWeight: 1.5,
    });
    const bounds = circleRef.current.getBounds();
    if (bounds) mapInstance.current.fitBounds(bounds, 72);
    await loadStops(position, radius);
  }

  async function chooseSuggestion(suggestion) {
    setLoading(true);
    setError(null);
    try {
      const prediction = suggestion.placePrediction;
      await commitPlace(prediction.toPlace(), prediction.text.toString(), true);
    } catch (error) {
      setError(error.message || "Could not resolve that address.");
      setLoading(false);
    }
  }

  async function searchAddress(event) {
    event.preventDefault();
    if (!query.trim() || !mapReady) return;
    setLoading(true);
    setError(null);
    try {
      const { Place } = await googleRef.current.maps.importLibrary("places");
      const result = await Place.searchByText({
        textQuery: query,
        fields: ["displayName", "formattedAddress", "location", "id"],
        maxResultCount: 1,
      });
      const place = result.places?.[0];
      if (!place) throw new Error("No matching location was found.");
      await commitPlace(place, query);
    } catch (error) {
      setError(error.message || "Search failed.");
      setLoading(false);
    }
  }

  function resetSearch() {
    clearRoute();
    clearStops();
    if (destinationMarkerRef.current) destinationMarkerRef.current.map = null;
    if (circleRef.current) circleRef.current.setMap(null);
    locationRef.current = null;
    setLocation(null);
    setStops([]);
    setSelectedStop(null);
    setStopDetail(null);
    setQuery("");
    setError(null);
    mapInstance.current?.setCenter(DEFAULT_CENTER);
    mapInstance.current?.setZoom(11);
  }

  async function changeRadius(nextRadius) {
    setRadius(nextRadius);
    if (!locationRef.current) return;
    circleRef.current?.setRadius(nextRadius * 1609.344);
    const bounds = circleRef.current?.getBounds();
    if (bounds) mapInstance.current.fitBounds(bounds, 72);
    await loadStops(locationRef.current.position, nextRadius);
  }

  async function selectStop(stop) {
    clearRoute();
    setSelectedStop(stop);
    setStopDetail(null);
    setStopLoading(true);
    setError(null);
    updateSelectedMarker(stop.id);
    const bounds = new googleRef.current.maps.LatLngBounds();
    if (locationRef.current) bounds.extend(locationRef.current.position);
    bounds.extend({ lat: stop.latitude, lng: stop.longitude });
    mapInstance.current.fitBounds(bounds, 150);
    try {
      const response = await fetch(`/api/transit/stops/${encodeURIComponent(stop.id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load this stop.");
      setStopDetail(data);
    } catch (error) {
      setError(error.message || "Could not load this stop.");
    } finally {
      setStopLoading(false);
    }
  }

  function closeStop() {
    clearRoute();
    setSelectedStop(null);
    setStopDetail(null);
    updateSelectedMarker(null);
    const bounds = circleRef.current?.getBounds();
    if (bounds) mapInstance.current.fitBounds(bounds, 72);
  }

  async function selectRoute(route, direction = route.directions?.[0]) {
    const key = `${route.id}:${direction?.id || ""}:${direction?.headsign || ""}`;
    if (activeRoute?.key === key) {
      clearRoute();
      return;
    }
    clearRoute();
    setError(null);
    setActiveRoute({ key, route, direction });
    showOnlySelectedStop();
    try {
      const response = await fetch(`/api/transit/routes/${encodeURIComponent(route.id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load route geometry.");
      setRouteDetail(data);
      for (const shape of data.shapes || []) {
        routeLinesRef.current.push(new googleRef.current.maps.Polyline({
          map: mapInstance.current,
          path: shape.points.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: route.color || "#0f766e",
          strokeOpacity: 0.94,
          strokeWeight: 6,
          zIndex: 30,
        }));
      }
      const bounds = new googleRef.current.maps.LatLngBounds();
      if (locationRef.current) bounds.extend(locationRef.current.position);
      (data.shapes || []).forEach((shape) => shape.points.forEach(([lat, lng]) => bounds.extend({ lat, lng })));
      if (!bounds.isEmpty()) mapInstance.current.fitBounds(bounds, 72);
    } catch (error) {
      setError(error.message || "Could not load route geometry.");
    }
  }

  const allRoutes = uniqueRoutes(stops);
  const routeCounts = allRoutes.reduce((counts, route) => {
    const label = modeLabel(route.type);
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});
  const activeDirection = routeDetail?.directions?.find((direction) =>
    direction.id === activeRoute?.direction?.id
    && (!activeRoute.direction.headsign || direction.headsign === activeRoute.direction.headsign),
  ) || routeDetail?.directions?.[0];

  return (
    <main className="relative h-[100dvh] min-h-[620px] w-full overflow-hidden bg-[#dce3e2]">
      <MapView ref={mapRef} />

      <section className="absolute left-3 right-3 top-3 z-20 sm:left-5 sm:right-auto sm:top-5 sm:w-[390px]">
        <SearchPanel
          location={location} radius={radius} stopCount={stops.length}
          compact={Boolean(selectedStop)}
          onReset={resetSearch} onRadiusChange={changeRadius}
          query={query} setQuery={setQuery} loading={loading} mapReady={mapReady}
          onSubmit={searchAddress} suggestions={suggestions} suggestionsOpen={suggestionsOpen}
          setSuggestionsOpen={setSuggestionsOpen} onChoose={chooseSuggestion}
        />

        {location && !selectedStop && (
          <TransitSummary stops={stops} routeCounts={routeCounts} onSelectStop={selectStop} />
        )}
      </section>

      {selectedStop && (
        <TransitStopPanel
          selectedStop={selectedStop} stopDetail={stopDetail} stopLoading={stopLoading}
          activeRoute={activeRoute} activeDirection={activeDirection}
          onClose={closeStop} onSelectRoute={selectRoute}
        />
      )}

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2" aria-live="polite">
        {(loading || error) && (
          <div className="rounded-full border border-white/70 bg-white/90 px-4 py-2 text-xs font-medium text-gray-600 shadow-lg backdrop-blur-xl">{loading ? "Finding nearby transit..." : error}</div>
        )}
      </div>
    </main>
  );
}