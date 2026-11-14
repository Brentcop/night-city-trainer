// "▶ Run this event again" in a recorded event's header (#/tournaments): opens the runner (#/run) with the event's own
// setup link, and says in one line whether the run plays the same games as the record. Nothing when the event cannot be
// opened as a setup link (src/ui/eventRerun.ts), or when the owner has turned the runner page off.
import { useMemo } from 'react';
import type { LibraryDeck } from '../../lib/library';
import { CURRENT_SIM_VERSION } from '../../lib/playedRecord';
import { TOURNEY_BOTS } from '../../ai/tiers';
import { eventRerun, rerunNote, type RecordedEvent } from '../eventRerun';
import { IfPage } from './SiteChrome';

const BOT_KEYS = TOURNEY_BOTS.map((b) => b.key);

export function RerunEvent({ event, lib }: { event: RecordedEvent; lib: readonly LibraryDeck[] }) {
  const r = useMemo(() => eventRerun(event, lib, { bots: BOT_KEYS, simVersion: CURRENT_SIM_VERSION }), [event, lib]);
  if (!r.open) return null;
  return (
    <IfPage path="run">
      <div className="row" style={{ margin: '10px 0' }}>
        <a className="btn" href={`#/run?${r.query}`}>
          ▶ Run this event again
        </a>
        <span className="small muted">{rerunNote(r, CURRENT_SIM_VERSION)}</span>
      </div>
    </IfPage>
  );
}
