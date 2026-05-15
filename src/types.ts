export type Area =
  | 'MEG'
  | 'Red Sea'
  | 'Indonesia'
  | 'Med'
  | 'Black Sea'
  | 'Continent'
  | 'WAfrica'
  | 'Caribs'
  | 'WAmerica'
  | 'Other';

export type Status = '' | 'OPEN' | 'SUBS' | 'FIXED' | 'FAILED' | 'REPLACED';

export type DwtCategory = 'SMALL' | 'HANDY' | 'PANAMAX' | 'AFRAMAX' | 'SUEZMAX' | 'VLCC' | '';

export interface FieldEdit {
  field: string;
  oldValue: string;
  newValue: string;
  /** ISO timestamp or legacy yyyy-mm-dd date string from older rows */
  editedAt: string;
  /** Workstation label from localStorage after login */
  deviceOwner?: string;
}

export interface Fixture {
  id: string;
  dateAdded: string;
  charterers: string;
  qty: string;
  loadPort: string;
  dischargePort: string;
  laycan: string;
  vessel: string;
  rate: string;
  status: Status;
  grade: string;
  area: Area;
  dem: string;
  comments: string;
  position: string;
  openDate: string;
  editHistory: FieldEdit[];
  archived: boolean;
  private: boolean;
  /** Millisecond timestamp of the last local mutation (last-write-wins guard). */
  updatedAt?: number;
}

export interface PortMapping {
  portName: string;
  area: Area;
  updatedAt?: number;
}

export interface VesselOwner {
  vesselName: string;
  owner: string;
  dwt: string;
  yob: string;
  updatedAt?: number;
}

export interface Anagrafiche {
  charterers: string[];
  vessels: string[];
  loadPorts: string[];
  dischargePorts: string[];
  grades: string[];
  portMappings: PortMapping[];
  vesselOwners: VesselOwner[];
}

export type ThemeMode = 'dark' | 'light';

/** Extra columns written to Google Sheet `Fixtures` tab (owner/dwt/yob from master). */
export type FixtureSheetPayload = Fixture & { owner?: string; dwt?: string; yob?: string };

export interface SyncData {
  fixtures?: FixtureSheetPayload[];
  /** Aggregated lists from server; merged safely — master sheets use masterVessels / masterPorts. */
  anagrafiche?: Partial<Anagrafiche> | Record<string, unknown>;
  vesselsOnSubs?: VesselOnSubsEntry[];
  masterVessels?: VesselOwner[];
  masterPorts?: PortMapping[];
}

/** Payload for `metaSync4` (fixtures excluded — use rowUpsert4 per fixture). */
export interface MetaSyncPayload {
  anagrafiche: Anagrafiche;
  vesselsOnSubs: VesselOnSubsEntry[];
  masterVessels: VesselOwner[];
  masterPorts: PortMapping[];
}

export interface VesselOnSubsEntry {
  id: string;
  vessel: string;
  port: string;
  openDate: string;
  dateAdded: string;
  updatedAt?: number;
}

/**
 * DWT brackets (in thousands DWT):
 *  Small      0 – 24.99
 *  Handy/MR   25 – 52.99
 *  Panamax    53 – 69.99
 *  Aframax    70 – 124.99
 *  Suezmax    125 – 199.99
 *  VLCC       200 +
 */
export function getDwtCategory(dwt: string): DwtCategory {
  const num = parseInt(dwt, 10);
  if (isNaN(num) || num <= 0) return '';
  if (num < 25) return 'SMALL';
  if (num < 53) return 'HANDY';
  if (num < 70) return 'PANAMAX';
  if (num < 125) return 'AFRAMAX';
  if (num < 200) return 'SUEZMAX';
  return 'VLCC';
}
