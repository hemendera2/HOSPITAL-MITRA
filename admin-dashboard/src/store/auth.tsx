import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken, getToken } from '../lib/api';

export interface AuthUser {
  id: string; email: string; display_name: string; role: string;
  hospital_id: string | null; permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (perm: string) => boolean;
}
const Ctx = createContext<AuthState>({ user: null, loading: true, login: async () => {}, logout: () => {}, can: () => false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    console.debug('[auth] useEffect: token from localStorage:', t?.slice(0, 12) ?? 'NONE');
    if (!t) { setLoading(false); return; }
    api.get<AuthUser>('/api/auth/me')
      .then((u) => setUser(u))
      .catch((e) => { console.warn('[auth] /me failed:', e); setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    console.debug('[auth] login:', email);
    // Login response now includes permissions — no need for a second /me call
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', { email, password });
    console.debug('[auth] login response:', { hasToken: !!res.token, tokenLen: res.token?.length, role: res.user?.role });
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  function can(perm: string) {
    if (!user) return false;
    return user.permissions.includes('*') || user.permissions.includes(perm);
  }

  return <Ctx.Provider value={{ user, loading, login, logout, can }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
