// When something was recorded, in the viewer's locale and time zone: "11 Nov 2026, 22:10" (or "11 Nov" compact), in a
// <time> element carrying the stored ISO value. A missing or unparseable date shows nothing (older or locally saved
// events may lack one). Tests pass `locale` / `timeZone` so they never depend on the machine running them.
import type { ReactNode } from 'react';

export interface RecordedFormat {
  /** BCP 47 locale; default: the viewer's */
  locale?: string;
  /** IANA time zone; default: the viewer's */
  timeZone?: string;
  /** day and month only */
  compact?: boolean;
}

/** The ISO timestamp formatted to the minute (or day and month when compact), or null when it is missing or invalid. */
export function formatRecorded(iso: string | null | undefined, { locale, timeZone, compact }: RecordedFormat = {}): string | null {
  if (typeof iso !== 'string' || !iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      ...(compact ? {} : { year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      timeZone,
    }).format(t);
  } catch {
    return null; // an unknown locale or time zone
  }
}

/**
 * `<time dateTime={iso} title={iso}>`, with `prefix` before it and `suffix` after it; renders nothing at all (no prefix
 * or suffix either) when the date is missing or invalid.
 */
export function RecordedAt({
  iso,
  prefix,
  suffix,
  className,
  ...fmt
}: { iso: string | null | undefined; prefix?: ReactNode; suffix?: ReactNode; className?: string } & RecordedFormat) {
  const text = formatRecorded(iso, fmt);
  if (text === null) return null;
  return (
    <>
      {prefix}
      <time dateTime={iso!} title={iso!} className={className}>
        {text}
      </time>
      {suffix}
    </>
  );
}
