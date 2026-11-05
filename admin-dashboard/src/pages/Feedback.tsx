import { useEffect, useState } from 'react';
import { api, type Feedback, type Hospital } from '../lib/api';
import { useAuth } from '../store/auth';
import { Loading, Empty, statusBadge, useToast, Modal } from '../components/ui';

export default function Feedback() {
  const { can, user } = useAuth();
  const toast = useToast();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalId, setHospitalId] = useState('');
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<Feedback | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => { api.get<{ hospitals: Hospital[] }>('/api/patient/hospitals').then((d) => { setHospitals(d.hospitals); if (d.hospitals[0]) setHospitalId(d.hospitals[0].id); }); }, []);
  useEffect(() => {
    if (!hospitalId) return;
    setLoading(true);
    api.get<{ feedback: Feedback[] }>(`/api/admin/hospitals/${hospitalId}/feedback`).then((d) => setItems(d.feedback)).finally(() => setLoading(false));
  }, [hospitalId]);

  async function act(status: 'resolved' | 'rejected' | 'reviewing') {
    if (!review) return;
    await api.post(`/api/admin/hospitals/${hospitalId}/feedback/${review.id}/review`, { status, resolution_note: note });
    toast('Feedback updated', 'ok'); setReview(null); setNote('');
    api.get<{ feedback: Feedback[] }>(`/api/admin/hospitals/${hospitalId}/feedback`).then((d) => setItems(d.feedback));
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card card-pad">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, flex: 1 }}><label>Hospital</label>
            <select className="select" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
              <option value="">— select —</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          {user?.hospital_id && <span className="muted">{user?.hospital_id === hospitalId ? 'Your scoped hospital' : 'Selecting another hospital'}</span>}
        </div>
      </div>

      {loading ? <Loading /> : items.length === 0 ? <Empty icon="✎" title="No feedback" hint="Corrections submitted by patients and staff appear here." /> : (
        <div className="grid grid-2">
          {items.map((f) => (
            <div key={f.id} className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-brand">{f.category}</span>{statusBadge(f.status)}
              </div>
              <p style={{ margin: '10px 0 6px' }}>{f.description}</p>
              <div className="muted" style={{ fontSize: 12 }}>{new Date(f.created_at).toLocaleString()}</div>
              {f.resolution_note && <div className="muted" style={{ fontSize: 13, marginTop: 8, padding: 8, background: 'var(--surface-2)', borderRadius: 8 }}>Resolution: {f.resolution_note}</div>}
              {can('feedback:review') && f.status !== 'resolved' && (
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => { setReview(f); setNote(f.resolution_note || ''); }}>Review</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {review && (
        <Modal title="Review feedback" onClose={() => setReview(null)}>
          <p style={{ marginTop: 0 }}>{review.description}</p>
          <div className="field"><label>Resolution note</label><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="How was this resolved?" /></div>
          <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setReview(null)}>Cancel</button>
            <button className="btn" onClick={() => act('reviewing')}>Mark reviewing</button>
            <button className="btn btn-danger" onClick={() => act('rejected')}>Reject</button>
            <button className="btn btn-primary" onClick={() => act('resolved')}>Mark resolved</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
