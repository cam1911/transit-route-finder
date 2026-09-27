"use client";

// These components are intentionally presentational: data and callbacks enter
// through props, while TransitExplorer owns effects, API calls, and map objects.
import { forwardRef } from "react";
import {
  ArrowLeft, ArrowRight, BusFront, ChevronRight, LoaderCircle,
  MapPin, Navigation, Route as RouteIcon, Search, TrainFront, TramFront, X,
} from "lucide-react";

export const RADIUS_OPTIONS = [0.5, 1, 2];

// GTFS allows either a short public label or a longer descriptive route name.
export function routeName(route) {
  return route.shortName || route.longName || route.id;
}

export function ModeIcon({ type, className = "h-4 w-4" }) {
  if (type === "RAIL") return <TrainFront className={className} aria-hidden="true" />;
  if (type === "STREETCAR") return <TramFront className={className} aria-hidden="true" />;
  return <BusFront className={className} aria-hidden="true" />;
}

export function modeLabel(type) {
  if (type === "RAIL") return "Rail";
  if (type === "STREETCAR") return "Streetcar";
  if (type === "BUS") return "Bus";
  return "Transit";
}

function uniqueModes(routes = []) {
  return [...new Set(routes.map((route) => modeLabel(route.type)))];
}

function routeTextColor(backgroundColor) {
  const hex = backgroundColor?.replace("#", "");
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? "#111827" : "#ffffff";
}

export const MapView = forwardRef(function MapView(_props, ref) {
  // forwardRef lets the parent hand this real DOM node to the imperative Maps API.
  return <div ref={ref} id="map" className="absolute inset-0" role="region" aria-label="Transit map" />;
});

