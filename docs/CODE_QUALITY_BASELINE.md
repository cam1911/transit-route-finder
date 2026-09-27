# Code Quality Baseline

Baseline date: 2026-09-27

This report records the first Biome and Fallow analysis of Dallas Transit Nearby. It intentionally does not
fix, format, suppress, or refactor application code. The findings below should be reviewed before either tool
is made a required CI gate.

## Summary

| Area | Result | Classification |
| --- | --- | --- |
| Biome check | Failed: 33 errors and 5 warnings across 29 checked files | MEDIUM |
| Fallow full analysis | Failed: dead-code and complexity findings | MEDIUM |
| Fallow dead code | Failed: 2 unused files and 6 unused exports | MEDIUM |
| Fallow duplication | Passed: 2 clone groups, 2.1% duplicated lines | LOW |
| Fallow health score | 85/A in score-only mode; 75.4/B with full hotspot analysis | MEDIUM |
| Playwright | Passed: 3 tests | — |
| Next.js production build | Passed | — |
| Supabase pgTAP tests | Not run: Docker or Podman is not installed | — |

No finding is classified HIGH because the baseline did not demonstrate a current correctness or security
failure. The MEDIUM items are worthwhile maintenance, accessibility, and testability work rather than
evidence that the application is broken.

## 1. Biome Findings

`npm run lint` exited with status 1. Biome checked 29 files and reported:

- 22 formatting differences in existing authored files.
- 6 `useIterableCallbackReturn` errors:
  - 5 in `components/TransitExplorer.js`
  - 1 in `utils/supabase/middleware.js`
- 3 accessibility errors in `components/transit/TransitUI.js`:
  - 1 `useSemanticElements` finding
  - 2 `useAriaPropsSupportedByRole` findings
- 2 import-order assist findings:
  - 1 in `components/TransitExplorer.js`
  - 1 in `components/transit/TransitUI.js`
- 5 `noImportantStyles` warnings in `app/globals.css`.

### Assessment

| Classification | Finding | Rationale |
| --- | --- | --- |
| MEDIUM | Accessibility semantics and unsupported ARIA properties | These can affect assistive-technology behavior and should be checked against the rendered controls. |
| MEDIUM | `forEach` callbacks returning values | The return values are ignored by JavaScript. The current behavior may still be intentional, but explicit block callbacks would make the control flow unambiguous. |
| LOW | Existing formatting and import ordering | Mechanical consistency work with no demonstrated behavior impact. |
| LOW | Five `!important` declarations | One supports a Google Maps mobile-control override; four enforce reduced-motion behavior. Biome marks removal as unsafe, so these should not be changed blindly. |

`npm run format:check` also exited with status 1 because of the same 22 existing formatting differences.
No formatter or automatic fix was run.

## 2. Fallow Dead-Code Findings

`npm run fallow:dead-code` exited with status 1 and reported 8 issues:

### Unused files

- `utils/supabase/client.js`
- `utils/supabase/server.js`

These appear to be unused Supabase application-client scaffolding. The application currently accesses its
transit data through server route handlers instead.

### Unused exports

Fallow found six symbols exported from `components/transit/TransitUI.js` that are not imported by another
module:

- `RADIUS_OPTIONS`
- `ModeIcon`
- `AddressAutocomplete`
- `MapControls`
- `RouteTimeline`
- `TransitRouteRow`

These symbols are used inside their defining module, so this is excess public surface rather than six
unreachable implementations.

### Assessment

| Classification | Finding | Rationale |
| --- | --- | --- |
| MEDIUM | Two unused Supabase helper files | Stale integration scaffolding can confuse future development and security reviews. Confirm that no planned authentication flow needs it before removal. |
| LOW | Six unnecessary exports | Removing only the `export` modifiers would reduce module surface without changing internal use. |

Fallow found no unused dependencies, unresolved imports, unlisted dependencies, circular dependencies,
route collisions, misplaced client/server directives, or boundary violations.

## 3. Fallow Duplication Findings

`npm run fallow:dupes` exited successfully. It found two clone groups, both shared by:

- `app/api/transit/nearby/route.js`
- `app/api/transit/stops/nearby/route.js`

The duplicated regions cover coordinate/radius validation and nearby-stop response handling. The two groups
represent 45 duplicated lines across the analyzed corpus:

- 17 files included in duplication analysis
- 2 files with clones
- 2 clone groups in 1 family
- 2.1% duplicated lines

**Classification: LOW.** A shared request parser or handler could reduce drift, but the current duplication is
small and no divergent behavior was demonstrated.

## 4. Fallow Complexity and Health Findings

