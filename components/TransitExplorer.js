"use client";

import { APILoadingStatus, APIProvider, useApiLoadingStatus, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";
import { createTransitApi } from "../lib/client/transit-api";
import TransitMap from "./transit/TransitMap";
import { modeLabel } from "./transit/TransitUI";
import TransitWorkspace from "./transit/TransitWorkspace";
import { googleErrorMessage, useAddressSearch } from "./transit/useAddressSearch";

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
  stops.forEach((stop) => {
    stop.routes.forEach((route) => {
      routes.set(route.id, route);
    });
  });
  return [...routes.values()];
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === "AbortError";
}

function MapsConnectedExplorer() {
  const loadingStatus = useApiLoadingStatus();
  const placesLibrary = useMapsLibrary("places");
  const mapsReady = loadingStatus === APILoadingStatus.LOADED && Boolean(placesLibrary);
  let mapsError = null;
  if (loadingStatus === APILoadingStatus.AUTH_FAILURE) {
    mapsError = "Google Maps could not authorize this site. Check the configured browser key.";
  } else if (loadingStatus === APILoadingStatus.FAILED) {
    mapsError = "Google Maps could not be loaded. Check your connection and try again.";
  }

  return <TransitController placesLibrary={placesLibrary} mapsReady={mapsReady} mapsError={mapsError} />;
}

export default function TransitExplorer() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <TransitController
        placesLibrary={null}
        mapsReady={false}
        mapsError="Google Maps is not configured. Add the browser API key to load the map."
      />
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["places", "marker"]} language="en" region="US" version="weekly">
      <MapsConnectedExplorer />
    </APIProvider>
  );
}

