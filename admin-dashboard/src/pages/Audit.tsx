import { useEffect, useState } from 'react';
import { api, type AuditLog, type Hospital } from '../lib/api';
import { useAuth } from '../store/auth';
import { Loading, Empty, useToast, Badge } from '../components/ui';

export default function Audit() {
  const { user } = useAuth();
  const toast = useToast();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalId, setHospitalId] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get<{ hospitals: Hospital[] }>('/api/patient/hospitals').then((d) => { setHospitals(d.hospitals); setHospitalId(user?.hospital_id || d.hospitals[0]?.id || ''); }); }, [user]);
  useEffect(() => {
    if (!hospitalId) { setLoading(false); return; }
    setLoading(true);
    api.get<{ logs: AuditLog[] }>(`/api/admin/hospitals/${hospitalId}/audit`).then((d) => setLogs(d.logs)).catch(() => toast('Need audit:read permission', 'error')).finally(() => setLoading(false));
  }, [hospitalId, toast]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card card-pad">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, flex: 1 }}><label>Hospital</label>
            <select className="select" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
              <option value="">— platform-wide —</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      {loading ? <Loading /> : logs.length === 0 ? <Empty icon="📋" title="No audit entries" /> : (
        <div className="card">
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td><Badge kind="brand">{l.actor_role}</Badge> <span className="muted">{l.actor_name || '—'}</span></td>
                  <td><strong>{l.action}</strong></td>
                  <td>{l.entity_type || '—'}</td>
                  <td className="muted" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
