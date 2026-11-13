// Saved practice games in the UI (src/lib/savedGames.ts): the "Resume game" line beside Start, the list of named saves
// (resume, rename, export, delete, import), the in-game Save dialog, and the dialogs for a save that can't be resumed.
// Every dialog is a Modal (useFocusTrap: focus in, Tab kept inside, Escape closes, focus restored).
import { useId, useRef, useState } from 'react';
import { tierLabel } from '../../ai/tiers';
import { MAX_SLOTS, versionProblem, type SavedGame } from '../../lib/savedGames';
import { Modal } from './Modal';
import { formatRecorded } from './RecordedAt';

/** "A vs B · Hard · turn 7 · Gigs 3–2 · saved 12 Nov 2026, 10:00" */
export function saveSummary(s: SavedGame): string {
  const when = formatRecorded(s.saved);
  return [`${s.decks[0].name} vs ${s.decks[1].name}`, tierLabel(s.botLevel), `turn ${s.turn}`, `Gigs ${s.gigs[0]}–${s.gigs[1]}`, when ? `saved ${when}` : null].filter(Boolean).join(' · ');
}

/** A short "are you sure?" dialog. */
export function ConfirmDialog({
  title,
  text,
  confirm,
  danger,
  onConfirm,
  onCancel,
  extra,
  className,
}: {
  title: string;
  text: React.ReactNode;
  confirm: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** another choice between confirm and cancel */
  extra?: { label: string; onClick: () => void };
  className?: string;
}) {
  const id = useId();
  return (
    <Modal labelledBy={id} onClose={onCancel} className={['confirm-dialog', className].filter(Boolean).join(' ')}>
      <h3 id={id} style={{ marginTop: 0 }}>
        {title}
      </h3>
      <div className="muted">{text}</div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className={danger ? 'pb-danger' : 'primary'} onClick={onConfirm} data-autofocus>
          {confirm}
        </button>
        {extra && <button onClick={extra.onClick}>{extra.label}</button>}
        <button onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  );
}

