// Trusted device management for 2FA.
// After a successful 2FA verification, we remember the device for 4 days so
// the user isn't prompted for a code on every login.

const TRUST_DAYS = 4;
const TRUST_MS = TRUST_DAYS * 24 * 60 * 60 * 1000;
const keyFor = (userId: string) => `fiveserv-trusted-device:${userId}`;

export function markDeviceTrusted(userId: string) {
  if (!userId) return;
  const expiresAt = Date.now() + TRUST_MS;
  try {
    localStorage.setItem(keyFor(userId), String(expiresAt));
  } catch {
    // ignore storage errors
  }
}

export function isDeviceTrusted(userId: string): boolean {
  if (!userId) return false;
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return false;
    const expiresAt = Number(raw);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      localStorage.removeItem(keyFor(userId));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clearTrustedDevice(userId: string) {
  if (!userId) return;
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}