// Controlled inputs receive their value and setter from a parent, making the
// parent the single source of truth for the current search.
export function AddressAutocomplete({
  query, setQuery, loading, mapReady, onSubmit, suggestions, suggestionsOpen,
  setSuggestionsOpen, onChoose, location, onReset,
}) {
  return (
    <div className="relative">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-gray-950">Find transit near a Dallas address</h1>
          {!location && <p className="mt-0.5 text-xs text-gray-500">Explore nearby DART stops and published routes.</p>}
        </div>
      </div>
      <form onSubmit={onSubmit} className="relative mt-2.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setSuggestionsOpen(true)}
          placeholder="Search a Dallas address..."
          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-20 text-sm text-gray-950 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-teal-700 focus:bg-white focus:ring-3 focus:ring-teal-700/10"
          aria-label="Search a Dallas address"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestionsOpen && suggestions.length > 0}
          aria-controls={suggestionsOpen && suggestions.length > 0 ? "address-suggestions" : undefined}
          autoComplete="off"
        />
        {location && (
          <button
            type="button"
            onClick={onReset}
            className="absolute right-11 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            aria-label="Clear location"
            title="Clear location"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !mapReady}
          className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md bg-teal-800 text-white transition hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Search"
          title="Search"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
      {suggestionsOpen && suggestions.length > 0 && (
        <div id="address-suggestions" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {suggestions.map((suggestion) => {
            const prediction = suggestion.placePrediction;
            return (
              <button
                key={prediction.placeId}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChoose(suggestion)}
                className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">{prediction.mainText?.text || prediction.text.toString()}</span>
                  <span className="block truncate text-xs text-gray-500">{prediction.secondaryText?.text || ""}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MapControls({ radius, onRadiusChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-gray-500">Search radius</span>
      <div className="flex rounded-lg bg-gray-100 p-0.5" aria-label="Search radius">
        {RADIUS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onRadiusChange(option)}
            className={`min-w-12 rounded-md px-2 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 ${radius === option ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
          >
            {option} mi
          </button>
        ))}
      </div>
    </div>
  );
}

export function SearchPanel({
  location, radius, stopCount, onReset, onRadiusChange, query, setQuery,
  loading, mapReady, onSubmit, suggestions, suggestionsOpen,
  setSuggestionsOpen, onChoose, compact = false,
}) {
  return (
    <div className="shrink-0 bg-white">
      <header className="flex h-14 items-center gap-2.5 border-b border-gray-100 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-800 text-white">
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-teal-800">Dallas Transit Nearby</p>
          <p className="text-[11px] text-gray-500">DART stops and routes</p>
        </div>
      </header>
      <div className="p-4">
        <AddressAutocomplete
          query={query} setQuery={setQuery} loading={loading} mapReady={mapReady}
          onSubmit={onSubmit} suggestions={suggestions} suggestionsOpen={suggestionsOpen}
          setSuggestionsOpen={setSuggestionsOpen} onChoose={onChoose}
          location={location} onReset={onReset}
        />
      </div>
      {location && (
        <div className="address-selection border-t border-gray-100 px-4 py-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-950">{location.title}</p>
              {!compact && <p className="mt-0.5 truncate text-xs text-gray-500">{location.subtitle}</p>}
            </div>
            <span className="shrink-0 rounded-full bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800">
              {stopCount} stop{stopCount === 1 ? "" : "s"}
            </span>
          </div>
          {!compact && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <MapControls radius={radius} onRadiusChange={onRadiusChange} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TransitSummary({ stops, routeCounts, onSelectStop }) {
  const allRouteCount = Object.values(routeCounts).reduce((total, count) => total + count, 0);
  return (
    <section className="transit-summary flex min-h-0 flex-1 flex-col border-t border-gray-200 bg-white" aria-labelledby="nearby-stops-heading">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 id="nearby-stops-heading" className="text-sm font-semibold text-gray-950">Nearby stops</h2>
          <p className="mt-0.5 text-xs text-gray-500">{stops.length} stops · {allRouteCount} unique routes</p>
        </div>
        <Navigation className="h-4 w-4 text-teal-700" aria-hidden="true" />
      </div>
      <div className="min-h-0 overflow-y-auto border-t border-gray-100">
        {stops.length > 0 ? stops.map((stop) => {
          const modes = uniqueModes(stop.routes);
          return (
            <button
              key={stop.id}
              type="button"
              onClick={() => onSelectStop(stop)}
              className="group flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-teal-50/60 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-teal-700"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-teal-800">
                <ModeIcon type={stop.routes[0]?.type} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900 group-hover:text-teal-900">{stop.name}</span>
                <span className="mt-0.5 block truncate text-xs text-gray-500">{modes.join(" / ") || "Transit"} · {stop.routes.length} route{stop.routes.length === 1 ? "" : "s"}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-xs font-medium tabular-nums text-gray-600">{stop.distanceMiles.toFixed(2)} mi</span>
                <ChevronRight className="ml-auto mt-1 h-3.5 w-3.5 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700" aria-hidden="true" />
              </span>
            </button>
          );
        }) : (
          <p className="px-4 py-8 text-center text-sm text-gray-500">No transit stops found in this radius.</p>
        )}
      </div>
    </section>
  );
}

export function RouteTimeline({ stops, routeColor, selectedStopId }) {
  return (
    <ol className="route-timeline">
      {stops.map((stop, index) => (
        <li key={`${stop.shapeId}-${stop.sequence}-${stop.id}`} className="route-timeline__stop">
          <span className="route-timeline__node" style={{ borderColor: routeColor || "#0f766e" }} />
          <span className={`text-sm leading-5 ${stop.id === selectedStopId ? "font-semibold text-gray-950" : "text-gray-600"}`}>{stop.name}</span>
          {index < stops.length - 1 && <span className="route-timeline__line" />}
        </li>
      ))}
    </ol>
  );
}

function RouteBadge({ route, className = "" }) {
  const backgroundColor = route.color || "#0f766e";
  return (
    <span
      className={`inline-flex min-w-10 items-center justify-center rounded-md px-2 py-1 text-xs font-bold ${className}`}
      style={{ backgroundColor, color: routeTextColor(backgroundColor) }}
    >
      {routeName(route)}
    </span>
  );
}

export function TransitRouteRow({ route, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(route)}
      className="group flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-teal-700"
    >
      <RouteBadge route={route} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900">{route.longName || routeName(route)}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
          <ModeIcon type={route.type} className="h-3.5 w-3.5" />{modeLabel(route.type)}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700" aria-hidden="true" />
    </button>
  );
}

function RouteDetail({ activeRoute, activeDirection, selectedStopId, onBack, onSelectRoute }) {
  const route = activeRoute.route;
  return (
    <>
      <div className="border-b border-gray-200 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-semibold text-teal-800 transition hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to stop
        </button>
        <div className="mt-3 flex items-start gap-3">
          <RouteBadge route={route} className="mt-0.5" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{modeLabel(route.type)} route</p>
            <h2 className="mt-0.5 text-lg font-semibold leading-6 text-gray-950">{route.longName || routeName(route)}</h2>
          </div>
        </div>
        {route.directions?.length > 0 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5" aria-label="Route direction">
            {route.directions.map((direction) => {
              const selected = activeRoute.direction?.id === direction.id
                && activeRoute.direction?.headsign === direction.headsign;
              return (
                <button
                  key={`${direction.id}-${direction.headsign}`}
                  type="button"
                  onClick={() => { if (!selected) onSelectRoute(route, direction); }}
                  aria-pressed={selected}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 ${selected ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {direction.headsign || `Direction ${direction.id}`}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-950">Route stops</h3>
          {activeDirection?.stops?.length > 0 && <span className="text-xs text-gray-500">{activeDirection.stops.length} stops</span>}
        </div>
        {activeDirection?.stops?.length ? (
          <RouteTimeline stops={activeDirection.stops} routeColor={route.color} selectedStopId={selectedStopId} />
        ) : (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
            <RouteIcon className="h-4 w-4" aria-hidden="true" /> Published route shown on map
          </div>
        )}
      </div>
    </>
  );
}

export function TransitStopPanel({
  selectedStop, stopDetail, stopLoading, activeRoute, activeDirection,
  onClose, onSelectRoute, onBackRoute,
}) {
  const modes = uniqueModes(selectedStop.routes);
  return (
    <section
      className="stop-panel pointer-events-auto absolute bottom-3 left-3 right-3 flex max-h-[58dvh] min-h-0 flex-col overflow-hidden rounded-xl border border-white/70 bg-white/96 shadow-[0_18px_55px_rgba(20,36,34,0.2)] backdrop-blur-xl md:static md:max-h-none md:flex-1 md:rounded-none md:border-0 md:border-t md:border-gray-200 md:bg-white md:shadow-none"
      aria-label={activeRoute ? "Route details" : "Selected transit stop"}
    >
      {activeRoute ? (
        <RouteDetail
          activeRoute={activeRoute}
          activeDirection={activeDirection}
          selectedStopId={selectedStop.id}
          onBack={onBackRoute}
          onSelectRoute={onSelectRoute}
        />
      ) : (
        <>
          <div className="border-b border-gray-200 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-semibold text-teal-800 transition hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Nearby stops
            </button>
            <h2 className="mt-2 text-lg font-semibold leading-6 text-gray-950">{selectedStop.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><Navigation className="h-3.5 w-3.5" aria-hidden="true" />{selectedStop.distanceMiles.toFixed(2)} mi away</span>
              <span>{modes.join(" / ") || "Transit"}</span>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-950">Routes and services</h3>
              {stopDetail && <span className="text-xs text-gray-500">{stopDetail.routes.length} routes</span>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-100">
              {stopLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading services</div>
              ) : stopDetail?.routes.length ? (
                stopDetail.routes.map((route) => (
                  <TransitRouteRow key={route.id} route={route} onSelect={onSelectRoute} />
                ))
              ) : (
                <p className="px-4 py-8 text-center text-sm text-gray-500">No published routes found for this stop.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
