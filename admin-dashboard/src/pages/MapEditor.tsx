import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type FloorGraphResponse, type NavNode, type NavEdge, type Room, type RouteResult } from '../lib/api';
import { useAuth } from '../store/auth';
import { Loading, Empty, useToast, useConfirm, statusBadge, Badge } from '../components/ui';

type Tool = 'select' | 'node' | 'edge' | 'delete';
const NODE_TYPES = ['junction', 'room', 'entrance', 'exit', 'stair', 'lift', 'emergency', 'info_point'];
const NODE_COLORS: Record<string, string> = {
  junction: '#94a3b8', room: '#0d9488', entrance: '#16a34a', exit: '#dc2626',
  stair: '#d97706', lift: '#6366f1', emergency: '#dc2626', info_point: '#0891b2',
};
const EDGE_COLORS: Record<string, string> = {
  corridor: '#cbd5e1', room_access: '#5eead4', stair: '#f59e0b', lift: '#818cf8', ramp: '#22c55e',
};
const ACCESS = ['wheelchair_accessible', 'step_free', 'stairs_only', 'limited_access', 'staff_assistance_required'];

export default function MapEditor() {
  const { id: hospitalId, floorId } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const svgRef = useRef<SVGSVGElement>(null);

  const [data, setData] = useState<FloorGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<Tool>('select');
  const [nodeType, setNodeType] = useState('junction');
  const [edgeKind, setEdgeKind] = useState('corridor');
  const [edgeAccess, setEdgeAccess] = useState('wheelchair_accessible');
  const [selected, setSelected] = useState<string | null>(null);
  const [edgeStart, setEdgeStart] = useState<string | null>(null);
  const [calib, setCalib] = useState({ scale_ppm: 100, origin_x: 0, origin_y: 0, rotation: 0, width: 1000, height: 700 });
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeStart, setRouteStart] = useState('');
  const [routeEnd, setRouteEnd] = useState('');
  const [floorStatus, setFloorStatus] = useState('draft');

  async function load() {
    setLoading(true);
    try {
      const d = await api.get<FloorGraphResponse>(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/graph`);
      setData(d);
      const floors = await api.get<{ floors: { id: string; map_status: string }[] }>(`/api/admin/hospitals/${hospitalId}/floors`);
      setFloorStatus(floors.floors.find((f) => f.id === floorId)?.map_status || 'draft');
      setCalib({
        scale_ppm: d.floorGraph.levelElevationM !== null ? 100 : 100,
        origin_x: 0, origin_y: 0, rotation: 0, width: 1000, height: 700,
      });
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [hospitalId, floorId]);

  const nodes = data?.floorGraph.nodes || [];
  const edges = data?.floorGraph.edges || [];
  const rooms = data?.rooms || [];

  // viewBox bounds from nodes (metric space).
  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: -5, minY: -5, w: 70, h: 60 };
    const xs = nodes.map((n) => n.x_metres), ys = nodes.map((n) => n.y_metres);
    const minX = Math.min(...xs) - 6, minY = Math.min(...ys) - 6;
    return { minX, minY, w: Math.max(...xs) - minX + 12, h: Math.max(...ys) - minY + 12 };
  }, [nodes]);

  function toMetric(evt: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (tool === 'node') {
      const m = toMetric(e); if (!m) return;
      const newNode = { id: '', floor_id: floorId!, node_type: nodeType, x_metres: Math.round(m.x * 100) / 100, y_metres: Math.round(m.y * 100) / 100, accessibility: 'wheelchair_accessible', label: '' };
      api.post(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/nodes`, newNode).then((created) => {
        setData((d) => d ? { ...d, floorGraph: { ...d.floorGraph, nodes: [...d.floorGraph.nodes, created as NavNode] } } : d);
        toast('Node added', 'ok');
      });
    } else if (tool === 'edge') {
      // pick nearest node within threshold
      const m = toMetric(e); if (!m) return;
      const hit = nodes.find((n) => Math.hypot(n.x_metres - m.x, n.y_metres - m.y) < 0.8);
      if (!hit) return;
      if (!edgeStart) { setEdgeStart(hit.id); setSelected(hit.id); toast(`Pick a second node to connect to "${hit.label || hit.id}"`, 'info'); return; }
      if (edgeStart === hit.id) { setEdgeStart(null); return; }
      const dist = Math.hypot((nodes.find((n) => n.id === edgeStart)!.x_metres - hit.x_metres), (nodes.find((n) => n.id === edgeStart)!.y_metres - hit.y_metres));
      const newEdge = { id: '', floor_id: floorId!, start_node_id: edgeStart, end_node_id: hit.id, kind: edgeKind, distance_metres: Math.round(dist * 100) / 100, accessibility: edgeAccess, is_bidirectional: true, is_vertical: false };
      api.post(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/edges`, newEdge).then((created) => {
        setData((d) => d ? { ...d, floorGraph: { ...d.floorGraph, edges: [...d.floorGraph.edges, created as NavEdge] } } : d);
        setEdgeStart(null); toast('Edge added', 'ok');
      }).catch((err) => { toast(err.message, 'error'); setEdgeStart(null); });
    }
  }

  function nodeClick(n: NavNode) {
    if (tool === 'delete') {
      api.del(`/api/admin/hospitals/${hospitalId}/nodes/${n.id}`).then(() => {
        setData((d) => d ? { ...d, floorGraph: { ...d.floorGraph, nodes: d.floorGraph.nodes.filter((x) => x.id !== n.id), edges: d.floorGraph.edges.filter((e) => e.start_node_id !== n.id && e.end_node_id !== n.id) } } : d);
        toast('Node deleted', 'ok');
      });
      return;
    }
    if (tool === 'edge') {
      if (!edgeStart) { setEdgeStart(n.id); setSelected(n.id); }
      else if (edgeStart === n.id) { setEdgeStart(null); }
      else {
        const a = nodes.find((x) => x.id === edgeStart)!;
        const dist = Math.hypot(a.x_metres - n.x_metres, a.y_metres - n.y_metres);
        api.post(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/edges`, { id: '', floor_id: floorId!, start_node_id: edgeStart, end_node_id: n.id, kind: edgeKind, distance_metres: Math.round(dist * 100) / 100, accessibility: edgeAccess, is_bidirectional: true, is_vertical: false })
          .then((created) => { setData((d) => d ? { ...d, floorGraph: { ...d.floorGraph, edges: [...d.floorGraph.edges, created as NavEdge] } } : d); setEdgeStart(null); toast('Edge added', 'ok'); })
          .catch((err) => { toast(err.message, 'error'); setEdgeStart(null); });
      }
      return;
    }
    setSelected(n.id);
  }

  async function updateNode(patch: Partial<NavNode>) {
    if (!selected) return;
    const updated = await api.patch(`/api/admin/hospitals/${hospitalId}/nodes/${selected}`, patch);
    setData((d) => d ? { ...d, floorGraph: { ...d.floorGraph, nodes: d.floorGraph.nodes.map((n) => n.id === selected ? updated as NavNode : n) } } : d);
  }
  async function deleteEdge(edgeId: string) {
    if (!await confirm('Delete this edge?')) return;
    await api.del(`/api/admin/hospitals/${hospitalId}/edges/${edgeId}`);
    setData((d) => d ? { ...d, floorGraph: { ...d.floorGraph, edges: d.floorGraph.edges.filter((e) => e.id !== edgeId) } } : d);
    toast('Edge deleted', 'ok');
  }
  async function snapshot() { await api.post(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/versions`, { change_summary: 'Editor snapshot' }); toast('Version snapshot saved', 'ok'); }
  async function verify() { const mv = await api.post<{ id: string }>(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/versions`, { change_summary: 'Verified snapshot' }); await api.post(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/verify`, { map_version_id: mv.id, status: 'verified' }); toast('Map verified — now publishable', 'ok'); }
  async function publish() { await api.post(`/api/admin/hospitals/${hospitalId}/floors/${floorId}/publish`, {}); toast('Map published to patients', 'ok'); }
  async function testRoute() {
    if (!routeStart || !routeEnd) { toast('Select start and end nodes', 'error'); return; }
    setRoute(await api.post<RouteResult>(`/api/patient/hospitals/${hospitalId}/route`, { start_node_id: routeStart, end_node_id: routeEnd }));
  }

  if (loading) return <Loading />;
  if (!data) return <Empty icon="🗺️" title="Floor not found" />;
  const sel = nodes.find((n) => n.id === selected);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div>
        <Link to={`/hospitals/${hospitalId}`} className="muted" style={{ fontSize: 13 }}>← Back to hospital</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Map Editor · F{data.floorGraph.floorNumber} {data.floorGraph.floorLabel}</h1>
          {floorStatus && <Badge kind={floorStatus === 'published' ? 'ok' : 'muted'}>{floorStatus}</Badge>}
        </div>
      </div>

      <div className="map-toolbar">
        <button className={`tool-btn ${tool === 'select' ? 'active' : ''}`} onClick={() => setTool('select')}>↖ Select</button>
        <button className={`tool-btn ${tool === 'node' ? 'active' : ''}`} onClick={() => setTool('node')}>＋ Node</button>
        <button className={`tool-btn ${tool === 'edge' ? 'active' : ''}`} onClick={() => setTool('edge')}>⤢ Edge</button>
        <button className={`tool-btn ${tool === 'delete' ? 'active' : ''}`} onClick={() => setTool('delete')}>✕ Delete</button>
        <span style={{ width: 1, background: 'var(--border)' }} />
        {tool === 'node' && <>Node type: <select className="select" style={{ width: 150 }} value={nodeType} onChange={(e) => setNodeType(e.target.value)}>{NODE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></>}
        {tool === 'edge' && <>Kind: <select className="select" style={{ width: 130 }} value={edgeKind} onChange={(e) => setEdgeKind(e.target.value)}>{['corridor', 'room_access', 'stair', 'lift', 'ramp'].map((t) => <option key={t}>{t}</option>)}</select>
          <select className="select" style={{ width: 200 }} value={edgeAccess} onChange={(e) => setEdgeAccess(e.target.value)}>{ACCESS.map((a) => <option key={a}>{a}</option>)}</select></>}
        {edgeStart && <Badge kind="brand">edge start: {nodes.find((n) => n.id === edgeStart)?.label || edgeStart}</Badge>}
      </div>

      <div className="btn-row">
        {can('map:edit') && <button className="btn" onClick={snapshot}>＋ Snapshot version</button>}
        {can('map:verify') && <button className="btn btn-primary" onClick={verify}>Verify map</button>}
        {can('map:publish') && <button className="btn" onClick={publish}>Publish map</button>}
        <span style={{ flex: 1 }} />
        <RouteTester nodes={nodes} routeStart={routeStart} routeEnd={routeEnd} setRouteStart={setRouteStart} setRouteEnd={setRouteEnd} route={route} onTest={testRoute} />
      </div>

      <div className="grid grid-2">
        <div>
          <div className="map-stage" style={{ aspectRatio: `${bounds.w} / ${bounds.h}` }}>
            <svg ref={svgRef} viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`} style={{ width: '100%', height: '100%', cursor: tool === 'node' ? 'crosshair' : 'default' }} onClick={onCanvasClick}>
              <defs>
                <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#e2e8f0" strokeWidth="0.2" /></pattern>
              </defs>
              <rect x={bounds.minX} y={bounds.minY} width={bounds.w} height={bounds.h} fill="url(#grid)" />
              {rooms.map((r) => r.x_centroid != null && r.y_centroid != null ? (
                <g key={r.id}>
                  <rect x={r.x_centroid - 3} y={r.y_centroid - 1.5} width={6} height={3} rx={0.5} fill="none" stroke="#0d9488" strokeWidth={0.3} strokeDasharray="1 0.6" />
                  <text x={r.x_centroid} y={r.y_centroid - 2} fontSize={2.2} textAnchor="middle" fill="#0f766e">{r.room_number}</text>
                </g>
              ) : null)}
              {edges.map((e) => {
                const a = nodes.find((n) => n.id === e.start_node_id), b = nodes.find((n) => n.id === e.end_node_id);
                if (!a || !b) return null;
                return <line key={e.id} x1={a.x_metres} y1={a.y_metres} x2={b.x_metres} y2={b.y_metres} stroke={EDGE_COLORS[e.kind] || '#cbd5e1'} strokeWidth={0.6} strokeDasharray={e.kind === 'stair' ? '1 0.5' : undefined} markerEnd="url(#arrow)" />;
              })}
              <defs><marker id="arrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" /></marker></defs>
              {route?.pathNodeIds && route.pathNodeIds.length > 1 ? (
                <polyline points={route.pathNodeIds.map((pid) => { const n = nodes.find((x) => x.id === pid); return n ? `${n.x_metres},${n.y_metres}` : ''; }).filter(Boolean).join(' ')} fill="none" stroke="#dc2626" strokeWidth={0.9} strokeLinejoin="round" />
              ) : null}
              {nodes.map((n) => (
                <g key={n.id} style={{ cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); nodeClick(n); }}>
                  <circle cx={n.x_metres} cy={n.y_metres} r={selected === n.id || edgeStart === n.id ? 1.6 : 1.1} fill={NODE_COLORS[n.node_type] || '#94a3b8'} stroke={selected === n.id ? '#0f172a' : 'none'} strokeWidth={0.3} />
                  {n.label && <text x={n.x_metres} y={n.y_metres - 1.8} fontSize={2} textAnchor="middle" fill="#334155">{n.label}</text>}
                </g>
              ))}
            </svg>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{nodes.length} nodes · {edges.length} edges. Click canvas to place {tool === 'node' ? 'a node' : tool === 'edge' ? 'a second node' : ''}.</div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          {sel ? (
            <div className="card card-pad">
              <h2>Node properties</h2>
              <div className="field"><label>Label</label><input className="input" value={sel.label || ''} onChange={(e) => updateNode({ label: e.target.value })} /></div>
              <div className="row">
                <div className="field"><label>Type</label><select className="select" value={sel.node_type} onChange={(e) => updateNode({ node_type: e.target.value })}>{NODE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div className="field"><label>Accessibility</label><select className="select" value={sel.accessibility || 'wheelchair_accessible'} onChange={(e) => updateNode({ accessibility: e.target.value })}>{ACCESS.map((a) => <option key={a}>{a}</option>)}</select></div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>Position: ({sel.x_metres}, {sel.y_metres}) m</div>
            </div>
          ) : <div className="card card-pad"><h2>Node properties</h2><Empty icon="◉" title="Select a node to edit" /></div>}

          <div className="card card-pad">
            <h2>Edges ({edges.length})</h2>
            {edges.length === 0 ? <Empty icon="⤢" title="No edges — connect nodes" /> : (
              <div style={{ maxHeight: 260, overflow: 'auto' }}>
                {edges.map((e) => {
                  const a = nodes.find((n) => n.id === e.start_node_id), b = nodes.find((n) => n.id === e.end_node_id);
                  return (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13 }}>{a?.label || a?.id} → {b?.label || b?.id} <span className="muted">· {e.kind} · {e.distance_metres}m</span></span>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteEdge(e.id)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {node}
    </div>
  );
}

function RouteTester({ nodes, routeStart, routeEnd, setRouteStart, setRouteEnd, route, onTest }: {
  nodes: NavNode[]; routeStart: string; routeEnd: string; setRouteStart: (s: string) => void; setRouteEnd: (s: string) => void; route: RouteResult | null; onTest: () => void;
}) {
  return (
    <div className="card card-pad" style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="select" style={{ width: 180 }} value={routeStart} onChange={(e) => setRouteStart(e.target.value)}>
          <option value="">Start…</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.label || n.id}</option>)}
        </select>
        <span>→</span>
        <select className="select" style={{ width: 180 }} value={routeEnd} onChange={(e) => setRouteEnd(e.target.value)}>
          <option value="">End…</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.label || n.id}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={onTest}>Test route</button>
      </div>
      {route && route.found ? (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <Badge kind="ok">{route.totalDistanceMetres} m · {route.estimatedWalkingTimeSeconds}s</Badge>
          {route.accessible ? <Badge kind="brand">accessible</Badge> : <Badge kind="warn">not wheelchair-accessible</Badge>}
          <div className="muted" style={{ marginTop: 6 }}>{route.steps.map((s, i) => `${i + 1}. ${s.instruction}`).join('  ·  ')}</div>
        </div>
      ) : null}
    </div>
  );
}
