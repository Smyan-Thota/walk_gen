# Random Walk Generator — Claude Code Build Prompt

## What you are building

A Next.js (TypeScript, App Router) web app called **Random Walk Generator** that creates a random loop walking route every time, based on start location, desired walking time, and elevation preference. Deploy target is Vercel.

---

## Step 0: Bootstrap

Run `npx create-next-app@latest random-walk --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` then `cd random-walk` and install these exact dependencies:

```bash
npm install maplibre-gl @maplibre/maplibre-gl-geocoder zustand
npm install -D @types/geojson jest @testing-library/react @testing-library/jest-dom ts-jest
```

Create `.env.local` and `.env.example` with:

```
ORS_API_KEY=          # openrouteservice.org API key
NEXT_PUBLIC_MAPTILER_KEY=   # maptiler.com API key (client-safe, used for map tiles only)
```

`ORS_API_KEY` is server-only. `NEXT_PUBLIC_MAPTILER_KEY` is the ONLY key exposed to the client — it is used solely for loading map tile styles.

---

## Step 1: File structure

Create this exact structure. Do NOT skip any file.

```
random-walk/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # HTML shell, meta tags, font
│   │   ├── page.tsx                # Main page — assembles all UI components
│   │   ├── globals.css             # Tailwind base + maplibre-gl CSS import + custom styles
│   │   └── api/
│   │       └── generate-route/
│   │           └── route.ts        # POST handler — all ORS logic lives here
│   ├── components/
│   │   ├── Map.tsx                 # MapLibre GL JS map + route polyline + start marker
│   │   ├── RouteForm.tsx           # Inputs: location, minutes, hilliness, generate button
│   │   ├── StatsPanel.tsx          # Route stats display
│   │   ├── StepsList.tsx           # Turn-by-turn directions
│   │   └── ErrorBanner.tsx         # Dismissible error display with retry
│   ├── lib/
│   │   ├── constants.ts            # All magic numbers, thresholds, defaults
│   │   ├── routeScoring.ts         # Hilliness scoring + candidate selection (pure functions)
│   │   ├── fingerprint.ts          # Route fingerprinting + localStorage dedup
│   │   ├── geometry.ts             # Bbox diagonal, haversine, polyline simplification
│   │   ├── ors.ts                  # ORS API client (server-only, used by route handler)
│   │   ├── types.ts                # All shared TypeScript types/interfaces
│   │   └── demo.ts                 # Hard-coded demo/fixture ORS response for dev without API keys
│   ├── store/
│   │   └── routeStore.ts           # Zustand store for app state
│   └── __tests__/
│       ├── routeScoring.test.ts
│       ├── fingerprint.test.ts
│       ├── geometry.test.ts
│       └── generateRoute.test.ts   # Integration test for /api/generate-route with mocked ORS
├── public/
│   └── favicon.ico
├── .env.example
├── .env.local                      # gitignored
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── jest.config.ts
├── README.md
└── package.json
```

---

## Step 2: Types (`src/lib/types.ts`)

Define these exact types. Every other file imports from here.

```typescript
export type HillinessPreference = "no_hill" | "little_hill" | "damon_hill";

export interface RouteRequest {
  lat: number;
  lng: number;
  minutes: number;
  hilliness: HillinessPreference;
  seed?: number;         // optional: lock seed for reproducibility / share links
  lockedSeeds?: number[]; // seeds to avoid (from recent fingerprint dedup)
}

export interface RouteCandidate {
  seed: number;
  distanceM: number;
  durationS: number;
  ascentM: number;
  descentM: number;
  ascentPerKm: number;
  geometry: GeoJSON.LineString;       // with elevation as 3rd coordinate
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  steps: RouteStep[];
  score: number;         // lower is better
}

export interface RouteStep {
  instruction: string;
  distanceM: number;
  durationS: number;
}

export interface RouteResult {
  candidate: RouteCandidate;
  hillinessScore: string;  // human-friendly label like "Flat", "Rolling", "Very Hilly"
  targetDistanceM: number;
  fingerprint: string;
}

export interface GenerateRouteResponse {
  ok: true;
  result: RouteResult;
} | {
  ok: false;
  error: string;
  retryable: boolean;
}
```

---

## Step 3: Constants (`src/lib/constants.ts`)

