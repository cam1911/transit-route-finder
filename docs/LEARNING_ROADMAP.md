# Transit Home Finder Learning Roadmap

This guide assumes you remember some JavaScript but are new to modern JavaScript,
React, Next.js, Tailwind CSS, HTTP APIs, Supabase, PostgreSQL/PostGIS, Google
Maps, and GTFS.

The goal is not to memorize the whole ecosystem. It is to learn enough to trace
one user action through every layer and explain why each layer exists.

## The thirty-second explanation

Transit Home Finder is a full-stack Next.js application. A React client
component lets the user search for an address with Google Places and displays
results on Google Maps. The browser calls Next.js API routes, which validate the
request and ask a shared GTFS data layer for nearby stops, stop details, or route
geometry. That data layer can use a bundled JSON snapshot for easy local
development or PostgreSQL/PostGIS for scalable geographic searches. Separate
import scripts download and normalize public DART GTFS data. Supabase utilities
maintain a server-compatible authentication session, although the current
transit search itself does not require user-specific data.

## The mental model

```text
USER
  │ types an address
  ▼
REACT CLIENT COMPONENT
  │ asks Google Places for coordinates
  │ calls fetch("/api/...")
  ▼
NEXT.JS ROUTE HANDLER
  │ validates untrusted URL values
  │ calls a normal JavaScript function
  ▼
GTFS DATA-ACCESS MODULE
  │ chooses JSON or PostgreSQL/PostGIS
  ▼
DATA
  │ returns plain JavaScript objects / JSON
  ▼
REACT + GOOGLE MAPS
  │ update panels, markers, circles, and lines
  ▼
USER SEES NEARBY TRANSIT
```

The key architectural idea is **separation of concerns**:

- React handles interactive screen state.
- Google Maps handles map rendering and geocoding-related services.
- Route Handlers handle HTTP.
- The GTFS module handles data retrieval and shaping.
- PostgreSQL/PostGIS handles indexed geographic work.
- Import scripts handle slow, offline data preparation.

## Phase 1: Refresh modern JavaScript

### Learn

1. `const` and `let`; avoid `var` in new code.
2. Objects and arrays.
3. Function declarations and arrow functions.
4. ES modules: `import` and `export`.
5. Destructuring: `{ name }` and `[first, second]`.
6. Spread syntax: `{ ...oldObject, newValue }`.
7. Template literals: `` `/stops/${id}` ``.
8. Optional chaining: `location?.title`.
9. Array methods: `map`, `filter`, `find`, `some`, `forEach`, and `reduce`.
10. Promises, `async`/`await`, `try`/`catch`/`finally`.
11. Closures and why callbacks can remember surrounding variables.

### Find it in the app

- `primaryMode` demonstrates `some`.
- `splitAddress` demonstrates `split`, `map`, `filter`, and object shorthand.
- `uniqueRoutes` demonstrates `Map`, nested callbacks, and spread syntax.
- `loadStops` demonstrates `fetch`, `await`, error handling, and `finally`.
- `routeCounts` demonstrates `reduce`.
- `activeDirection` demonstrates optional chaining and `find`.

### You are ready to continue when

You can explain this without running it:

```js
const names = routes
  .filter((route) => route.type === "RAIL")
  .map((route) => route.shortName || route.longName);
```

## Phase 2: Understand browser and HTTP fundamentals

### Learn

1. The browser, DOM, events, and form submission.
2. URLs: path, query string, and encoded path segments.
3. HTTP request methods and status codes.
4. JSON serialization.
5. The Fetch API and the fact that HTTP 404/500 responses do not automatically
   reject a `fetch` Promise.
6. Client-side versus server-side code.
7. Environment variables and why browser-visible configuration cannot be secret.

### Follow one request

Start at `loadStops` in `components/TransitExplorer.js`:

1. The browser sends:
   `/api/transit/stops/nearby?lat=...&lng=...&radiusMiles=...`.
2. `app/api/transit/stops/nearby/route.js` reads the query string.
3. The handler validates coordinates and radius.
4. It calls `nearbyStops` from `lib/gtfs.js`.
5. It serializes the result with `NextResponse.json`.
6. The browser checks `response.ok`, parses JSON, and updates React state.

