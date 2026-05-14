/** Hardcoded app unlock (per product spec). */
export const MASTER_PASSWORD = 'Cargo2026';

export const SESSION_DURATION_MS = 60 * 60 * 1000;

export const LS_SESSION_START = 'sessionStartTime';
export const LS_DEVICE_OWNER = 'deviceOwner';

export function readSessionStartMs(): number | null {
  const v = localStorage.getItem(LS_SESSION_START);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/** True when there is no valid session window (missing or older than 1 hour). */
export function isSessionExpired(): boolean {
  const t = readSessionStartMs();
  if (t === null) return true;
  return Date.now() - t > SESSION_DURATION_MS;
}

export function readDeviceOwner(): string {
  return (localStorage.getItem(LS_DEVICE_OWNER) || '').trim();
}

export function saveDeviceOwner(name: string): void {
  localStorage.setItem(LS_DEVICE_OWNER, name.trim());
}

export function touchSessionStart(): void {
  localStorage.setItem(LS_SESSION_START, String(Date.now()));
}

/**
 * If a session timestamp exists and is within the last hour, slide the window forward and return true.
 * Otherwise return false (caller should show login).
 */
export function slideSessionIfValid(): boolean {
  if (isSessionExpired()) return false;
  touchSessionStart();
  return true;
}

export function tryUnlock(password: string, computerName: string | undefined): boolean {
  if (password !== MASTER_PASSWORD) return false;
  touchSessionStart();
  if (!readDeviceOwner() && computerName?.trim()) saveDeviceOwner(computerName.trim());
  return true;
}
