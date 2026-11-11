// The next event the trainer prepares for. One definition for the Home page's countdown, the live day count in the
// tournament plan (which scripts/plan.ts generates with the count frozen at generation time) and plan.ts itself.
export const EVENT = {
  name: 'Edgerunner Open Regional — Chicago',
  start: new Date('2026-12-11T09:00:00-06:00'),
  url: 'https://cyberpunktcg.com/eor',
};

/** Whole days from `now` to the event's start (rounded, never negative). */
export function daysUntil(start: Date = EVENT.start, now: Date = new Date()): number {
  return Math.max(0, Math.round((start.getTime() - now.getTime()) / 86_400_000));
}

/**
 * The generated plan's "(N days to Chicago)" heading with N computed now instead of when plan.ts last ran; once the
 * event has started it reads "(the event is underway)". Text without that heading is returned unchanged.
 */
export function withLiveCountdown(md: string, now: Date = new Date(), start: Date = EVENT.start): string {
  return md.replace(/\((\d+) days? to Chicago\)/g, () => {
    if (now.getTime() >= start.getTime()) return '(the event is underway)';
    const d = daysUntil(start, now);
    return `(${d} day${d === 1 ? '' : 's'} to Chicago)`;
  });
}