### Why this design

The browser does not query PostgreSQL directly. A database URL is a secret, and
the server must validate untrusted input. The API is also a stable boundary:
the browser receives the same response whether the server reads JSON or PostGIS.

## Phase 3: Learn React

### Learn

1. Function components and JSX.
2. Props: read-only inputs passed from parent to child.
3. State: values that trigger a render when updated.
4. Controlled form inputs.
5. Conditional rendering.
6. Rendering lists and stable `key` values.
7. `useEffect` for synchronizing with external systems.
8. Effect dependency arrays and cleanup functions.
9. `useRef` for DOM nodes and mutable values that do not trigger renders.
10. Derived values versus duplicated state.

### The most important distinction in this app

`TransitExplorer` bridges two programming models:

- **React is declarative.** State describes what the panels should look like.
- **Google Maps is imperative.** Methods explicitly create, change, and remove
  markers, circles, bounds, and polylines.

React state stores things displayed by JSX:

```js
const [selectedStop, setSelectedStop] = useState(null);
```

Refs store Google objects that must survive renders without causing one:

```js
const stopMarkersRef = useRef([]);
```

### Why this design

Putting a Google Map instance in state would cause unnecessary renders and would
not make the third-party object declarative. Keeping it in a ref makes ownership
clear: Google owns the map object; React owns the application panels.

`TransitExplorer` acts as a controller while `TransitUI.js` contains
presentational components. This avoids mixing every API call and map operation
into every button or card.

## Phase 4: Learn Next.js App Router

### Learn

1. Next.js is a framework around React, not a replacement for React.
2. File-system routing under `app/`.
3. `page.js` and `layout.js`.
4. Server Components as the default.
5. Client Components and the `"use client"` boundary.
6. Route Handlers under `app/api/`.
7. Dynamic folders such as `[stopId]`.
8. Server-only versus browser-visible environment variables.
9. Next.js Proxy (formerly Middleware) and request matching.

### Find it in the app

- `app/page.js` maps to `/`.
- `app/layout.js` wraps every page.
- `app/api/transit/stops/nearby/route.js` maps to the nearby-stop endpoint.
- `app/api/transit/stops/[stopId]/route.js` has a dynamic path parameter.
- `components/TransitExplorer.js` requires `"use client"` because it uses hooks
  and browser APIs.
- `proxy.js` refreshes Supabase sessions before matched requests continue.

### Why this design

The map feature must be a Client Component, but the database must remain on the
server. Next.js supports both in one repository and deployment. Thin Route
Handlers keep HTTP concerns separate from reusable data functions.

## Phase 5: Learn Tailwind CSS

### Learn

1. Utility-first CSS.
2. Spacing, sizing, color, flexbox, positioning, and typography utilities.
3. Responsive prefixes such as `sm:`.
4. State variants such as `hover:` and `focus:`.
5. Arbitrary values such as `w-[390px]`.
6. When normal CSS is still appropriate.

### Decode one example

```text
absolute left-3 right-3 top-3 sm:left-5 sm:right-auto sm:w-[390px]
```

- Position the panel absolutely.
- On mobile, place it 0.75rem from the left, right, and top.
- At the `sm` breakpoint, use a fixed 390px width and no right constraint.

### Why this app uses both Tailwind and global CSS

Tailwind keeps component layout visible beside the JSX. The Google Maps SDK,
however, receives manually created DOM elements rather than React components.
Those marker classes are easier to style in `app/globals.css`. Keyframes and
complex pseudo-elements also read more clearly as conventional CSS.

## Phase 6: Learn Google Maps and Places

### Learn

1. Loading the Maps JavaScript API with an API key.
2. The difference between a map, marker, circle, polyline, and bounds.
3. Places autocomplete predictions versus full Place records.
4. Latitude/longitude coordinate objects.
5. Events from non-React libraries.
6. API key restrictions, billing, and quotas.

### Trace the map lifecycle

