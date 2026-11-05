-- ============================================================================
-- Hospital Mitra — Demo seed data
-- ============================================================================
-- IMPORTANT: This is SAMPLE / DEMO data used to demonstrate the platform.
-- The four Kota hospitals below are CANDIDATE directory entries only. They are
-- intentionally left UNMAPPED (no rooms, no maps, map_verified = false) because
-- no approved indoor dataset has been supplied. Do NOT present them as mapped.
--
-- A single clearly-labelled DEMO hospital ("Mitra Demo Hospital") carries a
-- small synthetic indoor graph so the patient flow can be exercised end-to-end.
-- Every demo row has is_demo = true and will be filtered/flagged in the UI.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Roles
-- ----------------------------------------------------------------------------

INSERT INTO admin_roles (role_key, name, description, permissions) VALUES
('super_admin',   'Super Admin',        'Platform-wide administrator',      '["*"]'),
('hospital_admin','Hospital Admin',     'Manages a single hospital',        '["hospital:manage","map:publish","feedback:read","feedback:review","audit:read"]'),
('map_editor',    'Map Editor',         'Digitises and edits maps',         '["map:edit","room:edit","department:edit","qr:generate","feedback:read"]'),
('map_verifier',  'Map Verifier',       'Verifies and publishes maps',      '["map:verify","map:publish","feedback:read","feedback:review","audit:read"]'),
('read_only',     'Read-only Staff',   'Read-only access',                 '["audit:read","feedback:read"]')
ON CONFLICT (role_key) DO NOTHING;

-- Demo admin users are created by the backend seed (bcrypt-hashed passwords).
-- Roles are seeded here so RBAC assignment works immediately.

-- ----------------------------------------------------------------------------
-- Candidate Kota hospitals (UNMAPPED — directory only, no invented data)
-- ----------------------------------------------------------------------------

INSERT INTO hospitals (name, short_name, city, district, state, hospital_type,
                       mapping_status, map_verified, is_demo, is_active) VALUES
('M.B.S. Hospital',            'MBS',     'Kota',   'Kota',     'Rajasthan', 'Government', 'unmapped', false, false, true),
('New Medical College Hospital','NMCH',    'Kota',   'Kota',     'Rajasthan', 'Government', 'unmapped', false, false, true),
('Rampura Satellite Hospital', 'RSH',     'Kota',   'Kota',     'Rajasthan', 'Government', 'unmapped', false, false, true),
('Super Speciality Block',     'SSB',     'Kota',   'Kota',     'Rajasthan', 'Government', 'unmapped', false, false, true)
ON CONFLICT (name, city) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Demo hospital with a synthetic, clearly-labelled indoor graph
-- ----------------------------------------------------------------------------

INSERT INTO hospitals (name, short_name, city, district, state, hospital_type,
                       address, latitude, longitude, mapping_status, map_verified,
                       map_last_updated_at, is_demo, is_active) VALUES
('Mitra Demo Hospital', 'MDH', 'Kota', 'Kota', 'Rajasthan', 'Government',
 'Demo Campus, Kota, Rajasthan', 25.1858, 75.8326, 'fully_mapped', true,
 now(), true, true)
RETURNING id;

-- Use a deterministic UUID for the demo hospital for cross-table references.
-- (Re-run safe: ON CONFLICT is not available for UUID default, so we look up.)
UPDATE hospitals
SET id = '11111111-1111-1111-1111-111111111111'
WHERE name = 'Mitra Demo Hospital';

INSERT INTO buildings (id, hospital_id, name, code, latitude, longitude, floor_count)
VALUES ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', 'Main Building', 'B1', 25.1858, 75.8326, 2);

INSERT INTO floors (id, hospital_id, building_id, floor_number, floor_label, level_elevation_m,
                    map_status, map_verified_at, map_verified_by, published_at, is_demo, is_active)
