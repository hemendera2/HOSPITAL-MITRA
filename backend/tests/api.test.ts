import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Use a fresh temp DB for every test run.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-test-'));
process.env.DB_FILE = path.join(tmpDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret';
process.env.CORS_ORIGINS = '*';

let server: import('node:http').Server;
let base: string;

const { createApp } = await import('../src/app.js');
const { pixelToMetric, metricToPixel, validateCalibration } = await import('../src/map/calibration.js');
const { isValidIdentifier, buildIdentifier } = await import('../src/map/qr.js');

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function api(method: string, url: string, token?: string, body?: unknown) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ---- Calibration & QR helpers ---------------------------------------------

test('calibration round-trips pixel -> metric -> pixel', () => {
  const cal = { scalePpm: 100, originX: 0, originY: 0, rotationDeg: 0, imageWidthPx: 1000, imageHeightPx: 800 };
  const m = pixelToMetric({ px: 100, py: 50 }, cal);
  const p = metricToPixel(m, cal);
  assert.ok(Math.abs(p.px - 100) < 1e-9);
  assert.ok(Math.abs(p.py - 50) < 1e-9);
});

test('calibration rejects invalid scale', () => {
  assert.equal(validateCalibration({ scalePpm: 0, originX: 0, originY: 0, rotationDeg: 0, imageWidthPx: 10, imageHeightPx: 10 }).ok, false);
});

test('QR identifier format is valid and rejects junk', () => {
  const id = buildIdentifier({ hospitalShort: 'MDH', floorLetter: 'G', slot: 'REG', sequence: 1 });
  assert.equal(id, 'MDH-G-REG-001');
  assert.equal(isValidIdentifier(id), true);
  assert.equal(isValidIdentifier('not-a-qr'), false);
});

// ---- Auth ------------------------------------------------------------------

test('admin login returns a JWT for seeded credentials', async () => {
  const { status, data } = await api('POST', '/api/auth/login', undefined, { email: 'super@mitra.demo', password: 'Mitra@Admin2026' });
  assert.equal(status, 200);
  assert.ok(data.token);
  assert.equal(data.user.role, 'super_admin');
});

test('admin login rejects wrong password', async () => {
  const { status } = await api('POST', '/api/auth/login', undefined, { email: 'super@mitra.demo', password: 'wrong' });
  assert.equal(status, 401);
});

test('protected endpoint rejects missing token', async () => {
  const { status } = await api('GET', '/api/auth/me');
  assert.equal(status, 401);
});

// ---- RBAC -----------------------------------------------------------------

test('read-only staff cannot create a hospital', async () => {
  const login = await api('POST', '/api/auth/login', undefined, { email: 'staff@mitra.demo', password: 'Mitra@Staff2026' });
  const token = login.data.token as string;
  const { status } = await api('POST', '/api/admin/hospitals', token, { name: 'X', city: 'Y', district: 'Z' });
  assert.equal(status, 403);
});

test('super admin can create a hospital', async () => {
  const login = await api('POST', '/api/auth/login', undefined, { email: 'super@mitra.demo', password: 'Mitra@Admin2026' });
  const token = login.data.token as string;
  const { status, data } = await api('POST', '/api/admin/hospitals', token, { name: 'Test Gov Hospital', city: 'Kota', district: 'Kota' });
  assert.equal(status, 201);
  assert.equal(data.mapping_status, 'unmapped');
  assert.equal(data.is_demo, 0);
});

// ---- Map publish workflow --------------------------------------------------

test('unverified map cannot be published', async () => {
  const login = await api('POST', '/api/auth/login', undefined, { email: 'super@mitra.demo', password: 'Mitra@Admin2026' });
  const token = login.data.token as string;
  const hospitals = await api('GET', '/api/patient/hospitals');
  const demo = hospitals.data.hospitals.find((h: { name: string }) => h.name === 'Mitra Demo Hospital');
  const floors = await api('GET', `/api/admin/hospitals/${demo.id}/floors`, token);
  const ground = floors.data.floors.find((f: { floor_number: number }) => f.floor_number === 1);
  assert.ok(ground, 'demo ground floor should be listed');

  // create a brand-new floor on the demo hospital -> draft
  const buildings = await api('GET', `/api/admin/hospitals/${demo.id}`, token);
  const building = buildings.data.buildings[0];
  const newFloor = await api('POST', `/api/admin/hospitals/${demo.id}/floors`, token, {
    hospital_id: demo.id, building_id: building.id, floor_number: 9, floor_label: 'Test',
  });
  assert.equal(newFloor.status, 201);
  // create a draft map version for the new floor
  const version = await api('POST', `/api/admin/hospitals/${demo.id}/floors/${newFloor.data.id}/versions`, token, {
    change_summary: 'initial draft',
  });
  assert.equal(version.status, 201);
  // publish an unverified version -> 403 (must verify first)
  const pub = await api('POST', `/api/admin/hospitals/${demo.id}/floors/${newFloor.data.id}/publish`, token);
  assert.equal(pub.status, 403);
});

test('verified + published map becomes visible in the patient API', async () => {
  const login = await api('POST', '/api/auth/login', undefined, { email: 'super@mitra.demo', password: 'Mitra@Admin2026' });
  const token = login.data.token as string;
  const hospitals = await api('GET', '/api/patient/hospitals');
  const demo = hospitals.data.hospitals.find((h: { name: string }) => h.name === 'Mitra Demo Hospital');
  const detail = await api('GET', `/api/admin/hospitals/${demo.id}`, token);
  const ground = detail.data.floors.find((f: { floor_number: number }) => f.floor_number === 1);

  // the demo ground floor is already published; verify patient sees it
  const patientFloors = await api('GET', `/api/patient/hospitals/${demo.id}`);
  assert.ok(patientFloors.data.floors.some((f: { id: string }) => f.id === ground.id));
  assert.equal(patientFloors.data.hospital.map_verified, 1);
});

// ---- Patient routing & search ---------------------------------------------

test('patient can compute a route on the published demo graph', async () => {
  const hospitals = await api('GET', '/api/patient/hospitals');
  const demo = hospitals.data.hospitals.find((h: { name: string }) => h.name === 'Mitra Demo Hospital');
  // entrance node -> pharmacy room node (use seeded ids)
  const r = await api('POST', `/api/patient/hospitals/${demo.id}/route`, undefined, {
    start_node_id: '88888888-8888-8888-8888-888888888801',
    end_node_id: '88888888-8888-8888-8888-888888888806',
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.found, true);
  assert.equal(r.data.totalDistanceMetres, 65);
  assert.ok(r.data.steps.length >= 3);
});

test('patient wheelchair route avoids stairs', async () => {
  const hospitals = await api('GET', '/api/patient/hospitals');
  const demo = hospitals.data.hospitals.find((h: { name: string }) => h.name === 'Mitra Demo Hospital');
  const r = await api('POST', `/api/patient/hospitals/${demo.id}/route`, undefined, {
    start_node_id: '88888888-8888-8888-8888-888888888801',
    end_node_id: '88888888-8888-8888-8888-888888888816', // lab on first floor
    wheelchair_only: true,
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.found, true);
  assert.equal(r.data.accessible, true);
  assert.equal(r.data.steps.some((s: { kind: string }) => s.kind === 'stair'), false);
});

test('patient smart search finds pharmacy by English and Hindi terms', async () => {
  const hospitals = await api('GET', '/api/patient/hospitals');
  const demo = hospitals.data.hospitals.find((h: { name: string }) => h.name === 'Mitra Demo Hospital');
  const en = await api('GET', `/api/patient/hospitals/${demo.id}/search?q=pharmacy`);
  assert.ok(en.data.results.some((r: { label: string }) => /pharmacy/i.test(r.label)));
  const hi = await api('GET', `/api/patient/hospitals/${demo.id}/search?q=फार्मेसी`);
  assert.ok(hi.data.results.length >= 1);
});

test('patient offline bundle contains the published graph', async () => {
  const hospitals = await api('GET', '/api/patient/hospitals');
  const demo = hospitals.data.hospitals.find((h: { name: string }) => h.name === 'Mitra Demo Hospital');
  const bundle = await api('GET', `/api/patient/hospitals/${demo.id}/offline-bundle`);
  assert.equal(bundle.status, 200);
  assert.ok(bundle.data.floors.length >= 2);
  assert.ok(bundle.data.floors[0].nodes.length > 0);
  assert.ok(bundle.data.floors[0].edges.length > 0);
});

// ---- QR resolution ---------------------------------------------------------

test('QR resolve returns a verified location for a seeded identifier', async () => {
  const r = await api('GET', '/api/patient/qr/resolve/MDH-G-REG-001');
  assert.equal(r.status, 200);
  assert.equal(r.data.location.label, 'Registration Counter');
  assert.equal(r.data.location.verification_status, 'verified');
});

test('QR resolve rejects an invalid identifier', async () => {
  const r = await api('GET', '/api/patient/qr/resolve/not-valid');
  assert.equal(r.status, 400);
});

test('QR resolve rejects an unknown identifier', async () => {
  const r = await api('GET', '/api/patient/qr/resolve/ZZZ-G-XXX-999');
  assert.equal(r.status, 400);
});

// ---- Feedback --------------------------------------------------------------

test('patient can submit feedback and staff can review it', async () => {
  const hospitals = await api('GET', '/api/patient/hospitals');
  const demo = hospitals.data.hospitals.find((h: { name: string }) => h.name === 'Mitra Demo Hospital');
  const sub = await api('POST', `/api/patient/hospitals/${demo.id}/feedback`, undefined, {
    category: 'room_location', description: 'Registration counter not clearly marked',
  });
  assert.equal(sub.status, 201);
  const login = await api('POST', '/api/auth/login', undefined, { email: 'verifier@mitra.demo', password: 'Mitra@Verify2026' });
  const token = login.data.token as string;
  const fb = await api('GET', `/api/admin/hospitals/${demo.id}/feedback`, token);
  assert.ok(fb.data.feedback.length >= 1);
  const review = await api('POST', `/api/admin/hospitals/${demo.id}/feedback/${sub.data.id}/review`, token, { status: 'resolved', resolution_note: 'Added signage' });
  assert.equal(review.status, 200);
  assert.equal(review.data.status, 'resolved');
});

// ---- Audit ----------------------------------------------------------------

test('audit log records admin actions', async () => {
  const login = await api('POST', '/api/auth/login', undefined, { email: 'super@mitra.demo', password: 'Mitra@Admin2026' });
  const token = login.data.token as string;
  const hospitals = await api('GET', '/api/patient/hospitals');
  const demo = hospitals.data.hospitals.find((h: { name: string }) => h.name === 'Mitra Demo Hospital');
  // perform an action on the demo hospital so a hospital-scoped audit entry exists
  await api('POST', `/api/admin/hospitals/${demo.id}/departments`, token, { name: 'Cardiology', category: 'OPD' });
  const logs = await api('GET', `/api/admin/hospitals/${demo.id}/audit`, token);
  assert.equal(logs.status, 200);
  assert.ok(logs.data.logs.length >= 1);
  assert.ok(logs.data.logs.some((l: { action: string }) => l.action === 'department.create'));
});
