export function toUpper(str: string): string {
  return str.toUpperCase();
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Millisecond timestamp used by the universal last-write-wins guard across all sheets. */
export function nowMs(): number {
  return Date.now();
}

export function uniqueSorted(arr: string[]): string[] {
  return [...new Set(arr.map(s => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

export function matchesSearch(text: string, query: string): boolean {
  return text.toUpperCase().includes(query.toUpperCase());
}
