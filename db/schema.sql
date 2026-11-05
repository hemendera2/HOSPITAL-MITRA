-- ============================================================================
-- Hospital Mitra — Indoor Navigation Platform
-- Canonical PostgreSQL schema (production target: Supabase Postgres)
-- ============================================================================
-- This schema is the single source of truth for the data model. The Node
-- backend (backend/src/db) mirrors this exact shape on SQLite for local dev,
-- so the admin dashboard runs identically offline and against Supabase.
--
-- Design rules:
--   * Every indoor map is versioned and must be VERIFIED + PUBLISHED before it
--     is visible to the patient app. Nothing unverified is ever public.
--   * No patient PII is stored. There is no medical-record table by design.
--   * All positional data is in a floor-local metric coordinate system
--     (metres, origin at a building corner) so maps are calibratable.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

-- A hospital's mapping availability, surfaced to patients.
CREATE TYPE hospital_mapping_status AS ENUM (
    'unmapped',      -- no approved indoor map exists
    'mapping_planned',
    'partially_mapped',
    'fully_mapped'
);

-- A room / facility / department's verification lifecycle.
CREATE TYPE verification_status AS ENUM (
    'unverified',    -- created by an editor, not yet checked
    'verified',      -- a verifier has approved the location
    'rejected',      -- a verifier rejected; needs correction
    'deprecated'
);

-- Overall publication lifecycle of a floor map.
CREATE TYPE map_status AS ENUM (
    'draft',         -- editor working copy, not public
    'pending_review',
    'verified',      -- verified but not published
    'published',     -- live for patients
    'unpublished',   -- taken live
    'archived'
);

CREATE TYPE node_type AS ENUM (
    'junction',      -- corridor intersection / decision point
    'room',
    'entrance',
    'exit',
    'stair',
    'lift',
    'escalator',
    'ramp',
    'emergency',
    'info_point',
    'corridor_end'
);

CREATE TYPE edge_kind AS ENUM (
    'corridor',
    'room_access',
    'stair',
    'lift',
    'ramp',
    'escalator',
    'bridge',
    'outdoor'
);

-- Accessibility profile of a walkable edge / node.
CREATE TYPE accessibility_class AS ENUM (
    'wheelchair_accessible',
    'step_free',
    'stairs_only',
    'limited_access',
    'staff_assistance_required'
);

-- ----------------------------------------------------------------------------
-- Core: hospitals, buildings, floors
-- ----------------------------------------------------------------------------

CREATE TABLE hospitals (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   TEXT NOT NULL,
    short_name             TEXT,
    city                   TEXT NOT NULL,
    district               TEXT NOT NULL,
    state                  TEXT NOT NULL DEFAULT 'Rajasthan',
    country                TEXT NOT NULL DEFAULT 'IN',
    address                TEXT,
    latitude               NUMERIC(9,6),
    longitude              NUMERIC(9,6),
    phone_emergency        TEXT,
    hospital_type          TEXT,                 -- e.g. Government
    bed_count              INTEGER,
    mapping_status         hospital_mapping_status NOT NULL DEFAULT 'unmapped',
    -- map availability evidence
    map_verified           BOOLEAN NOT NULL DEFAULT FALSE,
    map_last_updated_at    TIMESTAMPTZ,
    map_last_updated_by    UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    is_demo                BOOLEAN NOT NULL DEFAULT FALSE,  -- DEMO data flag
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, city)
);
CREATE INDEX idx_hospitals_city ON hospitals(city);
CREATE INDEX idx_hospitals_mapping ON hospitals(mapping_status);

CREATE TABLE buildings (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    name                   TEXT NOT NULL,
    code                   TEXT,                 -- short code e.g. "B-Block"
    latitude               NUMERIC(9,6),
    longitude              NUMERIC(9,6),
    floor_count            INTEGER NOT NULL DEFAULT 0,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hospital_id, name)
);

