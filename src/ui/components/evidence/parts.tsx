// Small pieces of the evidence page (src/ui/pages/Evidence.tsx): the strength and nature chips, flag chips, the range
// bar, a change written with its cards, the cite control and the one polite live region it speaks through. The words
// are src/lib/findingWords.ts; the chips are text, and the bar is a picture of the sentence beside it with its own label.
import { createContext, useContext, useState } from 'react';
import { formatValue, STRENGTHS, unitOf, type ChangeSubject, type FindingKind, type FlagCode, type Nature, type Strength } from '../../../lib/findings';
import { FLAG_SHORT, FLAG_WORDS, NATURE_WORDS, STRENGTH_WORDS } from '../../../lib/findingWords';
import { changeParts, nameOf, placeOf } from '../../../lib/evidenceView';
import { CardMention } from '../CardMention';

/** The strength chip: the word, with a three-step meter drawn beside it (decoration only: the word is the chip). */
export function StrengthChip({ s }: { s: Strength }) {
  const filled = s === 'strong' ? 3 : s === 'moderate' ? 2 : s === 'weak' ? 1 : 0;
  return (
    <span className={`ev-chip ev-s-${s}`}>
      {s === 'no-difference' ? (
        <span className="ev-eq" aria-hidden="true">
          =
        </span>
      ) : (
        <span className="ev-meter" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i < filled ? 'on' : ''} />
          ))}
        </span>
      )}
      {STRENGTH_WORDS[s]}
    </span>
  );
}

export function NatureChip({ n }: { n: Nature }) {
  return <span className={`ev-chip ev-n-${n}`}>{NATURE_WORDS[n]}</span>;
}

/** A finding's flags as short chips; the full words are the title (and the row's Details). */
export function FlagChips({ flags, simVersion }: { flags: readonly FlagCode[]; simVersion: number }) {
  return (
    <>
      {flags.map((c) => (
        <span key={c} className={`ev-chip ev-flag ev-flag-${c}`} title={FLAG_WORDS[c]}>
          {c === 'stale' ? `version ${simVersion}` : FLAG_SHORT[c]}
        </span>
      ))}
    </>
  );
}

/** Counts by strength word as chips (nothing for a word with none). */
export function CountChips({ counts }: { counts: Readonly<Record<Strength, number>> }) {
  return (
    <span className="ev-counts">
      {STRENGTHS.filter((s) => counts[s] > 0).map((s) => (
        <span key={s} className={`ev-chip ev-s-${s} ev-count`}>
          <b>{counts[s]}</b> {STRENGTH_WORDS[s]}
        </span>
      ))}
    </span>
  );
}