/** A save that this version can't resume: why, its log to read, and Delete. */
export function UnresumableDialog({ save, why, onDelete, onClose }: { save: SavedGame; why: string; onDelete?: () => void; onClose: () => void }) {
  const id = useId();
  const [showLog, setShowLog] = useState(false);
  return (
    <Modal labelledBy={id} onClose={onClose} className="save-problem">
      <h3 id={id} style={{ marginTop: 0 }}>
        This game can't be resumed
      </h3>
      <p className="small muted">{saveSummary(save)}</p>
      <p>{why}</p>
      <p className="small muted">Resuming it would play a different game, so it is not resumed. You can still read what happened.</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="primary" onClick={() => setShowLog(!showLog)} aria-expanded={showLog}>
          {showLog ? 'Hide the log' : 'Open the game log'}
        </button>
        {onDelete && (
          <button className="pb-danger" onClick={onDelete}>
            Delete this save
          </button>
        )}
        <button onClick={onClose}>Close</button>
      </div>
      {showLog && (
        <ol className="save-log small" aria-label="Game log">
          {save.log.map((e, i) => (
            <li key={i} className={e.player === 0 ? 'me' : e.player === 1 ? 'rival' : ''}>
              <span className="muted">T{e.turn}</span> {e.player === 0 ? 'You: ' : e.player === 1 ? 'Bot: ' : ''}
              {e.text}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

export interface SavesProps {
  /** false: this browser blocks storage, so saving is off (the panel says so) */
  storage: boolean;
  autosave: SavedGame | null;
  slots: SavedGame[];
  /** a restore is running */
  restoring: boolean;
  onResume: (s: SavedGame) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExport: (s: SavedGame) => void;
  /** import a file's text; returns the reason when it is refused */
  onImport: (text: string) => string | null;
}

/** The autosave, beside Start game: "Resume game" and what it is. */
export function ResumeButton({ saves }: { saves: SavesProps }) {
  const a = saves.autosave;
  if (!saves.storage || !a) return null;
  return (
    <button className="primary save-resume" onClick={() => saves.onResume(a)} disabled={saves.restoring} title={saveSummary(a)}>
      {saves.restoring ? 'Restoring…' : 'Resume game'}
    </button>
  );
}

/** One line under the setup buttons naming the autosave. */
export function ResumeNote({ saves }: { saves: SavesProps }) {
  const a = saves.autosave;
  if (!saves.storage || !a) return null;
  const old = versionProblem(a);
  return (
    <p className="small muted save-resume-note">
      Unfinished game: {saveSummary(a)}
      {old ? ' (made with another version: it can be read, not resumed)' : ''}
    </p>
  );
}

/** The named saves: resume, rename, export or delete each; import a file. */
export function SavedGamesPanel({ saves }: { saves: SavesProps }) {
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<SavedGame | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  if (!saves.storage) {
    return <p className="small muted">This browser blocks site storage, so games can't be saved or resumed here.</p>;
  }
  const readFile = (f: File | undefined) => {
    if (!f) return;
    void f.text().then(
      (t) => setImportMsg(saves.onImport(t) ?? `Imported "${f.name}".`),
      () => setImportMsg('That file could not be read.'),
    );
  };
  return (
    <div className="panel saved-games">
      <div className="spread">
        <h3 style={{ margin: 0 }}>
          Saved games <span className="muted small">({saves.slots.length} of {MAX_SLOTS})</span>
        </h3>
        <button className="ghost" onClick={() => file.current?.click()} disabled={saves.restoring}>
          ⤒ Import a save
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
      {importMsg && (
        <p className="small" role="status">
          {importMsg}
        </p>
      )}
      {!saves.slots.length ? (
        <p className="small muted">No saved games yet. During a game, use Save game in the game menu to keep it here.</p>
      ) : (
        <ul className="save-list">
          {saves.slots.map((s) => (
            <li key={s.id} className="save-row">
              {renaming?.id === s.id ? (
                <form
                  className="row save-rename"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saves.onRename(s.id, renaming.name);
                    setRenaming(null);
                  }}
                >
                  <input aria-label="Name" value={renaming.name} maxLength={80} onChange={(e) => setRenaming({ id: s.id, name: e.target.value })} autoFocus />
                  <button type="submit" className="primary">
                    Save name
                  </button>
                  <button type="button" onClick={() => setRenaming(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="save-name">
                  <b>{s.name}</b>
                  <div className="small muted">
                    {saveSummary(s)}
                    {versionProblem(s) ? ' · made with another version: it can be read, not resumed' : ''}
                  </div>
                </div>
              )}
              <div className="row save-actions">
                <button className="primary" onClick={() => saves.onResume(s)} disabled={saves.restoring}>
                  Resume
                </button>
                <button onClick={() => setRenaming({ id: s.id, name: s.name })} disabled={saves.restoring}>
                  Rename
                </button>
                <button onClick={() => saves.onExport(s)} title="Save it as a file">
                  ⤓ Export
                </button>
                <button className="pb-danger" onClick={() => setDeleting(s)} disabled={saves.restoring}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this saved game?"
          text={
            <>
              <p style={{ margin: 0 }}>
                <b>{deleting.name}</b>
              </p>
              <p>{saveSummary(deleting)}. This can't be undone (export it first to keep a copy).</p>
            </>
          }
          confirm="Delete"
          danger
          onConfirm={() => {
            saves.onDelete(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/**
 * The in-game Save dialog: a name (default: decks and turn) and Save. With every slot in use it lists them oldest first,
 * each with Delete (confirmed), and saves once one is free: a save is never overwritten.
 */
export function SaveGameDialog({
  defaultName,
  slots,
  onSave,
  onDelete,
  onClose,
}: {
  defaultName: string;
  slots: SavedGame[];
  /** returns the reason when the save was refused */
  onSave: (name: string) => string | null;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SavedGame | null>(null);
  const full = slots.length >= MAX_SLOTS;
  return (
    <>
      <Modal labelledBy={id} onClose={onClose} className="pb-leave pb-save">
        <h3 id={id} style={{ marginTop: 0 }}>
          Save this game
        </h3>
        <p className="small muted">Saved in this browser, to resume from the Play setup screen. The game in progress is also saved automatically.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (full) return;
            const why = onSave(name);
            if (why) setError(why);
          }}
        >
          <label className="pb-save-name">
            <span className="small muted">Name</span>
            <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} data-autofocus />
          </label>
          {full && (
            <div className="pb-save-full">
              <p className="small">All {MAX_SLOTS} save slots are in use. Delete one to save this game (oldest first):</p>
              <ul className="save-list">
                {slots.map((s) => (
                  <li key={s.id} className="save-row">
                    <div className="save-name">
                      <b>{s.name}</b>
                      <div className="small muted">{saveSummary(s)}</div>
                    </div>
                    <button type="button" className="pb-danger" onClick={() => setDeleting(s)}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p className="small" role="alert" style={{ color: 'var(--red)' }}>
              {error}
            </p>
          )}
          <div className="row pb-leave-actions">
            <button type="submit" className="primary" disabled={full}>
              Save
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
      {deleting && (
        <ConfirmDialog
          className="pb-leave"
          title="Delete this saved game?"
          text={
            <p>
              <b>{deleting.name}</b> ({saveSummary(deleting)}). This can't be undone.
            </p>
          }
          confirm="Delete"
          danger
          onConfirm={() => {
            onDelete(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