function TransitController({ placesLibrary, mapsReady, mapsError }) {
  const locationRef = useRef(null);
  const transitApiRef = useRef(null);
  if (!transitApiRef.current) transitApiRef.current = createTransitApi();

  const [radius, setRadius] = useState(0.5);
  const [location, setLocation] = useState(null);
  const [stops, setStops] = useState([]);
  const [selectedStop, setSelectedStop] = useState(null);
  const [stopDetail, setStopDetail] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeDetail, setRouteDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState(null);
  const addressSearch = useAddressSearch({ placesLibrary, mapsReady, location, setError });
  const { query, setQuery, suggestions, suggestionsOpen, setSuggestionsOpen } = addressSearch;

  useEffect(() => () => transitApiRef.current?.dispose(), []);

  function clearRoute() {
    transitApiRef.current.cancel("route");
    setActiveRoute(null);
    setRouteDetail(null);
    setRouteLoading(false);
  }

  async function loadStops(position, nextRadius) {
    transitApiRef.current.cancel("stop");
    setLoading(true);
    setError(null);
    setSelectedStop(null);
    setStopDetail(null);
    clearRoute();

    try {
      const data = await transitApiRef.current.nearby(position, nextRadius);
      setStops(data.stops || []);
      setLoading(false);
    } catch (requestError) {
      if (isAbortError(requestError)) return;
      setStops([]);
      setError("Nearby transit could not be loaded. Please try again.");
      setLoading(false);
    }
  }

  async function commitPlace(place, fallback) {
    if (!place.location) throw new Error("No matching location was found.");
    const position = { lat: place.location.lat(), lng: place.location.lng() };
    const address = splitAddress(place, fallback);
    const nextLocation = { ...address, position, formattedAddress: place.formattedAddress || fallback };
    locationRef.current = nextLocation;
    addressSearch.resetSession();
    setLocation(nextLocation);
    setQuery(address.title);
    await loadStops(position, radius);
  }

  async function chooseSuggestion(suggestion) {
    setLoading(true);
    setError(null);
    try {
      const result = await addressSearch.resolveSuggestion(suggestion);
      await commitPlace(result.place, result.fallback);
    } catch (requestError) {
      setError(googleErrorMessage(requestError, "That address could not be resolved. Please try again."));
      setLoading(false);
    }
  }

  async function searchAddress(event) {
    event.preventDefault();
    if (!query.trim() || !mapsReady) return;
    setLoading(true);
    setError(null);

    try {
      const result = await addressSearch.searchText();
      if (!result.place) throw new Error("No matching location was found.");
      await commitPlace(result.place, result.fallback);
    } catch (requestError) {
      setError(googleErrorMessage(requestError, "Search failed. Check the address and try again."));
      setLoading(false);
    }
  }

  function resetSearch() {
    transitApiRef.current.dispose();
    addressSearch.resetSession();
    locationRef.current = null;
    setLocation(null);
    setStops([]);
    setSelectedStop(null);
    setStopDetail(null);
    setQuery("");
    setLoading(false);
    setStopLoading(false);
    setError(null);
    clearRoute();
  }

  async function changeRadius(nextRadius) {
    setRadius(nextRadius);
    if (locationRef.current) await loadStops(locationRef.current.position, nextRadius);
  }

  async function selectStop(stop) {
    clearRoute();
    setSelectedStop(stop);
    setStopDetail(null);
    setStopLoading(true);
    setError(null);

    try {
      setStopDetail(await transitApiRef.current.stop(stop.id));
      setStopLoading(false);
    } catch (requestError) {
      if (isAbortError(requestError)) return;
      setError("This stop could not be loaded. Please try again.");
      setStopLoading(false);
    }
  }

  function closeStop() {
    transitApiRef.current.cancel("stop");
    clearRoute();
    setSelectedStop(null);
    setStopDetail(null);
    setStopLoading(false);
  }

  async function selectRoute(route, direction = route.directions?.[0]) {
    const key = `${route.id}:${direction?.id ?? ""}:${direction?.headsign || ""}`;
    if (activeRoute?.key === key) {
      clearRoute();
      return;
    }

    setError(null);
    setActiveRoute({ key, route, direction });
    setRouteDetail(null);
    setRouteLoading(true);

    try {
      setRouteDetail(await transitApiRef.current.route(route.id, direction));
      setRouteLoading(false);
    } catch (requestError) {
      if (isAbortError(requestError)) return;
      setActiveRoute(null);
      setError("Route geometry could not be loaded. Please try again.");
      setRouteLoading(false);
    }
  }

  const allRoutes = uniqueRoutes(stops);
  const routeCounts = allRoutes.reduce((counts, route) => {
    const label = modeLabel(route.type);
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});
  const activeDirection =
    routeDetail?.directions?.find(
      (direction) =>
        String(direction.id) === String(activeRoute?.direction?.id) &&
        (!activeRoute.direction.headsign || direction.headsign === activeRoute.direction.headsign),
    ) || routeDetail?.directions?.[0];

  const map = mapsReady ? (
    <TransitMap
      location={location}
      radius={radius}
      stops={stops}
      selectedStop={selectedStop}
      routeDetail={routeDetail}
      activeDirection={activeDirection}
      routeColor={activeRoute?.route.color}
      onSelectStop={selectStop}
    />
  ) : (
    <section
      className="absolute inset-0 flex items-center justify-center bg-slate-200 px-6 text-center text-sm text-slate-600"
      aria-label="Transit map"
    >
      {mapsError || "Loading Google Maps..."}
    </section>
  );

  return (
    <TransitWorkspace
      map={map}
      search={{
        location,
        radius,
        stopCount: stops.length,
        onReset: resetSearch,
        onRadiusChange: changeRadius,
        query,
        setQuery,
        loading,
        mapReady: mapsReady,
        onSubmit: searchAddress,
        suggestions,
        suggestionsOpen,
        setSuggestionsOpen,
        onChoose: chooseSuggestion,
      }}
      summary={{
        stops,
        routeCounts,
        onSelectStop: selectStop,
      }}
      stop={{
        selectedStop,
        stopDetail,
        stopLoading,
        routeLoading,
        activeRoute,
        activeDirection,
        onClose: closeStop,
        onSelectRoute: selectRoute,
        onBackRoute: clearRoute,
      }}
      status={{
        loading: loading || routeLoading,
        loadingMessage: routeLoading ? "Loading published route..." : "Finding nearby transit...",
        error: mapsError || error,
      }}
    />
  );
}