/** The key: the five strength words and the three natures, as the chips the page uses. */
export function ChipKey({ natureHelp }: { natureHelp: Readonly<Record<Nature, string>> }) {
  return (
    <div className="ev-key">
      <p className="ev-key-row">
        <span className="small muted">How strong:</span>
        {(['strong', 'moderate', 'weak', 'no-difference', 'not-enough'] as const).map((s) => (
          <StrengthChip key={s} s={s} />
        ))}
      </p>
      <ul className="ev-key-natures">
        {(['result', 'effect', 'association'] as const).map((n) => (
          <li key={n}>
            <NatureChip n={n} /> <span className="small">{natureHelp[n]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarInput {
  estimate: number;
  lower: number;
  upper: number;
  baseline: number;
}

/**
 * The range bar: the interval as a band, the estimate as a mark, and "no difference" as a tick, on the list's shared
 * scale. Labelled with the same numbers as the sentence; the strength is the chip's, drawn here only as the band's fill.
 */
export function RangeBar({ x, kind, strength, scale, stale }: { x: BarInput; kind: FindingKind; strength?: Strength; scale: readonly [number, number]; stale?: boolean }) {
  const u = unitOf(kind);
  const v = (n: number) => formatValue(n, u);
  const lo = placeOf(x.lower, scale);
  const hi = placeOf(x.upper, scale);
  const label = `Estimate ${v(x.estimate)}, range ${v(x.lower)} to ${v(x.upper)}; no difference at ${v(x.baseline)}`;
  return (
    <span className={`ev-bar ev-bs-${strength ?? 'plain'}${stale ? ' is-stale' : ''}`} role="img" aria-label={label} title={label}>
      <span className="ev-bar-track" />
      <span className="ev-bar-ci" style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 0.6)}%` }} />
      <span className="ev-bar-base" style={{ left: `${placeOf(x.baseline, scale)}%` }} />
      <span className="ev-bar-est" style={{ left: `${placeOf(x.estimate, scale)}%` }} />
    </span>
  );
}

/** A change written with its cards as mentions: "−1 Card → +1 Card" (Legends marked). */
export function ChangeLabel({ change, names }: { change: Pick<ChangeSubject, 'cuts' | 'adds' | 'legendCuts' | 'legendAdds' | 'label'>; names: ReadonlyMap<string, string> }) {
  const { cuts, adds } = changeParts(change);
  if (!cuts.length && !adds.length) return <>{change.label}</>;
  const side = (parts: typeof cuts, sign: string) =>
    parts.map((p, i) => (
      <span key={`${p.id}:${i}`} className="ev-part">
        {i > 0 && ', '}
        {sign}
        {p.n} <CardMention id={p.id}>{nameOf(p.id, names)}</CardMention>
        {p.legend && <span className="small muted"> (Legend)</span>}
      </span>
    ));
  return (
    <span className="ev-change-label">
      {side(cuts, '−')}
      {cuts.length > 0 && adds.length > 0 && ' → '}
      {side(adds, '+')}
    </span>
  );
}

// ---------------------------------------------------------------- cite, and one polite live region

const Announce = createContext<(msg: string) => void>(() => {});
export const AnnounceProvider = Announce.Provider;

/** The page's live region: what the last cite did, read out politely. */
export function useAnnouncer(): [string, (msg: string) => void] {
  const [msg, setMsg] = useState('');
  // a repeated message is read again: clear it first, then set it
  const say = (m: string) => {
    setMsg('');
    setTimeout(() => setMsg(m), 30);
  };
  return [msg, say];
}

export interface ClipboardEnv {
  clipboard?: { writeText(text: string): Promise<void> } | undefined;
  doc?: Pick<Document, 'createElement' | 'execCommand'> & { body: Pick<HTMLElement, 'appendChild' | 'removeChild'> };
}

/** Copy text: the clipboard API, else a selected hidden text area and the copy command. False when neither worked. */
export async function copyText(text: string, env: ClipboardEnv = { clipboard: typeof navigator !== 'undefined' ? navigator.clipboard : undefined, doc: typeof document !== 'undefined' ? document : undefined }): Promise<boolean> {
  try {
    if (env.clipboard?.writeText) {
      await env.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refused: try the older way */
  }
  const d = env.doc;
  if (!d) return false;
  try {
    const ta = d.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    d.body.appendChild(ta);
    ta.select();
    const ok = d.execCommand('copy');
    d.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** "Cite": copies the cite line (kept in `data-cite`, so what is copied is exactly what the row carries). */
export function CiteButton({ text }: { text: string }) {
  const say = useContext(Announce);
  const [shown, setShown] = useState<'idle' | 'copied' | 'select'>('idle');
  return (
    <span className="ev-cite-wrap">
      <button
        type="button"
        className="ghost small ev-cite"
        aria-label={`Cite ${/^\[(F:[0-9a-f]{8})\]/.exec(text)?.[1] ?? 'this finding'}: copy its cite line`}
        data-cite={text}
        onClick={async (e) => {
          const line = e.currentTarget.dataset.cite ?? text;
          const ok = await copyText(line);
          setShown(ok ? 'copied' : 'select');
          say(ok ? 'Copied the cite line.' : 'The cite line could not be copied: select it in the box shown and copy it.');
          if (ok) setTimeout(() => setShown('idle'), 2000);
        }}
      >
        {shown === 'copied' ? 'Copied' : 'Cite'}
      </button>
      {shown === 'select' && (
        <input
          className="ev-cite-text small"
          readOnly
          value={text}
          aria-label="Cite line"
          ref={(el) => {
            el?.focus();
            el?.select();
          }}
        />
      )}
    </span>
  );
}

/** Move to a finding's row: scroll it into view and focus it (smoothly only with full motion). False when it is not on the page. */
export function revealRow(doc: Pick<Document, 'getElementById' | 'documentElement'>, id: string): boolean {
  const el = doc.getElementById(id);
  if (!el) return false;
  const smooth = doc.documentElement?.getAttribute?.('data-motion') === 'full';
  el.scrollIntoView?.({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
  el.focus?.({ preventScroll: true });
  return true;
}
