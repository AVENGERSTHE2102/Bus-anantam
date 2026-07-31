# BusTracker — Technologies & Stack Documentation

Welcome to the comprehensive technology guide for **BusTracker**, a real-time public transit tracking and management ecosystem designed for fixed-route suburban bus networks. This document details all frameworks, libraries, database engines, routing pipelines, and deployment tools powering the platform.

---

## 🏗️ High-Level Architectural Overview

BusTracker is built using a decoupled monorepo architecture, combining a **Next.js frontend**, an **Express + Node.js backend**, a **hybrid dual-database strategy**, a self-hosted **OSRM routing engine**, and an **Android native wrapper**.

```mermaid
flowchart TD
    subgraph Client Layer
        Web[Next.js 14 App Router]
        Mobile[Capacitor 8 Android App]
    end

    subgraph Backend Layer
        API[Express 4 HTTP REST API]
        WS[Socket.IO Server]
        Jobs[Background Job Scheduler]
    end

    subgraph Data & Routing Layer
        Mongo[(MongoDB Atlas / Geo 2dsphere)]
        SQLite[(SQLite node:sqlite / Identity DB)]
        OSRM[OSRM Container / Docker MLD]
        FCM[Firebase Admin / Push Notifications]
    end

    Client Layer <-->|HTTP Cookies / Socket.IO| Backend Layer
    Backend Layer <-->|Geospatial & Operations| Mongo
    Backend Layer <-->|User Auth & Favorites| SQLite
    Backend Layer <-->|Route Polylines & ETA| OSRM
    Backend Layer -->|Notifications| FCM
```

---

## 🎨 Frontend Stack (`frontend/`)

The frontend application serves four distinct role-based interfaces (**Passenger**, **Driver**, **Conductor**, and **Admin**) within a unified, responsive client interface.

| Technology | Version | Category | Role / Description |
| :--- | :--- | :--- | :--- |
| **Next.js** | `14.2.35` | Core Framework | React Framework using App Router for server/client component separation |
| **React** | `18.x` | UI Library | Component-driven user interface engine |
| **TypeScript** | `^5.x` | Type Safety | Strict type definitions across pages, components, and API helpers |
| **Tailwind CSS** | `^3.4.1` | Styling | Utility-first CSS framework for custom responsive design |
| **PostCSS** | `^8.x` | CSS Processing | Processes Tailwind CSS directives and vendor prefixing |
| **Lucide React** | `^1.25.0` | Iconography | Lightweight, consistent iconography set |
| **Leaflet** | `^1.9.4` | Mapping Engine | Interactive map rendering, custom SVG bus markers, and polyline visualization |
| **Socket.IO Client** | `^4.8.3` | Real-Time Sync | WebSockets client operating with `withCredentials: true` for httpOnly cookies |

### 📱 Mobile Native Integration (Android)

For driver background tracking and mobile passenger UX, the frontend is compiled into a native Android application using Capacitor.

* **Capacitor Core & Android (`@capacitor/core`, `@capacitor/android ^8.4.2`)**: Wraps Next.js static exports into a native Android WebApp.
* **Capgo Background Geolocation (`@capgo/background-geolocation ^8.3.1`)**: Enables continuous foreground/background GPS tracking for driver devices during active trips.
* **Capacitor Geolocation (`@capacitor/geolocation ^8.2.0`)**: Standard location provider for passenger UI map centering.
* **Capacitor Preferences (`@capacitor/preferences ^8.0.1`)**: Native key-value persistence for app settings.

---

## ⚙️ Backend Stack (`backend/`)

The backend is a Node.js process providing REST APIs, WebSocket events, session security, and background job loops.

| Technology | Version | Category | Role / Description |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v20+` | Runtime | Server-side JavaScript execution engine |
| **Express.js** | `^4.19.2` | Web Framework | Handles REST endpoints, CORS origin checks, and middleware |
| **Socket.IO** | `^4.7.5` | Real-Time WebSockets | Bi-directional event communication for live location feeds and incident alerts |
| **JSON Web Token (JWT)** | `^9.0.2` | Authentication | Stateless session authentication delivered via `httpOnly` secure cookies |
| **bcryptjs** | `^2.4.3` | Cryptography | Secure password hashing (`saltRound = 10`) |
| **Cors** | `^2.8.5` | Middleware | Credentials-aware Origin whitelisting and protection |
| **Dotenv** | `^16.4.5` | Environment | Environment variable loader |
| **Firebase Admin SDK** | `^12.3.1` | Push Notifications | Direct integration with Firebase Cloud Messaging (FCM) for trip updates |

---

## 💾 Dual-Database Data Persistence System

BusTracker uses a **hybrid database architecture** that explicitly splits operational data from sensitive user identity data:

```
                      ┌─────────────────────────────────────────┐
                      │             Backend Server              │
                      └────┬───────────────────────────────┬────┘
                           │                               │
                           ▼                               ▼
     ┌───────────────────────────────────┐   ┌───────────────────────────┐
     │          MongoDB Cluster          │   │      SQLite Local DB      │
     ├───────────────────────────────────┤   ├───────────────────────────┤
     │ • Buses & Active Routes           │   │ • User Accounts (Auth)    │
     │ • Bus Stops (GeoJSON 2dsphere)    │   │ • Passenger Favorites     │
     │ • Live Trip Coordinates           │   │ • UUID Identity Isolation │
     │ • Incident Remarks & Logs         │   │ • Local File: data/app.db │
     └───────────────────────────────────┘   └───────────────────────────┘
