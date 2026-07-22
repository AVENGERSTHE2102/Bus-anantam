# BusTracker — Codebase Guide (for agents)

Real-time bus tracking app for a specific route in Dombivli (Mumbai suburb). Four
role-based UIs (Passenger, Driver, Conductor, Admin) over a Node/Express +
MongoDB + Socket.IO backend, with a self-hosted OSRM instance for real
road-network routing/ETA. Read this before touching code — it tells you what's
real, what's mocked, and where every piece lives.

Full product spec: `BusTracker_PRD.md` (phased design doc, written before most
of this was built — treat it as intent, not ground truth; this file says what
actually exists).

## Repo layout

```
backend/        Node/Express API + Socket.IO + Mongo/SQLite (see below)
frontend/       Next.js 14 (App Router) + Leaflet map, 4 role UIs
osrm-data/      Self-hosted OSRM routing engine data + profiles (own process, port 5050)
BusTracker_PRD.md   Original phased product spec
*.png            Reference screenshots (admin/driver/conductor/passenger)
```

Backend and frontend are independent processes with independent
`package.json`/`node_modules`. Nothing in the repo builds them together.

## Running it locally

```bash
cd backend && npm run dev      # node --watch server.js, port 4000, needs backend/.env
cd frontend && npm run dev     # next dev, port 3000, needs frontend/.env.local

# OSRM (separate, not an npm process — installed via `brew install osrm-backend`):
cd osrm-data && osrm-routed --algorithm mld --port 5050 dombivli.osrm
```

`backend/.env` needs at minimum `MONGODB_URI`, `JWT_SECRET`, `OSRM_BASE_URL=http://localhost:5050`.
`frontend/.env.local` needs `NEXT_PUBLIC_API_URL=http://localhost:4000`.

If OSRM's `.osrm` graph files are ever regenerated, the pipeline is:
`osrm-extract -p osrm-data/profiles/car-allow-private.lua dombivli.osm` →
`osrm-partition dombivli.osrm` → `osrm-customize dombivli.osrm` → restart
`osrm-routed`. The custom profile (not the stock one) is required — see
"OSRM specifics" below.

---

## Backend (`backend/`)

Plain Express app, no framework magic. `server.js` is the entry point: sets up
CORS (credentials-aware, origin locked to `FRONTEND_URL`/`localhost:3000`),
JSON body parsing, mounts every route module, creates the Socket.IO server on
top of the same HTTP server, and starts the background job loop after Mongo
connects.

### Data storage — split across two databases, deliberately

- **MongoDB** (`config/db.js`, via Mongoose): `Bus`, `Route`, `Stop`, `Trip`,
  `Remark`, `RouteConversionRule`. This is the "operational" data — buses,
  routes, live trip positions, incident remarks. Chosen for Mongo's 2dsphere
  geo-indexes (`Route.endLocation`, `Stop.location`, `Trip.lastPosition.location`
  all have one).
- **SQLite** (`config/sqlite.js`, via Node's built-in `node:sqlite` —
  `DatabaseSync`, no native module to compile): `User`, `Favorite`. This is
  "identity" data, deliberately kept out of the cloud Mongo cluster. File
  lives at `backend/data/app.db` (gitignored). `node:sqlite` logs an
  "experimental feature" warning on every backend start — expected, not a bug.
- **`models/User.js` and `models/Favorite.js` are NOT Mongoose models.** They
  export plain async functions (`create`, `findOne`, `find`, `deleteOne`,
  `aggregate`) that hand-roll just enough of the Mongoose query shape actually
  used elsewhere in the codebase (`$in`, `$nin`, `$ne`, `.find().distinct()`,
  one specific `.aggregate()` group/sort/limit pipeline) via
  `config/sqliteQuery.js`'s `matches()`/`findResult()` helpers. **Important
  consequence**: `Trip.driverId` and `Trip.conductorId` are typed as plain
  `String` in the Mongoose schema (NOT `ObjectId`), because SQLite user ids are
  UUIDs (`crypto.randomUUID()`), not Mongo ObjectIds — casting them to
  ObjectId would throw. If you ever add a new field that stores a User id
  anywhere, it must be `String`, not `ObjectId`.
