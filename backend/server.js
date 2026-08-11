require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db.config');
const { runReminderSweep } = require('./jobs/renewalCheck.job');

const PORT = process.env.PORT || 5000;

// The reminder sweep is deliberately NOT run on boot and NOT scheduled by
// default — every server start/restart must produce zero automatic
// notification activity against real data. It only becomes periodic when an
// operator explicitly opts in via REMINDER_SCHEDULER_ENABLED=true in the
// environment, and even then the first execution waits for the first
// interval tick rather than firing immediately on boot. The engine remains
// fully available on demand either way, via the admin-only
// POST /api/notifications/admin/run-reminder-sweep endpoint. No queue/cron
// dependency exists in this project, so a plain, opt-in interval is the
// minimal fit — idempotency comes from the Notification collection's unique
// index, not from this interval's timing or presence.
const REMINDER_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });

  if (process.env.REMINDER_SCHEDULER_ENABLED === 'true') {
    console.log(`[ReminderJob] Periodic sweep enabled — first run in ${REMINDER_SWEEP_INTERVAL_MS / 1000}s, then every ${REMINDER_SWEEP_INTERVAL_MS / 1000}s.`);
    setInterval(() => {
      runReminderSweep().catch((error) => console.error('[ReminderJob] Sweep failed:', error.message));
    }, REMINDER_SWEEP_INTERVAL_MS);
  } else {
    console.log('[ReminderJob] Periodic sweep disabled (REMINDER_SCHEDULER_ENABLED is not "true"). Trigger it explicitly via POST /api/notifications/admin/run-reminder-sweep.');
  }
});
