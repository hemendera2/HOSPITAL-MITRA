import type { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { uuid, nowIso } from './sqlite.js';

const now = nowIso;

const DEMO_HOSPITAL = '11111111-1111-1111-1111-111111111111';
const DEMO_BUILDING = '22222222-2222-2222-2222-222222222222';
const DEMO_F1 = '33333333-3333-3333-3333-333333333331'; // Ground
const DEMO_F2 = '33333333-3333-3333-3333-333333333332'; // First

const ROLES = [
  { id: 'dddddddd-0000-0000-0000-000000000001', key: 'super_admin', name: 'Super Admin', permissions: '["*"]' },
  { id: 'dddddddd-0000-0000-0000-000000000002', key: 'hospital_admin', name: 'Hospital Admin', permissions: '["hospital:manage","map:publish","feedback:read","feedback:review","audit:read"]' },
  { id: 'dddddddd-0000-0000-0000-000000000003', key: 'map_editor', name: 'Map Editor', permissions: '["map:edit","room:edit","department:edit","qr:generate","feedback:read"]' },
  { id: 'dddddddd-0000-0000-0000-000000000004', key: 'map_verifier', name: 'Map Verifier', permissions: '["map:verify","map:publish","feedback:read","feedback:review","audit:read"]' },
  { id: 'dddddddd-0000-0000-0000-000000000005', key: 'read_only', name: 'Read-only Staff', permissions: '["audit:read","feedback:read"]' },
];

const ADMIN_USERS = [
  { email: 'super@mitra.demo', name: 'Platform Super Admin', roleKey: 'super_admin', password: 'Mitra@Admin2026' },
  { email: 'admin@mitra.demo', name: 'Kota Hospital Admin', roleKey: 'hospital_admin', password: 'Mitra@Admin2026', hospitalId: DEMO_HOSPITAL },
  { email: 'editor@mitra.demo', name: 'Map Editor', roleKey: 'map_editor', password: 'Mitra@Editor2026', hospitalId: DEMO_HOSPITAL },
  { email: 'verifier@mitra.demo', name: 'Map Verifier', roleKey: 'map_verifier', password: 'Mitra@Verify2026', hospitalId: DEMO_HOSPITAL },
  { email: 'staff@mitra.demo', name: 'Read-only Staff', roleKey: 'read_only', password: 'Mitra@Staff2026', hospitalId: DEMO_HOSPITAL },
];

const CANDIDATE_HOSPITALS = [
  { id: 'eeeeeeee-0000-0000-0000-000000000001', name: 'M.B.S. Hospital', short: 'MBS' },
  { id: 'eeeeeeee-0000-0000-0000-000000000002', name: 'New Medical College Hospital', short: 'NMCH' },
  { id: 'eeeeeeee-0000-0000-0000-000000000003', name: 'Rampura Satellite Hospital', short: 'RSH' },
  { id: 'eeeeeeee-0000-0000-0000-000000000004', name: 'Super Speciality Block', short: 'SSB' },
];

export function seedDatabase(db: DatabaseSync): void {
  const t = now();
  db.exec('BEGIN');
  try {
    // roles
    for (const r of ROLES) {
      db.prepare('INSERT OR IGNORE INTO admin_roles (id, role_key, name, description, permissions) VALUES (?,?,?,?,?)')
        .run(r.id, r.key, r.name, `${r.name} role`, r.permissions);
    }

    // candidate Kota hospitals — UNMAPPED, no invented data
    for (const h of CANDIDATE_HOSPITALS) {
      db.prepare(`INSERT OR IGNORE INTO hospitals
        (id, name, short_name, city, district, state, country, hospital_type, mapping_status, map_verified, is_demo, is_active, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(h.id, h.name, h.short, 'Kota', 'Kota', 'Rajasthan', 'IN', 'Government', 'unmapped', 0, 0, 1, t, t);
    }

    // demo hospital
    db.prepare(`INSERT OR IGNORE INTO hospitals
      (id, name, short_name, city, district, state, country, address, latitude, longitude, hospital_type, mapping_status, map_verified, map_last_updated_at, is_demo, is_active, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(DEMO_HOSPITAL, 'Mitra Demo Hospital', 'MDH', 'Kota', 'Kota', 'Rajasthan', 'IN', 'Demo Campus, Kota, Rajasthan', 25.1858, 75.8326, 'Government', 'fully_mapped', 1, t, 1, 1, t, t);

    db.prepare(`INSERT OR IGNORE INTO buildings (id, hospital_id, name, code, latitude, longitude, floor_count, is_active, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(DEMO_BUILDING, DEMO_HOSPITAL, 'Main Building', 'B1', 25.1858, 75.8326, 2, 1, t, t);

    db.prepare(`INSERT OR IGNORE INTO floors (id, hospital_id, building_id, floor_number, floor_label, level_elevation_m, map_status, map_verified_at, published_at, is_demo, is_active, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(DEMO_F1, DEMO_HOSPITAL, DEMO_BUILDING, 1, 'Ground', 0.0, 'published', t, t, 1, 1, t, t);
    db.prepare(`INSERT OR IGNORE INTO floors (id, hospital_id, building_id, floor_number, floor_label, level_elevation_m, map_status, map_verified_at, published_at, is_demo, is_active, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(DEMO_F2, DEMO_HOSPITAL, DEMO_BUILDING, 2, 'First', 3.5, 'published', t, t, 1, 1, t, t);

    // admin users (hospital must exist first for the hospital_id FK)
    for (const u of ADMIN_USERS) {
      const role = ROLES.find((r) => r.key === u.roleKey)!;
      const hash = bcrypt.hashSync(u.password, 10);
      db.prepare('INSERT OR IGNORE INTO admin_users (id, email, display_name, password_hash, role_id, hospital_id, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(uuid(), u.email, u.name, hash, role.id, u.hospitalId ?? null, 1, t, t);
    }

    // departments
    const depts = [
      ['55555555-5555-5555-5555-555555555501', 'Registration', 'पंजीकरण', 'Registration', 'REG'],
      ['55555555-5555-5555-5555-555555555502', 'Pharmacy', 'फार्मेसी', 'Pharmacy', 'PHA'],
      ['55555555-5555-5555-5555-555555555503', 'Emergency', 'आपतकालीन', 'Emergency', 'EMG'],
      ['55555555-5555-5555-5555-555555555504', 'Outpatient Department', 'आउटपेशेंट विभाग', 'OPD', 'OPD'],
      ['55555555-5555-5555-5555-555555555505', 'Laboratory', 'परीक्षणशाला', 'Laboratory', 'LAB'],
    ];
    for (const d of depts) {
      db.prepare('INSERT OR IGNORE INTO departments (id, hospital_id, name, name_hi, category, short_code, is_active, created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(d[0], DEMO_HOSPITAL, d[1], d[2], d[3], d[4], 1, t);
    }

    // rooms
    const rooms = [
      ['44444444-4444-4444-4444-444444444401', DEMO_F1, 'G-01', 'Registration Counter', 'पंजीकरण काउंटर', 'Registration', 5.0, 8.0],
      ['44444444-4444-4444-4444-444444444402', DEMO_F1, 'G-02', 'Pharmacy', 'फार्मेसी', 'Pharmacy', 30.0, 8.0],
      ['44444444-4444-4444-4444-444444444403', DEMO_F1, 'G-03', 'Emergency', 'आपतकालीन', 'Emergency', 5.0, 40.0],
      ['44444444-4444-4444-4444-444444444404', DEMO_F2, 'F-01', 'Outpatient Department', 'आउटपेशेंट विभाग', 'OPD', 15.0, 15.0],
      ['44444444-4444-4444-4444-444444444405', DEMO_F2, 'F-02', 'Laboratory', 'परीक्षणशाला', 'Laboratory', 35.0, 15.0],
    ];
    for (const r of rooms) {
      db.prepare(`INSERT OR IGNORE INTO rooms (id, hospital_id, building_id, floor_id, room_number, name, name_hi, department_id, category, x_centroid, y_centroid, verification_status, is_demo, is_active, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(r[0], DEMO_HOSPITAL, DEMO_BUILDING, r[1], r[2], r[3], r[4], null, r[5], r[6], r[7], 'verified', 1, 1, t, t);
    }
    // link rooms to departments
    db.prepare('UPDATE rooms SET department_id = ? WHERE id = ?').run('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444401');
    db.prepare('UPDATE rooms SET department_id = ? WHERE id = ?').run('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444402');
    db.prepare('UPDATE rooms SET department_id = ? WHERE id = ?').run('55555555-5555-5555-5555-555555555503', '44444444-4444-4444-4444-444444444403');
    db.prepare('UPDATE rooms SET department_id = ? WHERE id = ?').run('55555555-5555-5555-5555-555555555504', '44444444-4444-4444-4444-444444444404');
    db.prepare('UPDATE rooms SET department_id = ? WHERE id = ?').run('55555555-5555-5555-5555-555555555505', '44444444-4444-4444-4444-444444444405');

    // entrances / exits
    db.prepare(`INSERT OR IGNORE INTO entrances (id, hospital_id, building_id, floor_id, name, kind, latitude, longitude, x_metres, y_metres, is_emergency, is_accessible, verification_status, is_demo, is_active, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run('66666666-6666-6666-6666-666666666601', DEMO_HOSPITAL, DEMO_BUILDING, DEMO_F1, 'Main Entrance', 'main', 25.1858, 75.8326, 0.0, 50.0, 0, 1, 'verified', 1, 1, t);
    db.prepare(`INSERT OR IGNORE INTO entrances (id, hospital_id, building_id, floor_id, name, kind, latitude, longitude, x_metres, y_metres, is_emergency, is_accessible, verification_status, is_demo, is_active, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run('66666666-6666-6666-6666-666666666602', DEMO_HOSPITAL, DEMO_BUILDING, DEMO_F1, 'Emergency Entrance', 'emergency', 25.1859, 75.8325, 5.0, 40.0, 1, 1, 'verified', 1, 1, t);
    db.prepare(`INSERT OR IGNORE INTO exits (id, hospital_id, building_id, floor_id, name, kind, latitude, longitude, x_metres, y_metres, is_emergency, is_accessible, verification_status, is_demo, is_active, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run('77777777-7777-7777-7777-777777777701', DEMO_HOSPITAL, DEMO_BUILDING, DEMO_F1, 'Main Exit', 'public', 25.1858, 75.8326, 0.0, 50.0, 0, 1, 'verified', 1, 1, t);

    // nav nodes ground
    const nodesG = [
      ['88888888-8888-8888-8888-888888888801', DEMO_F1, 'entrance', 0.0, 50.0, null, 'wheelchair_accessible', 'Main Entrance'],
      ['88888888-8888-8888-8888-888888888802', DEMO_F1, 'junction', 10.0, 50.0, null, 'wheelchair_accessible', 'Junction A'],
      ['88888888-8888-8888-8888-888888888803', DEMO_F1, 'junction', 10.0, 20.0, null, 'wheelchair_accessible', 'Junction B'],
      ['88888888-8888-8888-8888-888888888804', DEMO_F1, 'junction', 40.0, 20.0, null, 'wheelchair_accessible', 'Junction C'],
      ['88888888-8888-8888-8888-888888888805', DEMO_F1, 'room', 5.0, 8.0, '44444444-4444-4444-4444-444444444401', 'wheelchair_accessible', 'Registration'],
      ['88888888-8888-8888-8888-888888888806', DEMO_F1, 'room', 30.0, 8.0, '44444444-4444-4444-4444-444444444402', 'wheelchair_accessible', 'Pharmacy'],
      ['88888888-8888-8888-8888-888888888807', DEMO_F1, 'room', 5.0, 40.0, '44444444-4444-4444-4444-444444444403', 'wheelchair_accessible', 'Emergency'],
      ['88888888-8888-8888-8888-888888888808', DEMO_F1, 'lift', 10.0, 15.0, null, 'wheelchair_accessible', 'Lift to First Floor'],
      ['88888888-8888-8888-8888-888888888809', DEMO_F1, 'stair', 12.0, 15.0, null, 'stairs_only', 'Stairs to First Floor'],
    ];
    for (const n of nodesG) {
      db.prepare(`INSERT OR IGNORE INTO navigation_nodes (id, floor_id, node_type, x_metres, y_metres, room_id, facility_id, accessibility, label, metadata, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(n[0], n[1], n[2], n[3], n[4], n[5], null, n[6], n[7], '{}', t, t);
    }
    const nodesF = [
      ['88888888-8888-8888-8888-888888888811', DEMO_F2, 'lift', 10.0, 15.0, null, 'wheelchair_accessible', 'Lift from Ground'],
      ['88888888-8888-8888-8888-888888888812', DEMO_F2, 'stair', 12.0, 15.0, null, 'stairs_only', 'Stairs from Ground'],
      ['88888888-8888-8888-8888-888888888813', DEMO_F2, 'junction', 10.0, 20.0, null, 'wheelchair_accessible', 'Junction D'],
      ['88888888-8888-8888-8888-888888888814', DEMO_F2, 'junction', 30.0, 20.0, null, 'wheelchair_accessible', 'Junction E'],
      ['88888888-8888-8888-8888-888888888815', DEMO_F2, 'room', 15.0, 15.0, '44444444-4444-4444-4444-444444444404', 'wheelchair_accessible', 'OPD'],
      ['88888888-8888-8888-8888-888888888816', DEMO_F2, 'room', 35.0, 15.0, '44444444-4444-4444-4444-444444444405', 'wheelchair_accessible', 'Laboratory'],
    ];
    for (const n of nodesF) {
      db.prepare(`INSERT OR IGNORE INTO navigation_nodes (id, floor_id, node_type, x_metres, y_metres, room_id, facility_id, accessibility, label, metadata, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(n[0], n[1], n[2], n[3], n[4], n[5], null, n[6], n[7], '{}', t, t);
    }

    // edges ground
    const edgesG = [
      ['99999999-9999-9999-9999-999999999901', '88888888-8888-8888-8888-888888888801', '88888888-8888-8888-8888-888888888802', 'corridor', 10.0, 'wheelchair_accessible', 1, 0, null],
      ['99999999-9999-9999-9999-999999999902', '88888888-8888-8888-8888-888888888802', '88888888-8888-8888-8888-888888888803', 'corridor', 30.0, 'wheelchair_accessible', 1, 0, null],
      ['99999999-9999-9999-9999-999999999903', '88888888-8888-8888-8888-888888888803', '88888888-8888-8888-8888-888888888804', 'corridor', 30.0, 'wheelchair_accessible', 1, 0, null],
      ['99999999-9999-9999-9999-999999999904', '88888888-8888-8888-8888-888888888803', '88888888-8888-8888-8888-888888888805', 'corridor', 13.0, 'wheelchair_accessible', 1, 0, null],
      ['99999999-9999-9999-9999-999999999905', '88888888-8888-8888-8888-888888888803', '88888888-8888-8888-8888-888888888806', 'corridor', 25.0, 'wheelchair_accessible', 1, 0, null],
      ['99999999-9999-9999-9999-999999999906', '88888888-8888-8888-8888-888888888803', '88888888-8888-8888-8888-888888888807', 'corridor', 20.0, 'wheelchair_accessible', 1, 0, null],
      ['99999999-9999-9999-9999-999999999907', '88888888-8888-8888-8888-888888888802', '88888888-8888-8888-8888-888888888808', 'corridor', 5.0, 'wheelchair_accessible', 1, 0, null],
      ['99999999-9999-9999-9999-999999999908', '88888888-8888-8888-8888-888888888802', '88888888-8888-8888-8888-888888888809', 'corridor', 5.0, 'stairs_only', 1, 0, null],
    ];
    for (const e of edgesG) {
      db.prepare(`INSERT OR IGNORE INTO navigation_edges (id, floor_id, start_node_id, end_node_id, kind, distance_metres, accessibility, is_bidirectional, one_way_direction, is_vertical, connects_to_floor_id, is_active, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(e[0], DEMO_F1, e[1], e[2], e[3], e[4], e[5], e[6], null, e[7], e[8], 1, t, t);
    }
    // vertical edges
    db.prepare(`INSERT OR IGNORE INTO navigation_edges (id, floor_id, start_node_id, end_node_id, kind, distance_metres, accessibility, is_bidirectional, one_way_direction, is_vertical, connects_to_floor_id, is_active, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run('99999999-9999-9999-9999-999999999911', DEMO_F1, '88888888-8888-8888-8888-888888888808', '88888888-8888-8888-8888-888888888811', 'lift', 3.5, 'wheelchair_accessible', 1, null, 1, DEMO_F2, 1, t, t);
    db.prepare(`INSERT OR IGNORE INTO navigation_edges (id, floor_id, start_node_id, end_node_id, kind, distance_metres, accessibility, is_bidirectional, one_way_direction, is_vertical, connects_to_floor_id, is_active, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run('99999999-9999-9999-9999-999999999912', DEMO_F1, '88888888-8888-8888-8888-888888888809', '88888888-8888-8888-8888-888888888812', 'stair', 3.5, 'stairs_only', 1, null, 1, DEMO_F2, 1, t, t);
    // first floor edges
    const edgesF = [
      ['99999999-9999-9999-9999-999999999921', '88888888-8888-8888-8888-888888888811', '88888888-8888-8888-8888-888888888813', 'corridor', 5.0, 'wheelchair_accessible', 1, 0, null],
      ['99999999-9999-9999-9999-999999999922', '88888888-8888-8888-8888-888888888813', '88888888-8888-8888-8888-888888888814', 'corridor', 20.0, 'wheelchair_accessible', 1, 0, null],
      ['99999999-9999-9999-9999-999999999923', '88888888-8888-8888-8888-888888888813', '88888888-8888-8888-8888-888888888815', 'corridor', 7.0, 'wheelchair_accessible', 1, 0, null],
      ['99999999-9999-9999-9999-999999999924', '88888888-8888-8888-8888-888888888814', '88888888-8888-8888-8888-888888888816', 'corridor', 7.0, 'wheelchair_accessible', 1, 0, null],
    ];
    for (const e of edgesF) {
      db.prepare(`INSERT OR IGNORE INTO navigation_edges (id, floor_id, start_node_id, end_node_id, kind, distance_metres, accessibility, is_bidirectional, one_way_direction, is_vertical, connects_to_floor_id, is_active, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(e[0], DEMO_F2, e[1], e[2], e[3], e[4], e[5], e[6], null, e[7], e[8], 1, t, t);
    }

    // qr locations
    const qrs = [
      ['aaaaaaa1-0000-0000-0000-000000000001', DEMO_F1, '44444444-4444-4444-4444-444444444401', '88888888-8888-8888-8888-888888888805', 'MDH-G-REG-001', 'Registration Counter', 5.0, 8.0],
      ['aaaaaaa2-0000-0000-0000-000000000002', DEMO_F1, '44444444-4444-4444-4444-444444444402', '88888888-8888-8888-8888-888888888806', 'MDH-G-PHA-001', 'Pharmacy', 30.0, 8.0],
      ['aaaaaaa3-0000-0000-0000-000000000003', DEMO_F1, '44444444-4444-4444-4444-444444444403', '88888888-8888-8888-8888-888888888807', 'MDH-G-EMG-001', 'Emergency', 5.0, 40.0],
      ['aaaaaaa4-0000-0000-0000-000000000004', DEMO_F2, '44444444-4444-4444-4444-444444444404', '88888888-8888-8888-8888-888888888815', 'MDH-F-OPD-001', 'Outpatient Department', 15.0, 15.0],
    ];
    for (const q of qrs) {
      db.prepare(`INSERT OR IGNORE INTO qr_locations (id, hospital_id, building_id, floor_id, room_id, node_id, location_identifier, label, x_metres, y_metres, is_active, generated_at, verification_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(q[0], DEMO_HOSPITAL, DEMO_BUILDING, q[1], q[2], q[3], q[4], q[5], q[6], q[7], 1, t, 'verified');
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
