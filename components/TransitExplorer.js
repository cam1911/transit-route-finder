/*
 * BEGINNER READING KEY
 * --------------------
 * This file combines modern JavaScript, React, Next.js, and Google Maps. The
 * recurring syntax is:
 *
 * - `const value = ...` creates a variable that cannot be reassigned. Objects
 *   stored in it can still be changed.
 * - `const fn = (item) => ...` is an arrow function, a shorter function syntax.
 * - `{ value }` is destructuring: it extracts a named property from an object.
 * - `[value, setValue]` is array destructuring, used by React's useState hook.
 * - `...object` copies/spreads an object's properties into another object.
 * - `value?.property` is optional chaining; it returns undefined instead of
 *   throwing when value is null or undefined.
 * - `value || fallback` picks the fallback when value is "falsy".
 * - `` `text ${value}` `` is a template literal with an embedded expression.
 * - `async` functions return Promises; `await` pauses that function until a
 *   Promise settles without blocking the browser's entire JavaScript thread.
 * - JSX is the HTML-like syntax returned near the bottom of this component.
 *
 * Read docs/LEARNING_ROADMAP.md before studying this file line by line.
 */

// Next.js treats components as Server Components by default. This directive
// creates a client boundary because this component needs hooks, `window`,
// browser DOM APIs, and the Google Maps JavaScript SDK.
"use client";

// Loader is a class exported by Google's npm package. It downloads the actual
// Maps SDK in the browser only when this component initializes.
import { Loader } from "@googlemaps/js-api-loader";
// This is the feature's "controller" component. It owns browser-only Google
// Maps objects, React state, API calls, and coordination between presentational
// components in TransitUI.js.
// Named imports use braces; the package decides which names it exports.
import { useEffect, useRef, useState } from "react";
// These are project modules. Keeping display components in another file makes
// this controller easier to reason about and those components easier to reuse.
import { modeLabel, routeName } from "./transit/TransitUI";
import TransitWorkspace from "./transit/TransitWorkspace";

// Constants outside the component are created once when this module loads,
// rather than being recreated after every React render.
const DEFAULT_CENTER = { lat: 32.7767, lng: -96.797 };

// Prefer the highest-capacity transit mode when choosing a marker's visual style.
function primaryMode(routes) {
  // `some` returns true as soon as one array item passes its callback test.
  // The callback parameter `route` represents the current array item.
  if (routes.some((route) => route.type === "RAIL")) return "rail";
  if (routes.some((route) => route.type === "STREETCAR")) return "streetcar";
  if (routes.some((route) => route.type === "BUS")) return "bus";
  return "other";
}

function splitAddress(place, fallback) {
  // Places returns several address representations. Normalize them once so the
  // rest of the UI can rely on a short title plus a descriptive subtitle.
  const formatted = place.formattedAddress || fallback;
  // `split` creates an array; `map` creates a new array by transforming each item.
  const parts = formatted.split(",").map((part) => part.trim());
  const title = place.displayName || parts[0] || fallback;
  return {
    // This shorthand is equivalent to `title: title`.
    title,
    // `filter` keeps matching items and `join` combines them into one string.
    subtitle: parts.filter((part) => part !== title).join(", ") || formatted,
  };
}

function uniqueRoutes(stops) {
  // A Map keyed by route ID removes duplicates while preserving insertion order.
  const routes = new Map();
  stops.forEach((stop) => {
    stop.routes.forEach((route) => {
      routes.set(route.id, route);
    });
  });
  // Spread syntax (`...`) turns the Map iterator into a normal array.
  return [...routes.values()];
}

function drawRouteShapes({ google, map, location, routeLines, shapes, color }) {
  // Keep Google Maps geometry creation outside the React controller's workflow.
  for (const shape of shapes) {
    routeLines.push(
      new google.maps.Polyline({
        map,
        path: shape.points.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: color || "#0f766e",
        strokeOpacity: 0.94,
        strokeWeight: 6,
        zIndex: 30,
      }),
    );
  }

  const bounds = new google.maps.LatLngBounds();
  if (location) bounds.extend(location.position);
  for (const shape of shapes) {
    for (const [lat, lng] of shape.points) bounds.extend({ lat, lng });
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds, 72);
}

