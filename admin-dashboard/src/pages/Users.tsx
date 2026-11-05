import { useEffect, useState } from 'react';
import { api, type AdminUser, type AdminRole, type Hospital } from '../lib/api';
import { useAuth } from '../store/auth';
import { Loading, Empty, Modal, Badge, useToast } from '../components/ui';

export default function Users() {
  const { can } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ email: '', display_name: '', password: '', role_id: '', hospital_id: '' });

  async function load() {
    setLoading(true);
    try {
      const d = await api.get<{ users: AdminUser[]; roles: AdminRole[] }>('/api/auth/users');
      setUsers(d.users); setRoles(d.roles);
      const h = await api.get<{ hospitals: Hospital[] }>('/api/patient/hospitals'); setHospitals(h.hospitals);
    } finally { setLoading(false); }
  }
  useEffect(() => { if (can('hospital:manage')) load(); else setLoading(false); }, [can]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/api/auth/users', { ...form, hospital_id: form.hospital_id || null });
    toast('User created', 'ok'); setShow(false); setForm({ email: '', display_name: '', password: '', role_id: '', hospital_id: '' }); load();
  }

  if (!can('hospital:manage')) return <Empty icon="🔒" title="No permission" hint="You need hospital:manage to manage users." />;
  if (loading) return <Loading />;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h2 style={{ margin: 0 }}>Administrators ({users.length})</h2><div className="muted">Role-based access control. Super admins are platform-wide.</div></div>
          <button className="btn btn-primary" onClick={() => setShow(true)}>＋ Add user</button>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Hospital scope</th><th>Status</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.display_name}</strong></td>
                <td>{u.email}</td>
                <td><Badge kind="brand">{u.role_name}</Badge></td>
                <td className="muted">{u.hospital_id ? hospitals.find((h) => h.id === u.hospital_id)?.name || 'scoped' : 'platform-wide'}</td>
                <td>{u.is_active ? <Badge kind="ok">active</Badge> : <Badge kind="muted">inactive</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      <div className="card card-pad">
        <h2>Roles &amp; permissions</h2>
        <div className="grid grid-2">
          {roles.map((r) => (
            <div key={r.id} className="card card-pad" style={{ boxShadow: 'none', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{r.name}</strong><code className="muted">{r.role_key}</code></div>
              <div className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>{r.description}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {JSON.parse(r.permissions).map((p: string) => <span key={p} className="badge badge-muted">{p}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {show && (
        <Modal title="Add administrator" onClose={() => setShow(false)}>
          <form onSubmit={add}>
            <div className="field"><label>Name *</label><input className="input" required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
            <div className="field"><label>Email *</label><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label>Password *</label><input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="row">
              <div className="field"><label>Role</label><select className="select" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}><option value="">—</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div className="field"><label>Hospital scope</label><select className="select" value={form.hospital_id} onChange={(e) => setForm({ ...form, hospital_id: e.target.value })}><option value="">platform-wide</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
            </div>
            <div className="btn-row" style={{ justifyContent: 'flex-end' }}><button className="btn" type="button" onClick={() => setShow(false)}>Cancel</button><button className="btn btn-primary" type="submit">Create user</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
