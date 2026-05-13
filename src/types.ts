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

export type Status = '' | 'SUBS' | 'FIXED' | 'FAILED' | 'REPLACED';

export type DwtCategory = 'AFRAMAX' | 'SUEZMAX' | 'VLCC' | '';

export interface FieldEdit {
  field: string;
  oldValue: string;
  newValue: string;
  editedAt: string;
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
}

export interface PortMapping {
  portName: string;
  area: Area;
}

export interface VesselOwner {
  vesselName: string;
  owner: string;
  dwt: string;
  yob: string;
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

export interface VesselOnSubsEntry {
  id: string;
  vessel: string;
  port: string;
  openDate: string;
  dateAdded: string;
}

export function getDwtCategory(dwt: string): DwtCategory {
  const num = parseInt(dwt, 10);
  if (isNaN(num) || num <= 0) return '';
  if (num >= 80 && num < 125) return 'AFRAMAX';
  if (num >= 125 && num < 190) return 'SUEZMAX';
  if (num >= 190 && num <= 330) return 'VLCC';
  if (num < 80) return 'AFRAMAX';
  return 'VLCC';
}
