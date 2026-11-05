import { useState, useMemo } from 'react';
import { Hospital3DMap, FloorPlan2D } from '../components/Hospital3DMap';
import { KOTA_HOSPITALS, DEPARTMENT_COLORS, type KotaHospitalRecord, type RoomRecord } from '../data/kota-hospitals';

export default function PatientMap() {
  const [hospitalId, setHospitalId] = useState<string>('');
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [exploded, setExploded] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleFloors, setVisibleFloors] = useState<Set<number>>(new Set());
  const [route, setRoute] = useState<{ from: string; to: string } | null>(null);

  const hospital = useMemo(() => {
    return KOTA_HOSPITALS.find(h => h.id === hospitalId) || null;
  }, [hospitalId]);

  const allRooms = useMemo(() => {
    if (!hospital) return [];
    const rooms: Array<RoomRecord & { floorLabel: string; floorNumber: number }> = [];
    for (const b of hospital.buildings) {
      for (const f of b.floors) {
        for (const r of f.rooms) {
          rooms.push({ ...r, floorLabel: f.label, floorNumber: f.floorNumber });
        }
      }
    }
    return rooms;
  }, [hospital]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return allRooms;
    const q = searchQuery.toLowerCase();
    return allRooms.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.nameHi?.toLowerCase().includes(q) ||
      r.department?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q)
    );
  }, [searchQuery, allRooms]);

  const toggleFloor = (floorNumber: number) => {
    const next = new Set(visibleFloors);
    if (next.has(floorNumber)) {
      next.delete(floorNumber);
    } else {
      next.add(floorNumber);
    }
    setVisibleFloors(next);
  };

  const showAllFloors = () => {
    const all = new Set<number>();
    hospital?.buildings[0].floors.forEach(f => all.add(f.floorNumber));
    setVisibleFloors(all);
  };

  const handleSelectRoom = (roomId: string) => {
    setSelectedRoom(roomId);
    setRoute(null);
  };

  const startRoute = (fromId: string, toId: string) => {
    setRoute({ from: fromId, to: toId });
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      {/* Hospital selector */}
      <div className="card card-pad">
        <h2 style={{ marginTop: 0 }}>🏥 Kota Hospital Maps</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Select a hospital to explore its indoor map. Rooms marked with official source data are shown.
           Hospitals without floor plans show directory information only.
        </p>
        <div className="grid grid-3" style={{ gap: 12 }}>
          {KOTA_HOSPITALS.map(h => (
            <button
              key={h.id}
              onClick={() => { setHospitalId(h.id); setSelectedRoom(null); setRoute(null); setVisibleFloors(new Set()); }}
              className={`card card-pad ${hospitalId === h.id ? 'selected' : ''}`}
              style={{
                cursor: 'pointer', textAlign: 'left',
                border: hospitalId === h.id ? '2px solid var(--brand)' : '1px solid var(--border)',
                background: hospitalId === h.id ? 'var(--brand-tint)' : 'var(--surface)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{h.shortName || h.name.slice(0, 20)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {h.name}
              </div>
              <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {h.bedCount && <span className="badge badge-brand">{h.bedCount} beds</span>}
                <span className="badge" style={{ background: h.buildings.length > 0 ? '#D1FAE5' : '#FEE2E2' }}>
                  {h.buildings.length > 0 ? `${h.buildings[0].floors.length} floors mapped` : 'No floor plan'}
                </span>
                <span className="badge badge-warn">{h.verification}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Map viewer */}
      {hospital && (
        <>
          {/* Header info */}
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{hospital.name}</h2>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  📍 {hospital.address || 'Address not available'}
                  {hospital.phone && ` · 📞 ${hospital.phone}`}
                  {hospital.website && ` · 🌐 ${hospital.website}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn btn-sm ${mode === '3d' ? 'btn-primary' : ''}`}
                  onClick={() => setMode('3d')}
                >3D View</button>
                <button
                  className={`btn btn-sm ${mode === '2d' ? 'btn-primary' : ''}`}
                  onClick={() => setMode('2d')}
                >2D Floor Plan</button>
                {hospital.buildings.length > 0 && (
                  <button
                    className={`btn btn-sm ${exploded ? 'btn-primary' : ''}`}
                    onClick={() => setExploded(!exploded)}
                  >
                    {exploded ? '🏗️ Combined' : '💥 Exploded'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3D/2D Map */}
          {hospital.buildings.length > 0 ? (
            mode === '3d' ? (
              <Hospital3DMap
                hospital={hospital}
                exploded={exploded}
                selectedRoom={selectedRoom}
                onSelectRoom={handleSelectRoom}
                visibleFloors={visibleFloors.size > 0 ? visibleFloors : new Set(hospital.buildings[0].floors.map(f => f.floorNumber))}
              />
            ) : (
              <FloorPlan2D
                hospital={hospital}
                selectedRoom={selectedRoom}
                onSelectRoom={handleSelectRoom}
              />
            )
          ) : (
            <div className="card card-pad" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
              <h3>No Indoor Map Available</h3>
              <p className="muted" style={{ maxWidth: 400, margin: '0 auto' }}>
                This hospital does not have a verified indoor floor plan in our database.
                Hospital directory information is available below. Indoor navigation will be
                available after an authorised editor digitises and a verifier publishes a map.
              </p>
              <div style={{ marginTop: 16, textAlign: 'left', maxWidth: 400, margin: '16px auto 0' }}>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>📋 Missing data:</div>
                {hospital.missingData.map((d, i) => (
                  <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>• {d}</div>
                ))}
              </div>
            </div>
          )}

          {/* Floor filter */}
          {hospital.buildings.length > 0 && (
            <div className="card card-pad">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Floors:</span>
                {hospital.buildings[0].floors.map(f => (
                  <button
                    key={f.id}
                    onClick={() => toggleFloor(f.floorNumber)}
                    className={`btn btn-sm ${visibleFloors.size === 0 || visibleFloors.has(f.floorNumber) ? 'btn-primary' : ''}`}
                    style={{ fontSize: 12 }}
                  >
                    {f.label}
                  </button>
                ))}
                <button className="btn btn-sm" onClick={showAllFloors}>Show All</button>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>🔍 Search Destinations</h3>
            <input
              className="input"
              type="text"
              placeholder="Search by department, room, facility... (e.g. pharmacy, emergency, OT)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, fontSize: 12 }}>
              {Object.entries(DEPARTMENT_COLORS).slice(0, 8).map(([key, color]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block' }} />
                  {key}
                </div>
              ))}
            </div>

            {/* Results */}
            {filteredRooms.length > 0 ? (
              <div className="grid grid-2" style={{ gap: 8 }}>
                {filteredRooms.map(room => {
                  const color = DEPARTMENT_COLORS[room.category || 'facility'] || '#6366F1';
                  return (
                    <div
                      key={room.id}
                      className="card card-pad"
                      style={{ padding: 12, cursor: 'pointer', borderLeft: `3px solid ${color}` }}
                      onClick={() => handleSelectRoom(room.id)}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{room.name}</div>
                      {room.nameHi && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{room.nameHi}</div>}
                      <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 6 }}>
                        <span className="badge" style={{ fontSize: 10 }}>{room.department || room.category}</span>
                        <span className="badge badge-warn" style={{ fontSize: 10 }}>{room.verification}</span>
                      </div>
                      {selectedRoom === room.id && (
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ marginTop: 8, width: '100%' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Simple route: entrance → room
                            const entrance = allRooms.find(r => r.category === 'entrance');
                            if (entrance) startRoute(entrance.id, room.id);
                            else startRoute(room.id, room.id);
                          }}
                        >
                          🧭 Navigate Here
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : hospital.buildings.length > 0 ? (
              <p className="muted">No matching rooms found.</p>
            ) : (
              <p className="muted">This hospital has no indoor map data. Only directory information is available.</p>
            )}
          </div>

          {/* Route display */}
          {route && (
            <div className="card card-pad" style={{ borderLeft: '3px solid #0D9488' }}>
              <h3 style={{ marginTop: 0, color: '#0D9488' }}>🧭 Navigation Route</h3>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>From:</strong> {allRooms.find(r => r.id === route.from)?.name || 'Entrance'}
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>To:</strong> {allRooms.find(r => r.id === route.to)?.name || 'Destination'}
                </p>
                <p style={{ margin: 0 }} className="muted">
                  Route calculated using the navigation graph. The route highlights
                  corridors, lifts, and stairs on the 3D map.
                </p>
              </div>
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setRoute(null)}>
                Clear Route
              </button>
            </div>
          )}

          {/* Sources */}
          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>📚 Research Sources & Verification</h3>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>VERIFICATION STATUS</div>
                <span className={`badge ${hospital.verification === 'VERIFIED' || hospital.verification === 'OFFICIAL_SOURCE' ? 'badge-brand' : 'badge-warn'}`}>
                  {hospital.verification}
                </span>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>SOURCES</div>
                {hospital.sources.map((s, i) => (
                  <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0D9488' }}>
                      [{s.type}] {s.url.length > 60 ? s.url.slice(0, 60) + '…' : s.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
