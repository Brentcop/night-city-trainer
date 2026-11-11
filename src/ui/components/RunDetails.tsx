// A collapsed "Run details" line under browser-run results: what the numbers were measured on (src/lib/runManifest.ts).
import { runDetailsLine, type RunManifest } from '../../lib/runManifest';

export function RunDetails({ m }: { m: RunManifest | null | undefined }) {
  if (!m) return null;
  return (
    <details className="small muted">
      <summary>Run details</summary>
      <div>{runDetailsLine(m)}</div>
      <div title={m.decks.map((d) => `${d.id}  ${d.name}`).join('\n')}>
        run {m.runId} · field {m.field.mode} ({m.field.deckIds.length} deck{m.field.deckIds.length === 1 ? '' : 's'}) · seats {m.seatPolicy}
      </div>
    </details>
  );
}
