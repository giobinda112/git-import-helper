import type { Anagrafiche, Area, PortMapping, VesselOwner } from '../types';
import { canonicalArea } from './areaMapper';

/** Map sheet rows (vesselName or legacy name) to app model. */
export function normalizeVesselOwnerRow(row: unknown): VesselOwner | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  const vesselName = String(
    o.vesselName ?? o.name ?? (o as Record<string, string>).Vessel ?? '',
  ).trim();
  if (!vesselName) return null;
  return {
    vesselName,
    owner: String(o.owner ?? ''),
    dwt: String(o.dwt ?? ''),
    yob: String(o.yob ?? ''),
  };
}

/** Map sheet rows (portName / Port / name / Port name) to app model. */
export function normalizePortMappingRow(row: unknown): PortMapping | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  const portName = String(
    o.portName ?? o.Port ?? o.port ?? o.name ??
    (o as Record<string, string>)['Port name'] ?? (o as Record<string, string>)['Port Name'] ?? '',
  ).trim();
  if (!portName) return null;
  const area: Area = canonicalArea(o.area ?? o.Area ?? 'Other');
  return { portName, area };
}

export function normalizeMasterVesselsList(rows: unknown): VesselOwner[] {
  if (!Array.isArray(rows)) return [];
  const out: VesselOwner[] = [];
  for (const r of rows) {
    const vo = normalizeVesselOwnerRow(r);
    if (vo) out.push(vo);
  }
  return out;
}

export function normalizeMasterPortsList(rows: unknown): PortMapping[] {
  if (!Array.isArray(rows)) return [];
  const out: PortMapping[] = [];
  for (const r of rows) {
    const pm = normalizePortMappingRow(r);
    if (pm) out.push(pm);
  }
  return out;
}

/**
 * Apps Script `buildAnagrafiche` uses different keys (`ports`, `owners`).
 * Only merge list fields we trust — never replace vesselOwners/portMappings from this blob.
 */
export function pickSafeAnagraficheFromServer(raw: unknown): Partial<Anagrafiche> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const out: Partial<Anagrafiche> = {};

  const strArrays = ['charterers', 'vessels', 'grades'] as const;
  for (const k of strArrays) {
    const v = o[k];
    if (Array.isArray(v) && v.every(x => typeof x === 'string')) {
      (out as Record<string, unknown>)[k] = v;
    }
  }

  if (Array.isArray(o.loadPorts) && o.loadPorts.every(x => typeof x === 'string')) {
    out.loadPorts = o.loadPorts as string[];
  }
  if (Array.isArray(o.dischargePorts) && o.dischargePorts.every(x => typeof x === 'string')) {
    out.dischargePorts = o.dischargePorts as string[];
  }

  const ports = o.ports;
  if (!out.loadPorts?.length && Array.isArray(ports) && ports.every(x => typeof x === 'string')) {
    const p = ports as string[];
    out.loadPorts = [...p];
    out.dischargePorts = [...p];
  }

  return Object.keys(out).length ? out : undefined;
}
