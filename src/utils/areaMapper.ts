import type { Area, PortMapping } from '../types';

const DEFAULT_PORT_MAPPINGS: PortMapping[] = [
  // MEG
  { portName: 'RAS TANURA', area: 'MEG' }, { portName: 'JUAYMAH', area: 'MEG' },
  { portName: 'DUBAI', area: 'MEG' }, { portName: 'FUJAIRAH', area: 'MEG' },
  { portName: 'KHOR FAKKAN', area: 'MEG' }, { portName: 'MINA AL AHMADI', area: 'MEG' },
  { portName: 'SIDI KERIR', area: 'MEG' }, { portName: 'AIN SUKHNA', area: 'MEG' },
  { portName: 'DAMMAM', area: 'MEG' }, { portName: 'MUSCAT', area: 'MEG' },
  { portName: 'SOHAR', area: 'MEG' }, { portName: 'BASRAH', area: 'MEG' },
  { portName: 'ES SIDER', area: 'MEG' }, { portName: 'HARIGA', area: 'MEG' },
  { portName: 'ZAWIYA', area: 'MEG' }, { portName: 'MARSAXLOKK', area: 'MEG' },
  // Red Sea
  { portName: 'YANBU', area: 'Red Sea' }, { portName: 'JEDDAH', area: 'Red Sea' },
  { portName: 'SOKHNA', area: 'Red Sea' }, { portName: 'AQUABA', area: 'Red Sea' },
  { portName: 'PORT SUDAN', area: 'Red Sea' }, { portName: 'ERITREA', area: 'Red Sea' },
  { portName: 'DJIBOUTI', area: 'Red Sea' },
  // Indonesia
  { portName: 'BALIKPAPAN', area: 'Indonesia' }, { portName: 'CILACAP', area: 'Indonesia' },
  { portName: 'DUMAI', area: 'Indonesia' }, { portName: 'TANJUNG', area: 'Indonesia' },
  { portName: 'SEKUPANG', area: 'Indonesia' }, { portName: 'PLAJU', area: 'Indonesia' },
  { portName: 'CIGADING', area: 'Indonesia' }, { portName: 'JAKARTA', area: 'Indonesia' },
  { portName: 'SURABAYA', area: 'Indonesia' }, { portName: 'PALEMBANG', area: 'Indonesia' },
  // Med
  { portName: 'CEYHAN', area: 'Med' }, { portName: 'ISKENDERUN', area: 'Med' },
  { portName: 'TRIPOLI LB', area: 'Med' }, { portName: 'AUGUSTA', area: 'Med' },
  { portName: 'GENOA', area: 'Med' }, { portName: 'TRIESTE', area: 'Med' },
  { portName: 'LAVRION', area: 'Med' }, { portName: 'PIRAEUS', area: 'Med' },
  { portName: 'MILAZZO', area: 'Med' }, { portName: 'SARROCH', area: 'Med' },
  { portName: 'ALGECIRAS', area: 'Med' }, { portName: 'MARSEILLE', area: 'Med' },
  // Continent
  { portName: 'ROTTERDAM', area: 'Continent' }, { portName: 'AMSTERDAM', area: 'Continent' },
  { portName: 'ANTWERP', area: 'Continent' }, { portName: 'HAMBURG', area: 'Continent' },
  { portName: 'LE HAVRE', area: 'Continent' }, { portName: 'FAWLEY', area: 'Continent' },
  { portName: 'IMMINGHAM', area: 'Continent' }, { portName: 'MILFORD HAVEN', area: 'Continent' },
  { portName: 'WILHELMSHAVEN', area: 'Continent' }, { portName: 'MONGSTAD', area: 'Continent' },
  { portName: 'KALUNDBORG', area: 'Continent' }, { portName: 'GOETEBORG', area: 'Continent' },
  { portName: 'PORI', area: 'Continent' },
  // WAfrica
  { portName: 'LAGOS', area: 'WAfrica' }, { portName: 'BONNY', area: 'WAfrica' },
  { portName: 'FORCADOS', area: 'WAfrica' }, { portName: 'ESCRAVOS', area: 'WAfrica' },
  { portName: 'QUA IBOE', area: 'WAfrica' }, { portName: 'ABIDJAN', area: 'WAfrica' },
  { portName: 'TEMA', area: 'WAfrica' }, { portName: 'TAKORADI', area: 'WAfrica' },
  { portName: 'LUANDA', area: 'WAfrica' }, { portName: 'CABINDA', area: 'WAfrica' },
  { portName: 'POINTE NOIRE', area: 'WAfrica' }, { portName: 'DAKAR', area: 'WAfrica' },
  // Caribs
  { portName: 'CURACAO', area: 'Caribs' }, { portName: 'ARUBA', area: 'Caribs' },
  { portName: 'ST EUSTATIUS', area: 'Caribs' }, { portName: 'FREEPORT', area: 'Caribs' },
  { portName: 'POINT LISAS', area: 'Caribs' }, { portName: 'TRINIDAD', area: 'Caribs' },
  { portName: 'BAHIA LAS MINAS', area: 'Caribs' },
  // WAmerica
  { portName: 'LONG BEACH', area: 'WAmerica' }, { portName: 'LOS ANGELES', area: 'WAmerica' },
  { portName: 'SAN FRANCISCO', area: 'WAmerica' }, { portName: 'SEATTLE', area: 'WAmerica' },
  { portName: 'VANCOUVER', area: 'WAmerica' }, { portName: 'VALDEZ', area: 'WAmerica' },
  { portName: 'ANCHORAGE', area: 'WAmerica' },
];

