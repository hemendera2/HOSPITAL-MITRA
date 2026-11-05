# Hospital Mitra — Project Status & Continuation Guide

> **For new chats / AI agents:** Read this file FIRST to understand where the
> project stands and what to do next. Everything below is up to date as of the
> last commit on this branch.

## What is this?

A production-oriented **Android-first indoor hospital navigation platform** for
Kota, Rajasthan (→ India-wide). Three components:

| Component | Stack | Status |
|-----------|-------|--------|
| `backend/` | Node.js + TypeScript + SQLite (Postgres-ready schema) | **COMPLETE & TESTED** (29/29 tests pass) |
| `admin-dashboard/` | React 18 + TypeScript + Vite 5 | **COMPLETE & BUILT** (tsc clean, vite build succeeds) |
| `patient-app/` | Flutter + Dart | **IN PROGRESS** (engine done, screens done, not yet compiled — no Flutter SDK in sandbox) |

## Branch

`arena/3aabb8b1-hospital-mitra` — always work on this branch. Push to it.

## Backend — COMPLETE ✅

- **Server:** `cd backend && node --import tsx src/index.ts` → port 8787
- **Tests:** `cd backend && node --import tsx --test tests/routing.test.ts tests/api.test.ts` → 29/29 pass
- **Demo credentials:** `super@mitra.demo` / `Mitra@Admin2026` (super_admin, platform-wide `*` perms)
- **Smoke test:** `curl http://localhost:8787/health`, `/api/patient/hospitals`,
  `/api/auth/login` (POST email+password), route POST `/api/patient/hospitals/:id/route`
- **Key files:**
  - `backend/src/map/graph.ts` — Dijkstra/A* routing engine (TS reference)
  - `backend/src/routes/patient.ts` — patient-facing API
  - `backend/src/routes/maps.ts` — admin map digitization API
  - `backend/src/db/schema.ts` + `db/schema.sql` + `db/seeds/demo_data.sql` — schema & DEMO data
  - `backend/src/auth/rbac.ts` — RBAC permissions

## Admin Dashboard — COMPLETE ✅

- **Dev server:** `cd admin-dashboard && npx vite --host 0.0.0.0 --port 5173` → port 5173
- **Build:** `cd admin-dashboard && npx tsc -b && npx vite build` → clean
- **API proxy:** `/api` → `http://localhost:8787` (via `VITE_API_TARGET` env or default)
- **7 pages:** Login, Dashboard, Hospitals (list+form), HospitalDetail (8 tabs),
  MapEditor (SVG canvas — digitize nodes/edges, calibrate, verify, publish, route-test),
  Feedback (review), Audit (log), Users (admin+roles)
- **Key files:**
  - `admin-dashboard/src/lib/api.ts` — typed API client + all domain types
  - `admin-dashboard/src/store/auth.tsx` — auth + RBAC (`can(perm)`)
  - `admin-dashboard/src/pages/MapEditor.tsx` — SVG map digitization editor

## Patient App (Flutter) — IN PROGRESS 🔨

### Already built (not yet compiled — no Flutter SDK in sandbox):

- **Routing engine** (`lib/engine/routing/graph.dart`) — pure Dart, mirrors
  `backend/src/map/graph.ts` exactly. Dijkstra/A*, multi-floor vertical lift/stair,
  wheelchair filtering, EN+HI turn instructions. **Unit-tested** (`test/router_test.dart`
  mirrors `backend/tests/routing.test.ts`).
- **Models** (`lib/models/hospital.dart`) — Hospital, Building, Floor, Room,
  SearchResult, QrLocation, OfflineBundle, OfflineFloor
- **Services** (`lib/services/api_service.dart`, `lib/services/offline_store.dart`)
  — typed API client + SQLite offline cache
- **Core** (`lib/core/`) — app_theme.dart (light/dark/high-contrast),
  l10n.dart (EN/HI strings), app_state.dart (provider state), routes.dart (MapArgs)
