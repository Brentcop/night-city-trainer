// One finding as a row (docs/EVIDENCE.md "The page"), two lines on a desktop and three or four on a phone:
//   1. the strength chip (and the nature chip where natures share the list), a short title, the number once (bold only
//      when strong or moderate and current; "reads … so far", muted, for "not enough games"), the range bar, Cite;
//   2. small and muted: the rest of its sentence (range, games, what the strength word needs said; restOf), the bot and
//      version once, and its flags in short words, then "Details".
// Details holds the sentence, the full claim, how it was measured, its family, flags in words, sources and a link to the
// row. A stale row is greyed.
import { useEffect, useState } from 'react';
import { citeLine, type Finding, type FindingRef } from '../../../lib/findings';
import { botVersionWords, FLAG_SHORT, FLAG_WORDS, familyPassWords, familyWords, METHOD_WORDS, rangeKindWords, restOf, sentenceOf, staleWords, valueOf } from '../../../lib/findingWords';
import { emphasised, familyNoun, findingHref, rowId } from '../../../lib/evidenceView';
import { CURRENT_SIM_VERSION } from '../../../lib/playedRecord';
import { CiteButton, NatureChip, RangeBar, StrengthChip } from './parts';

export type RowFinding = Finding | FindingRef;

export function FindingRow({
  f,
  listId,
  title,
  scale,
  nature,
  target,
  extra,
  details,
  detailsOpen,
  more,
}: {
  f: RowFinding;
  listId: string;
  title: React.ReactNode;
  scale: readonly [number, number];
  nature?: boolean;
  target?: boolean;
  extra?: React.ReactNode;
  details?: React.ReactNode;
  /** open the Details (a link points at a finding they hold) */
  detailsOpen?: boolean;
  /** more words for the second line (an association's two win rates, a change's verdict) */
  more?: string | null;
}) {
  const cur = CURRENT_SIM_VERSION;
  const stale = f.simVersion !== cur;
  const em = emphasised(f, cur);
  const whole = 'sources' in f ? f : null;
  const [open, setOpen] = useState(!!detailsOpen);
  useEffect(() => {
    if (detailsOpen) setOpen(true);
  }, [detailsOpen]);
  const id = rowId(f.short);
  const second = [restOf(f), more, botVersionWords(f), ...f.flags.map((c) => FLAG_SHORT[c])].filter(Boolean).join(' · ');
  const cls = ['ev-row', `ev-rs-${f.strength}`, stale ? 'is-stale' : '', target ? 'is-target' : ''].filter(Boolean).join(' ');
  return (
    <li id={id} className={cls} tabIndex={-1} data-short={f.short}>
      <div className="ev-line1">
        <StrengthChip s={f.strength} />
        {nature && <NatureChip n={f.nature} />}
        <span className="ev-row-title">{title}</span>
        <span className="ev-row-num">
          <span className={`ev-value${em ? ' is-em' : ''}`}>{em ? <strong>{valueOf(f)}</strong> : valueOf(f)}</span>
          <RangeBar x={f} kind={f.kind} strength={f.strength} scale={scale} stale={stale} />
          <CiteButton text={citeLine(f, f.claim)} />
        </span>
      </div>
      <p className="ev-line2">
        {second}{' '}
        <button type="button" className="ev-details-btn" aria-expanded={open} aria-controls={`${id}-d`} aria-label={`Details of F:${f.short}`} onClick={() => setOpen(!open)}>
          Details
        </button>
      </p>
      {extra}
      <div id={`${id}-d`} className="ev-details-body small" hidden={!open}>
        <p>{sentenceOf(f)}</p>
        {stale && <p className="ev-stale-note">{staleWords(f.simVersion, cur)}</p>}
        <p>
          <span className="muted">What was measured:</span> {f.claim}
        </p>
        <p>
          <span className="muted">How:</span> {METHOD_WORDS[f.method]}. {rangeKindWords(f)}
        </p>
        {whole && whole.family.size > 1 && (
          <p>
            <span className="muted">Family:</span> {familyWords(whole.family.size, familyNoun(whole.family.key))}; {familyPassWords(whole.corrected)}.
          </p>
        )}
        {f.flags.length > 0 && (
          <ul className="ev-flag-words">
            {f.flags.map((c) => (
              <li key={c}>{FLAG_WORDS[c]}</li>
            ))}
          </ul>
        )}
        {details}
        {whole && (
          <p className="muted ev-sources">
            Sources:{' '}
            {whole.sources.map((s, i) => (
              <span key={i}>
                {i > 0 && '; '}
                <code>{s.file}</code> <code>{s.path}</code>
              </span>
            ))}
          </p>
        )}
        <p className="muted">
          Id <code>F:{f.short}</code> ·{' '}
          <a className="ev-link" href={findingHref(listId, f.short)} aria-label={`Link to finding F:${f.short}`}>
            Link to this finding
          </a>
        </p>
      </div>
    </li>
  );
}