export default function TransitExplorer() {
  // A React function component is called again on every render. Hooks let React
  // preserve values between those calls. Hooks must always be called in the
  // same order, which is why they stay at the top level instead of inside `if`.
  //
  // There are two kinds of long-lived values here:
  // 1. Refs for imperative Google/DOM objects. Changing `.current` does NOT render.
  // 2. State for information shown by JSX. Its setter schedules a new render.
  // Refs hold mutable third-party objects that should survive renders without
  // causing renders when they change. State below holds values that affect JSX.
  // mapRef is also passed to <MapView ref={mapRef}> so React writes its DOM node
  // into mapRef.current after mounting.
  const mapRef = useRef(null);
  const googleRef = useRef(null);
  const mapInstance = useRef(null);
  const destinationMarkerRef = useRef(null);
  const circleRef = useRef(null);
  const routeLinesRef = useRef([]);
  const stopMarkersRef = useRef([]);
  // locationRef mirrors location state because async callbacks sometimes need
  // the latest location immediately without waiting for React's next render.
  const locationRef = useRef(null);

  // `useState(initialValue)` returns the current value and its update function.
  // Each pair below models one independent part of the screen's state.
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [radius, setRadius] = useState(0.5);
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

  // An empty dependency array means this effect initializes Google Maps once
  // after the component mounts. Cleanup prevents late async work after unmount.
  useEffect(() => {
    // Variables declared inside an effect are captured by its callbacks. This is
    // a closure: initializeMap and the cleanup function both share `cancelled`.
    let cancelled = false;
    async function initializeMap() {
      // Next.js replaces NEXT_PUBLIC_ environment values in browser JavaScript
      // at build time. Never use this prefix for database passwords or secrets.
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
        // `await` resumes in a later microtask after the SDK Promise resolves.
        const google = await loader.load();
        // The component may have unmounted while loading. Do not touch stale DOM.
        if (cancelled) return;
        googleRef.current = google;
        // The map is imperative: Google draws into the DOM node referenced by mapRef.
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
        // Errors thrown by `await` flow into catch like synchronous exceptions.
        setError(`Google Maps failed to load: ${error.message}`);
      }
    }
    initializeMap();
    // An effect may return a cleanup function. React calls it during unmount or
    // before rerunning the effect.
    return () => {
      cancelled = true;
      routeLinesRef.current.forEach((line) => {
        line.setMap(null);
      });
      stopMarkersRef.current.forEach(({ marker, clickListener }) => {
        clickListener.remove();
        marker.map = null;
      });
      if (destinationMarkerRef.current) destinationMarkerRef.current.map = null;
      if (circleRef.current) circleRef.current.setMap(null);
      mapInstance.current = null;
      googleRef.current = null;
    };
  }, []);

  // Debounce autocomplete so typing does not make a network request per keystroke.
  // React reruns the cleanup whenever query/location changes.
  useEffect(() => {
    // `?.` safely reads title when location might still be null.
    if (!mapReady || query.trim().length < 3 || location?.title === query.trim()) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    // setTimeout implements a debounce: only the last keystroke that survives
    // 220 ms of inactivity reaches the Places API.
    const timer = window.setTimeout(async () => {
      try {
        // Object destructuring extracts one export from the dynamically loaded library.
        const { AutocompleteSuggestion } = await googleRef.current.maps.importLibrary("places");
        const request = { input: query, includedRegionCodes: ["us"], language: "en-US" };
        const center = mapInstance.current?.getCenter();
        // Bias means "prefer nearby results"; it is not a hard geographic filter.
        if (center) request.locationBias = { center, radius: 50000 };
        const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (!cancelled) {
          // `slice` returns a new array containing at most the first five items.
          setSuggestions(result.suggestions.slice(0, 5));
          setSuggestionsOpen(true);
        }
      } catch {
        // Autocomplete is optional assistance, so a failure clears suggestions.
        // Submitted searches still report errors through searchAddress below.
        if (!cancelled) setSuggestions([]);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // This dependency array tells React which values should restart the debounce.
  }, [mapReady, query, location]);

  // Imperative Google Maps overlays live outside React's DOM tree, so each
  // explicit cleanup removes them from the map and synchronizes React state.
  function clearRoute() {
    // Array.forEach performs a side effect for each item and returns nothing.
    routeLinesRef.current.forEach((line) => {
      line.setMap(null);
    });
    routeLinesRef.current = [];
    setActiveRoute(null);
    setRouteDetail(null);
    // The callback parameter destructures marker and element from each stored object.
    stopMarkersRef.current.forEach(({ marker, element }) => {
      element.classList.remove("is-route-hidden");
      marker.gmpClickable = true;
    });
  }

  function showOnlySelectedStop() {
    // String conversion makes numeric and string IDs compare consistently.
    const selectedStopId = String(selectedStop.id);
    stopMarkersRef.current.forEach(({ id, marker, element }) => {
      const isSelectedStop = String(id) === selectedStopId;
      // The second toggle argument explicitly adds true classes and removes false ones.
      element.classList.toggle("is-route-hidden", !isSelectedStop);
      marker.gmpClickable = isSelectedStop;
    });
  }

  function clearStops() {
    stopMarkersRef.current.forEach(({ marker, clickListener }) => {
      clickListener.remove();
      marker.map = null;
    });
    stopMarkersRef.current = [];
  }

  function updateSelectedMarker(stopId) {
    stopMarkersRef.current.forEach(({ id, element }) => {
      element.classList.toggle("is-selected", id === stopId);
    });
  }

  function createDestinationMarker(position, title) {
    if (destinationMarkerRef.current) destinationMarkerRef.current.map = null;
    // AdvancedMarkerElement accepts custom DOM, which enables the CSS marker design.
    const element = document.createElement("div");
    element.className = "destination-map-marker";
    const dot = document.createElement("span");
    dot.className = "destination-map-marker__dot";
    const label = document.createElement("span");
    label.className = "destination-map-marker__label";
    label.textContent = "Address";
    // This DOM is created manually because Google owns the marker container;
    // React only owns the panels rendered in the JSX below.
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
    // `map` transforms each API stop into a stored {id, marker, element} object.
    stopMarkersRef.current = stopResults.map((stop, index) => {
      const element = document.createElement("div");
      // A template literal combines the base CSS class with a mode modifier.
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
      // Functions are values in JavaScript, so routeName can be passed directly to map.
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
      // Bridge Google's event system back into the React interaction flow.
      const clickListener = marker.addListener("click", () => selectStop(stop));
      return {
        id: stop.id,
        marker,
        element,
        clickListener,
      };
    });
  }

  async function loadStops(position, nextRadius) {
    // Fetch through this app's API instead of exposing database credentials or
    // coupling the browser to the selected storage backend.
    // Several setters are intentionally grouped before the request so the old
    // selection disappears immediately and the loading UI appears together.
    setLoading(true);
    setError(null);
    setSelectedStop(null);
    setStopDetail(null);
    clearRoute();
    try {
      // fetch returns a Response Promise. This relative URL calls our own Next.js
      // server on the same origin, so no API hostname is hard-coded.
      const response = await fetch(
        `/api/transit/stops/nearby?lat=${position.lat}&lng=${position.lng}&radiusMiles=${nextRadius}`,
      );
      // Parsing the response body is a second asynchronous operation.
      const data = await response.json();
      // fetch only rejects on network failure; 4xx/5xx responses must be checked.
      if (!response.ok) throw new Error(data.error || "Could not load nearby stops.");
      setStops(data.stops || []);
      createStopMarkers(data.stops || []);
    } catch (error) {
      setStops([]);
      clearStops();
      setError(error.message || "Could not load nearby stops.");
    } finally {
      // finally runs after success or failure, making it the reliable place to
      // turn off loading state.
      setLoading(false);
    }
  }

  async function commitPlace(place, fallback, needsFields = false) {
    // Autocomplete predictions are lightweight; fetchFields upgrades one to a
    // complete Place before reading its coordinates.
    if (needsFields) {
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "id"] });
    }
    if (!place.location) throw new Error("No matching location was found.");
    // Google exposes coordinates through methods; this app converts them to a
    // plain serializable object used by React and API query strings.
    const position = { lat: place.location.lat(), lng: place.location.lng() };
    const address = splitAddress(place, fallback);
    // Spread copies title/subtitle, then adds the other properties.
    const nextLocation = { ...address, position, formattedAddress: place.formattedAddress || fallback };
    // Update the ref for immediate imperative use and state for the next render.
    locationRef.current = nextLocation;
    setLocation(nextLocation);
    setQuery(address.title);
    setSuggestions([]);
    setSuggestionsOpen(false);
    createDestinationMarker(position, nextLocation.formattedAddress);
    if (circleRef.current) circleRef.current.setMap(null);
    // Google expects meters, while the product presents familiar miles.
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
      // Suggestions are predictions, not full Place records. commitPlace fetches
      // only the fields this app uses, which limits unnecessary API data.
      const prediction = suggestion.placePrediction;
      await commitPlace(prediction.toPlace(), prediction.text.toString(), true);
    } catch (error) {
      setError(error.message || "Could not resolve that address.");
      setLoading(false);
    }
  }

  async function searchAddress(event) {
    // React passes a SyntheticEvent to form handlers. Preventing the browser's
    // default form submission keeps this single-page experience from reloading.
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
      // Optional chaining handles an absent places array; [0] chooses best match.
      const place = result.places?.[0];
      if (!place) throw new Error("No matching location was found.");
      await commitPlace(place, query);
    } catch (error) {
      setError(error.message || "Search failed.");
      setLoading(false);
    }
  }

  function resetSearch() {
    // Reset both worlds: Google overlays are imperative objects, while panels
    // and messages are driven by React state.
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
    // Optional method calls do nothing safely if the map has not initialized.
    mapInstance.current?.setCenter(DEFAULT_CENTER);
    mapInstance.current?.setZoom(11);
  }

  async function changeRadius(nextRadius) {
    // Keep the circle, viewport, and server query synchronized to one radius.
    setRadius(nextRadius);
    if (!locationRef.current) return;
    circleRef.current?.setRadius(nextRadius * 1609.344);
    const bounds = circleRef.current?.getBounds();
    if (bounds) mapInstance.current.fitBounds(bounds, 72);
    await loadStops(locationRef.current.position, nextRadius);
  }

  async function selectStop(stop) {
    // Stop details are loaded on demand because the nearby result only contains
    // summary data needed to draw markers and the nearest-stop card.
    clearRoute();
    setSelectedStop(stop);
    setStopDetail(null);
    setStopLoading(true);
    setError(null);
    updateSelectedMarker(stop.id);
    // LatLngBounds grows as points are added, then fitBounds chooses a zoom and
    // center that keeps all of them visible.
    const bounds = new googleRef.current.maps.LatLngBounds();
    if (locationRef.current) bounds.extend(locationRef.current.position);
    bounds.extend({ lat: stop.latitude, lng: stop.longitude });
    mapInstance.current.fitBounds(bounds, 150);
    try {
      // IDs become URL path segments, so encodeURIComponent escapes reserved characters.
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
    // Closing details does not discard the searched address or nearby stops.
    clearRoute();
    setSelectedStop(null);
    setStopDetail(null);
    updateSelectedMarker(null);
    const bounds = circleRef.current?.getBounds();
    if (bounds) mapInstance.current.fitBounds(bounds, 72);
  }

  function closeRoute() {
    // Returning from route focus restores the same destination-to-stop framing
    // the user saw before opening the route.
    clearRoute();
    const bounds = new googleRef.current.maps.LatLngBounds();
    if (locationRef.current) bounds.extend(locationRef.current.position);
    if (selectedStop) bounds.extend({ lat: selectedStop.latitude, lng: selectedStop.longitude });
    if (!bounds.isEmpty()) mapInstance.current.fitBounds(bounds, 150);
  }

  async function selectRoute(route, direction = route.directions?.[0]) {
    // Route + direction + headsign form the UI selection identity. Clicking the
    // same selection again acts as a toggle and clears its overlays.
    // A default parameter selects the first direction when the caller omits one.
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
      // One published route can contain multiple GTFS shapes/variants.
      drawRouteShapes({
        google: googleRef.current,
        map: mapInstance.current,
        location: locationRef.current,
        routeLines: routeLinesRef.current,
        shapes: data.shapes || [],
        color: route.color,
      });
    } catch (error) {
      setError(error.message || "Could not load route geometry.");
    }
  }

  // These values are derived during render rather than duplicated in state,
  // preventing route counts and active-direction details from becoming stale.
  const allRoutes = uniqueRoutes(stops);
  const routeCounts = allRoutes.reduce((counts, route) => {
    // `reduce` folds many routes into one object such as { Bus: 4, Rail: 2 }.
    const label = modeLabel(route.type);
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});
  // `find` returns the first matching item. The final `||` provides a fallback.
  const activeDirection =
    routeDetail?.directions?.find(
      (direction) =>
        direction.id === activeRoute?.direction?.id &&
        (!activeRoute.direction.headsign || direction.headsign === activeRoute.direction.headsign),
    ) || routeDetail?.directions?.[0];

  return (
    <TransitWorkspace
      mapRef={mapRef}
      search={{
        location,
        radius,
        stopCount: stops.length,
        onReset: resetSearch,
        onRadiusChange: changeRadius,
        query,
        setQuery,
        loading,
        mapReady,
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
        activeRoute,
        activeDirection,
        onClose: closeStop,
        onSelectRoute: selectRoute,
        onBackRoute: closeRoute,
      }}
      status={{
        loading,
        error,
      }}
    />
  );
}
