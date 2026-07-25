export type ExpirationStatus = 'expired' | 'expiring' | 'ok' | 'none';

export const getExpirationStatus = (dateStr: string | null | undefined): ExpirationStatus => {
  if (!dateStr) return 'none';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring';
  return 'ok';
};

export const getWorstStatus = (
  ...dates: (string | null | undefined)[]
): ExpirationStatus => {
  const statuses = dates.map(getExpirationStatus);
  if (statuses.includes('expired')) return 'expired';
  if (statuses.includes('expiring')) return 'expiring';
  if (statuses.every(s => s === 'none')) return 'none';
  return 'ok';
};

export const expirationBadgeClass = (status: ExpirationStatus): string => {
  switch (status) {
    case 'expired':
      return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'expiring':
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300';
    default:
      return '';
  }
};

export const expirationLabel = (status: ExpirationStatus, kind: string): string => {
  if (status === 'expired') return `${kind} expired`;
  if (status === 'expiring') return `${kind} expiring soon`;
  return '';
};
