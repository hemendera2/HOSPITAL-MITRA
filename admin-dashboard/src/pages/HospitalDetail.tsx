import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type HospitalDetail, type Building, type Floor, type Department, type Room, type Facility, type Doctor, type MapVersion, type QrLocation } from '../lib/api';
import { useAuth } from '../store/auth';
import { Loading, Empty, Modal, statusBadge, Badge, useToast, useConfirm } from '../components/ui';

type Tab = 'overview' | 'buildings' | 'departments' | 'rooms' | 'facilities' | 'doctors' | 'qr' | 'versions';

export default function HospitalDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [detail, setDetail] = useState<HospitalDetail | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setDetail(await api.get<HospitalDetail>(`/api/admin/hospitals/${id}`)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  if (loading) return <Loading />;
  if (!detail) return <Empty icon="❓" title="Hospital not found" />;

  const tabs: [Tab, string][] = [
    ['overview', 'Overview'], ['buildings', 'Buildings & Floors'], ['departments', 'Departments'],
    ['rooms', 'Rooms'], ['facilities', 'Facilities'], ['doctors', 'Doctors'], ['qr', 'QR Locations'], ['versions', 'Map Versions'],
  ];

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div>
        <Link to="/hospitals" className="muted" style={{ fontSize: 13 }}>← All hospitals</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>{detail.hospital.name}</h1>
          {detail.hospital.is_demo ? <Badge kind="brand">DEMO</Badge> : null}
          {statusBadge(detail.hospital.mapping_status)}
        </div>
        <div className="muted" style={{ marginTop: 4 }}>{detail.hospital.city}, {detail.hospital.district} · {detail.hospital.address}</div>
      </div>

      <div className="tabs">
        {tabs.map(([k, l]) => <div key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</div>)}
      </div>

      {tab === 'overview' && <Overview detail={detail} />}
      {tab === 'buildings' && <BuildingsTab hospitalId={id!} detail={detail} onChange={load} />}
      {tab === 'departments' && <DepartmentsTab hospitalId={id!} detail={detail} onChange={load} />}
      {tab === 'rooms' && <RoomsTab hospitalId={id!} detail={detail} />}
      {tab === 'facilities' && <FacilitiesTab hospitalId={id!} detail={detail} onChange={load} />}
      {tab === 'doctors' && <DoctorsTab hospitalId={id!} detail={detail} onChange={load} />}
      {tab === 'qr' && <QrTab hospitalId={id!} />}
      {tab === 'versions' && <VersionsTab hospitalId={id!} detail={detail} />}
    </div>
  );
}