1. The first effect loads the SDK and constructs the map.
2. The second effect debounces Places autocomplete.
3. `commitPlace` turns a Place into a destination marker and radius circle.
4. `createStopMarkers` creates custom Advanced Markers.
5. Marker click listeners call back into React through `selectStop`.
6. `selectRoute` turns GTFS shape points into Google polylines.
7. Cleanup helpers remove objects from the map when selections change.

### Why the code manually creates marker DOM

`AdvancedMarkerElement` supports custom content. Manual DOM gives the markers a
distinct visual design and tooltip while retaining Google Maps positioning and
click behavior. Text is assigned through `textContent`, not HTML strings, which
also avoids interpreting feed text as markup.

### Why autocomplete is debounced

Without the 220 ms timer, every keystroke could create a network request. The
debounce reduces quota use, race conditions, and visible suggestion flicker.

## Phase 7: Learn databases, Supabase, and PostGIS

### Separate these concepts

- **PostgreSQL** is the relational database.
- **PostGIS** is a PostgreSQL extension for geographic data and spatial queries.
- **Supabase** hosts PostgreSQL and adds products such as Auth, APIs, Storage,
  and Realtime.
- **`pg`** is the Node.js PostgreSQL driver used by this app.
- **`@supabase/ssr`** manages Supabase Auth sessions across browser/server code.

The transit query path uses `pg` directly. The Supabase utilities are currently
session infrastructure; they do not power the map search.

### Learn

1. Tables, rows, columns, primary keys, and foreign keys.
2. One-to-many and many-to-many relationships.
3. SQL `SELECT`, `JOIN`, `GROUP BY`, and aggregate functions.
4. Parameterized queries such as `$1`.
5. Connection pools.
6. Database migrations.
7. Geographic points, lines, distance, and spatial indexes.
8. Supabase publishable keys versus server secrets.
9. Cookies, sessions, and Row Level Security.

### Why PostGIS

A normal database can store latitude and longitude, but PostGIS can answer
"which stops are within this radius?" using geographic types and a GiST index.
`ST_DWithin` can use that index to narrow candidates before exact distances and
route joins are calculated.

### Why JSON also exists

The JSON fallback makes onboarding and demos resilient: someone can run the app
without first configuring and importing a database. The data-access interface
keeps this convenience from leaking into the UI.

## Phase 8: Learn GTFS and data engineering

### Learn

1. GTFS is a public transit data standard distributed as related text files.
2. Routes describe named services.
3. Trips describe individual runs of a route.
4. Stop times connect trips to ordered stops.
5. Shapes contain ordered points used to draw route lines.
6. ETL means extract, transform, and load.
7. Validation should happen before database writes.
8. Transactions make a multi-step import atomic.

### Why imports happen offline

Parsing a large ZIP, validating relationships, inserting rows, and constructing
route lines are expensive and change only when the agency publishes a feed.
Doing this during a user's request would be slow and unreliable. The import
pipeline prepares query-friendly data ahead of time.

### Why IDs are prefixed

GTFS identifiers are guaranteed unique only inside one feed. Prefixing them
with feed or agency identity prevents collisions if the application later adds
another transit provider.

## Phase 9: Study reliability and security decisions

Be ready to explain these choices:

| Decision | Reason |
| --- | --- |
| Validate latitude, longitude, and radius in API handlers | Browser input is untrusted and invalid geographic values should not reach SQL. |
| Use parameterized SQL | Values cannot change the SQL program, preventing injection. |
| Keep the database URL server-only | Browser bundles can be downloaded and inspected by anyone. |
| Use a bounded connection pool | Reusing a small number of connections is faster and protects the database. |
| Request Google Place fields explicitly | Avoid unnecessary data and API work. |
| Debounce autocomplete | Reduce requests, quota use, races, and flicker. |
| Load stop and route detail on demand | Keep initial responses and rendering work small. |
| Use effect cleanup and cancellation flags | Avoid stale async callbacks updating an unmounted component. |
| Use transactions for imports | Readers never see a partially imported feed. |
| Use an advisory lock | Two imports cannot replace the same feed concurrently. |
| Support reduced motion | Respect user accessibility preferences. |
| Keep generated GTFS files generated | The import pipeline remains the source of truth. |