```

1. **MongoDB Atlas (Geospatial & Operational Storage)**
   * **ODM**: Mongoose (`^8.5.0`)
   * **Geospatial Indexing**: Utilizes `2dsphere` indexes on `Route.endLocation`, `Stop.location`, and `Trip.lastPosition.location` for fast geographic proximity and map calculations.
   * **Collections**: `Bus`, `Route`, `Stop`, `Trip`, `Remark`, `RouteConversionRule`.

2. **SQLite (Local Identity & Privacy Storage)**
   * **Driver**: Node.js Native Module (`node:sqlite` via `DatabaseSync`)
   * **Location**: Local disk database stored at `backend/data/app.db` (gitignored).
   * **Query Abstraction**: Custom query builder (`config/sqliteQuery.js`) providing a Mongoose-like interface (`find`, `findOne`, `create`, `$in`, `$nin`, `$ne`).
   * **Collections**: `User`, `Favorite`.

> [!NOTE]
> `User` IDs in SQLite are generated as random UUIDs (`crypto.randomUUID()`). To maintain compatibility, `Trip.driverId` and `Trip.conductorId` in Mongo schemas are explicitly stored as `String` rather than `ObjectId`.

---

## 🗺️ Geospatial & Routing Infrastructure

BusTracker replaces straight-line estimations with real road-network navigation powered by a dedicated **OSRM (Open Source Routing Machine)** instance.

```
OpenStreetMap (.osm) ──> OSRM Extract (Lua Profile) ──> Partition & Customize ──> OSRM Routed Server (Port 5050/5000)
```

* **Routing Engine**: OSRM MLD (Multi-Level Dijkstra) engine.
* **Custom Lua Profile (`car-allow-private.lua`)**: Tailored profile accommodating suburban road restrictions, private lanes, and bus maneuver rules.
* **API Integration**: REST endpoint requests (`/route/v1/driving/...`) providing real-time polyline geometries, road distances, and traffic-adjusted ETA calculations.
* **Docker Container (`Dockerfile.osrm`)**: Self-contained Alpine-based OSRM container serving preprocessed routing graph data for deployment.

---

## 🚀 Deployment & DevOps

* **Render (Backend & Routing Engine)**:
  * Backend deployed as a **Node.js Web Service**.
  * OSRM deployed as a **Private Docker Service** using `Dockerfile.osrm`.
* **Mobile Compilation**: Android APK / App Bundle generation via `npx cap sync android` and Gradle.
* **Package Management**:
  * Independent `package.json` configurations in `frontend/` and `backend/`.
  * `patch-package` (`^8.0.1`) for local node_module customizations.

---

## 📋 Summary Table

| Layer | Primary Technology | Supplementary Tools |
| :--- | :--- | :--- |
| **Frontend UI** | Next.js 14, React 18, TypeScript | Tailwind CSS, Lucide React |
| **Maps & Location** | Leaflet 1.9, Capgo Background Geolocation | Custom SVG Markers, Polylines |
| **Native Mobile** | Capacitor 8 (Android) | Android Studio, Capacitor CLI |
| **Backend API** | Node.js, Express.js | CORS, httpOnly Cookie JWT Auth |
| **Real-time Engine** | Socket.IO Server & Client | WebSocket transport fallback |
| **Geospatial DB** | MongoDB Atlas (2dsphere Mongoose) | Mongoose ODM |
| **Identity DB** | SQLite (`node:sqlite`) | Custom Mongoose query emulator |
| **Routing Engine** | OSRM MLD (Docker) | OpenStreetMap, Custom Lua Profile |
| **Push Service** | Firebase Admin SDK | Firebase Cloud Messaging (FCM) |
| **Cloud Hosting** | Render | Docker, Render Private Services |
