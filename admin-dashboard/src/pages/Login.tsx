import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useToast } from '../components/ui';
import { ApiError } from '../lib/api';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('super@mitra.demo');
  const [password, setPassword] = useState('Mitra@Admin2026');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast('Welcome back', 'ok');
      nav((loc.state as { from?: string })?.from || '/', { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card card card-pad" onSubmit={submit}>
        <div className="logo">✚</div>
        <h2 style={{ textAlign: 'center', margin: '0 0 4px' }}>Hospital Mitra</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '0 0 20px', fontSize: 14 }}>
          Indoor navigation admin console
        </p>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="muted" style={{ fontSize: 12, marginTop: 16, textAlign: 'center', lineHeight: 1.6 }}>
          Demo accounts seeded on first run.<br />super · admin · editor · verifier · staff @mitra.demo
        </div>
      </form>
    </div>
  );
}
