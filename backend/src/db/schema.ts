// SQLite schema mirroring db/schema.sql (PostgreSQL). Same tables & columns so
// the admin dashboard behaves identically against local SQLite or Supabase.
// Booleans are INTEGER 0/1; UUIDs are TEXT; timestamps are ISO-8601 text.

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_roles (
  id            TEXT PRIMARY KEY,
  role_key      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  permissions   TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role_id       TEXT NOT NULL REFERENCES admin_roles(id),
  hospital_id   TEXT REFERENCES hospitals(id) ON DELETE SET NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hospitals (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  short_name           TEXT,
  city                 TEXT NOT NULL,
  district             TEXT NOT NULL,
  state                TEXT NOT NULL DEFAULT 'Rajasthan',
  country              TEXT NOT NULL DEFAULT 'IN',
  address              TEXT,
  latitude             REAL,
  longitude            REAL,
  phone_emergency      TEXT,
  hospital_type        TEXT,
  bed_count            INTEGER,
  mapping_status       TEXT NOT NULL DEFAULT 'unmapped',
  map_verified         INTEGER NOT NULL DEFAULT 0,
  map_last_updated_at  TEXT,
  map_last_updated_by  TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  is_demo              INTEGER NOT NULL DEFAULT 0,
  is_active            INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  UNIQUE (name, city)
);

CREATE TABLE IF NOT EXISTS buildings (
  id            TEXT PRIMARY KEY,
  hospital_id   TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT,
  latitude      REAL,
  longitude     REAL,
  floor_count   INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (hospital_id, name)
);

CREATE TABLE IF NOT EXISTS floors (
  id                    TEXT PRIMARY KEY,
  hospital_id           TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  building_id           TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  floor_number          INTEGER NOT NULL,
  floor_label           TEXT NOT NULL,
  level_elevation_m     REAL,
  map_image_url         TEXT,
  map_svg_url           TEXT,
  map_pdf_url           TEXT,
  calibration_scale_ppm REAL,
  calibration_origin_x  REAL,
  calibration_origin_y  REAL,
  calibration_rotation_deg REAL DEFAULT 0,
  image_width_px        INTEGER,
  image_height_px       INTEGER,
  map_status            TEXT NOT NULL DEFAULT 'draft',
  map_version_id        TEXT REFERENCES map_versions(id) ON DELETE SET NULL,
  map_verified_at       TEXT,
  map_verified_by       TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  published_at          TEXT,
  is_demo               INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  UNIQUE (building_id, floor_number)
);

CREATE TABLE IF NOT EXISTS map_versions (
  id             TEXT PRIMARY KEY,
  floor_id       TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft',
  change_summary TEXT,
  created_by     TEXT NOT NULL REFERENCES admin_users(id),
  created_at     TEXT NOT NULL,
  published_at   TEXT,
  published_by   TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  UNIQUE (floor_id, version_number)
);

CREATE TABLE IF NOT EXISTS map_verifications (
  id                  TEXT PRIMARY KEY,
  floor_id            TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  map_version_id      TEXT NOT NULL REFERENCES map_versions(id) ON DELETE CASCADE,
  verified_by         TEXT NOT NULL REFERENCES admin_users(id),
  verification_status TEXT NOT NULL DEFAULT 'verified',
  comments            TEXT,
  checked_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id                 TEXT PRIMARY KEY,
  hospital_id        TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  building_id        TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  floor_id           TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  room_number        TEXT NOT NULL,
  name               TEXT,
  name_hi            TEXT,
  department_id      TEXT REFERENCES departments(id) ON DELETE SET NULL,
  category           TEXT,
  geometry           TEXT DEFAULT '{}',
  x_centroid         REAL,
  y_centroid         REAL,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  operating_info     TEXT,
  is_demo            INTEGER NOT NULL DEFAULT 0,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (floor_id, room_number)
);

CREATE TABLE IF NOT EXISTS departments (
  id             TEXT PRIMARY KEY,
  hospital_id    TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  name_hi        TEXT,
  category       TEXT,
  short_code     TEXT,
  operating_hours TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  UNIQUE (hospital_id, name)
);

CREATE TABLE IF NOT EXISTS doctors (
  id                   TEXT PRIMARY KEY,
  hospital_id          TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  department_id        TEXT REFERENCES departments(id) ON DELETE SET NULL,
  name                 TEXT NOT NULL,
  qualifications       TEXT,
  specialization       TEXT,
  registration_number  TEXT,
  room_id              TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  verification_status  TEXT NOT NULL DEFAULT 'unverified',
  is_demo              INTEGER NOT NULL DEFAULT 0,
  is_active            INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  UNIQUE (hospital_id, name, registration_number)
);

CREATE TABLE IF NOT EXISTS facilities (
  id                 TEXT PRIMARY KEY,
  hospital_id        TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  building_id        TEXT REFERENCES buildings(id) ON DELETE SET NULL,
  floor_id           TEXT REFERENCES floors(id) ON DELETE SET NULL,
  room_id            TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  name_hi            TEXT,
  facility_type      TEXT NOT NULL,
  x_metres           REAL,
  y_metres           REAL,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  operating_info     TEXT,
  is_demo            INTEGER NOT NULL DEFAULT 0,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL,
  UNIQUE (hospital_id, name, room_id)
);

CREATE TABLE IF NOT EXISTS entrances (
  id                 TEXT PRIMARY KEY,
  hospital_id        TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  building_id        TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  floor_id           TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  node_id            TEXT REFERENCES navigation_nodes(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  kind               TEXT NOT NULL DEFAULT 'public',
  latitude           REAL,
  longitude          REAL,
  x_metres           REAL,
  y_metres           REAL,
  is_emergency       INTEGER NOT NULL DEFAULT 0,
  is_accessible      INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  is_demo            INTEGER NOT NULL DEFAULT 0,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exits (
  id                 TEXT PRIMARY KEY,
  hospital_id        TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  building_id        TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  floor_id           TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  node_id            TEXT REFERENCES navigation_nodes(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  kind               TEXT NOT NULL DEFAULT 'public',
  latitude           REAL,
  longitude          REAL,
  x_metres           REAL,
  y_metres           REAL,
  is_emergency       INTEGER NOT NULL DEFAULT 0,
  is_accessible      INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  is_demo            INTEGER NOT NULL DEFAULT 0,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS navigation_nodes (
  id             TEXT PRIMARY KEY,
  floor_id       TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  node_type      TEXT NOT NULL,
  x_metres       REAL NOT NULL,
  y_metres       REAL NOT NULL,
  room_id        TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  facility_id    TEXT REFERENCES facilities(id) ON DELETE SET NULL,
  accessibility  TEXT,
  label          TEXT,
  metadata       TEXT DEFAULT '{}',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE (floor_id, node_type, room_id, x_metres, y_metres)
);

CREATE TABLE IF NOT EXISTS navigation_edges (
  id                 TEXT PRIMARY KEY,
  floor_id           TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  start_node_id      TEXT NOT NULL REFERENCES navigation_nodes(id) ON DELETE CASCADE,
  end_node_id        TEXT NOT NULL REFERENCES navigation_nodes(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL,
  distance_metres    REAL NOT NULL,
  accessibility      TEXT NOT NULL DEFAULT 'wheelchair_accessible',
  is_bidirectional   INTEGER NOT NULL DEFAULT 1,
  one_way_direction  TEXT,
  is_vertical        INTEGER NOT NULL DEFAULT 0,
  connects_to_floor_id TEXT REFERENCES floors(id) ON DELETE CASCADE,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  CHECK (distance_metres >= 0),
  CHECK (start_node_id <> end_node_id)
);

CREATE TABLE IF NOT EXISTS qr_locations (
  id                 TEXT PRIMARY KEY,
  hospital_id        TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  building_id        TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  floor_id           TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  room_id            TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  node_id            TEXT REFERENCES navigation_nodes(id) ON DELETE SET NULL,
  location_identifier TEXT NOT NULL,
  label              TEXT NOT NULL,
  x_metres           REAL,
  y_metres           REAL,
  is_active          INTEGER NOT NULL DEFAULT 1,
  generated_at       TEXT NOT NULL,
  generated_by       TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  UNIQUE (location_identifier, hospital_id)
);

CREATE TABLE IF NOT EXISTS accessibility_attributes (
  id             TEXT PRIMARY KEY,
  hospital_id    TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  building_id    TEXT REFERENCES buildings(id) ON DELETE CASCADE,
  floor_id       TEXT REFERENCES floors(id) ON DELETE CASCADE,
  room_id        TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  node_id        TEXT REFERENCES navigation_nodes(id) ON DELETE CASCADE,
  edge_id        TEXT REFERENCES navigation_edges(id) ON DELETE CASCADE,
  class          TEXT NOT NULL,
  has_lift       INTEGER,
  has_ramp       INTEGER,
  width_metres   REAL,
  notes          TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_feedback (
  id              TEXT PRIMARY KEY,
  hospital_id     TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  floor_id        TEXT REFERENCES floors(id) ON DELETE SET NULL,
  room_id         TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  category        TEXT NOT NULL,
  description     TEXT NOT NULL,
  contact_hint    TEXT,
  status          TEXT NOT NULL DEFAULT 'open',
  reviewed_by     TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at     TEXT,
  resolution_note TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_role    TEXT,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  hospital_id   TEXT REFERENCES hospitals(id) ON DELETE CASCADE,
  details       TEXT DEFAULT '{}',
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
CREATE INDEX IF NOT EXISTS idx_floors_hospital ON floors(hospital_id);
CREATE INDEX IF NOT EXISTS idx_rooms_hospital ON rooms(hospital_id);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id);
CREATE INDEX IF NOT EXISTS idx_navnodes_floor ON navigation_nodes(floor_id);
CREATE INDEX IF NOT EXISTS idx_navedges_floor ON navigation_edges(floor_id);
CREATE INDEX IF NOT EXISTS idx_qr_hospital ON qr_locations(hospital_id);
CREATE INDEX IF NOT EXISTS idx_feedback_hospital ON user_feedback(hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_hospital ON audit_logs(hospital_id, created_at);
CREATE INDEX IF NOT EXISTS idx_map_versions_floor ON map_versions(floor_id, version_number);
`;
