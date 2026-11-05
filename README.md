# Hospital Mitra

**Android-first indoor hospital navigation platform** — helps patients and
visitors find departments, doctors, labs, pharmacies, and rooms inside hospitals,
with turn-by-turn directions, multi-floor routing, wheelchair-accessible paths,
QR-based location pinning, offline support, and an admin dashboard for map
management.

Built for Kota, Rajasthan → India-wide.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Flutter App    │     │  Node.js Backend  │     │  React Dashboard │
│  (Patient)      │◄───►│  (API + Routing)  │◄───►│  (Admin)         │
│  Android/iOS    │     │  SQLite/Postgres  │     │  Browser         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   SQLite (offline)        Indoor nav graph       SVG map editor
   QR scanning             Dijkstra/A* routing    Verify & publish
```

| Component | Stack | Path | Status |
|-----------|-------|------|--------|
| **Backend API** | Node.js + TypeScript | `backend/` | ✅ 29/29 tests |
| **Admin Dashboard** | React 18 + TS + Vite | `admin-dashboard/` | ✅ Builds & runs |
| **Patient App** | Flutter + Dart | `patient-app/` | 🔨 In progress |
| **Database** | Postgres schema (SQLite dev) | `db/` | ✅ Schema ready |

---

## Quick Start

### 1. Backend

```bash
cd backend
npm install
npm run dev          # or: node --import tsx src/index.ts
# → http://localhost:8787
```

Tests:
```bash
cd backend
npm test             # 29/29 pass
```

Demo admin login: `super@mitra.demo` / `Mitra@Admin2026`

### 2. Admin Dashboard

```bash
cd admin-dashboard
npm install
npm run dev          # → http://localhost:5173
```

The dashboard proxies `/api` → `http://localhost:8787`. Set `VITE_API_TARGET`
to override the backend URL.

### 3. Patient App (Flutter)

Requires Flutter SDK 3.19+:

```bash
cd patient-app
flutter pub get
dart analyze
flutter test
flutter run           # Android emulator: 10.0.2.2:8787 → host backend
```

---

## Features

### Patient App
- Hospital selection & search (city, district)
- Indoor floor map with SVG rendering (zoom, pan)
- Turn-by-turn navigation with EN + HI instructions
- Multi-floor routing via lifts/stairs
- Wheelchair-accessible route filtering
- QR code location scanning
- Offline map download & cache (SQLite)
- Accessibility: large text, high contrast, voice directions
- Emergency navigation (108 / 100) with safety disclaimer
- Feedback submission for map corrections

### Admin Dashboard
- Hospital CRUD (platform-wide or per-hospital scope)
- Building, floor, room, department, doctor, facility management
- **SVG Map Editor** — digitize navigation nodes & edges on a floor plan
- Calibration (scale, origin, rotation)
- Map verification & publish workflow
- Route tester (start → end, shows steps, distance, accessibility)
- Feedback review & resolution
- Audit log
- User & role management (RBAC)
- Light/dark theme

### Backend
- JWT authentication with RBAC
- Graph-based routing (Dijkstra / A*) with multi-floor vertical edges
- Wheelchair accessibility filtering
- QR location resolution
- Offline bundle generation
- Patient feedback submission
- Map versioning with verify/publish workflow
- Postgres schema with RLS policies (SQLite for dev)

---

## Design Principles

- **Honest DEMO data:** All sample data is marked `is_demo=true`. Real Kota
  hospitals are registered but their indoor maps are NOT fabricated — they stay
  `unmapped` until verified on-site.
- **No fake locations:** Location provenance (QR / GPS / manual) is always labeled.
- **No PII:** QR identifiers are opaque tokens. No patient tracking by default.
- **Publish gate:** Maps must be verified + published before patients see them.
- **Accessibility-first:** Wheelchair routes, large text, high contrast, voice
  directions (EN/HI), senior-friendly mode.
- **Offline-first:** SQLite cache for downloaded hospital bundles.

---

## Project Status

See [`PROGRESS.md`](PROGRESS.md) for detailed status, file map, and continuation
guide for new developers or AI agents.

---

## License

MIT (open source, no paid services).
