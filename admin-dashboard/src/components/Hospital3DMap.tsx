import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { DEPARTMENT_COLORS, type KotaHospitalRecord, type FloorRecord, type RoomRecord } from '../data/kota-hospitals';

// Room 3D box component
function RoomBox({ room, isSelected, onSelect, floorOffset }: {
  room: RoomRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  floorOffset: number;
}) {
  const [hovered, setHovered] = useState(false);
  const color = DEPARTMENT_COLORS[room.category || 'facility'] || '#6366F1';
  const w = room.widthMetres || 5;
  const d = room.depthMetres || 5;
  const h = 3.5;

  return (
    <group
      position={[room.xMetres, room.yMetres + floorOffset + h / 2, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => onSelect(room.id)}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={hovered || isSelected ? 0.85 : 0.55}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      {/* Room label */}
      <Html position={[0, h / 2 + 0.2, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontSize: 11,
          color: '#1a1a2e',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          background: 'rgba(255,255,255,0.85)',
          padding: '2px 6px',
          borderRadius: 4,
        }}>
          {room.name}
        </div>
      </Html>
    </group>
  );
}

// Floor slab component
function FloorSlab({ floor, floorOffset }: { floor: FloorRecord; floorOffset: number }) {
  return (
    <mesh position={[30, floorOffset, 15]} receiveShadow>
      <boxGeometry args={[60, 0.3, 30]} />
      <meshStandardMaterial color="#E8EDF2" roughness={0.8} transparent opacity={0.7} />
    </mesh>
  );
}

// Floor view with rooms
function Floor3D({ floor, floorOffset, selectedRoom, onSelectRoom }: {
  floor: FloorRecord;
  floorOffset: number;
  selectedRoom: string | null;
  onSelectRoom: (id: string) => void;
}) {
  return (
    <group>
      {/* Floor slab */}
      <mesh position={[30, floorOffset + 0.15, 15]} receiveShadow>
        <boxGeometry args={[60, 0.3, 30]} />
        <meshStandardMaterial color="#E8EDF2" roughness={0.8} transparent opacity={0.6} />
      </mesh>
      {/* Corridor */}
      <mesh position={[30, floorOffset + 0.3, 25]}>
        <boxGeometry args={[60, 0.1, 4]} />
        <meshStandardMaterial color="#F0F4F8" roughness={0.9} />
      </mesh>
      {/* Rooms */}
      {floor.rooms.map(room => (
        <RoomBox
          key={room.id}
          room={room}
          isSelected={selectedRoom === room.id}
          onSelect={onSelectRoom}
          floorOffset={floorOffset}
        />
      ))}
    </group>
  );
}

// Building 3D model
function Building3D({ hospital, exploded, selectedRoom, onSelectRoom, visibleFloors }: {
  hospital: KotaHospitalRecord;
  exploded: boolean;
  selectedRoom: string | null;
  onSelectRoom: (id: string) => void;
  visibleFloors: Set<number>;
}) {
  const building = hospital.buildings[0];
  if (!building) return null;

  const floors = building.floors.filter(f => visibleFloors.has(f.floorNumber));
  const floorSpacing = 5;

  return (
    <group>
      {/* Building base */}
      <mesh position={[30, -1, 15]} castShadow receiveShadow>
        <boxGeometry args={[60, 2, 30]} />
        <meshStandardMaterial color="#C8D0DA" roughness={0.7} />
      </mesh>

      {/* Floors */}
      {floors.map((floor, idx) => {
        const offset = exploded ? idx * floorSpacing : idx * 4;
        return (
          <Floor3D
            key={floor.id}
            floor={floor}
            floorOffset={offset}
            selectedRoom={selectedRoom}
            onSelectRoom={onSelectRoom}
          />
        );
      })}

      {/* Building outline */}
      <lineSegments position={[30, 0, 15]}>
        <edgesGeometry args={[new THREE.BoxGeometry(60, (floors.length * 4) + 2, 30)]} />
        <lineBasicMaterial color="#374151" linewidth={2} />
      </lineSegments>
    </group>
  );
}

// Main 3D scene
export function Hospital3DMap({
  hospital,
  exploded,
  selectedRoom,
  onSelectRoom,
  visibleFloors,
}: {
  hospital: KotaHospitalRecord;
  exploded: boolean;
  selectedRoom: string | null;
  onSelectRoom: (id: string) => void;
  visibleFloors: Set<number>;
}) {
  const selectedRoomData = useMemo(() => {
    if (!selectedRoom) return null;
    for (const b of hospital.buildings) {
      for (const f of b.floors) {
        const r = f.rooms.find(r => r.id === selectedRoom);
        if (r) return { room: r, floor: f };
      }
    }
    return null;
  }, [selectedRoom, hospital]);

  return (
    <div style={{ width: '100%', height: 480, borderRadius: 16, overflow: 'hidden', background: '#0B1220' }}>
      <Canvas shadows camera={{ position: [50, 40, 50], fov: 50 }}>
        <color attach="background" args={['#0B1220']} />
        <fog attach="fog" args={['#0B1220', 80, 180]} />

        <ambientLight intensity={0.4} />
        <directionalLight position={[30, 50, 20]} intensity={0.8} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-20, 30, -10]} intensity={0.3} />

        {hospital.buildings.map(b => (
          <Building3D
            key={b.id}
            hospital={hospital}
            exploded={exploded}
            selectedRoom={selectedRoom}
            onSelectRoom={onSelectRoom}
            visibleFloors={visibleFloors}
          />
        ))}

        <ContactShadows position={[30, -2, 15]} opacity={0.5} scale={80} blur={2} far={40} />
        <OrbitControls enableDamping dampingFactor={0.08} minDistance={20} maxDistance={120} />
        <Environment preset="city" />
      </Canvas>

      {/* Room detail panel */}
      {selectedRoomData && (
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 16,
          maxWidth: 280, boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{selectedRoomData.room.name}</h3>
          {selectedRoomData.room.nameHi && (
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>{selectedRoomData.room.nameHi}</p>
          )}
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#666' }}>
            🏥 {selectedRoomData.room.department || 'General'}
          </p>
          {selectedRoomData.room.operatingHours && (
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#666' }}>
              🕐 {selectedRoomData.room.operatingHours}
            </p>
          )}
          <p style={{ margin: 0, fontSize: 11, color: '#999', textTransform: 'uppercase' }}>
            {selectedRoomData.room.verification}
          </p>
        </div>
      )}
    </div>
  );
}

