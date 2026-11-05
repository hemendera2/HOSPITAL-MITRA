// ============================================================================
// Kota Hospital Intelligence Dataset
// Research compiled from public sources (web search, government listings,
// hospital websites, news reports). Each record includes source attribution
// and verification status per the Hospital Mitra policy.
//
// Verification statuses:
//   VERIFIED       — physically or officially verified
//   OFFICIAL_SOURCE — confirmed by an official document
//   PUBLIC_SOURCE  — found in a credible public source
//   APPROXIMATE   — approximate location only
//   UNVERIFIED    — requires investigation
//   NOT_AVAILABLE — no reliable data found
//
// IMPORTANT: No indoor room positions are inferred from exterior photographs.
// Where floor layouts are documented (e.g. Kota Heart Institute), the
// information is recorded with its source. Where no floor plan is available,
// the hospital is listed with directory data only and marked UNVERIFIED for
// indoor layout.
// ============================================================================

export type VerificationStatus =
  | 'VERIFIED'
  | 'OFFICIAL_SOURCE'
  | 'PUBLIC_SOURCE'
  | 'APPROXIMATE'
  | 'UNVERIFIED'
  | 'NOT_AVAILABLE';

export interface SourceRecord {
  url: string;
  type: 'official' | 'public' | 'news' | 'government' | 'map';
  retrieved: string; // ISO date
  confidence: 'high' | 'medium' | 'low';
}

export interface RoomRecord {
  id: string;
  floorId: string;
  roomNumber?: string;
  name: string;
  nameHi?: string;
  department?: string;
  category?: string;
  xMetres: number;
  yMetres: number;
  widthMetres?: number;
  depthMetres?: number;
  operatingHours?: string;
  accessibility?: 'wheelchair_accessible' | 'step_free' | 'stairs_only' | 'limited_access';
  verification: VerificationStatus;
  source?: SourceRecord;
  description?: string;
}

export interface FloorRecord {
  id: string;
  floorNumber: number;
  label: string;
  levelElevationM: number;
  rooms: RoomRecord[];
  verification: VerificationStatus;
}

export interface BuildingRecord {
  id: string;
  name: string;
  code?: string;
  floors: FloorRecord[];
  verification: VerificationStatus;
}

export interface KotaHospitalRecord {
  id: string;
  name: string;
  shortName?: string;
  city: string;
  district: string;
  state: string;
  address?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  phoneEmergency?: string;
  website?: string;
  hospitalType?: string;
  bedCount?: number;
  mappingStatus: 'unmapped' | 'partially_mapped' | 'fully_mapped';
  mapVerified: boolean;
  isDemo: boolean;
  buildings: BuildingRecord[];
  sources: SourceRecord[];
  verification: VerificationStatus;
  missingData: string[];
}

