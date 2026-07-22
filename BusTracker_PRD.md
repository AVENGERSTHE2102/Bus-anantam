# Product Requirements Document: BusTracker

**Version:** 1.0
**Author:** Aditya (GrowSphere)
**Status:** Draft for build planning
**Stack:** Next.js (frontend/PWA) + Express (backend) + Capacitor (Android APK) + PWA (iOS)

---

## 1. Overview

BusTracker is a real-time bus tracking platform for a bus operator (college shuttle, city fleet, or private transport company). It provides live map-based location tracking, arrival time predictions, route-to-route bus conversion at terminus points, driver/conductor-reported traffic remarks, automated traffic-stall detection, and push notifications — across four distinct user roles: **Admin, Driver, Conductor, Passenger**.

### 1.1 Problem Statement
Passengers don't know where their bus is or when it will arrive. Bus operators have no visibility into fleet location, delays, or route status. There's no system to track how a single physical bus gets reassigned to a new route number once it completes a trip.

### 1.2 Goals
- Live GPS tracking of every active bus on a map, visible to passengers and admin.
- Accurate ETA for passengers at a given stop.
- Automatic and manual "bus re-numbering" when a bus reaches its terminus and starts a new route.
- Traffic/delay visibility via driver/conductor remarks + automated stall detection.
- Push + in-app notifications for arrival, delay, and route changes.
- Ship on Android (APK via Capacitor) and iOS (PWA/web) without paid map API bills at MVP scale.

### 1.3 Non-Goals (MVP)
- Payment/ticketing integration
- Seat booking/reservation
- Native iOS App Store binary (PWA only, for now)
- Multi-city/multi-operator SaaS (single-operator system first)

---

## 2. User Roles & Personas

| Role | Who | Primary Device | Core Need |
|---|---|---|---|
| **Admin** | Fleet/transport office manager | Web dashboard (desktop) | Oversee all buses, routes, drivers; manage assignments; view analytics |
| **Driver** | Bus driver | Android app (Capacitor APK) | Broadcast live location automatically; minimal-interaction UI (safety-first) |
| **Conductor** | On-bus conductor/attendant | Android app or PWA | Add remarks, confirm route/bus conversion at terminus, assist driver with reporting |
| **Passenger** | Commuter/student | Android app (APK) or iOS/desktop (PWA) | See buses on map, get ETA, get notified before arrival |

---

## 3. Core Feature Set

### 3.1 Admin
- Dashboard: live map of all active buses (color-coded by route/status).
- CRUD: Routes, Stops, Buses, Drivers, Conductors, Route-Bus assignment rules.
- Terminus conversion rules — define which route a bus becomes when it completes Route A and reaches End Location (e.g., Route 12 → Route 12R on return leg).
- View trip history, delay logs, remarks log per bus/route/day.
- Push manual broadcast announcements (e.g., "Route 5 suspended due to waterlogging").
- Analytics: on-time %, average delay by route, most-used stops.