- **10 screens** (`lib/screens/`):
  1. `home_screen.dart` — hospital selection, search, bottom-nav shell
  2. `hospital_detail_screen.dart` — buildings, floors, offline download
  3. `floors_screen.dart` — floor grid for a building
  4. `search_screen.dart` — department/doctor/room/lab search
  5. `indoor_map_screen.dart` — SVG floor map, route overlay, start/end selection
  6. `navigation_screen.dart` — turn-by-turn steps, voice toggle, reroute
  7. `offline_screen.dart` — manage downloaded offline maps
  8. `accessibility_screen.dart` — large text, high contrast, wheelchair, voice, Hindi
  9. `emergency_screen.dart` — emergency contacts (108/100), disclaimer, emergency nav
  10. `qr_screen.dart` — QR scanner (mobile_scanner package)
  11. `feedback_screen.dart` — report corrections
- **Widget** (`lib/widgets/step_card.dart`) — turn-by-turn step display
- **Entry** (`lib/main.dart`) — MaterialApp + bottom-nav shell + named routes

### Still needed:

1. **Compile & test** — install Flutter SDK, run `dart analyze`, `flutter test`,
   `flutter build apk`
2. **Unit tests** — `test/router_test.dart` is written but unverified (no Dart SDK)
3. **Screenshot/UI verification** — visual walkthrough
4. **Assets** — `assets/l10n/` and `assets/images/` dirs referenced in pubspec (empty)
5. **Icon set** — app icons not yet created
6. **Documentation** — deployment docs, README updates

### To run locally (requires Flutter SDK):

```bash
cd patient-app
flutter pub get
dart analyze          # type check
flutter test          # run router_test.dart
flutter run           # hot reload
```

The backend must be running on port 8787 (or set `ApiService` baseUrl).
For Android emulator, default `10.0.2.2:8787` reaches the host.

## Key Design Decisions

- **Honest DEMO labeling:** All sample data marked `is_demo=true`. The 4 real Kota
  hospitals are registered but their indoor maps are NOT fabricated — they remain
  `unmapped` until verified on-site.
- **No fake locations:** Location provenance (QR / GPS / manual) is always labeled.
- **No PII:** QR identifiers are opaque tokens; no patient tracking by default.
- **Publish gate:** Maps must be verified + published before the patient app sees them.
- **Accessibility-first:** Wheelchair routes, large text, high contrast, voice
  directions (EN/HI), senior-friendly mode.
- **Offline-first:** SQLite cache for downloaded hospital bundles; app works without
  internet after download.

## Test Summary

- Backend: **29/29 pass** (10 routing + 19 API)
- Admin dashboard: tsc clean, vite build succeeds
- Patient app: Dart tests written but unverified (no Flutter SDK in sandbox)

## File Map (quick reference)

```
HOSPITAL-MITRA/
├── .gitignore
├── PROGRESS.md                    ← THIS FILE
├── README.md
├── backend/                       ← Node.js + TS API (COMPLETE)
│   ├── src/
│   │   ├── map/graph.ts           ← TS routing engine (reference)
│   │   ├── routes/                ← API route handlers
│   │   ├── db/                    ← schema, repos, seed
│   │   └── auth/                  ← JWT, RBAC
│   └── tests/                     ← routing.test.ts, api.test.ts
├── admin-dashboard/               ← React TS dashboard (COMPLETE)
│   └── src/
│       ├── pages/                 ← 7 pages
│       ├── store/                 ← auth, theme
│       └── lib/api.ts             ← typed API client
├── patient-app/                   ← Flutter app (IN PROGRESS)
│   ├── lib/
│   │   ├── engine/routing/graph.dart  ← Dart routing engine (mirrors TS)
│   │   ├── models/hospital.dart       ← data models
│   │   ├── services/                  ← API client + offline store
│   │   ├── core/                      ← theme, l10n, state, routes
│   │   ├── screens/                   ← 11 screens
│   │   ├── widgets/step_card.dart     ← step display
│   │   └── main.dart                  ← entry + shell
│   ├── test/router_test.dart          ← Dart routing tests
│   └── pubspec.yaml
└── db/
    ├── schema.sql                 ← Postgres schema
    ├── rls_policies.sql           ← row-level security
    └── seeds/demo_data.sql        ← DEMO data
```
