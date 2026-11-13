// Choosing what pays a cost (board settings "Choose before playing" / "Choose after playing"; logic in
// src/lib/eddiePayment.ts): the "Pay with" row of toggles, and the prompt that asks for the sources of one cost.
import { useId, useRef } from 'react';
import { useFocusTrap } from '../Modal';
import { payStatus, readyEddies, selectionCount, tapEddie, toggleLegend, EMPTY_SELECTION, type PaySelection, type PaySource } from '../../../lib/eddiePayment';

export const INTERCHANGEABLE_NOTE = 'Eddies are interchangeable in the current rules: the game spends your first ready ones.';

/**
 * A toggle per source: one per ready Eddie (selected Eddies are your first ones) and one per Legend that could pay.
 * `need`: the cost being paid, for "Selected 2 of 3"; without it the row just counts.
 */
export function PaySelector({ sources, sel, onChange, need, idPrefix }: { sources: readonly PaySource[]; sel: PaySelection; onChange: (s: PaySelection) => void; need?: number; idPrefix?: string }) {
  const ready = readyEddies(sources);
  const legends = sources.filter((s) => s.kind === 'legend');
  const n = selectionCount(sel);
  const status = need !== undefined ? payStatus(sel, need) : null;
  const statusId = `${idPrefix ?? 'pb-paysel'}-status`;
  return (
    <div className="pb-paysel" role="group" aria-label="Pay with" aria-describedby={statusId}>
      <div className="pb-paysel-head">
        <span className="pb-label">Pay with</span>
        <span id={statusId} className={`small pb-paysel-status ${status && !status.exact ? 'is-short' : ''}`} aria-live="polite">
          {status ? status.text : `${n} selected`}
        </span>
        {n > 0 && (
          <button type="button" className="ghost pb-paysel-clear" onClick={() => onChange(EMPTY_SELECTION)}>
            Clear
          </button>
        )}
      </div>
      <div className="pb-paysel-chips">
        {Array.from({ length: ready }, (_, j) => (
          <button key={`e${j}`} type="button" className="pb-pay-chip is-eddie" aria-pressed={j < sel.eddies} aria-label={`Eddie ${j + 1} of ${ready}`} onClick={() => onChange(tapEddie(sel, j, ready))}>
            €$
          </button>
        ))}
        {legends.map((s) => (
          <button key={s.uid} type="button" className="pb-pay-chip is-legend" aria-pressed={sel.legends.includes(s.uid)} onClick={() => onChange(toggleLegend(sel, s.uid))}>
            {s.label}
          </button>
        ))}
        {!sources.length && <span className="small muted">Nothing ready to pay with.</span>}
      </div>
    </div>
  );
}

/**
 * The prompt for one cost: pick exactly `amount` sources, then Confirm (the action goes ahead with them) or Cancel (the
 * action is not taken). `side`: phones, a small panel against the right edge like the drop confirmation.
 */
export function PayPrompt({
  title,
  amount,
  sources,
  sel,
  onChange,
  onConfirm,
  onCancel,
  side,
}: {
  title: string;
  amount: number;
  sources: readonly PaySource[];
  sel: PaySelection;
  onChange: (s: PaySelection) => void;
  onConfirm: () => void;
  onCancel: () => void;
  side?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, onCancel, { initial: 'first' });
  const exact = payStatus(sel, amount).exact;
  const onlyEddies = sources.every((s) => s.kind === 'eddie');
  return (
    <div className={`pb-modal-wrap ${side ? 'pb-confirm-side' : ''}`} onClick={onCancel}>
      <div ref={ref} className="pb-modal pb-confirm pb-payprompt" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div id={id} className="pb-confirm-title">
          {title}
        </div>
        <PaySelector sources={sources} sel={sel} onChange={onChange} need={amount} idPrefix={`${id}-sel`} />
        {onlyEddies && <p className="small muted pb-paynote">{INTERCHANGEABLE_NOTE}</p>}
        <div className="pb-confirm-actions">
          <button type="button" className="primary pb-big" onClick={onConfirm} disabled={!exact}>
            Confirm
          </button>
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