## Phase 10: Prepare your presentation

### A five-minute walkthrough

1. **Problem:** Apartment listings show location, but not how much useful transit
   exists nearby.
2. **User flow:** Search address, choose radius, inspect stops, choose a stop,
   and visualize published route geometry.
3. **Frontend:** React manages UI state while Google Maps manages map objects.
4. **Backend:** Next.js Route Handlers validate requests and expose narrow JSON
   endpoints.
5. **Data:** One GTFS data layer supports easy local JSON and scalable PostGIS.
6. **Pipeline:** Public DART data is validated and prepared before users query it.
7. **Tradeoff:** Static GTFS gives routes and stops, but not realtime arrivals,
   alerts, walking directions, or full trip planning.

### A fifteen-minute code walkthrough

1. Open `app/page.js` to show file-system routing and composition.
2. Open the state/ref section of `TransitExplorer.js`.
3. Follow `loadStops` into the nearby-stops Route Handler.
4. Follow that handler into `nearbyStops` in `lib/gtfs.js`.
5. Show the two backend branches.
6. Open the SQL migration and point out spatial indexes and relationships.
7. Open the importer and describe extract, validate, normalize, transact.
8. Finish with `TransitUI.js` and responsive Tailwind classes.

### Questions you should be ready for

**Why Next.js instead of plain React?**
It provides routing, server code, request proxying, deployment conventions, and React
rendering in one framework. This app needs both browser interaction and a secure
database boundary.

**Why not call Supabase directly from the browser?**
The current transit data is queried with server-side SQL and includes spatial
joins. Keeping it behind APIs protects credentials, centralizes validation, and
keeps the frontend independent of storage details.

**Why both Supabase and `pg`?**
Supabase provides the hosted PostgreSQL platform and authentication session
tools. `pg` gives server code direct access to PostGIS queries. They solve
different parts of the stack.

**Why is `TransitExplorer` a Client Component?**
It needs React hooks, DOM nodes, `window`, event handlers, and the browser-only
Google Maps SDK.

**Why refs instead of state for markers?**
Markers are mutable third-party objects and are not rendered by React. Refs
preserve them without causing unnecessary React renders.

**Why are the API handlers so small?**
They should translate HTTP into application calls. Keeping SQL and data shaping
in `lib/gtfs.js` makes those functions reusable and keeps route behavior clear.

**What would you improve next?**
Add automated tests, TypeScript data contracts, request cancellation with
`AbortController`, route-shape filtering by selected direction, explicit
authentication requirements if user features are added, observability, and
GTFS Realtime support.

## A practical four-week schedule

### Week 1: JavaScript and the browser

- Complete Phases 1 and 2.
- Rewrite `primaryMode`, `splitAddress`, and `uniqueRoutes` from memory.
- Use browser DevTools to inspect one nearby-stop request and response.

### Week 2: React and Next.js

- Complete Phases 3 and 4.
- Draw the component tree.
- Add a harmless UI state, such as a button that toggles a legend.
- Trace which state update causes which component to render.

### Week 3: Tailwind and Google Maps

- Complete Phases 5 and 6.
- Decode the major panel class strings.
- Change a marker style and radius color.
- Explain why marker cleanup is necessary.

### Week 4: Data and presentation

- Complete Phases 7 through 10.
- Draw the database relationships.
- Explain one PostGIS query in plain English.
- Rehearse the five-minute walkthrough without reading notes.
- Rehearse the fifteen-minute walkthrough while navigating the source.

## Definition of understanding

You understand the application when you can:

1. Trace an address search from browser event to map update.
2. Explain state versus refs with an example from this file.
3. Explain why code runs in the browser or on the server.
4. Explain the JSON/PostGIS data-source abstraction.
5. Describe the GTFS relationships needed for a route timeline.
6. Identify which environment variables are public and which are secret.
7. Defend the main implementation choices and name their tradeoffs.
8. Describe the current limitations without overselling the product.
