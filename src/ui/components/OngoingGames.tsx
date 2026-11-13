// The Ongoing games panel on the Play setup screen (features.multiDayGames): every multi-day game kept in this browser,
// against the bot (src/lib/multiDay.ts) or a person (src/net/corr.ts), your move first. Each row says the decks, the
// opponent, the turn and Gig score, whose move it is, when it was last played and the time left; it opens the game,
// exports it as a file (to carry it to another device) or deletes it (confirmed). An expired bot game offers "Finish it
// anyway" (recorded as finished late) or "Close as a timed-out loss". Import reads a file back. Dialogs are Modals.
import { useRef, useState } from 'react';
import { timeLeftText, type OngoingItem } from '../../lib/multiDay';
import { formatRecorded } from './RecordedAt';
import { ConfirmDialog } from './SavedGames';

export interface OngoingProps {
  items: readonly OngoingItem[];
  now: number;
  /** false: this browser blocks storage, so multi-day games are off here (the panel says so) */
  storage: boolean;
  cap: number;
  busy?: boolean;
  onOpen: (it: OngoingItem) => void;
  onFinishLate: (it: OngoingItem) => void;
  onCloseTimedOut: (it: OngoingItem) => void;
  onExport: (it: OngoingItem) => void;
  onDelete: (it: OngoingItem) => void;
  /** import a file's text; the reason when it is refused */
  onImport: (text: string) => Promise<string | null> | string | null;
}

/** The two-sentence truth about these games. */
export const MULTI_DAY_NOTE =
  'There is no server behind this site, so a game cannot wait online for an absent player: a game against the bot is kept in this browser, and a game against a person moves by the turn packets you send each other. Real play-whenever matches with enforced clocks would need a server this site does not have; here each device keeps its own clock.';

export function OngoingGames(p: OngoingProps) {
  const [deleting, setDeleting] = useState<OngoingItem | null>(null);
  const [closing, setClosing] = useState<OngoingItem | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  if (!p.storage) return <p className="small muted">This browser blocks site storage, so multi-day games can't be kept here.</p>;
  const open = p.items.filter((x) => !x.over).length;
  const readFile = (f: File | undefined) => {
    if (!f) return;
    void f
      .text()
      .then((t) => p.onImport(t))
      .then(
        (why) => setMsg(why ?? `Imported "${f.name}".`),
        () => setMsg('That file could not be read.'),
      );
  };
  return (
    <section className="panel ongoing" aria-labelledby="ongoing-h">
      <div className="spread">
        <h3 id="ongoing-h" style={{ margin: 0 }}>
          Ongoing games{' '}
          <span className="muted small">
            ({open} of {p.cap})
          </span>
        </h3>
        <button className="ghost" onClick={() => file.current?.click()} disabled={p.busy}>
          ⤒ Import a game
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            readFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {msg && (
        <p className="small" role="status">
          {msg}
        </p>
      )}
      {!p.items.length ? (
        <p className="small muted">No multi-day games yet. Tick "Multi-day game" above to start one against the bot, or play a person over days.</p>
      ) : (
        <ul className="save-list ongoing-list">
          {p.items.map((it) => {
            const left = timeLeftText(it, p.now);
            const last = formatRecorded(new Date(it.lastPlayed).toISOString());
            return (
              <li key={it.key} className={`save-row ongoing-row ${it.yourMove ? 'is-mine' : ''} ${it.expired ? 'is-late' : ''}`}>
                <div className="save-name">
                  <b>{it.title}</b> <span className="small muted">{it.against}</span>
                  <div className="small">
                    <span className={it.yourMove ? 'ongoing-mine' : 'muted'}>{it.status}</span>
                    {left && <span className={it.expired ? 'ongoing-late' : 'muted'}> · {left}</span>}
                  </div>
                  <div className="small muted">
                    {it.turn ? `Turn ${it.turn} · Gigs ${it.gigs[0]}–${it.gigs[1]}` : 'Not started'}
                    {last ? ` · last played ${last}` : ''}
                  </div>
                </div>
                <div className="row save-actions">
                  {it.type === 'bot' && it.expired && !it.stale ? (
                    <>
                      <button className="primary" onClick={() => p.onFinishLate(it)} disabled={p.busy}>
                        Finish it anyway
                      </button>
                      <button onClick={() => setClosing(it)} disabled={p.busy}>
                        Close as a timed-out loss
                      </button>
                    </>
                  ) : (
                    <button className={it.yourMove ? 'primary' : ''} onClick={() => p.onOpen(it)} disabled={p.busy || (it.type === 'bot' && !!it.stale)}>
                      {it.type === 'bot' ? 'Resume' : 'Open'}
                    </button>
                  )}
                  <button onClick={() => p.onExport(it)} title="Save it as a file (to carry it to another device)">
                    ⤓ Export
                  </button>
                  <button className="pb-danger" onClick={() => setDeleting(it)} disabled={p.busy}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>
        {MULTI_DAY_NOTE}
      </p>
      {deleting && (
        <ConfirmDialog
          title="Delete this game?"
          text={
            <p>
              <b>{deleting.title}</b> ({deleting.against}). It is removed from this browser and nothing is recorded.
              {deleting.type === 'pvp' ? ' Your rival keeps their copy.' : ''} This can't be undone (export it first to keep a copy).
            </p>
          }
          confirm="Delete"
          danger
          onConfirm={() => {
            p.onDelete(deleting);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
      {closing && (
        <ConfirmDialog
          title="Close as a timed-out loss?"
          text={
            <p>
              <b>{closing.title}</b> ran past its deadline. It is recorded now as a loss on time, and its replay stops where you left it.
            </p>
          }
          confirm="Record the loss"
          danger
          onConfirm={() => {
            p.onCloseTimedOut(closing);
            setClosing(null);
          }}
          onCancel={() => setClosing(null)}
        />
      )}
    </section>
  );
}