```typescript
export const DEFAULT_WALKING_SPEED_MPS = 1.34; // ~4.8 km/h
export const MIN_WALK_MINUTES = 5;
export const MAX_WALK_MINUTES = 180;
export const MIN_ROUTE_LENGTH_M = 400;
export const CANDIDATE_COUNT = 8;
export const MAX_FINGERPRINT_HISTORY = 10;
export const ORS_TIMEOUT_MS = 4000;
export const ORS_MAX_RETRIES = 2;
export const DISTANCE_TOLERANCE_FRACTION = 0.12; // ±12%
export const START_END_MAX_DISTANCE_M = 150;
export const BBOX_DIAGONAL_MAX_FACTOR = 2.2;

export const HILLINESS_RANGES: Record<string, { min: number; max: number; midpoint: number }> = {
  no_hill:     { min: 0,  max: 10, midpoint: 5 },
  little_hill: { min: 10, max: 25, midpoint: 17.5 },
  damon_hill:  { min: 25, max: 80, midpoint: 45 },
};
```

---

## Step 4: Core algorithm — implement exactly this

### 4a. Target distance calculation

```
target_distance_m = max(minutes * 60 * DEFAULT_WALKING_SPEED_MPS, MIN_ROUTE_LENGTH_M)
```

Cap `minutes` to `[MIN_WALK_MINUTES, MAX_WALK_MINUTES]` on the server. If the client sends a value outside this range, clamp it and include a warning in the response.

### 4b. ORS round-trip call (in `src/lib/ors.ts`)

For each candidate `i` in `0..CANDIDATE_COUNT-1`:

```
POST https://api.openrouteservice.org/v2/directions/foot-walking
Headers: { Authorization: ORS_API_KEY, Content-Type: application/json }
Body: {
  coordinates: [[lng, lat]],       // NOTE: ORS uses [longitude, latitude] order
  options: {
    round_trip: {
      length: target_distance_m,
      points: clamp(Math.round(target_distance_m / 500), 3, 8),
      seed: seed_i                  // random integer 0–2147483647, or user-provided
    }
  },
  elevation: true,
  instructions: true,
  instructions_format: "text",
  units: "m"
}
```

**Important ORS details:**
- The field is `round_trip` (underscore), not `round-trip` (hyphen).
- `coordinates` must be an array with exactly ONE `[lon, lat]` pair for round-trip mode.
- Response shape: `body.routes[0]` contains `summary.distance`, `summary.duration`, `summary.ascent`, `summary.descent`, `geometry` (encoded polyline by default — request `geometry_format: "geojson"` to get GeoJSON directly), and `segments[*].steps[*]`.
- Add `geometry_format: "geojson"` to the request body so you get a GeoJSON LineString directly instead of having to decode a polyline.

Implement timeout per request (`ORS_TIMEOUT_MS`) using `AbortController`. Implement retry with exponential backoff (delays: 500ms, 1500ms) up to `ORS_MAX_RETRIES` retries per individual candidate request. If a candidate fails after retries, skip it (do not fail the whole batch).

**Send all K candidate requests concurrently** using `Promise.allSettled`. This is critical for staying under the 2-second p95 target.

### 4c. Candidate scoring (in `src/lib/routeScoring.ts`)

For each successful candidate:

1. Compute `ascentPerKm = ascentM / Math.max(distanceM / 1000, 0.1)`.
2. Look up the hilliness range from `HILLINESS_RANGES[hilliness]`.
3. Compute `hillinessDeviation = Math.abs(ascentPerKm - range.midpoint)`.
4. Compute `distanceDeviation`: if `distanceM` is outside `targetDistanceM ± DISTANCE_TOLERANCE_FRACTION * targetDistanceM`, set `distanceDeviation = Math.abs(distanceM - targetDistanceM) / targetDistanceM * 100`. Else `0`.
5. `score = hillinessDeviation + distanceDeviation`.
6. Apply rejection rules (these set `score = Infinity`):
   - Start/end distance from origin > `START_END_MAX_DISTANCE_M` (check first and last coordinate of geometry vs `[lng, lat]` using haversine).
   - Bbox diagonal > `BBOX_DIAGONAL_MAX_FACTOR * expectedRadius` where `expectedRadius = targetDistanceM / (2 * Math.PI)`.

