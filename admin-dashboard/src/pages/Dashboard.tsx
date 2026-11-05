import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Hospital, type Feedback, type AuditLog } from '../lib/api';
import { useAuth } from '../store/auth';
import { Loading, Empty, statusBadge } from '../components/ui';

export default function Dashboard() {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ hospitals: Hospital[] }>('/api/patient/hospitals'),
      user?.permissions.includes('feedback:read') ? api.get<{ feedback: Feedback[] }>(`/api/admin/hospitals/${user.hospital_id}/feedback`).catch(() => ({ feedback: [] })) : Promise.resolve({ feedback: [] }),
      user?.permissions.includes('audit:read') ? api.get<{ logs: AuditLog[] }>(`/api/admin/hospitals/${user.hospital_id}/audit`).catch(() => ({ logs: [] })) : Promise.resolve({ logs: [] }),
    ]).then(([h, f, l]) => {
      setHospitals(h.hospitals);
      setFeedback(f.feedback || []);
      setLogs(l.logs || []);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <Loading />;

  const mapped = hospitals.filter((h) => h.map_verified).length;
  const openFeedback = feedback.filter((f) => f.status !== 'resolved').length;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="grid grid-4">
        <div className="card card-pad stat"><span className="num">{hospitals.length}</span><span className="lbl">Hospitals in directory</span></div>
        <div className="card card-pad stat"><span className="num">{mapped}</span><span className="lbl">Mapped &amp; verified</span></div>
        <div className="card card-pad stat"><span className="num">{openFeedback}</span><span className="lbl">Open feedback items</span></div>
        <div className="card card-pad stat"><span className="num">{logs.length}</span><span className="lbl">Recent audit events</span></div>
      </div>

      <div className="card card-pad">
        <h2>Welcome, {user?.display_name}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          You are signed in as <strong>{user?.role}</strong>. A map becomes publicly available only after an authorised verifier
          reviews and publishes it. Unverified hospitals and rooms stay unpublished.
        </p>
        <div className="btn-row">
          <Link className="btn btn-primary" to="/hospitals">Manage hospitals</Link>
          <Link className="btn" to="/feedback">Review feedback</Link>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <h2>Hospitals</h2>
          {hospitals.length === 0 ? <Empty icon="🏥" title="No hospitals yet" hint="Add the first hospital to begin." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Hospital</th><th>City</th><th>Status</th></tr></thead>
                <tbody>
                  {hospitals.slice(0, 6).map((h) => (
                    <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => window.location.assign(`/hospitals/${h.id}`)}>
                      <td><strong>{h.name}</strong>{h.is_demo ? <span className="badge badge-brand" style={{ marginLeft: 6 }}>DEMO</span> : null}</td>
                      <td>{h.city}</td>
                      <td>{statusBadge(h.mapping_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card card-pad">
          <h2>Recent activity</h2>
          {logs.length === 0 ? <Empty icon="📋" title="No activity yet" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {logs.slice(0, 7).map((l) => (
                <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span className="badge badge-brand" style={{ flex: '0 0 auto' }}>{l.actor_role}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{l.action}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{new Date(l.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
