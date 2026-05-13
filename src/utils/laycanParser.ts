/** Strict yyyy-mm-dd for calendar dates (dateAdded), not laycan ranges. */
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_MAP: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  '01': 1, '02': 2, '03': 3, '04': 4, '05': 5, '06': 6,
  '07': 7, '08': 8, '09': 9, '10': 10, '11': 11, '12': 12,
};

export function parseLaycan(input: string): string {
  if (!input.trim()) return '';

  const currentYear = new Date().getFullYear();
  const s = input.trim().toUpperCase();

  // Pattern: "12-14/05" or "12-14/MAY"
  const rangeMonthPattern = /^(\d{1,2})\s*[-–]\s*(\d{1,2})\s*\/\s*(\w+)$/;
  let m = s.match(rangeMonthPattern);
  if (m) {
    const month = MONTH_MAP[m[3]] || parseInt(m[3], 10);
    if (month) return `${pad(m[1])}-${pad(m[2])}/${pad(month)}/${currentYear}`;
  }

  // Pattern: "12/05-14/05" or "12/MAY-14/MAY"
  const splitRangePattern = /^(\d{1,2})\s*\/\s*(\w+)\s*[-–]\s*(\d{1,2})\s*\/\s*(\w+)$/;
  m = s.match(splitRangePattern);
  if (m) {
    const m1 = MONTH_MAP[m[2]] || parseInt(m[2], 10);
    const m2 = MONTH_MAP[m[4]] || parseInt(m[4], 10);
    if (m1 && m2) return `${pad(m[1])}/${pad(m1)}/${currentYear}-${pad(m[3])}/${pad(m2)}/${currentYear}`;
  }

  // Pattern: "12/05" or "12/MAY"
  const singlePattern = /^(\d{1,2})\s*\/\s*(\w+)$/;
  m = s.match(singlePattern);
  if (m) {
    const month = MONTH_MAP[m[2]] || parseInt(m[2], 10);
    if (month) return `${pad(m[1])}/${pad(month)}/${currentYear}`;
  }

  // Pattern: "12-14 MAY" or "12-14 05"
  const rangeSpacePattern = /^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(\w+)$/;
  m = s.match(rangeSpacePattern);
  if (m) {
    const month = MONTH_MAP[m[3]] || parseInt(m[3], 10);
    if (month) return `${pad(m[1])}-${pad(m[2])}/${pad(month)}/${currentYear}`;
  }

  // Pattern: "12 MAY" or "12 05"
  const dayMonthPattern = /^(\d{1,2})\s+(\w+)$/;
  m = s.match(dayMonthPattern);
  if (m) {
    const month = MONTH_MAP[m[2]] || parseInt(m[2], 10);
    if (month) return `${pad(m[1])}/${pad(month)}/${currentYear}`;
  }

  return s;
}

function pad(n: string | number): string {
  return String(n).padStart(2, '0');
}

/** Display laycan without year: "12-14/05/2026" -> "12-14/05". Handles Sheets mangling laycan into a single ISO date. */
export function displayLaycan(stored: string): string {
  if (!stored) return '';
  const s = stored.trim();
  // Single date saved as yyyy-mm-dd (Google Sheets date column)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return `${pad(parseInt(iso[3], 10))}/${pad(parseInt(iso[2], 10))}`;
  }
  return s.replace(/\/\d{4}/g, '');
}

export function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(weekNo)}`;
}

export function formatDate(isoDate: string): string {
  if (!isoDate?.trim()) return '--';
  if (ISO_DATE_ONLY.test(isoDate.trim())) {
    const [y, m, day] = isoDate.trim().split('-').map(Number);
    const d = new Date(y, m - 1, day);
    if (!Number.isNaN(d.getTime())) {
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
  }
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