### 3.2 Driver
- One-tap "Start Trip" / "End Trip" — starts/stops GPS broadcast for that route.
- Background location broadcast (works with screen off / app backgrounded) at a configurable interval (e.g., every 5–10s or on 20m movement, whichever first — to save battery/data).
- Large, glanceable current route + next stop display (minimal cognitive load while driving).
- Quick-tap remark buttons: "Heavy traffic," "Accident ahead," "Road blocked," "Running late," + optional voice-to-text note (conductor can also do this so driver isn't distracted).
- Automatic terminus detection: when the bus GPS enters the geofence of the route's End Location, driver is prompted to confirm "Start next trip as Route X?" (per admin-defined conversion rule) — one tap to confirm.

### 3.3 Conductor
- Same location visibility as driver (read-only map of own bus + route) but not the GPS source.
- Primary remark-entry UI (since driver shouldn't be typing while driving): traffic tags, free-text note, photo attachment (optional, e.g. of a blockage).
- Passenger count input (optional, for crowding indicator — stretch goal).
- Can confirm/override the bus's route conversion at terminus on the driver's behalf.

### 3.4 Passenger
- Live map: all buses on their route(s) shown as moving markers, updated in near real time.
- Per-stop ETA: "Bus arriving at Stop X in ~7 min," recalculated continuously from live GPS + road network, not a static timetable.
- "My ETA to bus" — reverse view: passenger shares/pins their location or selects their stop, sees countdown.
- Traffic/delay banner on a route: system-detected ("Bus stuck near Andheri Signal — delayed ~10 min") or driver/conductor-reported, shown inline on the map and as a notification.
- Push notification: "Bus arriving in 5 min at [stop]," "Route delayed," "Bus converted to Route 12R — new ETA."
- Favorite/pin frequently used stops and routes.

---

## 4. Real-Time Location & Tracking Architecture

### 4.1 Flow
```
Driver App (Capacitor Geolocation plugin)
   │  GPS coords every N seconds / M meters moved
   ▼
Express Backend (WebSocket ingest endpoint)
   │  validate + persist last-known position, compute speed/heading
   │  detect "stalled" state (speed ≈ 0 for > X min while trip active)
   ▼
Redis (or in-memory pub/sub) → broadcast channel per route
   │
   ▼
Socket.io rooms (one room per route / per bus)
   │
   ▼
Passenger clients subscribed to their route's room
   → map marker updates + ETA recompute
```

### 4.2 Why WebSockets over polling
Bus positions must feel "live." Socket.io (built on top of Express, using the same Node process or a dedicated realtime service) pushes position deltas to only the clients watching a given route — far cheaper than every passenger polling a REST endpoint every few seconds.

### 4.3 Location broadcast strategy (battery/data conscious)
- Adaptive interval: 5s while moving above walking speed, 15–20s if stationary >2 min, resume fast interval on movement.
- Send only delta payload: `{busId, lat, lng, heading, speedKmph, timestamp}`.
- Driver app uses Capacitor's `@capacitor/geolocation` (foreground) + a background geolocation plugin (e.g. `@capacitor-community/background-geolocation` or `cordova-plugin-background-geolocation` compatible fork) so tracking survives app backgrounding — critical since drivers won't keep the app in foreground all shift.

#### 4.3.1 Background Tracking Reliability (Android) — why it dies and how to prevent it
`@capacitor/geolocation` alone is foreground-only — it stops the moment the WebView is backgrounded or the screen locks, which is unacceptable for an 8-hour driving shift. To keep GPS pings flowing reliably:

1. **Use a real background-geolocation plugin**, not `@capacitor/geolocation`. It must run a native Android **foreground service** to survive backgrounding:
   - `@capacitor-community/background-geolocation` — standard choice, native foreground service under the hood.
   - `cordova-background-geolocation` (Transistor Software) — the most battle-tested option in production ride-share-style apps; free open-source tier is sufficient here, paid tier adds smarter motion-based battery optimization if needed later.
2. **Run it as a foreground service with a persistent notification.** Android requires a visible notification (e.g. "BusTracker is sharing your location") for any background location work — this is mandatory, not optional, and is how the OS lets the process survive instead of killing it. Both plugins above handle this automatically; just set the notification text/icon during setup.
3. **Request permissions explicitly and correctly:**
   - `ACCESS_FINE_LOCATION` **and** `ACCESS_BACKGROUND_LOCATION` — on Android 10+, background location is a *separate* runtime permission requested only after fine location is already granted (can't request both in one prompt).
   - On the system permission dialog, onboarding copy must steer the driver to **"Allow all the time"**, not "Allow only while using the app" — picking the latter is the single most common cause of tracking silently stopping mid-shift.
4. **Exempt the app from battery optimization.** Android's Doze mode/App Standby will throttle or kill location updates otherwise. Prompt the driver once during onboarding to disable battery optimization for the app (`Intent.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` via a plugin, or a manual settings deep-link). On OEM skins with their own aggressive battery managers (Xiaomi/MIUI, Oppo/ColorOS, Vivo, OnePlus), add a one-time onboarding screen linking drivers to that OEM's autostart/battery-whitelist settings — this is the most common real-world failure cause on non-Pixel/stock-Android phones.
5. **Buffer and retry on the client.** Treat every ping as best-effort: queue location pings in a small local buffer if the socket is disconnected (tunnel, dead zone, temporary signal loss) and flush them to the backend on reconnect, so a network dropout doesn't leave a permanent gap in the trip's position log.

Build-order note: swap in the background-geolocation plugin (item 1) first — it resolves the majority of drop-off cases on its own. Items 3 and 4 close the remaining gap that shows up on real driver phones in the field, especially non-stock-Android OEMs.

### 4.4 ETA computation
Two layers, so the app degrades gracefully:
1. **Fast/naive ETA (MVP):** straight-line distance from bus to stop ÷ recent average speed from GPS deltas. Cheap, works offline-of-routing-engine, decent for short hops.
2. **Road-network ETA (v1.1):** query a self-hosted **OSRM** instance with the bus's current position and the stop's coordinates along the actual route polyline, factoring real road distance instead of straight-line. Recompute every time a new GPS ping lands (or throttle to every 10–15s) and push updated ETA to subscribed passengers.

### 4.5 Bus → Route Conversion at Terminus
This is the "which bus becomes which route on arrival" requirement:
- Each **Route** has a defined `endLocation` (geofence, e.g. 100m radius).
- Admin defines a **Conversion Rule**: `Route A (arriving) → Route B (next assignment)` per terminus, per time-of-day if needed (e.g., last trip of the day → "Depot" instead of another route).
- Backend watches live GPS; when a bus carrying an active trip enters the terminus geofence, it flags `trip.status = "arrived"` and looks up the conversion rule.
- Driver/conductor gets a confirmation prompt (auto-suggested next route, one-tap accept or manual override).
- On confirm, backend closes the old trip, opens a new `Trip` record under the new Route, and re-publishes the bus under the new route's Socket.io room — passengers watching the old route see the bus "end," and passengers on the new route start seeing it live.
- If no confirmation within a grace window (e.g. 3 min) and admin has a default rule, auto-convert to avoid gaps in tracking.

### 4.6 Traffic Remarks & Automated Stall Detection
- **Manual remark:** driver/conductor picks a tag (Traffic / Accident / Roadblock / Breakdown / Other) + optional note; timestamped and geotagged to the bus's current position; pushed to passengers on that route as a banner + notification.
- **Automated system message:** backend-side rule — if a bus's GPS speed stays below a threshold (e.g. <3 km/h) for longer than X minutes (e.g. 5 min) while trip is active and not at a scheduled stop, auto-generate: *"[Route 12] Bus is stuck in traffic near [reverse-geocoded location name]. Estimated delay: ~N min."* This uses reverse geocoding (Nominatim, self-hosted or public instance, rate-limited) to turn coordinates into a human-readable place name.
- Remarks feed is visible to Admin (all routes), and filtered to Passenger by their subscribed route.

---

## 5. Notifications

| Trigger | Channel | Audience |
|---|---|---|
| Bus arriving within N min of passenger's stop | Push (FCM) + in-app | Passenger |
| Manual traffic/delay remark posted | Push + in-app banner | Passengers on that route |
| Automated stall detection fires | Push + in-app banner | Passengers on that route |
| Bus converted to new route at terminus | In-app (both old + new route subscribers) | Passenger |
| Admin broadcast/announcement | Push + in-app | All / route-filtered |
| Trip started/ended | In-app only | Admin dashboard |

**Implementation:** Firebase Cloud Messaging (FCM) — free, unlimited push notifications, works with Capacitor via `@capacitor/push-notifications`, and also supports web push for the PWA/iOS path. No paid tier needed at any realistic scale for this use case.

---

## 6. Tech Stack (Free-Tier-First)

| Layer | Choice | Why |
|---|---|---|
| Frontend web/PWA | **Next.js 14** | Already the team's stack; SSR for admin dashboard, static/PWA for passenger app |
| Backend/API | **Express** | Already the team's stack; simple REST + WebSocket server |
| Realtime | **Socket.io** (on Express) | Room-based pub/sub maps cleanly to "one room per route/bus"; free, self-hosted |
| Database | **PostgreSQL + PostGIS** | Free, open-source; PostGIS gives geofence/geo-distance queries (terminus detection, nearest-stop lookups) natively in SQL |
| Map rendering | **MapLibre GL JS** | MIT-licensed, no API key needed for rendering itself; drop-in Mapbox GL JS-compatible API, actively maintained (Linux Foundation project) — the correct 2026 default over Mapbox GL JS v2+, which is no longer free |
| Map tiles | **MapTiler Cloud (free tier)** or self-hosted **OpenMapTiles** | MapTiler's free plan gives 100,000 tile requests/month with no credit card required — plenty for MVP/pilot scale. If you outgrow it, OpenMapTiles + a self-hosted tile server (e.g. TileServer GL) on your own infra is a fully free fallback using OpenStreetMap data |
| Routing/ETA engine | **OSRM (Open Source Routing Machine)**, self-hosted | Free, extremely fast (pre-processed contraction hierarchies), runs on your own server against an OSM extract of your city — no per-request billing at all, unlike Google Directions API |
| Geocoding (place names for "stuck near X") | **Nominatim** (self-hosted or public OSM instance, rate-limited) | Free, OSM-based reverse geocoding |
| Push notifications | **Firebase Cloud Messaging (FCM)** | Free at any volume, works across Android (Capacitor) and web push (iOS PWA) |
| Driver background GPS | Capacitor + `@capacitor/geolocation` + a background-geolocation plugin | Needed so tracking survives app backgrounding on Android |
| Android packaging | **Capacitor** | Already decided — wraps the Next.js PWA into an APK |
| iOS | **PWA** (Add to Home Screen) | Already decided — avoids App Store review/cost for MVP; web push via FCM covers notifications |
| Hosting (MVP) | Any low-cost VPS (Render/Railway/Fly.io free-to-cheap tiers) or a college/dept server | Keeps infra cost near-zero for pilot phase |

**Why not Google Maps here:** Google Maps Platform's free tier shrank in the 2026 pricing restructure (~28,500 free map loads/month vs. Mapbox's 50,000), and it requires a credit card plus usage-based billing that's easy to accidentally exceed. Since this system needs continuous polling-adjacent behavior (many passengers, live buses, frequent ETA recalculation), a self-hosted-friendly, no-per-request-cost stack (MapLibre + OSRM + OSM tiles) is the right fit to genuinely stay free as usage grows, rather than just at launch.

---

## 7. Data Model (Core Entities)

```sql
-- Users (all 4 roles share one table, differentiated by role)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','driver','conductor','passenger')),
    password_hash TEXT,
    fcm_token TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Buses (physical vehicles)
CREATE TABLE buses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number TEXT UNIQUE NOT NULL,
    capacity INT,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle','active','maintenance'))
);

-- Routes
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,              -- e.g. "Route 12"
    start_location GEOGRAPHY(POINT),
    end_location GEOGRAPHY(POINT),
    polyline GEOMETRY(LINESTRING, 4326), -- for road-aware ETA + geofencing
    active BOOLEAN DEFAULT true
);

-- Stops (ordered per route)
CREATE TABLE stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id),
    name TEXT NOT NULL,
    location GEOGRAPHY(POINT) NOT NULL,
    sequence_order INT NOT NULL
);

-- Route conversion rules (terminus -> next route)
CREATE TABLE route_conversion_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_route_id UUID REFERENCES routes(id),
    to_route_id UUID REFERENCES routes(id),
    time_window TEXT -- optional, e.g. 'weekday_evening', null = always
);

-- Trips (a bus actively running a route)
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id UUID REFERENCES buses(id),
    route_id UUID REFERENCES routes(id),
    driver_id UUID REFERENCES users(id),
    conductor_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active','arrived','completed','cancelled')),
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ
);

-- Live position log (append-only, latest row per trip = current position)
CREATE TABLE bus_positions (
    id BIGSERIAL PRIMARY KEY,
    trip_id UUID REFERENCES trips(id),
    location GEOGRAPHY(POINT) NOT NULL,
    speed_kmph NUMERIC,
    heading NUMERIC,
    recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Remarks (manual + automated)
CREATE TABLE remarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id),
    source TEXT CHECK (source IN ('driver','conductor','system')),
    tag TEXT, -- 'traffic','accident','roadblock','breakdown','other'
    message TEXT,
    location GEOGRAPHY(POINT),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable geo indexing for fast nearest-stop / geofence queries
CREATE INDEX idx_bus_positions_location ON bus_positions USING GIST (location);
CREATE INDEX idx_stops_location ON stops USING GIST (location);
```

---

## 8. API Surface (high-level)

### REST (Express)
- `POST /auth/login` — role-aware login
- `GET /routes`, `GET /routes/:id/stops`
- `POST /admin/routes`, `POST /admin/conversion-rules` (admin only)
- `POST /trips/start`, `POST /trips/:id/end` (driver/conductor)
- `POST /trips/:id/confirm-conversion` (driver/conductor)
- `POST /trips/:id/remarks` (driver/conductor)
- `GET /trips/:id/eta?stopId=` (passenger)
- `GET /admin/analytics/*` (admin)

### WebSocket (Socket.io events)
- `driver:location` (driver → server) — `{tripId, lat, lng, speed, heading}`
- `bus:position` (server → passenger room) — live marker update
- `bus:eta-update` (server → passenger room)
- `remark:new` (server → passenger room + admin)
- `trip:converted` (server → old + new route rooms)
- `admin:broadcast` (server → all/filtered)

---

## 9. Non-Functional Requirements

- **Battery/data efficiency:** adaptive GPS ping interval (Section 4.3); avoid draining driver phones over an 8+ hour shift.
- **Offline resilience:** driver app queues location pings locally if network drops, flushes on reconnect (don't lose trip continuity in tunnels/dead zones).
- **Scalability:** Socket.io rooms scoped per route keep fan-out proportional to riders-per-route, not total riders; Redis adapter for Socket.io if scaling beyond a single Node instance.
- **Security:** role-based JWT auth; drivers can only push location for their own active trip; passengers are read-only.
- **Accuracy tolerance:** GPS drift handled by snapping bus position to the route polyline (map-matching) before computing ETA, so buses don't appear to teleport off-road.

---

## 10. Suggested Build Phases

1. **Phase 1 (MVP):** Auth (4 roles), route/stop CRUD, driver location broadcast, live map for passengers, naive straight-line ETA.
2. **Phase 2:** OSRM-based road-network ETA, manual remarks, FCM push notifications.
3. **Phase 3:** Terminus geofencing + route conversion flow, automated stall detection + reverse geocoding.
4. **Phase 4:** Admin analytics dashboard, offline queueing, map-matching for GPS smoothing.

---

## 11. Open Questions for Admin/Stakeholder Input
- How many buses/routes at pilot launch? (affects whether self-hosted OSM tiles are worth setting up vs. staying on MapTiler's free 100k/month tier)
- Is a city-wide OSM extract available/needed for OSRM, or campus/local-area only?
- Should passengers need to log in, or is anonymous route-subscription acceptable for MVP?
