import QRCode from 'qrcode';
import { get } from '../db/sqlite.js';
import { QrError } from '../errors.js';

// QR location identifiers are opaque, non-sensitive tokens. Format:
//   <HOSPITAL_SHORT>-<FLOOR_LETTER>-<ROOM/TYPE>-<NNN>
// e.g. MDH-G-REG-001. They encode no patient data and can be scanned safely.

export interface QrPayload {
  hospitalShort: string;
  floorLetter: string;
  slot: string;
  sequence: number;
}

export interface QrLocation {
  id: string;
  hospital_id: string;
  building_id: string;
  floor_id: string;
  room_id: string | null;
  node_id: string | null;
  location_identifier: string;
  label: string;
  x_metres: number | null;
  y_metres: number | null;
  is_active: number;
  verification_status: string;
}

export function buildIdentifier(payload: QrPayload): string {
  return `${payload.hospitalShort.toUpperCase()}-${payload.floorLetter.toUpperCase()}-${payload.slot.toUpperCase()}-${String(payload.sequence).padStart(3, '0')}`;
}

/** Generate a QR image (data URL) for a location identifier. */
export async function generateQrDataUrl(identifier: string): Promise<string> {
  return QRCode.toDataURL(identifier, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

/** Validate that an identifier conforms to the expected format. */
export function isValidIdentifier(identifier: string): boolean {
  return /^[A-Z0-9]+-[A-Z]-[A-Z0-9]+-[0-9]{3}$/.test(identifier.toUpperCase());
}

/** Resolve a scanned identifier to a live, verified QR location. */
export function resolveIdentifier(identifier: string, hospitalId?: string): QrLocation {
  if (!isValidIdentifier(identifier)) {
    throw new QrError('invalid', `QR identifier "${identifier}" is not a valid location identifier`);
  }
  const row = get<QrLocation>(
    `SELECT id, hospital_id, building_id, floor_id, room_id, node_id, location_identifier, label,
            x_metres, y_metres, is_active, verification_status
     FROM qr_locations
     WHERE location_identifier = ? AND is_active = 1 AND verification_status = 'verified'
     LIMIT 1`,
    identifier.toUpperCase(),
  );
  if (!row) {
    throw new QrError('unverified', `No verified location found for identifier "${identifier}"`);
  }
  if (hospitalId && row.hospital_id !== hospitalId) {
    throw new QrError('invalid', `Identifier "${identifier}" does not belong to this hospital`);
  }
  return row;
}

/** Guard against duplicate identifiers at creation time. */
export function assertNoDuplicate(identifier: string, hospitalId: string): void {
  const existing = get<{ id: string }>(
    'SELECT id FROM qr_locations WHERE location_identifier = ? AND hospital_id = ?',
    identifier, hospitalId,
  );
  if (existing) {
    throw new QrError('duplicate', `Location identifier "${identifier}" already exists in this hospital`);
  }
}
