// A collapsed "Run details" line under browser-run results: what the numbers were measured on (src/lib/runManifest.ts).
// `children` adds lines of its own (the tuned decks page puts the field, bot, rule and partner-aware flag there).
import { runDetailsLine, type RunManifest } from '../../lib/runManifest';

export function RunDetails({ m, children }: { m: RunManifest | null | undefined; children?: React.ReactNode }) {
  if (!m && !children) return null;
  return (
    <details className="small muted">
      <summary>Run details</summary>
      {children}
      {m && (
        <>
          <div>{runDetailsLine(m)}</div>
          <div title={m.decks.map((d) => `${d.id}  ${d.name}`).join('\n')}>
            run {m.runId} · field {m.field.mode} ({m.field.deckIds.length} deck{m.field.deckIds.length === 1 ? '' : 's'}) · seats {m.seatPolicy}
          </div>
        </>
      )}
    </details>
  );
}