Return the candidate with the lowest finite score. If all candidates are rejected or failed, return an error.

### 4d. Fingerprinting (in `src/lib/fingerprint.ts`)

Generate a fingerprint by:
1. Take every 5th coordinate from the geometry.
2. Round each to 4 decimal places.
3. JSON.stringify the resulting array.
4. Hash it (use a simple djb2 hash — do NOT import crypto libs for this).

Store up to `MAX_FINGERPRINT_HISTORY` fingerprints in `localStorage` under key `rw_fingerprints`. On the client, before showing a result, check if its fingerprint matches any stored one. If it does, auto-retry with a different seed (up to 2 retries). After showing a route, push its fingerprint to the history.

### 4e. Route validity (in `src/lib/geometry.ts`)

Implement these pure functions:
- `haversineDistance(lat1, lon1, lat2, lon2): number` — returns meters.
- `bboxDiagonal(bbox: [number, number, number, number]): number` — returns meters using haversine on corners.
- `computeAscentDescent(coords: number[][]): { ascentM: number; descentM: number }` — sums positive and negative elevation deltas from 3D coordinates. Use this as fallback if ORS summary doesn't include ascent/descent.

---

## Step 5: API route handler (`src/app/api/generate-route/route.ts`)

This is a Next.js App Router Route Handler exporting `POST`.

```typescript
export async function POST(request: Request): Promise<Response> { ... }
```

Logic:
1. Parse and validate `RouteRequest` from JSON body. Return 400 on bad input.
2. Compute `targetDistanceM`.
3. Generate `CANDIDATE_COUNT` random seeds (or use provided seed). Exclude any `lockedSeeds`.
4. Call ORS concurrently for all candidates (via `ors.ts`).
5. Score and select best candidate (via `routeScoring.ts`).
6. Compute fingerprint server-side too (return it in the response).
7. Return `GenerateRouteResponse`.

If `process.env.ORS_API_KEY` is missing or empty AND `process.env.NODE_ENV === 'development'`, return a demo fixture response from `src/lib/demo.ts` instead of calling ORS. Log a warning to console.

---

## Step 6: Demo fixture (`src/lib/demo.ts`)

Create a realistic hard-coded ORS-like response for a ~2km loop near downtown San Francisco (lat 37.7749, lng -122.4194). Include:
- A GeoJSON LineString geometry with ~30 coordinates including elevation (3rd value).
- Realistic summary: distance ~2100m, duration ~1600s, ascent ~45m, descent ~43m.
- At least 8 turn-by-turn steps.
- This allows full UI development without an API key.

---

## Step 7: Zustand store (`src/store/routeStore.ts`)

State shape:

```typescript
interface RouteState {
  // Inputs
  lat: number | null;
  lng: number | null;
  minutes: number;
  hilliness: HillinessPreference;
  lockedSeed: number | null;

  // Outputs
  routeResult: RouteResult | null;
  isLoading: boolean;
  error: string | null;
  errorRetryable: boolean;

  // Actions
  setLocation: (lat: number, lng: number) => void;
  setMinutes: (m: number) => void;
  setHilliness: (h: HillinessPreference) => void;
  setLockedSeed: (s: number | null) => void;
  generateRoute: () => Promise<void>;
  regenerateRoute: () => Promise<void>;
  clearError: () => void;
}
```

`generateRoute` calls `fetch('/api/generate-route', { method: 'POST', body: ... })`, handles response, updates state. `regenerateRoute` calls `generateRoute` but ensures a new seed.

---

## Step 8: UI Components

### Layout & Page

- `layout.tsx`: Standard Next.js App Router layout. Set page title to "Random Walk Generator". Import `globals.css`. Use `<html lang="en">`.
- `page.tsx`: Client component (`"use client"`). Reads URL search params on mount to support share links (`lat`, `lng`, `minutes`, `hilliness`, `seed`). Renders `RouteForm`, `Map`, `StatsPanel`, `StepsList`, `ErrorBanner`.

### `globals.css`

Import MapLibre CSS: `@import "maplibre-gl/dist/maplibre-gl.css";`. Add Tailwind directives. Set body to full height.

### `RouteForm.tsx`