- There is no `.populate()` anywhere in the backend (would break since `User`
  isn't a registered Mongoose model) — user info is always looked up
  separately via the SQLite functions.

### Auth model

JWT-based, but the token is never exposed to JS on the client — it travels as
an **httpOnly cookie** named `token` (`routes/auth.js`'s `COOKIE_OPTIONS`:
`httpOnly`, `sameSite: 'strict'`, `secure` only in production, 12h maxAge).

- `middleware/auth.js`'s `requireAuth` reads the token from the cookie
  (parsed manually via `utils/cookies.js` — no `cookie-parser` dependency) or
  falls back to an `Authorization: Bearer` header (kept for convenience,
  e.g. curl testing).
- `requireRole(...roles)` checks `req.user.role` (decoded JWT payload:
  `{id, role}`).
- **Socket.IO auth** (`sockets/index.js`): the `io.use()` middleware reads the
  same `token` cookie off `socket.handshake.headers.cookie` (again via
  `utils/cookies.js`) — the client must connect with
  `io(url, { withCredentials: true })`, no token ever touches client JS.
- `POST /auth/register`, `POST /auth/login` (sets cookie), `POST /auth/logout`
  (clears cookie), `GET /auth/me` (session restore — returns the current user
  from the cookie, since JS can't read an httpOnly cookie itself).

### REST endpoints (all under `backend/routes/`)

| Method & path | Auth | File | What it does |
|---|---|---|---|
| POST `/auth/register` | none | auth.js | Create user (SQLite), bcrypt-hash password |
| POST `/auth/login` | none | auth.js | Verify password, set httpOnly JWT cookie |
| POST `/auth/logout` | none | auth.js | Clear the cookie |
| GET `/auth/me` | cookie | auth.js | Return current user (session restore) |
| GET `/buses` | none | buses.js | List all buses (added late — needed so the frontend has a real Mongo `busId` to start trips with) |
| GET `/routes` | none | routes.js | List active routes (includes `polyline` field) |
| GET `/routes/:id/stops` | none | routes.js | Stops for a route, sequence-ordered |
| POST `/routes` | admin | routes.js | Create route |
| POST `/routes/:id/stops` | admin | routes.js | Create stop |
| POST `/trips/start` | driver/conductor | trips.js | Create active Trip (driverId forced to caller if role=driver) |
| POST `/trips/:id/end` | driver/conductor | trips.js | Mark trip completed |
| GET `/trips/active` | none | trips.js | List active trips |
| GET `/trips/:id/eta?stopId=` | none | trips.js | ETA to a stop: OSRM road-network duration if `OSRM_BASE_URL` set and reachable, else haversine distance ÷ last known speed. Snaps the bus's raw GPS onto the route polyline first (`utils/polyline.js`) so it doesn't look off-road. |
| POST `/trips/:id/confirm-conversion` | driver/conductor | trips.js | Ends current trip, starts a new one on the next route (manual or looked up via `RouteConversionRule`), emits `trip:converted` |
| POST `/trips/:id/remarks` | driver/conductor | remarks.js | Create a Remark, emits `remark:new` to the route room + admin room |
| GET `/remarks?routeId=` | none | remarks.js | Last 50 remarks for a route |
| GET `/admin/remarks` | admin | remarks.js | Last 200 remarks, all routes |
| GET `/favorites/me` | passenger | favorites.js | List own favorites |
| POST `/favorites` | passenger | favorites.js | Favorite a stop (unique per user+stop) |
| DELETE `/favorites/:id` | passenger | favorites.js | Unfavorite |
| POST `/admin/conversion-rules` | admin | admin.js | Create a from-route→to-route auto-conversion rule |
| POST `/admin/broadcast` | admin | admin.js | Emit `admin:broadcast` (route-scoped or global) + FCM push to affected users |
| GET `/admin/analytics/summary` | admin | admin.js | Per-route trip count / on-time % (proxy: no system-stall remark on the trip) / avg duration, + top-10 most-favorited stops |

### Socket.IO events (`sockets/index.js`)

Client → server:
- `subscribe:route` (routeId) — join `route:{routeId}` room
- `subscribe:admin` — join `admin` room (server checks `socket.user.role === 'admin'`)
- `driver:location` `{tripId, lat, lng, speed, heading}` — driver only, must
  own the trip and it must be `active`. Updates `Trip.lastPosition`, tracks
  `lowSpeedSince` for stall detection, then broadcasts `bus:position` to the
  route room, then checks terminus-arrival geofence.

Server → client:
- `bus:position` `{tripId, busId, lat, lng, speed, heading}` — every driver ping, to the route room
- `trip:conversion-suggested` `{tripId, suggestedRouteId}` — bus entered its route's end-geofence (`GEOFENCE_RADIUS_METERS`, default 100m)
- `trip:converted` `{oldTripId, newTripId, toRouteId}` — from manual confirm or the auto-grace-window job
- `remark:new` — full Remark doc, to route room + admin room
- `admin:broadcast` `{message, routeId?}` — from admin broadcast

### Background jobs (`jobs/index.js`, one `setInterval`, default every 30s — `JOB_INTERVAL_MS`)

- `stallDetection.js` — active trips stuck below `STALL_SPEED_KMPH` for
  `STALL_MINUTES`+ get an auto system Remark ("stuck near X" via
  `utils/nominatim.js` reverse geocoding), throttled by
  `STALL_REMARK_COOLDOWN_MINUTES` so it doesn't spam every tick.
- `conversionGraceWindow.js` — trips stuck `arrived` past
  `CONVERSION_GRACE_MINUTES` with no manual confirmation auto-convert if a
  default `RouteConversionRule` exists for that route.
- `arrivalNotifications.js` — for each active trip, finds favorited stops not
  yet notified this trip, computes naive ETA (haversine ÷ speed), sends an FCM
  push when ETA ≤ `ARRIVAL_NOTIFY_MINUTES`.

All three log-and-continue on error (`.catch(err => console.error(...))`) so
one failing job tick never kills the interval.

### Utils (`backend/utils/`)

- `haversine.js` — straight-line distance between two `[lng,lat]` pairs.
- `osrm.js` — `osrmDurationMinutes()`, calls the self-hosted OSRM `/route`
  endpoint, returns `null` (not throws) if `OSRM_BASE_URL` unset/unreachable
  so callers fall back to haversine.
- `polyline.js` — `snapToPolyline()`, projects a raw GPS point onto the
  nearest segment of a route's polyline (pure geometry, no deps) so
  ETA/map-matching doesn't show the bus floating off-road.
- `nominatim.js` — `reverseGeocode()` for stall messages, hits public OSM
  Nominatim by default (set `NOMINATIM_BASE_URL` for a self-hosted instance).
- `fcm.js` — `sendPush()` via `firebase-admin`; **no-ops with a console
  warning** if `FIREBASE_SERVICE_ACCOUNT_JSON` isn't set — the rest of the app
  works fine without a real Firebase project.
- `cookies.js` — `parseCookies()`, manual cookie-header parser (used instead
  of adding the `cookie-parser` dependency).

### Scripts (`backend/scripts/`, run manually with `node scripts/<file>`)

- `seedDombivliRoute.js` — one-time seed of the single real route in this app
  ("Dombivli Test Route", Anantam Exit → Sangeeta Cycle Mart, 11 real-world
  stop coordinates). Polyline is initially just straight lines between stops.
- `regenerateRoutePolylines.js` — replaces every route's straight-line
  polyline with real OSRM road geometry (queries OSRM with all stops as
  waypoints, `overview=full&geometries=geojson`).
- `joinOriginBuildingToRoute.js` — extends the route polyline to start at a
  specific landmark ("Regency Anantam Build 19", hardcoded coords) by
  prepending it as an OSRM waypoint before the first stop — used to make the
  route visually connect into a gated residential complex's internal road
  network (see OSRM specifics below).

### OSRM specifics — why there's a custom Lua profile

`osrm-data/profiles/car-allow-private.lua` is a **modified copy** of OSRM's
stock `car.lua` — `private` was moved from `access_tag_blacklist` to
`access_tag_whitelist` (and cleared from `service_access_tag_blacklist`).
Reason: the stock profile hard-excludes `access=private` roads, but the
Regency Anantam complex's *actual* internal driveways are tagged
`access=private` in OSM — without this change, OSRM routes around the
complex via the public road instead of through it, which looked wrong.
**If the `.osrm` graph is ever rebuilt, it must use this profile, not the
stock one, or the route will visibly detour around the complex again.**

The `.osrm.*` files in `osrm-data/` are OSRM's compiled routing graph
(binary, machine-specific-ish — regenerate via the extract/partition/customize
pipeline above if OSM source data or the profile changes, don't hand-edit).

---

## Frontend (`frontend/src/`)

Next.js 14 App Router, client-heavy (`"use client"` on everything that
matters). Single page (`app/page.tsx`) that renders one of four full-screen
role apps based on `activeRole` state, plus a role-switcher and theme-toggle
overlay — this is a deliberate "one browser, switch hats" demo/dev UX, not
separate logins per device (see AppContext below for how auth still works
underneath that).

### `app/page.tsx`

Wraps everything in `<AppProvider>` (see `AppContext.tsx`), renders
`PassengerApp | DriverApp | ConductorApp | AdminApp` based on `activeRole`,
and owns the floating role-switcher + light/dark toggle UI (bottom-right
corner buttons). Waits for `mounted` before rendering to avoid SSR/client
hydration mismatch on theme.

### `components/AppContext.tsx` — the state/data hub, read this fully before changing behavior

Everything else (`PassengerApp`, `DriverApp`, `ConductorApp`, `AdminApp`,
`RealMap`) consumes this via `useApp()`. It owns:

- **Real data fetched from the backend on mount**: `routes` (with nested
  `stops` and road-geometry `polyline`), `buses` — via `lib/api.ts`.
- **Demo-account session bootstrap**: `DEMO_ACCOUNTS` maps each of the 4 roles
  to a fixed phone/name; on `activeRole` change, it calls `fetchMe()` first
  (restore existing cookie session), and if that doesn't match the active
  role, auto-registers/logs-in the demo account for that role
  (`loginOrRegisterDemoUser`). This is what makes the zero-friction role
  switcher compatible with real cookie-based auth — switching role in the UI
  = logging in as that role's demo account. `DEMO_PASSWORD` is a fixed
  local-only string, not a real secret.
- **Real-time socket connection**: opens once `currentUser` is set
  (`io(API_BASE_URL, {withCredentials: true})`), subscribes to every loaded
  route + the admin room if applicable, and wires `bus:position` /
  `trip:conversion-suggested` / `trip:converted` / `remark:new` /
  `admin:broadcast` into the same local state the rest of the UI reads.
- **`realTrackedTripIds` ref**: once a trip has received one real
  `bus:position` event, the client-side movement simulation (see below)
  permanently stops touching that trip — real GPS always wins.
- **Movement simulation fallback** (`setInterval`, 4s): linear-interpolates
  `currentLat/currentLng` toward the next stop for any *active* trip NOT in
  `realTrackedTripIds`. This is what makes the demo look alive with no real
  driver connected — it is intentionally still here, not a bug.
- **Action functions** (`startTrip`, `endTrip`, `sendRemark`,
  `confirmConversion`, `toggleFavorite`) each try the real backend call first
  (guarded by `MONGO_ID_RE` — a 24-hex-char check — since some ids in this
  app are fake/local, e.g. the very first render before real ids exist) and
  fall back to local-only state mutation on failure or on non-real ids. This
  means the UI never hard-breaks even if the backend is down, but real ids
  always take the real path when available.
- **Cross-tab sync via `BroadcastChannel`** (`'bus-tracker-sync'`): every
  local state mutation also posts a message so multiple browser tabs stay in
  sync. This predates the socket wiring and is now partially redundant with
  it for real users, but still useful (e.g. keeps the *local-only fallback*
  paths in sync across tabs, and syncs theme).
- **`emitDriverLocation(tripId, lat, lng, speed, heading)`** — thin wrapper
  that emits `driver:location` on the current socket; called from
  `DriverApp.tsx`'s geolocation watcher.
- **Favorites**: real backend wiring only covers *stop* favorites (the
  backend `Favorite` model is stop+route pairs); *route*-level favorites
  (`PassengerApp` also lets you star a whole route) stay local-only since
  there's no backend concept for that — `toggleFavorite` detects which case
  it is by looking up whether the id matches a known stop.

### `lib/api.ts`

Every backend HTTP call goes through the `request()` helper (adds
`credentials: 'include'` so cookies flow, throws on non-2xx). Exports:
`fetchRoutes`, `fetchStops`, `fetchBuses`, `fetchMe`, `login`, `register`,
`loginOrRegisterDemoUser`, `startTrip`, `endTrip`, `sendRemarkApi`,
`confirmConversionApi`, `fetchMyFavorites`, `addFavoriteApi`,
`removeFavoriteApi`. Types (`ApiRoute`, `ApiStop`, `ApiBus`, `ApiUser`,
`ApiTrip`) mirror the backend's Mongoose/SQLite response shapes.

### `lib/geo.ts`

Standalone `haversineKm`/`etaMinutes` — a deliberate small duplicate of the
backend's `utils/haversine.js` logic, since the frontend can't `require()` the
backend's CommonJS module across the process boundary.

### `components/RealMap.tsx` — the Leaflet map, shared by all 4 role apps

- Leaflet map (no Google Maps / Mapbox — free CartoDB tiles, Voyager for
  light theme, Dark Matter for dark). **Locked to a Dombivli-only bounding
  box** (`maxBounds`, `minZoom: 13`) matching the OSRM data's coverage area —
  can't zoom/pan out to a country/world view.
- Draws the route as its **real OSRM road geometry** (`polyline` prop, an
  array of `{lat,lng}`) when available, falling back to a dashed straight
  line between stops if not.
- Renders a fixed landmark marker for "Regency Anantam Build 19" (hardcoded
  coords) — the real-world route origin building, separate from bus stops.
- **Bus marker**: glides smoothly between position updates
  (`requestAnimationFrame`-driven linear interpolation, ~900ms) instead of
  snapping, and its heading rotation is "unwrapped" (tracks accumulated
  rotation so a 350°→10° turn animates as +20°, not a nearly-full spin) —
  this is the Uber/Rapido-style motion the user asked for. Rotation is
  applied via direct DOM manipulation on the icon's inner div (CSS
  `transition`) rather than recreating the Leaflet icon each update, which
  would kill the animation.
- **Progress trail**: on every bus position update, finds the nearest point
  on the route polyline to the bus and draws the traveled portion in a dimmed
  gray, leaving the road ahead in the solid brand color — same "behind vs.
  ahead" visual as ride-hailing apps.
- Props: `stops`, `polyline?`, `activeTrip?`, `userCoords?`, `height?`.

### The four role apps (`components/{Passenger,Driver,Conductor,Admin}App.tsx`)

All follow the same shape: local `useState` for UI-only concerns (active tab,
form fields, modals), pull shared state/actions from `useApp()`, render a
`RealMap` somewhere, theme-conditional Tailwind classes via `theme === 'dark' ? ... : ...`
throughout (no dark: variants, no CSS-in-JS).

- **PassengerApp**: home tab = map + bottom sheet (route search, checkpoint
  timeline with per-stop ETA), favorite stops/routes, announcements tab,
  profile tab (mostly decorative — avatar/name/settings are static, not real).
- **DriverApp**: start/end trip (now uses real `buses[0]`/`routes[0]` ids +
  `currentUser.id`, not hardcoded strings), route-conversion confirm modal on
  end, quick-remark buttons, **real GPS capture** via
  `navigator.geolocation.watchPosition` while a trip is active → calls
  `emitDriverLocation`, live map tab, trip history tab (**still fully
  hardcoded fake data**, not wired to real trips — untouched, low priority).
  ETA calculator card also still returns a **hardcoded static result**
  (`"07:31"`) regardless of input — untouched.
- **ConductorApp**: join-trip screen (bus selector now derived from real
  `buses[0]?.id`, was hardcoded `'bus-221'`), live map, remark form (photo
  attach UI is still decorative/no-op — no upload endpoint exists),
  passenger count +/-, manual stop check-in (GPS-fallback path), end trip
  with the same conversion modal as driver.
- **AdminApp**: fleet map, fleet stats grid (**still hardcoded fake numbers**
  — "127 active buses" etc., not bound to real data, untouched), remarks log
  (real data), route/stop manager (add-stop is real via `addStop` context
  function, but the drag-to-reorder handle is decorative/unwired), broadcast
  announcement (real, hits `/admin/broadcast`).

---

## What's real vs. mocked — the short version

**Fully real, tested end-to-end**: routes/stops fetch, buses fetch, cookie
auth (register/login/logout/me), Trip start/end, driver GPS → socket →
passenger map (glide animation + progress trail), remarks (post + live
socket delivery), route conversion confirm, admin broadcast, admin
analytics summary, stop favorites, OSRM-based real road-network ETA.

**Deliberately still mocked / local-only** (not bugs, just not this app's
current priority — see below for what's genuinely pending):
- Movement simulation fallback for trips without a real driver connected (by
  design, so the demo isn't static).
- Route-level favorites (no backend model for it).
- Driver's ETA calculator card (`DriverApp.tsx`) — static `"07:31"`.
- Driver's trip history tab — two fully hardcoded entries.
- Admin's fleet stat tiles — hardcoded numbers.
- Passenger count field — UI-only, no backend `Trip.passengerCount` field
  exists (the local `Trip` type in `AppContext.tsx` has it, backend doesn't).
- Remark photo attachment — decorative UI, no upload endpoint, no `Remark`
  photo field.
- Admin route/stop drag-to-reorder — decorative handle, not wired.

## Genuinely pending / not implemented at all

- No native background geolocation (Capacitor or similar) — only browser
  `watchPosition`, which stops when the tab/screen is backgrounded on mobile.
  Fine for testing on a computer; not fine for a real driver's phone in
  their pocket.
- No offline GPS-ping queueing if the driver's connection drops mid-trip.
- `bus:eta-update` socket event mentioned in the PRD is never emitted — ETA
  is pull-only (`GET /trips/:id/eta`), which the frontend doesn't currently
  call anywhere in the UI (no ETA display wired to the real endpoint yet —
  the visible "ETA" numbers in Passenger/Driver UI are simple heuristics,
  not this endpoint).
- No Redis Socket.IO adapter (fine at single-instance scale, would matter if
  ever deployed across multiple backend processes).
- No web-push/VAPID for iOS PWA (native FCM via `firebase-admin` works, but
  needs `FIREBASE_SERVICE_ACCOUNT_JSON` configured — currently unset, so push
  silently no-ops).
- No automated tests anywhere in the repo (backend or frontend) — every
  verification so far in this project's history has been manual curl/socket
  scripts run ad hoc, not committed test files.
- No CI/CD, no deployment config (Procfile, systemd, Docker, etc.) for either
  backend or frontend.

## Conventions worth knowing before editing

- Backend is CommonJS (`require`/`module.exports`), not ESM.
- Frontend is TypeScript, strict-ish (`tsconfig.json` — `npx tsc --noEmit` is
  the fast correctness check after any change, always run it).
- No test framework installed on either side — don't assume `npm test` does
  anything.
- Env vars are the only config mechanism; no config files beyond
  `config/constants.js` (backend) which just reads env vars with defaults.
- Geo coordinates: MongoDB/GeoJSON convention is `[lng, lat]` everywhere in
  the backend; the frontend's local types use `{lat, lng}` objects — every
  boundary conversion between the two conventions happens explicitly in
  `AppContext.tsx`'s `toStop`/`toRoute` functions and in `RealMap.tsx` — don't
  assume order, check which side of that boundary you're on.
- There is exactly one real seeded route in the database ("Dombivli Test
  Route"). Most of the UI implicitly assumes `routes[0]` is the relevant one
  (this is a single-route demo app, not a multi-route product yet).