VALUES
('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 1, 'Ground', 0.00, 'published', now(), NULL, NULL, now(), true, true),
('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 2, 'First', 3.50, 'published', now(), NULL, NULL, now(), true, true);

-- Rooms (demo)
INSERT INTO rooms (id, hospital_id, building_id, floor_id, room_number, name, name_hi,
                   department_id, category, x_centroid, y_centroid, verification_status, is_demo) VALUES
('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', 'G-01', 'Registration Counter', 'पंजीकरण काउंटर', NULL, 'Registration', 5.0, 8.0, 'verified', true),
('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', 'G-02', 'Pharmacy', 'फार्मेसी', NULL, 'Pharmacy', 30.0, 8.0, 'verified', true),
('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', 'G-03', 'Emergency', ' emergency', NULL, 'Emergency', 5.0, 40.0, 'verified', true),
('44444444-4444-4444-4444-444444444404', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333332', 'F-01', 'Outpatient Department', 'आउटपेशेंट विभाग', NULL, 'OPD', 15.0, 15.0, 'verified', true),
('44444444-4444-4444-4444-444444444405', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333332', 'F-02', 'Laboratory', 'परीक्षणशाला', NULL, 'Laboratory', 35.0, 15.0, 'verified', true);

-- Departments (demo)
INSERT INTO departments (id, hospital_id, name, name_hi, category, short_code)
VALUES
('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111111', 'Registration', 'पंजीकरण', 'Registration', 'REG'),
('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111111', 'Pharmacy', 'फार्मेसी', 'Pharmacy', 'PHA'),
('55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111111', 'Emergency', 'आपतकालीन', 'Emergency', 'EMG'),
('55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111111', 'Outpatient Department', 'आउटपेशेंट विभाग', 'OPD', 'OPD'),
('55555555-5555-5555-5555-555555555505', '11111111-1111-1111-1111-111111111111', 'Laboratory', 'परीक्षणशाला', 'Laboratory', 'LAB')
ON CONFLICT (hospital_id, name) DO NOTHING;

-- Re-link rooms to departments (idempotent)
UPDATE rooms SET department_id = '55555555-5555-5555-5555-555555555501' WHERE id = '44444444-4444-4444-4444-444444444401';
UPDATE rooms SET department_id = '55555555-5555-5555-5555-555555555502' WHERE id = '44444444-4444-4444-4444-444444444402';
UPDATE rooms SET department_id = '55555555-5555-5555-5555-555555555503' WHERE id = '44444444-4444-4444-4444-444444444403';
UPDATE rooms SET department_id = '55555555-5555-5555-5555-555555555504' WHERE id = '44444444-4444-4444-4444-444444444404';
UPDATE rooms SET department_id = '55555555-5555-5555-5555-555555555505' WHERE id = '44444444-4444-4444-4444-444444444405';

-- Entrances / exits (demo)
INSERT INTO entrances (id, hospital_id, building_id, floor_id, name, kind, latitude, longitude, x_metres, y_metres, is_emergency, is_accessible, verification_status, is_demo)
VALUES ('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', 'Main Entrance', 'main', 25.1858, 75.8326, 0.0, 50.0, false, true, 'verified', true),
       ('66666666-6666-6666-6666-666666666602', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', 'Emergency Entrance', 'आपतकालीन', 25.1859, 75.8325, 5.0, 40.0, true, true, 'verified', true);

INSERT INTO exits (id, hospital_id, building_id, floor_id, name, kind, latitude, longitude, x_metres, y_metres, is_emergency, is_accessible, verification_status, is_demo)
VALUES ('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', 'Main Exit', 'public', 25.1858, 75.8326, 0.0, 50.0, false, true, 'verified', true);

-- Navigation graph — Ground floor (a simple L-shaped corridor + room nodes)
-- Coordinates in metres, origin bottom-left of the floor.
INSERT INTO navigation_nodes (id, floor_id, node_type, x_metres, y_metres, room_id, facility_id, accessibility, label)
VALUES
-- corridor junctions
('88888888-8888-8888-8888-888888888801', '33333333-3333-3333-3333-333333333331', 'entrance',      0.0, 50.0, NULL, NULL, 'wheelchair_accessible', 'Main Entrance'),
('88888888-8888-8888-8888-888888888802', '33333333-3333-3333-3333-333333333331', 'junction',      10.0, 50.0, NULL, NULL, 'wheelchair_accessible', 'Junction A'),
('88888888-8888-8888-8888-888888888803', '33333333-3333-3333-3333-333333333331', 'junction',      10.0, 20.0, NULL, NULL, 'wheelchair_accessible', 'Junction B'),
('88888888-8888-8888-8888-888888888804', '33333333-3333-3333-3333-333333333331', 'junction',      40.0, 20.0, NULL, NULL, 'wheelchair_accessible', 'Junction C'),
('88888888-8888-8888-8888-888888888805', '33333333-3333-3333-3333-333333333331', 'room',          5.0,  8.0, '44444444-4444-4444-4444-444444444401', NULL, 'wheelchair_accessible', 'Registration'),
('88888888-8888-8888-8888-888888888806', '33333333-3333-3333-3333-333333333331', 'room',          30.0, 8.0, '44444444-4444-4444-4444-444444444402', NULL, 'wheelchair_accessible', 'Pharmacy'),
('88888888-8888-8888-8888-888888888807', '33333333-3333-3333-3333-333333333331', 'room',          5.0, 40.0, '44444444-4444-4444-4444-444444444403', NULL, 'wheelchair_accessible', 'Emergency'),
('88888888-8888-8888-8888-888888888808', '33333333-3333-3333-3333-333333333331', 'lift',          10.0, 15.0, NULL, NULL, 'wheelchair_accessible', 'Lift to First Floor'),
('88888888-8888-8888-8888-888888888809', '33333333-3333-3333-3333-333333333331', 'stair',         12.0, 15.0, NULL, NULL, 'stairs_only', 'Stairs to First Floor');

-- Navigation graph — First floor
INSERT INTO navigation_nodes (id, floor_id, node_type, x_metres, y_metres, room_id, facility_id, accessibility, label)
VALUES
('88888888-8888-8888-8888-888888888811', '33333333-3333-3333-3333-333333333332', 'lift',          10.0, 15.0, NULL, NULL, 'wheelchair_accessible', 'Lift from Ground'),
('88888888-8888-8888-8888-888888888812', '33333333-3333-3333-3333-333333333332', 'stair',         12.0, 15.0, NULL, NULL, 'stairs_only', 'Stairs from Ground'),
('88888888-8888-8888-8888-888888888813', '33333333-3333-3333-3333-333333333332', 'junction',      10.0, 20.0, NULL, NULL, 'wheelchair_accessible', 'Junction D'),
('88888888-8888-8888-8888-888888888814', '33333333-3333-3333-3333-333333333332', 'junction',      30.0, 20.0, NULL, NULL, 'wheelchair_accessible', 'Junction E'),
('88888888-8888-8888-8888-888888888815', '33333333-3333-3333-3333-333333333332', 'room',          15.0, 15.0, '44444444-4444-4444-4444-444444444404', NULL, 'wheelchair_accessible', 'OPD'),
('88888888-8888-8888-8888-888888888816', '33333333-3333-3333-3333-333333333332', 'room',          35.0, 15.0, '44444444-4444-4444-4444-444444444405', NULL, 'wheelchair_accessible', 'Laboratory');

-- Edges — Ground floor
INSERT INTO navigation_edges (id, floor_id, start_node_id, end_node_id, kind, distance_metres, accessibility, is_bidirectional, is_vertical)
VALUES
('99999999-9999-9999-9999-999999999901', '33333333-3333-3333-3333-333333333331', '88888888-8888-8888-8888-888888888801', '88888888-8888-8888-8888-888888888802', 'corridor', 10.0, 'wheelchair_accessible', true, false),
('99999999-9999-9999-9999-999999999902', '33333333-3333-3333-3333-333333333331', '88888888-8888-8888-8888-888888888802', '88888888-8888-8888-8888-888888888803', 'corridor', 30.0, 'wheelchair_accessible', true, false),
('99999999-9999-9999-9999-999999999903', '33333333-3333-3333-3333-333333333331', '88888888-8888-8888-8888-888888888803', '88888888-8888-8888-8888-888888888804', 'corridor', 30.0, 'wheelchair_accessible', true, false),
('99999999-9999-9999-9999-999999999904', '33333333-3333-3333-3333-333333333331', '88888888-8888-8888-8888-888888888803', '88888888-8888-8888-8888-888888888805', 'corridor', 13.0, 'wheelchair_accessible', true, false),
('99999999-9999-9999-9999-999999999905', '33333333-3333-3333-3333-333333333331', '88888888-8888-8888-8888-888888888803', '88888888-8888-8888-8888-888888888806', 'corridor', 25.0, 'wheelchair_accessible', true, false),
('99999999-9999-9999-9999-999999999906', '33333333-3333-3333-3333-333333333331', '88888888-8888-8888-8888-888888888803', '88888888-8888-8888-8888-888888888807', 'corridor', 20.0, 'wheelchair_accessible', true, false),
('99999999-9999-9999-9999-999999999907', '33333333-3333-3333-3333-333333333331', '88888888-8888-8888-8888-888888888802', '88888888-8888-8888-8888-888888888808', 'corridor', 5.0, 'wheelchair_accessible', true, false),
('99999999-9999-9999-9999-999999999908', '33333333-3333-3333-3333-333333333331', '88888888-8888-8888-8888-888888888802', '88888888-8888-8888-8888-888888888809', 'corridor', 5.0, 'stairs_only', true, false);

-- Vertical edges: lift (accessible) and stairs (not) connecting ground <-> first
INSERT INTO navigation_edges (id, floor_id, start_node_id, end_node_id, kind, distance_metres, accessibility, is_bidirectional, is_vertical, connects_to_floor_id)
VALUES
('99999999-9999-9999-9999-999999999911', '33333333-3333-3333-3333-333333333331', '88888888-8888-8888-8888-888888888808', '88888888-8888-8888-8888-888888888811', 'lift', 3.5, 'wheelchair_accessible', true, true, '33333333-3333-3333-3333-333333333332'),
('99999999-9999-9999-9999-999999999912', '33333333-3333-3333-3333-333333333331', '88888888-8888-8888-8888-888888888809', '88888888-8888-8888-8888-888888888812', 'stair', 3.5, 'stairs_only', true, true, '33333333-3333-3333-3333-333333333332');

-- First floor edges
INSERT INTO navigation_edges (id, floor_id, start_node_id, end_node_id, kind, distance_metres, accessibility, is_bidirectional, is_vertical)
VALUES
('99999999-9999-9999-9999-999999999921', '33333333-3333-3333-3333-333333333332', '88888888-8888-8888-8888-888888888811', '88888888-8888-8888-8888-888888888813', 'corridor', 5.0, 'wheelchair_accessible', true, false),
('99999999-9999-9999-9999-999999999922', '33333333-3333-3333-3333-333333333332', '88888888-8888-8888-8888-888888888813', '88888888-8888-8888-8888-888888888814', 'corridor', 20.0, 'wheelchair_accessible', true, false),
('99999999-9999-9999-9999-999999999923', '33333333-3333-3333-3333-333333333332', '88888888-8888-8888-8888-888888888813', '88888888-8888-8888-8888-888888888815', 'corridor', 7.0, 'wheelchair_accessible', true, false),
('99999999-9999-9999-9999-999999999924', '33333333-3333-3333-3333-333333333332', '88888888-8888-8888-8888-888888888814', '88888888-8888-8888-8888-888888888816', 'corridor', 7.0, 'wheelchair_accessible', true, false);

-- QR locations (demo) — opaque identifiers, no sensitive data
INSERT INTO qr_locations (id, hospital_id, building_id, floor_id, room_id, node_id, location_identifier, label, x_metres, y_metres, verification_status)
VALUES
('aaaaaaa1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', '44444444-4444-4444-4444-444444444401', '88888888-8888-8888-8888-888888888805', 'MDH-G-REG-001', 'Registration Counter', 5.0, 8.0, 'verified'),
('aaaaaaa2-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', '44444444-4444-4444-4444-444444444402', '88888888-8888-8888-8888-888888888806', 'MDH-G-PHA-001', 'Pharmacy', 30.0, 8.0, 'verified'),
('aaaaaaa3-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', '44444444-4444-4444-4444-444444444403', '88888888-8888-8888-8888-888888888807', 'MDH-G-EMG-001', 'Emergency', 5.0, 40.0, 'verified'),
('aaaaaaa4-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333332', '44444444-4444-4444-4444-444444444404', '88888888-8888-8888-8888-888888888815', 'MDH-F-OPD-001', 'Outpatient Department', 15.0, 15.0, 'verified');

COMMIT;
