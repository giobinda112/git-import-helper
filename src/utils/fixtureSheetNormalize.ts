import type { Fixture, Area, VesselOwner, FixtureSheetPayload, FieldEdit } from '../types';
import { ALL_AREAS } from './areaMapper';
import { todayISO } from './helpers';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function coerceDateAdded(s: string): string {
  const t = s.trim();
  if (!t) return '';
  if (ISO_DATE.test(t)) return t;
  const eu = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (eu) {
    const dd = eu[1].padStart(2, '0');
    const mm = eu[2].padStart(2, '0');
    return `${eu[3]}-${mm}-${dd}`;
  }
  return t;
}

/** Laycan-like: range or slash dates (not a bare ISO yyyy-mm-dd). */
function looksLikeLaycan(s: string): boolean {
  if (!s || ISO_DATE.test(s.trim())) return false;
  return /[-\/]/.test(s) && /\d/.test(s);
}

/**
 * After Google Sheets pull: fix swapped DATE vs LAYCAN and normalize dateAdded to ISO yyyy-mm-dd.
 * Colors/weeks use dateAdded only — laycan must never replace it unless clearly misplaced.
 */
export function normalizeFixtureAfterPull(raw: Record<string, unknown>): Fixture {
  let dateAdded = coerceDateAdded(String(raw.dateAdded ?? ''));
  let laycan = String(raw.laycan ?? '').trim();

  // Pulled laycan into dateAdded cell (range text) and ISO laycan cell — swap
  if (looksLikeLaycan(dateAdded) && ISO_DATE.test(laycan)) {
    const t = dateAdded;
    dateAdded = laycan;
    laycan = t;
  }

  // dateAdded contains laycan text, laycan empty → move range to laycan; date = oggi (immissione)
  if (looksLikeLaycan(dateAdded) && !laycan) {
    laycan = dateAdded;
    dateAdded = todayISO();
  }

  const rawArea = String(raw.area ?? 'Other');
  const area = (ALL_AREAS.includes(rawArea as Area) ? rawArea : 'Other') as Area;

  let editHistory = raw.editHistory;
  if (typeof editHistory === 'string') {
    try {
      editHistory = JSON.parse(editHistory);
    } catch {
      editHistory = [];
    }
  }
  if (!Array.isArray(editHistory)) editHistory = [];

  const updatedAtRaw = Number(raw.updatedAt ?? 0);
  return {
    id: String(raw.id ?? ''),
    dateAdded,
    charterers: String(raw.charterers ?? ''),
    qty: String(raw.qty ?? ''),
    loadPort: String(raw.loadPort ?? ''),
    dischargePort: String(raw.dischargePort ?? ''),
    laycan,
    vessel: String(raw.vessel ?? ''),
    rate: String(raw.rate ?? ''),
    status: (raw.status ?? '') as Fixture['status'],
    grade: String(raw.grade ?? ''),
    area,
    dem: String(raw.dem ?? ''),
    comments: String(raw.comments ?? ''),
    position: String(raw.position ?? ''),
    openDate: String(raw.openDate ?? ''),
    editHistory: editHistory as FieldEdit[],
    archived: Boolean(raw.archived),
    private: Boolean(raw.private),
    updatedAt: Number.isFinite(updatedAtRaw) ? updatedAtRaw : 0,
  };
}

/** Sheet `Fixtures` has owner/dwt/yob columns; merge from master list so Google Sheets shows full vessel row. */
export function fixturesForGoogleSheetSync(fixtures: Fixture[], vesselOwners: VesselOwner[]): FixtureSheetPayload[] {
  return fixtures.map(f => {
    const vo = vesselOwners.find(v => v.vesselName === f.vessel);
    return {
      ...f,
      owner: vo?.owner ?? '',
      dwt: vo?.dwt ?? '',
      yob: vo?.yob ?? '',
    };
  });
}
