# Code Quality Report

Review date: 2026-09-27

## 1. What Was Improved

- Added and configured project-local Biome and Fallow tooling.
- Added a service-free `npm run quality` gate and changed-code Fallow audit for
  CI, with an identity-based baseline for reviewed complexity findings.
- Formatted the authored JavaScript, JSX, CSS, and configuration files with
  Biome's safe fixes.
- Resolved all Biome lint and accessibility diagnostics.
- Reduced unnecessary module exports and removed unused files.
- Consolidated duplicated nearby-transit request validation.
- Simplified GTFS route-type classification and feed validation.
- Separated page composition from the stateful map controller.
- Added explicit Google Maps marker-listener and overlay cleanup.
- Removed an unused Supabase Auth request path from the public application.
- Expanded API regression coverage from three to seven Playwright tests.

## 2. Important Architectural Changes

The application retains its layered request flow:

```text
Google Places / Maps
        ↓
TransitExplorer state and map orchestration
        ↓
TransitWorkspace and TransitUI presentation
        ↓
Next.js transit Route Handlers
        ↓
Shared request validation and GTFS data access
        ↓
DART JSON or server-only PostgreSQL/PostGIS
```

`app/page.js` remains a Server Component. `components/TransitExplorer.js` is
the intentional client boundary because it owns React state, browser APIs, and
Google Maps objects. Browser code calls the application's Route Handlers rather
than importing PostgreSQL or filesystem modules.

`components/transit/TransitWorkspace.js` now owns page composition while
`TransitExplorer` retains workflow state and side effects. This reduced the
controller's JSX depth from 4 to 1 and its cyclomatic complexity from 10 to 3.

The public application does not implement accounts or user-specific data.
The unused Supabase Auth proxy was therefore removed. Supabase remains the
optional PostgreSQL host, accessed only through the server-side `pg` driver.

## 3. Dead Code Removed

Fallow initially reported two unused files and six unused exports.

Removed unused files:

- `utils/supabase/client.js`
- `utils/supabase/server.js`

Removed unnecessary export modifiers while retaining the internally used UI
implementations:

- `RADIUS_OPTIONS`
- `ModeIcon`
- `AddressAutocomplete`
- `MapControls`
- `RouteTimeline`
- `TransitRouteRow`

The final architecture review also removed the unused authentication-session
chain:

- `proxy.js`
- `utils/supabase/config.js`
- `utils/supabase/middleware.js`
- `@supabase/ssr`
- `@supabase/supabase-js`

Final Fallow results report zero unused files, exports, dependencies, or
development dependencies.

## 4. Duplication Removed

The two nearby-transit endpoints previously duplicated coordinate and radius
parsing. `lib/api/nearby-request.js` now owns that HTTP-boundary validation.

Both route handlers retain their original status codes, response structures,
and distinct coordinate-error messages. Tests cover both endpoints and the
shared radius constraint.

Fallow duplication changed from two clone groups and 2.53% duplicated lines to
zero clone groups and 0% duplicated lines.

Stop-detail normalization now also shares one route-direction grouping helper
between the JSON and PostgreSQL implementations.

## 5. Complexity Reduced

| Area | Before | After |
| --- | --- | --- |
| `TransitExplorer` | Cyclomatic 10, cognitive 31, JSX depth 4 | Cyclomatic 3, cognitive 25, JSX depth 1 |
| `selectRoute` | Cyclomatic 18, cognitive 13 | Cyclomatic 13, cognitive 8 |
| `getStop` | Cyclomatic 13, cognitive 20 | Cyclomatic 8, cognitive 10 |
| `transitType` | Cyclomatic 29, cognitive 24 | Below both structural thresholds |
| `validateGtfs` | Cyclomatic 28, cognitive 39 | Below both structural thresholds |
| API route handlers | Cyclomatic 15 each | Cyclomatic 5 each |

The full Fallow health score improved from 75.4/B to 80/B. Score-only mode
reports 90/A because it does not include the 10-point Git-history hotspot
penalty.

## 6. Tests and Build Status

| Check | Result |
| --- | --- |
| Local quality gate | Passed |
| Biome check | Passed; 26 files checked, 0 findings |
| Fallow dead-code analysis | Passed; 0 findings |
| Fallow duplication analysis | Passed; 0 clone groups |
| Fallow dependency/cycle/boundary checks | Passed; 0 findings |
| Playwright | Passed; 7 tests |
| GTFS validation smoke tests | Passed |
| Supabase pgTAP security tests | Passed; 36 assertions |
| Production dependency audit | Passed; 0 vulnerabilities |
| Next.js production build | Passed |
| Next.js runtime compilation/errors | Passed; no issues |
| NorthPark happy path | Passed through search, stop, route, and back navigation |
| Automated WCAG A/AA scan | 0 violations; 4 dynamic/third-party contrast checks require manual review |

The full Fallow command still exits nonzero because its health mode reports
remaining complexity and estimated CRAP findings.

## 7. Remaining Technical Debt

### Transit controller size

`TransitExplorer` remains a 518-line stateful controller with cognitive
complexity 25. Its state is related to one progressive workflow, and further
splitting would require a deliberate custom-hook or state-machine design.
That broader change was not justified for this cleanup pass.

### Coverage-based Fallow estimates

Fallow reports 31 functions above at least one health threshold. Only
`TransitExplorer` exceeds a direct cyclomatic/cognitive threshold; the other
30 are primarily CRAP estimates produced without a coverage report. The
highest-priority Fallow recommendation is measured coverage for the decomposed
GTFS validation helpers.

### Long data transformation functions

The GTFS importer's `normalize` function and several response-mapping
functions remain longer than Fallow's 60-line threshold. They represent
cohesive feed transformations, so they were not split solely to improve a
metric.

### PostGIS extension placement

The local Supabase security advisor reports that PostGIS is installed in the
`public` schema, exposing its built-in `spatial_ref_sys` table to Data API
inspection. It contains coordinate-system definitions rather than application
or user data, but current Supabase guidance recommends installing PostGIS in a
dedicated `extensions` schema.

Moving an existing PostGIS installation requires a backup and extension
recreation, or assistance from Supabase Support. It was not automated during
this cleanup because doing so can drop extension-dependent objects and data.
The application's GTFS tables themselves have RLS enabled, no browser-facing
policies, and no `anon` or `authenticated` table privileges.

### Browser request cancellation

Address suggestions and transit requests guard common stale state, but they do
not yet use `AbortController`. Rapid repeated searches can still consume
unnecessary network work even though the latest UI state remains usable.

## 8. Recommended Future Improvements

1. Add unit tests and coverage reporting for GTFS validation, route
   normalization, geographic calculations, and request parsing; then feed the
   coverage file into Fallow.
2. Add backend-parity integration tests that run the same stop and route
   assertions against bundled JSON and PostGIS.
3. Plan a dedicated PostGIS-schema migration with a verified backup and restore
   procedure, following current Supabase guidance.
4. Consider extracting a focused Google Maps controller hook only when tests
   cover marker lifecycle, concurrent searches, and route-selection races.
5. Add request cancellation for autocomplete, nearby-stop, stop-detail, and
   route-detail requests if rapid interaction becomes a measured issue.
6. Manually review color contrast for the custom destination label and Google
   Maps' third-party controls.