CREATE TABLE floors (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    building_id           UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_number           INTEGER NOT NULL,     -- 1 = ground, 2 = first, ...
    floor_label            TEXT NOT NULL,        -- "Ground", "First"
    level_elevation_m      NUMERIC(7,2),         -- metres above ground
    -- map imagery / calibration
    map_image_url          TEXT,                 -- approved plan image (Supabase Storage)
    map_svg_url            TEXT,
    map_pdf_url            TEXT,
    -- calibration transform from image pixel coords -> metric floor coords
    calibration_scale_ppm  NUMERIC(10,4),        -- pixels per metre
    calibration_origin_x  NUMERIC(12,4),        -- metric x of image pixel (0,0)
    calibration_origin_y  NUMERIC(12,4),
    calibration_rotation_deg NUMERIC(6,3) DEFAULT 0,
    -- canvas size of the source image
    image_width_px         INTEGER,
    image_height_px        INTEGER,
    map_status             map_status NOT NULL DEFAULT 'draft',
    map_version_id         UUID REFERENCES map_versions(id) ON DELETE SET NULL,
    map_verified_at        TIMESTAMPTZ,
    map_verified_by        UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    published_at           TIMESTAMPTZ,
    -- safety flags
    is_demo                BOOLEAN NOT NULL DEFAULT FALSE,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (building_id, floor_number)
);
CREATE INDEX idx_floors_hospital ON floors(hospital_id);

-- ----------------------------------------------------------------------------
-- Map versions & verification
-- ----------------------------------------------------------------------------

CREATE TABLE map_versions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id               UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    version_number         INTEGER NOT NULL,
    -- immutable snapshot of the calibrated map state at this version
    snapshot               JSONB NOT NULL,        -- {nodes:[], edges:[], rooms:[], ...}
    status                 map_status NOT NULL DEFAULT 'draft',
    change_summary         TEXT,
    created_by             UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at           TIMESTAMPTZ,
    published_by           UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    UNIQUE (floor_id, version_number)
);
CREATE INDEX idx_map_versions_floor ON map_versions(floor_id, version_number DESC);

CREATE TABLE map_verifications (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id               UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    map_version_id         UUID NOT NULL REFERENCES map_versions(id) ON DELETE CASCADE,
    verified_by            UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
    verification_status    verification_status NOT NULL DEFAULT 'verified',
    comments               TEXT,
    checked_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (map_version_id, verified_by)
);

-- ----------------------------------------------------------------------------
-- Indoor graph: navigation nodes & edges
-- ----------------------------------------------------------------------------

CREATE TABLE navigation_nodes (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id               UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    node_type              node_type NOT NULL,
    -- metric floor coordinates (metres from calibrated origin)
    x_metres               NUMERIC(12,4) NOT NULL,
    y_metres               NUMERIC(12,4) NOT NULL,
    -- semantic link to a room / facility when this node represents one
    room_id                UUID REFERENCES rooms(id) ON DELETE SET NULL,
    facility_id            UUID REFERENCES facilities(id) ON DELETE SET NULL,
    accessibility          accessibility_class,
    label                  TEXT,
    metadata               JSONB DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (floor_id, node_type, room_id, x_metres, y_metres)
);
CREATE INDEX idx_navnodes_floor ON navigation_nodes(floor_id);
CREATE INDEX idx_navnodes_room ON navigation_nodes(room_id);

CREATE TABLE navigation_edges (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id               UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    start_node_id          UUID NOT NULL REFERENCES navigation_nodes(id) ON DELETE CASCADE,
    end_node_id            UUID NOT NULL REFERENCES navigation_nodes(id) ON DELETE CASCADE,
    kind                   edge_kind NOT NULL,
    distance_metres        NUMERIC(8,3) NOT NULL,   -- derived from coordinates, verified
    accessibility          accessibility_class NOT NULL DEFAULT 'wheelchair_accessible',
    is_bidirectional       BOOLEAN NOT NULL DEFAULT TRUE,
    one_way_direction      TEXT,                   -- 'north','south','east','west'
    is_vertical            BOOLEAN NOT NULL DEFAULT FALSE,  -- connects floors (stair/lift)
    connects_to_floor_id   UUID REFERENCES floors(id) ON DELETE CASCADE,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (distance_metres >= 0),
    CHECK (start_node_id <> end_node_id)
);
CREATE INDEX idx_navedges_floor ON navigation_edges(floor_id);
CREATE INDEX idx_navedges_nodes ON navigation_edges(start_node_id, end_node_id);

