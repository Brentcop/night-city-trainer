// The next event the trainer prepares for. The default for the site config's home.nextEvent (src/lib/siteConfig.ts;
// public/site-config.json is what the Home page shows, and tests/site-config.test.tsx keeps the two equal), and the one
// definition for the tournament plan's countdown, which scripts/plan.ts generates with the count frozen at generation
// time and the Strategy page recomputes when shown.
const START = '2026-12-11T09:00:00-06:00';
/** the last day (a date-only end lasts to the end of that day) */
const END = '2026-12-13';
export const EVENT = {
  name: 'Edgerunner Open Regional — Chicago',
  start: new Date(START),
  /** the start as written in the config */
  startText: START,
  /** the end as written in the config (home.nextEvent.end) */
  endText: END,
  /** the end of the last day, Chicago time */
  end: new Date('2026-12-14T00:00:00-06:00'),
  /** the line after the name on the Home page */
  detail: 'Dec 11–13 · Bo3 Swiss',
  url: 'https://cyberpunktcg.com/eor',
};

/** Whole days from `now` to the event's start (rounded, never negative). */
export function daysUntil(start: Date = EVENT.start, now: Date = new Date()): number {
  return Math.max(0, Math.round((start.getTime() - now.getTime()) / 86_400_000));
}

/**
 * The generated plan's "(N days to Chicago)" heading with N computed now instead of when plan.ts last ran; once the
 * event has started it reads "(the event is underway)", and once it has ended "(the event has finished)". Text without
 * that heading is returned unchanged.
 */
export function withLiveCountdown(md: string, now: Date = new Date(), start: Date = EVENT.start, end: Date | null = EVENT.end): string {
  return md.replace(/\((\d+) days? to Chicago\)/g, () => {
    if (end && now.getTime() >= end.getTime()) return '(the event has finished)';
    if (now.getTime() >= start.getTime()) return '(the event is underway)';
    const d = daysUntil(start, now);
    return `(${d} day${d === 1 ? '' : 's'} to Chicago)`;
  });
}
