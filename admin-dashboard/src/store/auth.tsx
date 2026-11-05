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
    if (!t) { setLoading(false); return; }
    api.get<AuthUser>('/api/auth/me')
      .then((u) => setUser(u))
      .catch(() => { setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string }>('/api/auth/login', { email, password });
    setToken(res.token);
    const me = await api.get<AuthUser>('/api/auth/me');
    setUser(me);
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
