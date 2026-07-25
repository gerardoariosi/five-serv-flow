// Vendor payment week helpers — local browser time (Eastern for the FiveServ team).

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Most recently completed Saturday. If today is Saturday, returns today. */
export function mostRecentSaturday(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const dow = d.getDay(); // 0 Sun..6 Sat
  const diff = (dow - 6 + 7) % 7; // days since last Saturday
  d.setDate(d.getDate() - diff);
  return d;
}

/** N most recent completed Saturdays, newest first. */
export function getRecentSaturdays(count = 6, from: Date = new Date()): Date[] {
  const first = mostRecentSaturday(from);
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() - i * 7);
    out.push(d);
  }
  return out;
}

/** Thursday after a given Saturday (Saturday + 5 days). Accepts Date or ISO string. */
export function thursdayAfter(sat: Date | string): Date {
  const d = typeof sat === 'string' ? new Date(sat + 'T00:00:00') : new Date(sat);
  d.setDate(d.getDate() + 5);
  return d;
}

export function formatWeekLabel(sat: Date): string {
  return sat.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
