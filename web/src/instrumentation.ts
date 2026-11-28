// Runs once when the site's server starts. Starts the automatic reminders (lib/reminders.ts): a pass every
// 10 minutes; each pass does nothing until the owner switches reminders on in the admin panel.
// Off in development and tests (REMINDERS=off), so a local run never messages real customers.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production' || process.env.REMINDERS === 'off') return
  // a minute later: let the server (and its database migrations) finish starting first
  setTimeout(async () => {
    try { (await import('@/lib/reminders')).startReminderLoop() } catch (e) { console.warn('reminders: not started —', (e as Error).message) }
  }, 60_000).unref?.()
}
