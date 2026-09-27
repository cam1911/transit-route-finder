"use client";

// These components are intentionally presentational: data and callbacks enter
// through props, while TransitExplorer owns effects, API calls, and map objects.
import { forwardRef } from "react";
import {
  ArrowRight, BusFront, ChevronDown, ChevronUp, CircleDot, Home,
  LoaderCircle, LocateFixed, MapPin, Navigation, Route as RouteIcon,
  Search, TrainFront, TramFront, X,
} from "lucide-react";

export const RADIUS_OPTIONS = [0.5, 1, 2];

// GTFS allows either a short public label or a longer descriptive route name.
export function routeName(route) {
  return route.shortName || route.longName || route.id;
}

export function ModeIcon({ type, className = "h-4 w-4" }) {
  // Centralizing this mapping keeps every card/summary visually consistent.
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

export const MapView = forwardRef(function MapView(_props, ref) {
  // forwardRef lets the parent hand this real DOM node to the imperative Maps API.
  return <div ref={ref} id="map" className="absolute inset-0" aria-label="Transit map" />;
});

// Controlled inputs receive their value and setter from a parent, making the
// parent the single source of truth for the current search.
export function AddressAutocomplete({
  query, setQuery, loading, mapReady, onSubmit, suggestions, suggestionsOpen,
  setSuggestionsOpen, onChoose,
}) {
  return (
    <>
      <h1 className="text-xl font-semibold text-gray-950">Find an apartment or address</h1>
      <p className="mt-1 text-sm leading-5 text-gray-500">See the transit network around a place you may call home.</p>
      <form onSubmit={onSubmit} className="relative mt-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setSuggestionsOpen(true)}
          placeholder="Search an address..."
          className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-12 text-[15px] text-gray-950 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-teal-700 focus:bg-white focus:ring-4 focus:ring-teal-700/10"
          aria-label="Search an address"
          aria-expanded={suggestionsOpen && suggestions.length > 0}
          autoComplete="off"
        />
        <button type="submit" disabled={loading || !mapReady} className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-white transition hover:bg-teal-900 disabled:opacity-50" aria-label="Search" title="Search">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
      {/* Render suggestions only when there is useful content, not an empty shell. */}
      {suggestionsOpen && suggestions.length > 0 && (
        <div className="-mx-5 mt-4 border-t border-gray-100 bg-white px-2 pb-2 pt-2">
          {suggestions.map((suggestion) => {
            const prediction = suggestion.placePrediction;
            return (
              <button key={prediction.placeId} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onChoose(suggestion)} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">{prediction.mainText?.text || prediction.text.toString()}</span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">{prediction.secondaryText?.text || ""}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

export function MapControls({ radius, onRadiusChange }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:px-5">
      <span className="text-xs font-medium text-gray-500">Search radius</span>
      <div className="flex rounded-lg bg-gray-100 p-0.5" aria-label="Search radius">
        {/* Mapping data to buttons makes adding another supported radius trivial. */}
        {RADIUS_OPTIONS.map((option) => (
          <button key={option} type="button" onClick={() => onRadiusChange(option)} className={`min-w-12 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${radius === option ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
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
    <div className={`search-panel overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-[0_18px_60px_rgba(25,42,40,0.16)] backdrop-blur-xl ${location ? "has-location" : ""}`}>
      <div className="p-4 sm:p-5">
        <div className={`mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800 ${compact && location ? "max-sm:hidden" : ""}`}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-800 text-white"><Home className="h-3.5 w-3.5" aria-hidden="true" /></span>
          Transit Home Finder
        </div>
        {/* The panel changes from search mode to selected-address mode. */}
        {location ? (
          <div className="address-selection flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-gray-950">{location.title}</p>
              <p className="mt-0.5 truncate text-sm text-gray-500">{location.subtitle}</p>
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-800">{radius} mile{radius === 1 ? "" : "s"}</span>
                <span>{stopCount} transit stops</span>
              </div>
            </div>
            <button type="button" onClick={onReset} className="icon-button" aria-label="Change location" title="Change location"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <AddressAutocomplete
            query={query} setQuery={setQuery} loading={loading} mapReady={mapReady}
            onSubmit={onSubmit} suggestions={suggestions} suggestionsOpen={suggestionsOpen}
            setSuggestionsOpen={setSuggestionsOpen} onChoose={onChoose}
          />
        )}
      </div>
      {location && (
        <div className={compact ? "max-sm:hidden" : ""}>
          <MapControls radius={radius} onRadiusChange={onRadiusChange} />
        </div>
      )}
    </div>
  );
}

export function TransitSummary({ stops, routeCounts, onSelectStop }) {
  // routeCounts is grouped by transport mode; reduce produces one headline total.
  const allRouteCount = Object.values(routeCounts).reduce((total, count) => total + count, 0);
  return (
    <div className="transit-summary mt-3 rounded-2xl border border-white/70 bg-white/92 p-4 shadow-[0_12px_40px_rgba(25,42,40,0.12)] backdrop-blur-xl sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Transit nearby</p>
          <p className="mt-1 text-2xl font-semibold text-gray-950">{stops.length} <span className="text-base font-normal text-gray-500">stops</span></p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><LocateFixed className="h-5 w-5" /></span>
      </div>
      {stops[0] && (
        <button type="button" onClick={() => onSelectStop(stops[0])} className="group mt-4 flex w-full items-center justify-between gap-3 border-t border-gray-100 pt-3 text-left">
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">Closest stop</span>
            <span className="mt-1 block truncate text-sm font-semibold text-gray-900 group-hover:text-teal-800">{stops[0].name}</span>
          </span>
          <span className="shrink-0 text-sm font-medium text-gray-500">{stops[0].distanceMiles.toFixed(2)} mi</span>
        </button>
      )}
      {allRouteCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-3">
          {Object.entries(routeCounts).map(([mode, count]) => (
            <span key={mode} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <ModeIcon type={mode.toUpperCase()} className="h-3.5 w-3.5 text-gray-400" />{count} {mode.toLowerCase()}{count === 1 ? " route" : " routes"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function RouteTimeline({ stops, routeColor, selectedStopId }) {
  // Semantic <ol>/<li> markup reflects that GTFS stop_sequence is ordered.
  return (
    <ol className="route-timeline max-h-60 overflow-y-auto pr-1">
      {stops.map((stop, index) => (
        <li key={`${stop.shapeId}-${stop.sequence}-${stop.id}`} className="route-timeline__stop">
          <span className="route-timeline__node" style={{ borderColor: routeColor || "#0f766e" }} />
          <span className={`text-xs ${stop.id === selectedStopId ? "font-bold text-gray-950" : "text-gray-600"}`}>{stop.name}</span>
          {index < stops.length - 1 && <span className="route-timeline__line" />}
        </li>
      ))}
    </ol>
  );
}

export function TransitRouteCard({ route, expanded, activeRoute, activeDirection, selectedStopId, onSelect }) {
  return (
    <section className={`route-card overflow-hidden rounded-xl border transition ${expanded ? "is-expanded border-gray-300 bg-gray-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
      <button type="button" onClick={() => onSelect(route)} className="flex w-full items-center gap-3 p-3.5 text-left">
        <span className="flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-bold text-white" style={{ backgroundColor: route.color || "#0f766e" }}>{routeName(route)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><ModeIcon type={route.type} className="h-3.5 w-3.5" /> {modeLabel(route.type)}</span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-gray-900">{route.longName || routeName(route)}</span>
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {/* Only the active route mounts its direction controls and stop timeline. */}
      {expanded && (
        <div className="route-card__details border-t border-gray-200 px-3.5 pb-4 pt-3">
          {route.directions?.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {route.directions.map((direction) => (
                <button key={`${direction.id}-${direction.headsign}`} type="button" onClick={() => onSelect(route, direction)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${activeRoute?.direction?.id === direction.id && activeRoute?.direction?.headsign === direction.headsign ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
                  {direction.headsign || `Direction ${direction.id}`}
                </button>
              ))}
            </div>
          )}
          {activeDirection?.stops?.length ? (
            <RouteTimeline stops={activeDirection.stops} routeColor={route.color} selectedStopId={selectedStopId} />
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-500"><RouteIcon className="h-3.5 w-3.5" /> Published route shown on map</div>
          )}
        </div>
      )}
    </section>
  );
}

export function TransitStopPanel({ selectedStop, stopDetail, stopLoading, activeRoute, activeDirection, onClose, onSelectRoute }) {
  // On small screens this is a bottom sheet; responsive Tailwind classes move it
  // to a right-side panel at the `sm` breakpoint.
  return (
    <aside className="stop-panel absolute bottom-3 left-3 right-3 z-30 max-h-[56dvh] overflow-y-auto rounded-2xl border border-white/70 bg-white/96 shadow-[0_22px_70px_rgba(20,36,34,0.22)] backdrop-blur-xl sm:bottom-5 sm:left-auto sm:right-5 sm:max-h-[calc(100dvh-40px)] sm:w-[400px]">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white/95 p-4 backdrop-blur-xl sm:p-5">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-teal-800"><CircleDot className="h-3.5 w-3.5" /> Transit stop</div>
          <h2 className="text-xl font-semibold leading-tight text-gray-950">{selectedStop.name}</h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500"><Navigation className="h-3.5 w-3.5" />{selectedStop.distanceMiles.toFixed(2)} mi from destination</p>
        </div>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Close stop details" title="Close"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-950">Routes and services</h3>
          {stopDetail && <span className="text-xs text-gray-400">{stopDetail.routes.length} routes</span>}
        </div>
        {stopLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading services</div>
        ) : (
          <div className="space-y-2">
            {stopDetail?.routes.map((route) => (
              <TransitRouteCard
                key={route.id} route={route} expanded={activeRoute?.route.id === route.id}
                activeRoute={activeRoute} activeDirection={activeDirection}
                selectedStopId={selectedStop.id} onSelect={onSelectRoute}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}