export function getDefaultPortMappings(): PortMapping[] {
  return DEFAULT_PORT_MAPPINGS;
}

export function normalizePortKey(value: string | undefined | null): string {
  if (value == null || typeof value !== 'string') return '';
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchPort(portInput: string, mappingName: string | undefined | null): boolean {
  const a = normalizePortKey(portInput);
  const b = normalizePortKey(mappingName);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

export function detectArea(loadPort: string | undefined | null, portMappings: PortMapping[]): Area | null {
  const lp = normalizePortKey(loadPort);
  if (!lp) return null;

  const rawFirst = typeof loadPort === 'string' ? loadPort.split('-')[0] : '';
  const firstPort = normalizePortKey(rawFirst || '');

  const mappings = Array.isArray(portMappings) ? portMappings : [];

  for (const mapping of mappings) {
    if (!mapping?.portName) continue;
    if (matchPort(firstPort, mapping.portName)) return mapping.area;
  }

  for (const mapping of mappings) {
    if (!mapping?.portName) continue;
    if (matchPort(lp, mapping.portName)) return mapping.area;
  }

  return null;
}

/**
 * Smart port parsing: "/" separates Load from Discharge zones.
 * "-" separates multiple ports within the same zone.
 * Laycan dates (e.g., "12-14/05") are not split.
 * Returns { loadPorts: string[], dischargePorts: string[] }
 */
export function parsePortRoute(input: string): { loadPorts: string[]; dischargePorts: string[] } {
  const s = input.toUpperCase().trim();
  if (!s) return { loadPorts: [], dischargePorts: [] };

  // Check if this looks like a laycan date (digits around /)
  const laycanPattern = /^\d{1,2}[-–]\d{1,2}\/\d{1,2}$/;
  if (laycanPattern.test(s)) return { loadPorts: [s], dischargePorts: [] };

  // Split by "/" - but only if it's not a date pattern
  // A date pattern has digits on both sides of /
  // A route pattern has word characters on at least one side
  const slashParts = s.split('/');

  if (slashParts.length >= 2) {
    // Check if the slash is a date separator (e.g., "12/05")
    const isDateSlash = /^\d{1,2}$/.test(slashParts[0]) && /^\d{1,2}(-|$)/.test(slashParts[1]);

    if (!isDateSlash) {
      // This is a route separator
      const loadPart = slashParts[0].trim();
      const dischargePart = slashParts.slice(1).join('/').trim();

      const loadPorts = loadPart ? loadPart.split('-').map(p => p.trim()).filter(Boolean) : [];
      const dischargePorts = dischargePart ? dischargePart.split('-').map(p => p.trim()).filter(Boolean) : [];

      return { loadPorts, dischargePorts };
    }
  }

  // No route separator found - treat entire input as load port(s)
  const ports = s.split('-').map(p => p.trim()).filter(Boolean);
  return { loadPorts: ports, dischargePorts: [] };
}

export const ALL_AREAS: Area[] = [
  'MEG', 'Red Sea', 'Indonesia', 'Med', 'Black Sea', 'Continent', 'WAfrica', 'Caribs', 'WAmerica', 'Other'
];

/** Strict canonicalization: matches by trimmed/uppercased key; unknown → 'Other'. */
export function canonicalArea(input: unknown): Area {
  if (typeof input !== 'string') return 'Other';
  const key = input.trim().toUpperCase();
  if (!key) return 'Other';
  const found = ALL_AREAS.find(a => a.toUpperCase() === key);
  return found ?? 'Other';
}
