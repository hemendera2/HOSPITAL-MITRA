# Hospital Mitra — Kota Hospital Intelligence & 3D Mapping Platform
## Progress Report — 2026-11-05

### Overview
This document tracks the implementation status of the Hospital Mitra platform
transformation from an indoor navigation demo into a complete Kota hospital
intelligence and 3D indoor mapping platform.

---

## Phase Status

### Phase 1: Kota Hospital Research — ✅ COMPLETED
Research conducted on all major Kota hospitals via web search. Findings:

| Hospital | Address | Beds | Floor Plan? | Verification |
|---|---|---|---|---|
| MBS Hospital (GMC Kota) | Rangbari Road, Nayapura, 324005 | 750 | No | PUBLIC_SOURCE |
| New Medical College Hospital | Rangbari Road, Ghantaghar, 324006 | — | No | PUBLIC_SOURCE |
| Super Speciality Block | GMC Kota campus, Rangbari Road | — | No | PUBLIC_SOURCE |
| Rampura Satellite Hospital | 5RQR+57J, Rampura, 324001 | 50 | No | PUBLIC_SOURCE |
| Kota Heart Institute | 10-A Talwandi, NH-12, 324005 | 100 | **YES** — 5 floors | OFFICIAL_SOURCE |
| Fortis Modi Hospital | Swami Vivekanand Nagar, 324010 | 200 | No | PUBLIC_SOURCE |
| JK Lone Hospital | Mahaveer Nagar III, 324005 | — | No | PUBLIC_SOURCE |

Additional: 12 government hospitals catalogued (list of names + districts).
Kota healthcare: 507 private hospitals, 12 government, 335 diagnostic centres.

**Key finding**: Kota Heart Institute (KOH) is the only hospital with a
documented floor-by-floor layout from an official source (their website).
All other hospitals lack publicly available floor plans.

### Phase 2: Structured Intelligence Database — ✅ COMPLETED (TypeScript module)
Created `admin-dashboard/src/data/kota-hospitals.ts` with:
- Typed interfaces: `VerificationStatus`, `SourceRecord`, `RoomRecord`,
  `FloorRecord`, `BuildingRecord`, `KotaHospitalRecord`
- 6 hospital records with full metadata
- KOH: 5 floors, 20+ rooms with room numbers, Hindi names, department categories,
  accessibility, operating hours, verification status
- 5 directory-only records with address, coords, phone, sources, missing-data lists
- `DEPARTMENT_COLORS` mapping for 3D/2D visualization

**NOT YET**: Backend Postgres schema migration for these tables (Batch 3).

### Phase 3: 3D Hospital Maps — ✅ COMPLETED (Admin dashboard)
Created `Hospital3DMap.tsx` using React Three Fiber:
- Isometric/perspective 3D room boxes with department colours
- Floor slabs, corridor rendering
- Room labels with Hindi + English names
- Explode view (vertical separation per floor)
- OrbitControls for camera rotation/zoom
- Environment lighting, contact shadows
- Click-to-select rooms with detail panel

Created `FloorPlan2D.tsx` as SVG fallback for low-end devices.

### Phase 4: Map Data Generation — ⚠️ PARTIAL
- KOH floor plan structured from official website description
- No PDF/CAD import pipeline yet (requires admin editor UI)
- Missing-data reports created for 5 hospitals
- Survey template not yet created

### Phase 5: Indoor Navigation — ⚠️ PARTIAL (Demo)
- Navigation graph built with Dijkstra/A* (`src/lib/navigation.ts`)
- Route calculation between entrance and destination rooms
- Turn-by-turn instructions in English + Hindi
- Wheelchair-accessible route filtering
- QR-based location lookup (`src/lib/qr.ts`)
- **Limitation**: Only KOH has room-level graph; other hospitals have no
  walkable connections (correctly — no fabricated data)

### Phase 6: Patient Experience — ✅ COMPLETED (Admin dashboard preview)
Created `PatientMap.tsx` with:
- Hospital selector cards with bed count + verification badges
- 3D/2D map toggle
- Floor filter buttons
- Search by department/room/facility (Hindi + English)
- Room detail panel with Hindi names, hours, accessibility
- "Navigate Here" button
- Route display
- Source attribution panel
- Large text, clear icons, department colour legend

**NOT YET**: Flutter Android app with same experience.

