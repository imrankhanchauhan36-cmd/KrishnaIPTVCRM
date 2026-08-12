export const formatDate = (value: string | undefined | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Days remaining until the customer's actual paid-for service boundary
// (renewalDate). Never negative in the UI — an already-elapsed renewalDate
// just means 0 days remaining, the Status badge (Expired) carries the rest
// of that meaning.
export const daysRemaining = (renewalDate: string | undefined | null): number => {
  if (!renewalDate) return 0;
  const target = new Date(renewalDate);
  if (Number.isNaN(target.getTime())) return 0;
  const diffMs = target.setHours(23, 59, 59, 999) - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};