// 2D fallback floor plan
export function FloorPlan2D({ hospital, selectedRoom, onSelectRoom }: {
  hospital: KotaHospitalRecord;
  selectedRoom: string | null;
  onSelectRoom: (id: string) => void;
}) {
  const building = hospital.buildings[0];
  if (!building) return <div className="card card-pad">No floor plan data available.</div>;

  return (
    <div style={{ width: '100%', height: 480, borderRadius: 16, overflow: 'hidden', background: '#F8FAFC', position: 'relative' }}>
      <svg viewBox="0 0 600 350" style={{ width: '100%', height: '100%' }}>
        {/* Building outline */}
        <rect x="20" y="20" width="560" height="300" fill="none" stroke="#CBD5E0" strokeWidth="3" />
        {/* Corridor */}
        <rect x="20" y="260" width="560" height="60" fill="#F0F4F8" stroke="#E2E8F0" />
        <text x="300" y="295" textAnchor="middle" fontSize="11" fill="#94A3B8">Corridor</text>

        {/* Floors */}
        {building.floors.map((floor, fi) => {
          const yBase = 20 + fi * 60;
          const floorLabel = floor.label;

          return (
            <g key={floor.id}>
              <rect x="20" y={yBase} width="560" height="55" fill="#FAFBFC" stroke="#E2E8F0" strokeWidth="1" />
              <text x="30" y={yBase + 15} fontSize="10" fill="#64748B" fontWeight="600">{floorLabel}</text>

              {floor.rooms.map(room => {
                const color = DEPARTMENT_COLORS[room.category || 'facility'] || '#6366F1';
                const rx = 30 + (room.xMetres * 4);
                const ry = yBase + 20 + (room.yMetres * 0.5);
                const rw = (room.widthMetres || 5) * 4;
                const rh = (room.depthMetres || 5) * 0.5;
                const isSelected = selectedRoom === room.id;

                return (
                  <g key={room.id} onClick={() => onSelectRoom(room.id)} style={{ cursor: 'pointer' }}>
                    <rect
                      x={rx} y={ry} width={rw} height={rh}
                      fill={color} fillOpacity={isSelected ? 0.85 : 0.5}
                      stroke={isSelected ? '#1a1a2e' : color} strokeWidth={isSelected ? 2 : 1}
                      rx="3"
                    />
                    <text x={rx + rw / 2} y={ry + rh / 2 + 3} textAnchor="middle" fontSize="7" fill="#1a1a2e" pointerEvents="none">
                      {room.name.length > 20 ? room.name.slice(0, 20) + '…' : room.name}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
