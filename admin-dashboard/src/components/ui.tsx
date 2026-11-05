import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// ---- Toast system ----
interface Toast { id: number; msg: string; kind: 'ok' | 'error' | 'info'; }
const ToastCtx = createContext<(msg: string, kind?: Toast['kind']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (msg: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind === 'info' ? '' : t.kind}`}>{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

// ---- Modal ----
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ maxWidth: wide ? 760 : 520 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-pad">
          <h3>{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---- Badge ----
export function Badge({ kind, children }: { kind: 'ok' | 'warn' | 'danger' | 'muted' | 'brand'; children: ReactNode }) {
  return <span className={`badge badge-${kind}`}><span className="dot" />{children}</span>;
}

export function statusBadge(status: string) {
  const map: Record<string, 'ok' | 'warn' | 'danger' | 'muted' | 'brand'> = {
    published: 'ok', verified: 'ok', resolved: 'ok', active: 'ok',
    draft: 'muted', unverified: 'warn', pending_review: 'warn', open: 'warn', reviewing: 'warn',
    rejected: 'danger', unpublished: 'danger', archived: 'muted', unmapped: 'muted',
    partially_mapped: 'brand', fully_mapped: 'ok', mapping_planned: 'warn',
  };
  return <Badge kind={map[status] || 'muted'}>{status}</Badge>;
}

// ---- Loading / Empty ----
export function Loading({ label }: { label?: string }) {
  return <div className="center"><div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}><div className="spinner" /><span className="muted">{label || 'Loading…'}</span></div></div>;
}
export function Empty({ icon, title, hint, action }: { icon: string; title: string; hint?: string; action?: ReactNode }) {
  return <div className="empty"><div className="ic">{icon}</div><div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>{hint && <div className="muted" style={{ marginBottom: 12 }}>{hint}</div>}{action}</div>;
}

// ---- Confirm hook ----
export function useConfirm() {
  const [state, setState] = useState<{ msg: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = (msg: string) => new Promise<boolean>((resolve) => setState({ msg, resolve }));
  const node = state ? (
    <Modal title="Please confirm" onClose={() => { state.resolve(false); setState(null); }}>
      <p style={{ margin: '0 0 18px' }}>{state.msg}</p>
      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => { state.resolve(false); setState(null); }}>Cancel</button>
        <button className="btn btn-danger" onClick={() => { state.resolve(true); setState(null); }}>Confirm</button>
      </div>
    </Modal>
  ) : null;
  return { confirm, node };
}