function Overview({ detail }: { detail: HospitalDetail }) {
  return (
    <div className="grid grid-3">
      <div className="card card-pad"><div className="stat"><span className="num">{detail.buildings.length}</span><span className="lbl">Buildings</span></div></div>
      <div className="card card-pad"><div className="stat"><span className="num">{detail.floors.length}</span><span className="lbl">Floors</span></div></div>
      <div className="card card-pad"><div className="stat"><span className="num">{detail.floors.filter((f) => f.map_status === 'published').length}</span><span className="lbl">Published maps</span></div></div>
      <div className="card card-pad"><div className="stat"><span className="num">{detail.departments.length}</span><span className="lbl">Departments</span></div></div>
      <div className="card card-pad"><div className="stat"><span className="num">{detail.doctors.length}</span><span className="lbl">Doctors</span></div></div>
      <div className="card card-pad"><div className="stat"><span className="num">{detail.facilities.length}</span><span className="lbl">Facilities</span></div></div>
      <div className="card card-pad">
        <h2>Floors</h2>
        {detail.floors.length === 0 ? <Empty icon="🗺️" title="No floors yet" hint="Add a building and floors, then digitise a map." /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Floor</th><th>Label</th><th>Elevation</th><th>Status</th><th></th></tr></thead>
            <tbody>{detail.floors.map((f) => (
              <tr key={f.id}>
                <td>F{f.floor_number}</td><td>{f.floor_label}</td>
                <td>{f.level_elevation_m ?? '—'} m</td><td>{statusBadge(f.map_status)}</td>
                <td>{f.map_status === 'published' || f.map_status === 'verified' ? <Link className="btn btn-sm" to={`/hospitals/${detail.hospital.id}/map/${f.id}`}>Open map</Link> : <span className="muted">Draft</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function BuildingsTab({ hospitalId, detail, onChange }: { hospitalId: string; detail: HospitalDetail; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', latitude: '', longitude: '' });

  async function addBuilding(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/api/admin/hospitals/${hospitalId}/buildings`, { ...form, latitude: form.latitude ? Number(form.latitude) : undefined, longitude: form.longitude ? Number(form.longitude) : undefined });
    toast('Building added', 'ok'); setShow(false); setForm({ name: '', code: '', latitude: '', longitude: '' }); onChange();
  }
  async function addFloor(b: Building) {
    const num = prompt('Floor number (1 = ground):');
    const label = prompt('Floor label (e.g. Ground, First):');
    if (!num || !label) return;
    await api.post(`/api/admin/hospitals/${hospitalId}/floors`, { hospital_id: hospitalId, building_id: b.id, floor_number: Number(num), floor_label: label });
    toast('Floor added — open it to digitise the map', 'ok'); onChange();
  }
  async function delBuilding(b: Building) {
    if (!await confirm(`Delete building "${b.name}" and all its floors?`)) return;
    await api.del(`/api/admin/hospitals/${hospitalId}/buildings/${b.id}`); toast('Building deleted', 'ok'); onChange();
  }

  return (
    <div className="grid grid-2">
      {can('map:edit') && (
        <div className="card card-pad" style={{ alignSelf: 'start' }}>
          <h2>Add building</h2>
          <form onSubmit={addBuilding}>
            <div className="field"><label>Name *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="row">
              <div className="field"><label>Code</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div className="field"><label>Lat</label><input className="input" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></div>
              <div className="field"><label>Long</label><input className="input" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></div>
            </div>
            <button className="btn btn-primary" type="submit">Add building</button>
          </form>
        </div>
      )}
      <div className="card card-pad">
        <h2>Buildings ({detail.buildings.length})</h2>
        {detail.buildings.length === 0 ? <Empty icon="🏢" title="No buildings" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {detail.buildings.map((b) => (
              <div key={b.id} className="card card-pad" style={{ boxShadow: 'none', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong>{b.name}</strong> <span className="muted">{b.code}</span></div>
                  <div className="btn-row">
                    <button className="btn btn-sm btn-primary" onClick={() => addFloor(b)}>＋ Floor</button>
                    {can('hospital:manage') && <button className="btn btn-sm btn-danger" onClick={() => delBuilding(b)}>Delete</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

function DepartmentsTab({ hospitalId, detail, onChange }: { hospitalId: string; detail: HospitalDetail; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', name_hi: '', category: '', short_code: '' });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/api/admin/hospitals/${hospitalId}/departments`, form);
    toast('Department added', 'ok'); setForm({ name: '', name_hi: '', category: '', short_code: '' }); onChange();
  }
  async function del(d: Department) {
    await api.del(`/api/admin/hospitals/${hospitalId}/departments/${d.id}`); toast('Department deleted', 'ok'); onChange();
  }
  return (
    <div className="grid grid-2">
      {can('department:edit') && (
        <div className="card card-pad" style={{ alignSelf: 'start' }}>
          <h2>Add department</h2>
          <form onSubmit={add}>
            <div className="field"><label>Name *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="row">
              <div className="field"><label>Hindi name</label><input className="input" value={form.name_hi} onChange={(e) => setForm({ ...form, name_hi: e.target.value })} /></div>
              <div className="field"><label>Category</label><input className="input" placeholder="OPD, Lab…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div className="field"><label>Code</label><input className="input" value={form.short_code} onChange={(e) => setForm({ ...form, short_code: e.target.value })} /></div>
            </div>
            <button className="btn btn-primary" type="submit">Add department</button>
          </form>
        </div>
      )}
      <div className="card card-pad">
        <h2>Departments ({detail.departments.length})</h2>
        {detail.departments.length === 0 ? <Empty icon="🏥" title="No departments" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Name</th><th>Hindi</th><th>Category</th><th>Code</th><th></th></tr></thead>
            <tbody>{detail.departments.map((d) => (
              <tr key={d.id}><td><strong>{d.name}</strong></td><td>{d.name_hi || '—'}</td><td>{d.category || '—'}</td><td>{d.short_code || '—'}</td>
                <td>{can('department:edit') && <button className="btn btn-sm btn-danger" onClick={() => del(d)}>Delete</button>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function RoomsTab({ hospitalId, detail }: { hospitalId: string; detail: HospitalDetail }) {
  const floors = detail.floors;
  const [floorId, setFloorId] = useState<string>('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState({ room_number: '', name: '', name_hi: '', category: '' });
  const { can } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!floorId && floors.length) { setFloorId(floors[0].id); }
  }, [floors, floorId]);
  useEffect(() => {
    if (!floorId) return;
    api.get<{ rooms: Room[] }>(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/rooms`).then((d) => setRooms(d.rooms));
  }, [floorId, hospitalId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!floorId) return;
    await api.post(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/rooms`, { hospital_id: hospitalId, building_id: floors.find((f) => f.id === floorId)!.building_id, floor_id: floorId, ...form });
    toast('Room added', 'ok'); setForm({ room_number: '', name: '', name_hi: '', category: '' });
    api.get<{ rooms: Room[] }>(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/rooms`).then((d) => setRooms(d.rooms));
  }
  async function verify(r: Room) {
    await api.patch(`/api/admin/hospitals/${hospitalId}/rooms/${r.id}/verify?status=verified`);
    toast('Room verified', 'ok');
    api.get<{ rooms: Room[] }>(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/rooms`).then((d) => setRooms(d.rooms));
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card card-pad">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0 }}><label>Floor</label>
            <select className="select" value={floorId} onChange={(e) => setFloorId(e.target.value)}>
              {floors.map((f) => <option key={f.id} value={f.id}>F{f.floor_number} — {f.floor_label}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-2">
        {can('room:edit') && (
          <div className="card card-pad" style={{ alignSelf: 'start' }}>
            <h2>Add room</h2>
            <form onSubmit={add}>
              <div className="field"><label>Room number *</label><input className="input" required value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} /></div>
              <div className="row">
                <div className="field"><label>Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="field"><label>Hindi</label><input className="input" value={form.name_hi} onChange={(e) => setForm({ ...form, name_hi: e.target.value })} /></div>
                <div className="field"><label>Category</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              </div>
              <button className="btn btn-primary" type="submit">Add room</button>
            </form>
          </div>
        )}
        <div className="card card-pad">
          <h2>Rooms ({rooms.length})</h2>
          {rooms.length === 0 ? <Empty icon="🚪" title="No rooms on this floor" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>#</th><th>Name</th><th>Category</th><th>Status</th><th></th></tr></thead>
              <tbody>{rooms.map((r) => (
                <tr key={r.id}><td>{r.room_number}</td><td>{r.name || '—'}</td><td>{r.category || '—'}</td><td>{statusBadge(r.verification_status)}</td>
                  <td>{can('map:verify') && r.verification_status !== 'verified' && <button className="btn btn-sm btn-primary" onClick={() => verify(r)}>Verify</button>}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}

function FacilitiesTab({ hospitalId, detail, onChange }: { hospitalId: string; detail: HospitalDetail; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', name_hi: '', facility_type: 'pharmacy', floor_id: '' });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/api/admin/hospitals/${hospitalId}/facilities`, { ...form, hospital_id: hospitalId });
    toast('Facility added', 'ok'); setForm({ name: '', name_hi: '', facility_type: 'pharmacy', floor_id: '' }); onChange();
  }
  return (
    <div className="grid grid-2">
      {can('room:edit') && (
        <div className="card card-pad" style={{ alignSelf: 'start' }}>
          <h2>Add facility</h2>
          <form onSubmit={add}>
            <div className="field"><label>Name *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="row">
              <div className="field"><label>Hindi</label><input className="input" value={form.name_hi} onChange={(e) => setForm({ ...form, name_hi: e.target.value })} /></div>
              <div className="field"><label>Type</label><select className="select" value={form.facility_type} onChange={(e) => setForm({ ...form, facility_type: e.target.value })}>
                <option>pharmacy</option><option>registry</option><option>emergency</option><option>canteen</option><option>atm</option><option>other</option>
              </select></div>
              <div className="field"><label>Floor</label><select className="select" value={form.floor_id} onChange={(e) => setForm({ ...form, floor_id: e.target.value })}>
                <option value="">—</option>{detail.floors.map((f) => <option key={f.id} value={f.id}>F{f.floor_number}</option>)}
              </select></div>
            </div>
            <button className="btn btn-primary" type="submit">Add facility</button>
          </form>
        </div>
      )}
      <div className="card card-pad">
        <h2>Facilities ({detail.facilities.length})</h2>
        {detail.facilities.length === 0 ? <Empty icon="📍" title="No facilities" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>{detail.facilities.map((f) => (<tr key={f.id}><td>{f.name}</td><td>{f.facility_type}</td><td>{statusBadge(f.verification_status)}</td></tr>))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function DoctorsTab({ hospitalId, detail, onChange }: { hospitalId: string; detail: HospitalDetail; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', specialization: '', qualifications: '', registration_number: '', department_id: '' });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/api/admin/hospitals/${hospitalId}/doctors`, { ...form, hospital_id: hospitalId });
    toast('Doctor added', 'ok'); setForm({ name: '', specialization: '', qualifications: '', registration_number: '', department_id: '' }); onChange();
  }
  return (
    <div className="grid grid-2">
      {can('department:edit') && (
        <div className="card card-pad" style={{ alignSelf: 'start' }}>
          <h2>Add doctor (directory only)</h2>
          <form onSubmit={add}>
            <div className="field"><label>Name *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="row">
              <div className="field"><label>Specialization</label><input className="input" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></div>
              <div className="field"><label>Qualifications</label><input className="input" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} /></div>
              <div className="field"><label>Reg. no.</label><input className="input" value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} /></div>
            </div>
            <button className="btn btn-primary" type="submit">Add doctor</button>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Availability &amp; booking are intentionally out of scope (no patient data).</div>
          </form>
        </div>
      )}
      <div className="card card-pad">
        <h2>Doctors ({detail.doctors.length})</h2>
        {detail.doctors.length === 0 ? <Empty icon="🧑‍⚕️" title="No doctors" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Name</th><th>Specialization</th><th>Dept</th></tr></thead>
            <tbody>{detail.doctors.map((d) => (<tr key={d.id}><td><strong>{d.name}</strong></td><td>{d.specialization || '—'}</td><td>{d.department_name || '—'}</td></tr>))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function QrTab({ hospitalId }: { hospitalId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<QrLocation[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [form, setForm] = useState({ label: '', floor_id: '', slot: '' });
  const [preview, setPreview] = useState<string>('');

  useEffect(() => { load(); api.get<{ floors: Floor[] }>(`/api/admin/hospitals/${hospitalId}/floors`).then((d) => setFloors(d.floors)); }, [hospitalId]);
  async function load() { setList((await api.get<{ locations: QrLocation[] }>(`/api/admin/hospitals/${hospitalId}/qr`)).locations); }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.floor_id) { toast('Select a floor first', 'error'); return; }
    const res = await api.post<QrLocation & { qr_data_url?: string }>(`/api/admin/hospitals/${hospitalId}/qr`, { hospital_id: hospitalId, building_id: floors.find((f) => f.id === form.floor_id)!.building_id, floor_id: form.floor_id, label: form.label, slot: form.slot });
    setPreview(res.qr_data_url || '');
    toast('QR location created', 'ok'); setForm({ label: '', floor_id: '', slot: '' }); load();
  }
  async function verify(q: QrLocation) { await api.patch(`/api/admin/hospitals/${hospitalId}/qr/${q.id}/verify?status=verified`); toast('QR verified', 'ok'); load(); }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid grid-2">
        {can('qr:generate') && (
          <div className="card card-pad">
            <h2>Generate QR location</h2>
            <form onSubmit={generate}>
              <div className="field"><label>Label *</label><input className="input" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Registration Counter" /></div>
              <div className="row">
                <div className="field"><label>Floor</label><select className="select" value={form.floor_id} onChange={(e) => setForm({ ...form, floor_id: e.target.value })}><option value="">—</option>{floors.map((f) => <option key={f.id} value={f.id}>F{f.floor_number}</option>)}</select></div>
                <div className="field"><label>Slot code</label><input className="input" value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} placeholder="REG" /></div>
              </div>
              <button className="btn btn-primary" type="submit">Generate QR</button>
            </form>
            {preview && <div style={{ marginTop: 14, textAlign: 'center' }}><img src={preview} alt="QR" style={{ width: 220, borderRadius: 10, border: '1px solid var(--border)' }} /></div>}
          </div>
        )}
        <div className="card card-pad">
          <h2>QR locations ({list.length})</h2>
          {list.length === 0 ? <Empty icon="🔳" title="No QR locations" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Identifier</th><th>Label</th><th>Status</th><th></th></tr></thead>
              <tbody>{list.map((q) => (<tr key={q.id}><td><code>{q.location_identifier}</code></td><td>{q.label}</td><td>{statusBadge(q.verification_status)}</td>
                <td>{can('map:verify') && q.verification_status !== 'verified' && <button className="btn btn-sm btn-primary" onClick={() => verify(q)}>Verify</button>}</td></tr>))}</tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionsTab({ hospitalId, detail }: { hospitalId: string; detail: HospitalDetail }) {
  const { can } = useAuth();
  const toast = useToast();
  const [versions, setVersions] = useState<MapVersion[]>([]);
  const [floorId, setFloorId] = useState('');
  useEffect(() => {
    if (!floorId && detail.floors.length) setFloorId(detail.floors[0].id);
  }, [detail.floors, floorId]);
  useEffect(() => { if (floorId) api.get<{ versions: MapVersion[] }>(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/versions`).then((d) => setVersions(d.versions)); }, [floorId, hospitalId]);

  async function snapshot() {
    await api.post(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/versions`, { change_summary: 'Manual snapshot' });
    toast('Map version snapshot saved', 'ok');
    api.get<{ versions: MapVersion[] }>(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/versions`).then((d) => setVersions(d.versions));
  }
  async function publish() { await api.post(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/publish`, {}); toast('Map published', 'ok'); }
  async function unpublish() { await api.post(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/unpublish`, {}); toast('Map unpublished', 'ok'); }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card card-pad">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0 }}><label>Floor</label>
            <select className="select" value={floorId} onChange={(e) => setFloorId(e.target.value)}>{detail.floors.map((f) => <option key={f.id} value={f.id}>F{f.floor_number} — {f.floor_label}</option>)}</select>
          </div>
          {can('map:edit') && <button className="btn" onClick={snapshot}>＋ Snapshot version</button>}
          {can('map:publish') && <button className="btn btn-primary" onClick={publish}>Publish map</button>}
          {can('map:publish') && <button className="btn btn-danger" onClick={unpublish}>Unpublish</button>}
        </div>
      </div>
      <div className="card card-pad">
        <h2>Version history</h2>
        {versions.length === 0 ? <Empty icon="🗄️" title="No versions yet" hint="Digitise the map, then snapshot a version." /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Version</th><th>Summary</th><th>Status</th><th>By</th><th>Created</th></tr></thead>
            <tbody>{versions.map((v) => (<tr key={v.id}><td>v{v.version_number}</td><td>{v.change_summary || '—'}</td><td>{statusBadge(v.status)}</td><td>{v.created_by_name || '—'}</td><td>{new Date(v.created_at).toLocaleString()}</td></tr>))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
