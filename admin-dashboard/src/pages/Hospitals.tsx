import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Hospital } from '../lib/api';
import { useAuth } from '../store/auth';
import { Loading, Empty, Modal, statusBadge, Badge, useToast, useConfirm } from '../components/ui';

export default function Hospitals() {
  const { can } = useAuth();
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Hospital | 'new' | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ hospitals: Hospital[] }>(`/api/patient/hospitals?search=${encodeURIComponent(search)}`);
      setHospitals(data.hospitals);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search]);

  async function save(body: Record<string, unknown>) {
    if (editing === 'new') {
      await api.post('/api/admin/hospitals', body);
      toast('Hospital added', 'ok');
    } else if (editing) {
      await api.patch(`/api/admin/hospitals/${editing.id}`, body);
      toast('Hospital updated', 'ok');
    }
    setEditing(null);
    load();
  }
  async function remove(h: Hospital) {
    if (!await confirm(`Delete "${h.name}"? All its buildings, floors, rooms and maps will be removed.`)) return;
    await api.del(`/api/admin/hospitals/${h.id}`);
    toast('Hospital deleted', 'ok');
    load();
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="card card-pad">
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <input className="input" placeholder="Search hospitals, city, district…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {can('hospital:manage') && <button className="btn btn-primary" onClick={() => setEditing('new')}>＋ Add hospital</button>}
        </div>
      </div>

      {loading ? <Loading /> : hospitals.length === 0 ? <Empty icon="🏥" title="No hospitals found" hint="Add a hospital or adjust your search." /> : (
        <div className="grid grid-2">
          {hospitals.map((h) => (
            <div key={h.id} className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Link to={`/hospitals/${h.id}`} style={{ fontWeight: 700, fontSize: 16 }}>{h.name}</Link>
                    {h.is_demo ? <Badge kind="brand">DEMO</Badge> : null}
                    {h.map_verified ? <Badge kind="ok">Mapped</Badge> : <Badge kind="muted">Unmapped</Badge>}
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {h.city}, {h.district} · {h.hospital_type || '—'}{h.bed_count ? ` · ${h.bed_count} beds` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>{statusBadge(h.mapping_status)}</div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                {h.building_count || 0} buildings · {h.published_floors || 0} published floors
                {h.map_last_updated_at ? ` · updated ${new Date(h.map_last_updated_at).toLocaleDateString()}` : ''}
              </div>
              <div className="btn-row" style={{ marginTop: 14 }}>
                <Link className="btn btn-sm btn-primary" to={`/hospitals/${h.id}`}>Open</Link>
                {can('hospital:manage') && <button className="btn btn-sm" onClick={() => setEditing(h)}>Edit</button>}
                {can('hospital:manage') && <button className="btn btn-sm btn-danger" onClick={() => remove(h)}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <HospitalForm hospital={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={save} />}
      {node}
    </div>
  );
}

function HospitalForm({ hospital, onClose, onSave }: { hospital: Hospital | null; onClose: () => void; onSave: (b: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({
    name: hospital?.name || '', short_name: hospital?.short_name || '', city: hospital?.city || 'Kota',
    district: hospital?.district || 'Kota', state: hospital?.state || 'Rajasthan', address: hospital?.address || '',
    latitude: hospital?.latitude ?? '', longitude: hospital?.longitude ?? '', hospital_type: hospital?.hospital_type || 'Government',
    bed_count: hospital?.bed_count ?? '',
  });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body: Record<string, unknown> = { ...form, latitude: form.latitude === '' ? undefined : Number(form.latitude), longitude: form.longitude === '' ? undefined : Number(form.longitude), bed_count: form.bed_count === '' ? undefined : Number(form.bed_count) };
    await onSave(body);
    setBusy(false);
  }
  return (
    <Modal title={hospital ? 'Edit hospital' : 'Add hospital'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="row">
          <div className="field"><label>Name *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Short name</label><input className="input" value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>City *</label><input className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="field"><label>District *</label><input className="input" required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
          <div className="field"><label>State</label><input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
        </div>
        <div className="field"><label>Address</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="row">
          <div className="field"><label>Latitude</label><input className="input" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></div>
          <div className="field"><label>Longitude</label><input className="input" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></div>
          <div className="field"><label>Type</label><input className="input" value={form.hospital_type} onChange={(e) => setForm({ ...form, hospital_type: e.target.value })} /></div>
          <div className="field"><label>Beds</label><input className="input" type="number" value={form.bed_count} onChange={(e) => setForm({ ...form, bed_count: e.target.value })} /></div>
        </div>
        <div className="btn-row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save hospital'}</button>
        </div>
      </form>
    </Modal>
  );
}
