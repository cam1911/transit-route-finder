# Transit Home Finder

Transit Home Finder answers one apartment-hunting question: **how good is public transportation around this address?**

Search for a prospective home, inspect nearby DART stops, select a stop, and explore its published routes on an interactive Google Map. The experience is deliberately ordered around **address → nearby transit → stop → route**, rather than generic trip planning.

![Transit Home Finder address search](docs/screenshots/search-desktop.png)

## Highlights

- Google Places address search and autocomplete
- Nearby stop discovery defaults to 0.5 miles, with 1- and 2-mile options
- Mode-aware map markers for bus, rail, and streetcar service
- Stop details with every available route and direction
- Published GTFS route geometry rendered on Google Maps
- Focus mode that keeps only the selected stop visible while a route is active
- Responsive desktop panel and mobile bottom sheet
- Bundled real DART GTFS snapshot for local development
- Optional PostgreSQL/PostGIS data source for production-scale spatial queries

## Demo

![Nearby transit around NorthPark Center](docs/screenshots/nearby-transit-desktop.png)

| Selected stop | Selected route |
| --- | --- |
| ![Selected DART stop](docs/screenshots/selected-stop-desktop.png) | ![Selected DART route](docs/screenshots/selected-route-desktop.png) |

The screenshots use a public commercial address in Dallas. No home address or personal location data is included in this repository.

## Tech stack

- Next.js 15 and React 19
- Tailwind CSS 4
- Google Maps JavaScript API and Places API
- DART static GTFS data
- PostgreSQL, PostGIS, and `pg` for the optional database-backed data source
- Supabase SSR client and session middleware

## Getting started

### Prerequisites

- Node.js 20 or newer
- A Google Maps Platform project with the Maps JavaScript API and Places API enabled
- A Supabase project for the configured session middleware

### Install

```bash
git clone https://github.com/cam1911/transit-route-finder.git
cd transit-route-finder
npm install
cp .env.example .env.local
```

Add your own development credentials to `.env.local`, then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The repository includes a real DART JSON snapshot, so a database import is not required for the first local run.

## Environment variables

| Variable | Required | Visibility | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Browser | Google Maps browser key |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | Recommended | Browser | Google Cloud map style ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Browser | Supabase publishable key |
| `SUPABASE_DB_URL` | PostGIS only | Server secret | PostgreSQL connection string |
| `GTFS_DATA_SOURCE` | No | Server | `json` or `postgres`; automatically uses JSON when no database URL exists |
| `GTFS_FEED_URL` | No | Server | Optional GTFS feed override |

`NEXT_PUBLIC_` values are intentionally included in the browser bundle. Restrict the Google key by HTTP referrer and allow only the required Google APIs. A Supabase publishable key is designed for public clients, but it must be paired with appropriate Row Level Security. Never expose a Supabase secret/service-role key or database connection string.

## Transit data

The committed files under `data/dart/` are generated from DART's public static GTFS feed. They contain published stops, routes, and shapes, not user information.

Refresh the local JSON snapshot:

```bash
npm run import:local -- dart
```

For PostGIS-backed queries:

1. Apply `supabase/migrations/0001_gtfs.sql`.
2. Set `SUPABASE_DB_URL` in `.env.local`.
3. Import the feed with `npm run import:dart`.
4. Set `GTFS_DATA_SOURCE=postgres` to require the database source.

Imports run in a transaction and preserve GTFS extended-hour times such as `25:10:00`.

## API routes

| Endpoint | Description |
| --- | --- |
| `GET /api/transit/stops/nearby` | Stops near a latitude/longitude and radius |
| `GET /api/transit/stops/:stopId` | Stop details, routes, and directions |
| `GET /api/transit/routes/:routeId` | Route metadata, shapes, and ordered stops |
| `GET /api/transit/nearby` | Legacy nearby-route search |

## Project structure

```text
app/                 Next.js pages, styles, and API routes
components/          Map controller and reusable transit UI
data/dart/           Generated public DART GTFS fallback
docs/screenshots/    Sanitized product screenshots
lib/                 GTFS and database data access
scripts/gtfs/        Feed download, validation, parsing, and import
supabase/migrations/ PostGIS schema
utils/supabase/      Browser/server Supabase clients and middleware
```

## Security and privacy

- `.env.local`, build output, logs, and local agent tooling are ignored by Git.
- No credentials, user records, analytics, or personal addresses are committed.
- Address searches are sent to Google Places from the browser and are not persisted by this application.
- The server-only database URL never enters the client bundle.
- Before deploying, configure Google referrer restrictions, Supabase RLS, and deployment environment variables.

## Limitations

This project uses static GTFS. It visualizes published routes and stops but does not currently provide realtime arrivals, service alerts, walking directions, or end-to-end journey planning.