### Phase 7: Admin Map Management — ⚠️ PARTIAL
- Existing MapEditor page for floor plan drawing
- Hospital CRUD in admin dashboard
- **Missing**: Full verification workflow (submit→review→approve→publish),
  source management UI, duplicate detection, completeness reports

### Phase 8: Research Automation — ⚠️ NOT STARTED
- No PDF/CAD/image import pipeline
- No OCR integration
- No CSV/JSON batch import
- No research report generator

### Phase 9: QA — ✅ PARTIAL
- ✅ 29 backend tests pass (navigation, routing, auth, edge cases)
- ✅ TypeScript compiles cleanly (admin dashboard)
- ✅ Production build succeeds (616 modules, code-split)
- ✅ 3D renderer builds without errors
- ⚠️ Flutter tests NOT run (no Flutter SDK in sandbox)
- ⚠️ No Android device/emulator testing
- ⚠️ No accessibility audit (WCAG)

### Phase 10: Execution Order — ✅ IN PROGRESS

| Batch | Status | Notes |
|---|---|---|
| 1 — Audit | ✅ | Codebase audited, architecture mapped |
| 2 — Research | ✅ | 6 hospitals researched, sources recorded |
| 3 — Data architecture | ⚠️ | TypeScript module done; Postgres schema pending |
| 4 — Map renderer | ✅ | R3F 3D + SVG 2D renderer built |
| 5 — Evidence-backed locations | ✅ | KOH room-level; 5 hospitals directory-only |
| 6 — Connect to search/navigation | ⚠️ | PatientMap page built; Flutter app pending |
| 7 — Admin editor | ⚠️ | Existing MapEditor; full workflow pending |
| 8 — Android/offline/perf | ⚠️ | Not started |
| 9 — Regression + report | ⚠️ | Partial; this document |

---

## What Works Today

### Admin Dashboard (http://localhost:5173)
- Login with admin credentials
- Dashboard with hospital overview
- Hospital list with 6 Kota hospitals
- Hospital detail pages
- Patient Map page (`/map`) with:
  - 3D hospital building visualization (KOH)
  - 2D floor plan fallback
  - Room search in Hindi + English
  - Department colour coding
  - Floor selection
  - Source attribution

### Backend API (http://localhost:8787)
- Auth (login, JWT, role-based permissions)
- Hospital CRUD
- Floor plan CRUD
- Navigation graph + routing (Dijkstra/A*)
- QR code generation/resolution
- 29 automated tests passing

### Data
- 6 Kota hospitals with verified coordinates, addresses, phone, websites
- Kota Heart Institute: 5 floors, 20+ rooms, full navigation graph
- 5 hospitals: directory-only (correctly unpublished for indoor navigation)

---

## What Does NOT Work (Gaps)

1. **No Postgres schema for hospital intelligence tables** — The TypeScript
   module exists but the backend DB doesn't have campuses/buildings/floors/
   rooms/departments/facilities/navigation_nodes/qr_locations/map_versions/
   sources/verification_records tables.

2. **No Flutter Android app** — The original deliverable was a Flutter app.
   The patient experience exists in the admin dashboard but not as a mobile
   app. No Flutter SDK in sandbox to build/test.

3. **No indoor maps for 5 of 6 hospitals** — MBS, NMCH, Rampura, Fortis,
   JK Lone have no floor plans available online. This is a real-world data
   gap, not a code gap. Survey/permission routes needed.

4. **No research automation** — PDF/CAD import, OCR, batch import pipelines
   not built.

5. **No admin verification workflow** — The existing MapEditor works for
   drafting, but the full submit→review→approve→publish pipeline is not
   implemented.

6. **No offline support** — No offline map download or cache mechanism.

7. **No voice navigation** — Not implemented.

---

## Honest Assessment

- **Implemented & tested**: Backend API (29 tests), admin dashboard build,
  3D/2D map renderer, patient map preview, Kota hospital research dataset
- **Partially implemented**: Navigation engine (works for KOH only), admin
  editor (basic), research database (TypeScript module but no Postgres schema)
- **Blocked by environment**: Flutter app (no SDK), Android testing (no device)
- **Requires real-world work**: Floor plans for 5 hospitals (survey/permission),
  admin verification workflow, offline support

## Branch & Commits
- Branch: `arena/3aabb8b1-hospital-mitra`
- 5 commits on this branch
- All work saved to GitHub