-- ----------------------------------------------------------------------------
-- Rooms, departments, doctors, facilities
-- ----------------------------------------------------------------------------

CREATE TABLE departments (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    name                   TEXT NOT NULL,
    name_hi                TEXT,                   -- Hindi name
    category               TEXT,                   -- OPD, IPD, Lab, Diagnostics...
    short_code             TEXT,
    operating_hours        TEXT,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hospital_id, name)
);

CREATE TABLE rooms (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    building_id           UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id               UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    room_number            TEXT NOT NULL,
    name                   TEXT,
    name_hi                TEXT,
    department_id          UUID REFERENCES departments(id) ON DELETE SET NULL,
    category               TEXT,
    -- polygon outline in metric floor coords (for rendering + hit testing)
    geometry               JSONB DEFAULT '{}'::jsonb,
    x_centroid             NUMERIC(12,4),
    y_centroid             NUMERIC(12,4),
    verification_status    verification_status NOT NULL DEFAULT 'unverified',
    operating_info         TEXT,
    is_demo                BOOLEAN NOT NULL DEFAULT FALSE,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (floor_id, room_number)
);
CREATE INDEX idx_rooms_hospital ON rooms(hospital_id);
CREATE INDEX idx_rooms_floor ON rooms(floor_id);
CREATE INDEX idx_rooms_dept ON rooms(department_id);

-- Doctors are directory-only (no availability/booking — that is a separate,
-- future integration). No patient interaction data is stored.
CREATE TABLE doctors (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    department_id          UUID REFERENCES departments(id) ON DELETE SET NULL,
    name                   TEXT NOT NULL,
    qualifications         TEXT,
    specialization         TEXT,
    registration_number    TEXT,                   -- institutional, non-sensitive
    room_id                UUID REFERENCES rooms(id) ON DELETE SET NULL,
    verification_status    verification_status NOT NULL DEFAULT 'unverified',
    is_demo                BOOLEAN NOT NULL DEFAULT FALSE,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hospital_id, name, registration_number)
);

CREATE TABLE facilities (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    building_id           UUID REFERENCES buildings(id) ON DELETE SET NULL,
    floor_id               UUID REFERENCES floors(id) ON DELETE SET NULL,
    room_id                UUID REFERENCES rooms(id) ON DELETE SET NULL,
    name                   TEXT NOT NULL,
    name_hi                TEXT,
    facility_type          TEXT NOT NULL,   -- pharmacy, registry, emergency, ATM, canteen...
    x_metres               NUMERIC(12,4),
    y_metres               NUMERIC(12,4),
    verification_status    verification_status NOT NULL DEFAULT 'unverified',
    operating_info         TEXT,
    is_demo                BOOLEAN NOT NULL DEFAULT FALSE,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hospital_id, name, room_id)
);
CREATE INDEX idx_facilities_hospital ON facilities(hospital_id);

-- ----------------------------------------------------------------------------
-- Entrances & exits (outdoor <-> indoor transition)
-- ----------------------------------------------------------------------------