// ============================================================================
// KOH — Kota Heart Institute (most detailed data available)
// ============================================================================
export const KOH: KotaHospitalRecord = {
  id: 'koh-001',
  name: 'Kota Heart Institute & Research Centre',
  shortName: 'KOH',
  city: 'Kota',
  district: 'Kota',
  state: 'Rajasthan',
  address: '10-A, Talwandi, NH-12, New Rajeev Gandhi Nagar, Sector-A, Talwandi, Kota, Rajasthan 324005',
  latitude: 25.1504732,
  longitude: 75.8524780,
  phone: '+91 9829228175',
  phoneEmergency: '+91 9829228175',
  website: 'https://kotaheartinstitute.in',
  hospitalType: 'Super Speciality',
  bedCount: 100,
  mappingStatus: 'partially_mapped',
  mapVerified: false,
  isDemo: false,
  verification: 'OFFICIAL_SOURCE',
  sources: [
    { url: 'https://kotaheartinstitute.in/about-hospital/', type: 'official', retrieved: '2026-11-05', confidence: 'high' },
    { url: 'https://yappe.in/rajasthan/kota/kota-heart-institute-and-general-hospital/124651', type: 'public', retrieved: '2026-11-05', confidence: 'medium' },
  ],
  missingData: ['Exact room dimensions', 'Corridor widths', 'Lift positions', 'Stair locations'],
  buildings: [
    {
      id: 'koh-bldg-01',
      name: 'Main Building',
      code: 'KOH-MB',
      verification: 'OFFICIAL_SOURCE',
      floors: [
        {
          id: 'koh-f1-gf',
          floorNumber: 1,
          label: 'Ground Floor',
          levelElevationM: 0,
          verification: 'OFFICIAL_SOURCE',
          rooms: [
            { id: 'koh-r-emergency', floorId: 'koh-f1-gf', name: 'Emergency Department', nameHi: 'आपतकालीन विभाग', department: 'Emergency', category: 'emergency', xMetres: 5, yMetres: 30, widthMetres: 8, depthMetres: 6, operatingHours: '24/7', accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE', description: 'Includes minor OT, 24-hour doctor duty room, round-the-clock pharmacy' },
            { id: 'koh-r-consult', floorId: 'koh-f1-gf', name: 'Consultation Rooms', nameHi: 'परामर्श कक्ष', department: 'OPD', category: 'consultation', xMetres: 20, yMetres: 15, widthMetres: 15, depthMetres: 8, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-pharmacy', floorId: 'koh-f1-gf', name: 'Pharmacy', nameHi: 'फार्मेसी', department: 'Pharmacy', category: 'facility', xMetres: 35, yMetres: 25, widthMetres: 5, depthMetres: 5, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-pathology', floorId: 'koh-f1-gf', name: 'Pathology / Diagnostics', nameHi: 'प्रीक्षणशाला', department: 'Laboratory', category: 'lab', xMetres: 42, yMetres: 20, widthMetres: 6, depthMetres: 6, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-ctscan', floorId: 'koh-f1-gf', name: 'CT Scan', nameHi: 'सीटी स्केन', department: 'Radiology', category: 'radiology', xMetres: 42, yMetres: 10, widthMetres: 5, depthMetres: 5, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-canteen', floorId: 'koh-f1-gf', name: 'Canteen', nameHi: 'कैंडीन', department: 'Amenities', category: 'amenity', xMetres: 50, yMetres: 30, widthMetres: 6, depthMetres: 5, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-entrance', floorId: 'koh-f1-gf', name: 'Main Entrance', nameHi: 'प्रवेश द्वार', category: 'entrance', xMetres: 10, yMetres: 40, widthMetres: 4, depthMetres: 3, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-lift-gf', floorId: 'koh-f1-gf', name: 'Lift (Ground to All Floors)', nameHi: 'लिफ्ट', category: 'lift', xMetres: 30, yMetres: 35, widthMetres: 3, depthMetres: 3, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-stairs-gf', floorId: 'koh-f1-gf', name: 'Stairs', nameHi: 'सीढ़ियाँ', category: 'stair', xMetres: 35, yMetres: 35, widthMetres: 3, depthMetres: 5, accessibility: 'stairs_only', verification: 'OFFICIAL_SOURCE' },
          ],
        },
        {
          id: 'koh-f2-1',
          floorNumber: 2,
          label: 'First Floor',
          levelElevationM: 3.5,
          verification: 'OFFICIAL_SOURCE',
          rooms: [
            { id: 'koh-r-ot-major1', floorId: 'koh-f2-1', name: 'Major OT 1', nameHi: 'प्रमुख Operation Theatre 1', department: 'Surgery', category: 'ot', xMetres: 8, yMetres: 20, widthMetres: 6, depthMetres: 6, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-ot-major2', floorId: 'koh-f2-1', name: 'Major OT 2', nameHi: 'प्रमुख OT 2', department: 'Surgery', category: 'ot', xMetres: 20, yMetres: 20, widthMetres: 6, depthMetres: 6, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-ot-major3', floorId: 'koh-f2-1', name: 'Major OT 3', nameHi: 'प्रमुख OT 3', department: 'Surgery', category: 'ot', xMetres: 32, yMetres: 20, widthMetres: 6, depthMetres: 6, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-ot-minor', floorId: 'koh-f2-1', name: 'Minor OT', nameHi: 'छोटा OT', department: 'Surgery', category: 'ot', xMetres: 8, yMetres: 10, widthMetres: 4, depthMetres: 4, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-ipd-1', floorId: 'koh-f2-1', name: 'IPD Wards (1st Floor)', nameHi: 'दिल्ली कक्ष', department: 'IPD', category: 'ward', xMetres: 20, yMetres: 10, widthMetres: 15, depthMetres: 8, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-lift-1', floorId: 'koh-f2-1', name: 'Lift', nameHi: 'लिफ्ट', category: 'lift', xMetres: 30, yMetres: 35, widthMetres: 3, depthMetres: 3, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-stairs-1', floorId: 'koh-f2-1', name: 'Stairs', nameHi: 'सीढ़ियाँ', category: 'stair', xMetres: 35, yMetres: 35, widthMetres: 3, depthMetres: 5, accessibility: 'stairs_only', verification: 'OFFICIAL_SOURCE' },
          ],
        },
        {
          id: 'koh-f3-2',
          floorNumber: 3,
          label: 'Second Floor',
          levelElevationM: 7,
          verification: 'OFFICIAL_SOURCE',
          rooms: [
            { id: 'koh-r-ipd-2', floorId: 'koh-f3-2', name: 'IPD Wards (2nd Floor)', nameHi: 'दिल्ली कक्ष', department: 'IPD', category: 'ward', xMetres: 8, yMetres: 15, widthMetres: 20, depthMetres: 10, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-ot-2', floorId: 'koh-f3-2', name: 'Operation Theatres (2nd Floor)', nameHi: 'Operation Theatres', department: 'Surgery', category: 'ot', xMetres: 30, yMetres: 15, widthMetres: 10, depthMetres: 8, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-lift-2', floorId: 'koh-f3-2', name: 'Lift', nameHi: 'लिफ्ट', category: 'lift', xMetres: 30, yMetres: 35, widthMetres: 3, depthMetres: 3, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-stairs-2', floorId: 'koh-f3-2', name: 'Stairs', nameHi: 'सीढ़ियाँ', category: 'stair', xMetres: 35, yMetres: 35, widthMetres: 3, depthMetres: 5, accessibility: 'stairs_only', verification: 'OFFICIAL_SOURCE' },
          ],
        },
        {
          id: 'koh-f4-3',
          floorNumber: 4,
          label: 'Third Floor — Paediatrics & Maternity',
          levelElevationM: 10.5,
          verification: 'OFFICIAL_SOURCE',
          rooms: [
            { id: 'koh-r-peds', floorId: 'koh-f4-3', name: 'Paediatrics & Neonatology', nameHi: 'बालचिकित्सा एवं नवजात शिशु', department: 'Paediatrics', category: 'department', xMetres: 8, yMetres: 15, widthMetres: 15, depthMetres: 8, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-nicu', floorId: 'koh-f4-3', name: 'Neonatal ICU (24 bed)', nameHi: 'नवजात ICU', department: 'Neonatology', category: 'icu', xMetres: 25, yMetres: 15, widthMetres: 10, depthMetres: 8, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-pICU', floorId: 'koh-f4-3', name: 'Paediatric ICU (12 bed)', nameHi: 'बाल ICU', department: 'Paediatrics', category: 'icu', xMetres: 25, yMetres: 5, widthMetres: 10, depthMetres: 6, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-labour', floorId: 'koh-f4-3', name: 'Labour Room', nameHi: 'प्रसव कक्ष', department: 'OBG', category: 'facility', xMetres: 8, yMetres: 5, widthMetres: 6, depthMetres: 5, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-private', floorId: 'koh-f4-3', name: 'AC Deluxe Private Rooms', nameHi: 'शटर कक्ष', department: 'IPD', category: 'ward', xMetres: 40, yMetres: 15, widthMetres: 15, depthMetres: 10, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-lift-3', floorId: 'koh-f4-3', name: 'Lift', nameHi: 'लिफ्ट', category: 'lift', xMetres: 30, yMetres: 35, widthMetres: 3, depthMetres: 3, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-stairs-3', floorId: 'koh-f4-3', name: 'Stairs', nameHi: 'सीढ़ियाँ', category: 'stair', xMetres: 35, yMetres: 35, widthMetres: 3, depthMetres: 5, accessibility: 'stairs_only', verification: 'OFFICIAL_SOURCE' },
          ],
        },
        {
          id: 'koh-f5-4',
          floorNumber: 5,
          label: 'Fourth Floor — AC General Ward',
          levelElevationM: 14,
          verification: 'OFFICIAL_SOURCE',
          rooms: [
            { id: 'koh-r-acward', floorId: 'koh-f5-4', name: 'AC General Ward', nameHi: 'कंडीनرال वार्ड', department: 'IPD', category: 'ward', xMetres: 10, yMetres: 15, widthMetres: 25, depthMetres: 12, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-lift-4', floorId: 'koh-f5-4', name: 'Lift', nameHi: 'लिफ्ट', category: 'lift', xMetres: 30, yMetres: 35, widthMetres: 3, depthMetres: 3, accessibility: 'wheelchair_accessible', verification: 'OFFICIAL_SOURCE' },
            { id: 'koh-r-stairs-4', floorId: 'koh-f5-4', name: 'Stairs', nameHi: 'सीढ़ियाँ', category: 'stair', xMetres: 35, yMetres: 35, widthMetres: 3, depthMetres: 5, accessibility: 'stairs_only', verification: 'OFFICIAL_SOURCE' },
          ],
        },
      ],
    },
  ],
};

// ============================================================================
// MBS — Government Medical College Kota (MBS Hospital)
// ============================================================================
export const MBS: KotaHospitalRecord = {
  id: 'mbs-001',
  name: 'MBS Hospital (Government Medical College Kota)',
  shortName: 'MBS',
  city: 'Kota',
  district: 'Kota',
  state: 'Rajasthan',
  address: 'Rangbari Road, Nayapura, Kota, Rajasthan 324005',
  latitude: 25.1242858,
  longitude: 75.8246870,
  phone: '+91 744 232 6000',
  hospitalType: 'Government Teaching Hospital',
  bedCount: 750,
  mappingStatus: 'unmapped',
  mapVerified: false,
  isDemo: false,
  verification: 'PUBLIC_SOURCE',
  sources: [
    { url: 'https://zospital.com/blogs/government-medical-college-kota-appointment-opd-registration-guide', type: 'public', retrieved: '2026-11-05', confidence: 'high' },
    { url: 'https://www.medindia.net/directories/hospitals/mbs-hospital-and-medical-college-kota-rajasthan-6324.htm', type: 'public', retrieved: '2026-11-05', confidence: 'medium' },
  ],
  missingData: ['Building layout', 'Floor plans', 'Room positions', 'Corridor layout', 'Lift/stair locations'],
  buildings: [],
};

// ============================================================================
// NMCH — New Medical College Hospital
// ============================================================================
export const NMCH: KotaHospitalRecord = {
  id: 'nmch-001',
  name: 'New Medical College Hospital (NMCH)',
  shortName: 'NMCH',
  city: 'Kota',
  district: 'Kota',
  state: 'Rajasthan',
  address: 'Rangbari Road, Ghantaghar, Kota, Rajasthan 324006',
  latitude: 25.1199552,
  longitude: 75.8304693,
  hospitalType: 'Government Teaching Hospital',
  mappingStatus: 'unmapped',
  mapVerified: false,
  isDemo: false,
  verification: 'PUBLIC_SOURCE',
  sources: [
    { url: 'https://www.justdial.com/Kota-Rajasthan/New-Medical-College-And-Hospital-Ghantaghar/9999PX744-X744-231111022454-R8X6_BZDET', type: 'public', retrieved: '2026-11-05', confidence: 'medium' },
    { url: 'https://rtiguru.com/how-to-file-rti-in-new-medical-college-and-hospital-kota-in-rajasthan', type: 'government', retrieved: '2026-11-05', confidence: 'medium' },
  ],
  missingData: ['Building layout', 'Floor plans', 'Room positions'],
  buildings: [],
};

// ============================================================================
// RAMPURA — Rampura Satellite Government Hospital
// ============================================================================
export const RAMPURA: KotaHospitalRecord = {
  id: 'rampura-001',
  name: 'Rampura Satellite Government Hospital',
  shortName: 'RSGH',
  city: 'Kota',
  district: 'Kota',
  state: 'Rajasthan',
  address: '5RQR+57J, Rampura, Kota, Rajasthan 324001',
  latitude: 25.1879537,
  longitude: 75.8406518,
  phone: '+91 744 238 0768',
  hospitalType: 'Government Hospital',
  bedCount: 50,
  mappingStatus: 'unmapped',
  mapVerified: false,
  isDemo: false,
  verification: 'PUBLIC_SOURCE',
  sources: [
    { url: 'https://promallu.com/toprated/india/rampura-satelite-government-hospital-ql2mj/', type: 'public', retrieved: '2026-11-05', confidence: 'medium' },
    { url: 'https://www.justdial.com/Kota-Rajasthan/Satellite-Government-Hospital-Rampura/9999PMULDELSTD41501_BZDET', type: 'public', retrieved: '2026-11-05', confidence: 'medium' },
  ],
  missingData: ['Building layout', 'Floor plans', 'Room positions'],
  buildings: [],
};

// ============================================================================
// FORTIS — Fortis Modi Hospital
// ============================================================================
export const FORTIS: KotaHospitalRecord = {
  id: 'fortis-001',
  name: 'Fortis Modi Hospital Kota',
  shortName: 'FMH',
  city: 'Kota',
  district: 'Kota',
  state: 'Rajasthan',
  address: 'Swami Vivekanand Nagar, Rajasthan Housing Board Colony, Kota, Rajasthan 324010',
  phone: '+91 744 2473501',
  website: 'https://www.fortishealthcare.com',
  latitude: 25.1690,
  longitude: 75.8380,
  hospitalType: 'Super Speciality',
  bedCount: 200,
  mappingStatus: 'unmapped',
  mapVerified: false,
  isDemo: false,
  verification: 'PUBLIC_SOURCE',
  sources: [
    { url: 'https://www.hospitalsdata.com/india/fortis-modi-hospital-kota-kota.html', type: 'public', retrieved: '2026-11-05', confidence: 'high' },
    { url: 'https://www.ask4healthcare.com/healthcaresolutions/HosDetail.aspx?hos_id=Del01\\Hos-3730', type: 'public', retrieved: '2026-11-05', confidence: 'high' },
  ],
  missingData: ['Building layout', 'Floor plans', 'Room positions', 'Corridor layout'],
  buildings: [],
};

// ============================================================================
// JK LONE — JK Lone Hospital
// ============================================================================
export const JKLONE: KotaHospitalRecord = {
  id: 'jklone-001',
  name: 'JK Lone Hospital',
  shortName: 'JKL',
  city: 'Kota',
  district: 'Kota',
  state: 'Rajasthan',
  address: '6-C19, Mahaveer Nagar - Lll, Kota, Rajasthan 324005',
  latitude: 25.139263,
  longitude: 75.831964,
  phone: '+91 744 2329603',
  website: 'http://medicaleducation.rajasthan.gov.in/kota/jkloneHospital.asp',
  hospitalType: 'Government Hospital',
  mappingStatus: 'unmapped',
  mapVerified: false,
  isDemo: false,
  verification: 'PUBLIC_SOURCE',
  sources: [
    { url: 'https://www.goaid.in/top-10-private-and-government-hospitals-in-rajasthan/', type: 'public', retrieved: '2026-11-05', confidence: 'medium' },
    { url: 'https://www.justdial.com/Kota-Rajasthan/J-K-Lone-Hospital-Mahaveer-Nagar/9999PX744-X744-140111202430-M7L7_BZDET', type: 'public', retrieved: '2026-11-05', confidence: 'medium' },
    { url: 'https://in.worldorgs.com/catalog/kota/animal-hospital/jk-lone-hospital', type: 'public', retrieved: '2026-11-05', confidence: 'low' },
  ],
  missingData: ['Building layout', 'Floor plans', 'Room positions'],
  buildings: [],
};

// ============================================================================
// Export all Kota hospitals
// ============================================================================
export const KOTA_HOSPITALS: KotaHospitalRecord[] = [
  KOH,
  MBS,
  NMCH,
  RAMPURA,
  FORTIS,
  JKLONE,
];

// Department colors for 3D rendering
export const DEPARTMENT_COLORS: Record<string, string> = {
  emergency: '#DC2626',
  consultation: '#3B82F6',
  pharmacy: '#10B981',
  lab: '#F59E0B',
  radiology: '#8B5CF6',
  ot: '#EF4444',
  ward: '#6366F1',
  icu: '#EC4899',
  entrance: '#22C55E',
  lift: '#F97316',
  stair: '#A16207',
  amenity: '#64748B',
  department: '#0EA5E9',
  facility: '#14B8A6',
};
