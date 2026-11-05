-- ============================================================================
-- Hospital Mitra — Supabase Row Level Security (RLS) policies
-- ============================================================================
-- Goal: the patient app is a public, read-only consumer of PUBLISHED, VERIFIED
-- data only. Admin data (unverified rooms, draft maps, credentials, audit)
-- must never be readable from the client, and mutation endpoints live in the
-- Node backend (which authenticates with service/JWT and is the only writer).
--
-- Apply in the Supabase SQL editor after schema.sql. Enable RLS on every table.
-- ============================================================================

-- Enable RLS everywhere.
DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
END;
$$;

-- The patient (public) app authenticates with Supabase Auth anonymously or via
-- a lightweight "patient" login. We grant it read access ONLY to the published,
-- verified projection. The cleanest approach is a VIEW the patient can read.

-- ---- Patient-facing read views -------------------------------------------

CREATE OR REPLACE VIEW public.patient_hospitals AS
SELECT
    id, name, short_name, city, district, state, country, address,
    latitude, longitude, phone_emergency, hospital_type, bed_count,
    mapping_status, map_verified, map_last_updated_at, is_demo,
    created_at, updated_at
FROM public.hospitals
WHERE is_active = TRUE;

COMMENT ON VIEW public.patient_hospitals IS
'Public, non-sensitive hospital directory for the patient app.';

-- Published, verified rooms only.
CREATE OR REPLACE VIEW public.patient_rooms AS
SELECT
    r.id, r.hospital_id, r.building_id, r.floor_id, r.room_number,
    r.name, r.name_hi, r.department_id, r.category, r.geometry,
    r.x_centroid, r.y_centroid, r.operating_info
FROM public.rooms r
JOIN public.floors f ON f.id = r.floor_id
WHERE r.is_active = TRUE
  AND r.verification_status = 'verified'
  AND f.map_status = 'published';

-- Published, verified navigation graph per floor (for offline download too).
CREATE OR REPLACE VIEW public.patient_floor_graph AS
SELECT
    f.id AS floor_id,
    f.building_id,
    f.floor_number,
    f.floor_label,
    f.level_elevation_m,
    f.calibration_scale_ppm,
    f.calibration_origin_x,
    f.calibration_origin_y,
    f.calibration_rotation_deg,
    f.image_width_px,
    f.image_height_px,
    f.map_last_updated_at,
    jsonb_agg(
        jsonb_build_object(
            'id', n.id, 'type', n.node_type, 'x', n.x_metres, 'y', n.y_metres,
            'room_id', n.room_id, 'facility_id', n.facility_id,
            'accessibility', n.accessibility, 'label', n.label
        )
    ) FILTER (WHERE n.id IS NOT NULL) AS nodes
FROM public.floors f
JOIN public.navigation_nodes n ON n.floor_id = f.id
WHERE f.map_status = 'published'
GROUP BY f.id;

CREATE OR REPLACE VIEW public.patient_nav_edges AS
SELECT
    e.id, e.floor_id, e.start_node_id, e.end_node_id, e.kind,
    e.distance_metres, e.accessibility, e.is_bidirectional,
    e.is_vertical, e.connects_to_floor_id, e.is_active
FROM public.navigation_edges e
JOIN public.floors f ON f.id = e.floor_id
WHERE e.is_active = TRUE
  AND f.map_status = 'published';

-- ---- RLS policies on the patient views -----------------------------------

-- Public read on the directory.
ALTER TABLE public.patient_hospitals
    DROP POLICY IF EXISTS patient_read ON public.patient_hospitals;
CREATE POLICY patient_read ON public.patient_hospitals
    FOR SELECT USING (true);

-- Patients may read published rooms/graphs anonymously (the SDK attaches the
-- authenticated JWT even for anonymous sign-ins; `auth.jwt()` is always set).
ALTER TABLE public.patient_rooms
    DROP POLICY IF EXISTS patient_read ON public.patient_rooms;
CREATE POLICY patient_read ON public.patient_rooms
    FOR SELECT USING (auth.jwt() IS NOT NULL);

ALTER TABLE public.patient_floor_graph
    DROP POLICY IF EXISTS patient_read ON public.patient_floor_graph;
CREATE POLICY patient_read ON public.patient_floor_graph
    FOR SELECT USING (auth.jwt() IS NOT NULL);

ALTER TABLE public.patient_nav_edges
    DROP POLICY IF EXISTS patient_read ON public.patient_nav_edges;
CREATE POLICY patient_read ON public.patient_nav_edges
    FOR SELECT USING (auth.jwt() IS NOT NULL);

-- ---- Restrictive policies on raw admin tables -----------------------------
-- No client may read raw tables directly. Admin writes are performed by the
-- Node backend using the service-role key server-side, not from the client.

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN (
              'patient_hospitals','patient_rooms','patient_floor_graph','patient_nav_edges'
          )
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS restrict_all ON %I;
             CREATE POLICY restrict_all ON %I FOR ALL USING (false) WITH CHECK (false);',
            t, t);
    END LOOP;
END;
$$;

-- Allow the service role to bypass RLS (Supabase default). Admins never hold
-- the service key; they authenticate via Supabase Auth and the backend checks
-- RBAC before writing.