CREATE TABLE entrances (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    building_id           UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id               UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    node_id                UUID REFERENCES navigation_nodes(id) ON DELETE SET NULL,
    name                   TEXT NOT NULL,
    kind                   TEXT NOT NULL DEFAULT 'public',  -- main, emergency, staff, service
    latitude               NUMERIC(9,6),
    longitude              NUMERIC(9,6),
    x_metres               NUMERIC(12,4),
    y_metres               NUMERIC(12,4),
    is_emergency           BOOLEAN NOT NULL DEFAULT FALSE,
    is_accessible          BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status    verification_status NOT NULL DEFAULT 'unverified',
    is_demo                BOOLEAN NOT NULL DEFAULT FALSE,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exits (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    building_id           UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id               UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    node_id                UUID REFERENCES navigation_nodes(id) ON DELETE SET NULL,
    name                   TEXT NOT NULL,
    kind                   TEXT NOT NULL DEFAULT 'public',
    latitude               NUMERIC(9,6),
    longitude              NUMERIC(9,6),
    x_metres               NUMERIC(12,4),
    y_metres               NUMERIC(12,4),
    is_emergency           BOOLEAN NOT NULL DEFAULT FALSE,
    is_accessible          BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status    verification_status NOT NULL DEFAULT 'unverified',
    is_demo                BOOLEAN NOT NULL DEFAULT FALSE,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- QR location registry (location identifiers printed as QR codes on walls)
-- ----------------------------------------------------------------------------

CREATE TABLE qr_locations (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    building_id           UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id               UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    room_id                UUID REFERENCES rooms(id) ON DELETE SET NULL,
    node_id                UUID REFERENCES navigation_nodes(id) ON DELETE SET NULL,
    -- stable, opaque location identifier (no sensitive info)
    location_identifier    TEXT NOT NULL,
    label                  TEXT NOT NULL,
    x_metres               NUMERIC(12,4),
    y_metres               NUMERIC(12,4),
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    generated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    generated_by           UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    verification_status    verification_status NOT NULL DEFAULT 'unverified',
    UNIQUE (location_identifier, hospital_id)
);
CREATE INDEX idx_qr_hospital ON qr_locations(hospital_id);

-- ----------------------------------------------------------------------------
-- Accessibility attributes (explicit, attachable to any map element)
-- ----------------------------------------------------------------------------

CREATE TABLE accessibility_attributes (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    building_id           UUID REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id               UUID REFERENCES floors(id) ON DELETE CASCADE,
    room_id                UUID REFERENCES rooms(id) ON DELETE CASCADE,
    node_id                UUID REFERENCES navigation_nodes(id) ON DELETE CASCADE,
    edge_id                UUID REFERENCES navigation_edges(id) ON DELETE CASCADE,
    class                   accessibility_class NOT NULL,
    has_lift               BOOLEAN,
    has_ramp               BOOLEAN,
    width_metres           NUMERIC(6,3),
    notes                   TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Admin users, roles, RBAC
-- ----------------------------------------------------------------------------

CREATE TABLE admin_roles (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key               TEXT NOT NULL UNIQUE,   -- super_admin | hospital_admin | map_editor | map_verifier | read_only
    name                   TEXT NOT NULL,
    description            TEXT,
    permissions            JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE admin_users (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                  TEXT NOT NULL UNIQUE,
    display_name           TEXT NOT NULL,
    password_hash          TEXT NOT NULL,           -- never store plaintext
    role_id                UUID NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
    hospital_id            UUID REFERENCES hospitals(id) ON DELETE SET NULL,  -- null = platform-wide
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at          TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- User feedback / corrections (patient or staff submitted)
-- ----------------------------------------------------------------------------

CREATE TYPE feedback_category AS ENUM (
    'room_location', 'department_location', 'facility', 'route_blocked',
    'accessibility', 'qr_issue', 'data_error', 'other'
);

CREATE TABLE user_feedback (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    floor_id               UUID REFERENCES floors(id) ON DELETE SET NULL,
    room_id                UUID REFERENCES rooms(id) ON DELETE SET NULL,
    category               feedback_category NOT NULL,
    description            TEXT NOT NULL,
    contact_hint           TEXT,                   -- optional, NOT a medical record
    status                 TEXT NOT NULL DEFAULT 'open',  -- open | reviewing | resolved | rejected
    reviewed_by            UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    reviewed_at            TIMESTAMPTZ,
    resolution_note        TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_hospital ON user_feedback(hospital_id, status);

-- ----------------------------------------------------------------------------
-- Audit log (immutable)
-- ----------------------------------------------------------------------------

CREATE TABLE audit_logs (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id               UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    actor_role             TEXT,
    action                 TEXT NOT NULL,         -- e.g. map.publish, room.create
    entity_type            TEXT,
    entity_id              TEXT,
    hospital_id            UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    details                JSONB DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_hospital ON audit_logs(hospital_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);

-- ----------------------------------------------------------------------------
-- Triggers: keep updated_at fresh; enforce hospital_id propagation on children
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN
        SELECT 'hospitals'::text UNION ALL
        SELECT 'buildings' UNION ALL
        SELECT 'floors' UNION ALL
        SELECT 'rooms' UNION ALL
        SELECT 'navigation_nodes' UNION ALL
        SELECT 'navigation_edges' UNION ALL
        SELECT 'admin_users'
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
             CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
    END LOOP;
END;
$$;

COMMIT;