- "Use my location" button: calls `navigator.geolocation.getCurrentPosition`. On denial, show a text input for address or raw lat/lng.
- Minutes input: number input, default 30, min 5, max 180.
- Hilliness: `<select>` with three options:
  - "Flat (no hills)" → `no_hill`
  - "Some hills" → `little_hill`
  - "Maximum hills (Damon Hill)" → `damon_hill`
- "Generate Route" button. Disabled while loading. Shows spinner while loading.
- "Regenerate" button (only visible after a route is shown). Each press produces a different route.
- "Lock seed" checkbox (advanced, collapsed by default). When checked, subsequent regenerations reuse the same seed.
- "Share" button: copies a URL with query params `?lat=...&lng=...&minutes=...&hilliness=...&seed=...` to clipboard. Show toast "Link copied!".

For address → geocode: use the free Nominatim API (`https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1`). Do NOT use a paid geocoding API. Call Nominatim from the client (it's free and public, no key needed). Set a `User-Agent` header with the app name per Nominatim usage policy.

### `Map.tsx`

- Use `maplibre-gl` directly (NOT react-map-gl — fewer deps, more control).
- Initialize map with MapTiler style URL: `` `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}` ``.
- Use a `ref` to hold the map instance. Use `useEffect` to add/update:
  - A GeoJSON source + line layer for the route polyline (blue, 4px width).
  - A marker at the start location (green circle).
- On new route: fit map bounds to the route bbox with padding.
- On no route: center map on user's location if available, else show a default view.
- Make the map container responsive: `w-full h-[50vh] md:h-[60vh]`.

### `StatsPanel.tsx`

Display (only when a route exists):
- Distance: `X.X km`
- Est. duration: `X hr Y min` or `Y min`
- Total ascent: `X m ↑`
- Total descent: `X m ↓`
- Ascent/km: `X.X m/km`
- Hilliness score: label like "Flat 🟢", "Rolling 🟡", "Hilly 🟠", "Very Hilly 🔴"

Derive hilliness label:
- ascentPerKm ≤ 10 → "Flat 🟢"
- ascentPerKm ≤ 25 → "Rolling 🟡"
- ascentPerKm ≤ 40 → "Hilly 🟠"
- ascentPerKm > 40 → "Very Hilly 🔴"

### `StepsList.tsx`

Render turn-by-turn steps as an ordered list. Each step shows instruction text, distance, and duration. Collapsible (default collapsed on mobile, expanded on desktop).

### `ErrorBanner.tsx`

Red banner at top. Shows error message. If `retryable`, show a "Retry" button that calls `generateRoute` again. Dismiss button (X).

---

## Step 9: Shareable links

On page load (`page.tsx`), read `searchParams` from the URL. If `lat`, `lng`, `minutes`, and `hilliness` are all present, populate the store and auto-trigger `generateRoute`. If `seed` is also present, lock that seed so the same route is reproduced.

The "Share" button constructs this URL and copies to clipboard using `navigator.clipboard.writeText`.

---

## Step 10: Edge cases — handle ALL of these explicitly

| Scenario | Handling |
|---|---|
| User denies geolocation | Show text input for address. Use Nominatim to geocode. Also accept raw "lat, lng" format. |
| ORS returns 429 (rate limit) | Return `{ ok: false, error: "Rate limited. Please wait a moment and try again.", retryable: true }` |
| ORS returns 5xx | Retry with backoff. After exhausting retries: `{ ok: false, error: "Routing service is temporarily unavailable.", retryable: true }` |
| ORS returns empty routes array | `{ ok: false, error: "No walkable routes found near this location. Try a different starting point.", retryable: false }` |
| Walk time < 5 min | Clamp to 5 min on server. Show info toast on client. |
| Walk time > 180 min | Clamp to 180 min on server. Show warning toast on client. |
| All candidates rejected by scoring | Relax constraints: double `DISTANCE_TOLERANCE_FRACTION`, increase `BBOX_DIAGONAL_MAX_FACTOR` to 3.0, retry scoring. If still none, return error. |
| Very short route (< 400m target) | Set `points = 3` minimum. Accept wider distance tolerance. |
| Missing `ORS_API_KEY` in production | Return `{ ok: false, error: "Server configuration error.", retryable: false }`. Log the actual issue server-side. |
| Missing `NEXT_PUBLIC_MAPTILER_KEY` | Map will fail to load tiles. Show a fallback message over the map container: "Map tiles unavailable. Please check configuration." |

---

## Step 11: Tests

### `jest.config.ts`

Configure Jest for Next.js with TypeScript. Use `ts-jest`. Set `testEnvironment: "node"` for lib tests.

### Unit tests to write:

**`routeScoring.test.ts`**: Test `scoreCandidate` and `selectBestCandidate` with:
- A flat candidate scores well for `no_hill`.
- A hilly candidate scores well for `damon_hill`.
- A candidate with distance outside tolerance gets penalized.
- A candidate with bbox too large gets score = Infinity.
- `selectBestCandidate` returns the lowest-scored candidate.

**`fingerprint.test.ts`**: Test `computeFingerprint` returns consistent hashes. Test that two different routes produce different fingerprints. Test that same route always produces same fingerprint.

**`geometry.test.ts`**: Test `haversineDistance` with known values (e.g., London to Paris ≈ 343.5 km). Test `computeAscentDescent` with a simple elevation profile. Test `bboxDiagonal`.

**`generateRoute.test.ts`**: Integration test for the POST route handler. Mock the ORS fetch call to return a fixture response. Assert the response shape matches `GenerateRouteResponse`. Test that missing body fields return 400. Test that ORS failure returns retryable error.

---

## Step 12: README.md

Write a complete README with these exact sections:

```
# Random Walk Generator

Generate random loop walking routes based on time and hilliness preference.

## Quick Start

### Prerequisites
- Node.js 18+
- API keys: [openrouteservice.org](https://openrouteservice.org) and [maptiler.com](https://maptiler.com)

### Run Locally
​```bash
git clone <repo> && cd random-walk
cp .env.example .env.local
# Add your API keys to .env.local
npm install
npm run dev
​```

Open http://localhost:3000.

> **No API keys?** The app runs in demo mode locally, returning a sample route in San Francisco.

### Deploy to Vercel
1. Push to GitHub.
2. Import project in Vercel.
3. Add environment variables: `ORS_API_KEY`, `NEXT_PUBLIC_MAPTILER_KEY`.
4. Deploy.

### Run Tests
​```bash
npm test
​```

## Troubleshooting

| Problem | Solution |
|---|---|
| Map shows grey/no tiles | Check `NEXT_PUBLIC_MAPTILER_KEY` is set and valid |
| "Rate limited" errors | ORS free tier allows ~40 req/min. Wait and retry. |
| Route not generating | Check `ORS_API_KEY` is set. Check browser console for errors. |
| Geolocation not working | Requires HTTPS (or localhost). Try entering address manually. |
```

---

## Implementation order

Execute these steps in this exact order. After each step, verify the code compiles (`npx tsc --noEmit`).

1. Bootstrap project + install deps.
2. Create all files in `src/lib/` (types, constants, geometry, routeScoring, fingerprint, ors, demo).
3. Create the API route handler.
4. Create the Zustand store.
5. Create UI components (ErrorBanner → Map → StatsPanel → StepsList → RouteForm).
6. Create page.tsx and layout.tsx.
7. Create globals.css.
8. Write tests.
9. Write README.
10. Verify `npm run dev` works and the demo mode returns a route without API keys.
11. Verify `npm run build` succeeds.

---

## Code quality rules

- Every function must have JSDoc with a one-line description.
- No `any` types. Use `unknown` + type guards where needed.
- All lib functions must be pure (no side effects) except `ors.ts` (network) and `fingerprint.ts` (localStorage).
- Use `"use client"` only on components that need browser APIs. Keep lib code server-compatible.
- No barrel exports. Import directly from the file.
- Handle every promise rejection. No unhandled promises.
- Use `const` everywhere. No `let` unless mutation is required.
- No unused imports or variables.

---

## What NOT to do

- Do NOT use `react-map-gl` or `deck.gl` — use `maplibre-gl` directly.
- Do NOT call ORS from the client. All ORS calls go through `/api/generate-route`.
- Do NOT use the Google Maps API or Mapbox API.
- Do NOT add authentication, database, or payment logic.
- Do NOT add a polyline decoding library — request `geometry_format: "geojson"` from ORS instead.
- Do NOT create a separate backend server. Use Next.js route handlers only.
- Do NOT over-engineer: no Redux, no React Query, no GraphQL.
