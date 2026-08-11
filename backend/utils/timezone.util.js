const { BUSINESS_TIMEZONE } = require('../constants/notification.constants');

// Returns the UTC instant corresponding to local midnight (00:00:00.000) of
// "today" in BUSINESS_TIMEZONE — correct regardless of what timezone the
// server process itself happens to be running in. This is the one and only
// place BUSINESS_TIMEZONE's fixed UTC+5:30 (Asia/Kolkata has no DST) is
// assumed; every reminder day-boundary calculation goes through this.
const getBusinessTodayStart = (referenceDate = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referenceDate);
  const y = Number(parts.find((p) => p.type === 'year').value);
  const m = Number(parts.find((p) => p.type === 'month').value);
  const d = Number(parts.find((p) => p.type === 'day').value);
  return new Date(Date.UTC(y, m - 1, d) - 5.5 * 60 * 60 * 1000);
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

module.exports = { getBusinessTodayStart, addDays };