The requested `npm run fallow:health` score-only command exited successfully with a score of **85/A**. Its
deductions were unit size (-10.0), dead exports (-3.1), and dead files (-1.5).

The richer full health analysis includes Git-history hotspot penalties and scored the project **75.4/B**:

- 26 files and 167 functions analyzed
- 2,273 lines of code
- Average maintainability index: 90.6
- Average cyclomatic complexity: 3.0
- 90th-percentile cyclomatic complexity: 7
- 26 functions exceeded at least one configured threshold
- CRAP scores use static estimated coverage because no coverage report was supplied

The differing scores are expected: score-only mode omits the full analysis's 10-point hotspot penalty.

### Primary hotspots

| Classification | Location | Finding |
| --- | --- | --- |
| MEDIUM | `components/TransitExplorer.js` | `TransitExplorer` is 518 lines with cognitive complexity 31; the 597-line module is also the highest change/complexity hotspot. |
| MEDIUM | `scripts/gtfs/validate.mjs` | `validateGtfs` has cyclomatic complexity 28 and cognitive complexity 39. |
| MEDIUM | `lib/gtfs.js` | `transitType` has cyclomatic complexity 29 and cognitive complexity 24. |
| MEDIUM | Nearby route handlers | Both handlers have cyclomatic complexity 15 and no measured unit coverage. |
| LOW | `components/transit/TransitUI.js` | Frequently changed UI module with 6 unnecessary exports and a rising hotspot trend. |

Five functions exceed the default 60-line unit-size threshold:

| Function | File | Lines |
| --- | --- | ---: |
| `TransitExplorer` | `components/TransitExplorer.js` | 518 |
| `normalize` | `scripts/gtfs/import.mjs` | 108 |
| `getStop` | `lib/gtfs.js` | 75 |
| `getRoute` | `lib/gtfs.js` | 74 |
| `AddressAutocomplete` | `components/transit/TransitUI.js` | 73 |

Fallow labels several CRAP findings as critical internally because it assumes no test coverage when a
coverage file is absent. This report does not translate those labels directly to HIGH: the calculation is
an estimate, the existing end-to-end tests pass, and no behavior defect was reproduced. Collecting unit
coverage would make the risk scores more representative.

## 5. Existing Test and Build Status

| Command | Status | Notes |
| --- | --- | --- |
| `npm run test:e2e` | Passed | 3 Chromium tests passed in 3.1 seconds. |
| `npm run build` | Passed | Next.js 16.3.6 Turbopack production build completed successfully. |
| `npm run test:db` | Blocked | Could not connect to local PostgreSQL on port 54322. |
| `npm run db:start` | Blocked | Supabase reported that Docker and Podman are unavailable on `PATH`. |

The database result is an environment limitation, not a pgTAP assertion failure. Run `npm run db:start`
followed by `npm run test:db` on a machine with Docker Desktop or Podman to complete that validation.

The repository requires Node 24, while this baseline was run under Node 22.23.3. The quality tools, Playwright,
and production build still executed, but future local and CI runs should use the pinned Node version.

## 6. Configuration Changes

Installed exact project-local development dependencies:

- `@biomejs/biome` 2.5.14
- `fallow` 3.30.0

Added npm scripts:

- `lint` and `lint:fix`
- `format` and `format:check`
- `quality`
- `fallow`
- `fallow:dead-code`
- `fallow:dupes`
- `fallow:health`

Biome is configured for formatting, recommended linting, React/JSX, modern JavaScript, and safe import
organization. `lint:fix` does not enable unsafe fixes.

Fallow uses automatic Next.js, React, and Playwright detection, mild duplication analysis, default health
thresholds, and no finding suppressions. `fallow config` and `fallow doctor` both validate the configuration;
doctor reports the project ready.

## 7. Intentional Exclusions

| Path | Reason |
| --- | --- |
| `.agents/**` | Tracked third-party agent skills and vendor documentation |
| `.next/**`, `.next-dev/**` | Generated Next.js build and development output |
| `coverage/**`, `playwright-report/**`, `test-results/**` | Generated test output |
| `data/**` | Generated DART GTFS snapshots |
| `docs/screenshots/**` | Binary documentation assets |
| `node_modules/**` | Installed dependencies |
| `supabase/.branches/**`, `supabase/.temp/**` | Generated local Supabase state |
| `package-lock.json` | Generated dependency lockfile; tracked but not hand-formatted |
| `.agents/skills-lock.json` | Generated skill lockfile |

Biome analyzes authored application, component, API, utility, script, end-to-end test, and relevant
configuration files. Fallow analyzes executable JavaScript modules and relies on its built-in framework
entry-point detection. No legitimate finding was suppressed to make the baseline pass.
