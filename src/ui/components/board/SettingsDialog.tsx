// The Play board's settings dialog (gear on the full board's strip, "Settings" in the phone ☰ menu, and a button on
// the setup screen): paying costs, the side panel (game log and coach notes), colours and backgrounds, plus the bot's
// pace and the panels kept open for the session (board/prefs.ts). Every change applies at once and is saved in this
// browser (src/lib/boardSettings.ts, through src/ui/useBoardSettings.ts). The caller renders it at <body>.
import { useId } from 'react';
import {
  ACCENT_LABEL,
  ACCENTS,
  BOARD_BACKGROUNDS,
  BOARD_BG_LABEL,
  GIG_BACKGROUNDS,
  GIG_BG_LABEL,
  PANEL_POSITIONS,
  PAY_MODE_HELP,
  PAY_MODE_LABEL,
  PAY_MODES,
  POSITION_LABEL,
  type BoardSettings,
  type BoardSettingsPatch,
  type PanelDensity,
  type PanelOrder,
  type PanelPosition,
  type TextSize,
} from '../../../lib/boardSettings';
import { Modal } from '../Modal';
import { BOT_SPEEDS } from './prefs';

export const PAY_NOTE = 'Eddies are interchangeable in the current rules, so choosing changes nothing in the game unless a Legend could pay instead.';

/** Panels that stay open for the browser session (shown only during a game). */
export interface SessionPanels {
  logOpen: boolean;
  setLogOpen: (on: boolean) => void;
  allOpen: boolean;
  setAllOpen: (on: boolean) => void;
}

function Choice({ name, value, checked, onPick, children }: { name: string; value: string; checked: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <label className="pb-set-choice">
      <input type="radio" name={name} value={value} checked={checked} onChange={onPick} />
      <span>{children}</span>
    </label>
  );
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="pb-set-row">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="pb-set-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SettingsDialog({
  settings,
  onChange,
  onReset,
  speed,
  setSpeed,
  panels,
  onClose,
}: {
  settings: BoardSettings;
  onChange: (patch: BoardSettingsPatch) => void;
  /** back to the defaults (the bot's pace included) */
  onReset: () => void;
  speed: number;
  setSpeed: (ms: number) => void;
  /** during a game: the panels kept open for the session */
  panels?: SessionPanels;
  onClose: () => void;
}) {
  const id = useId();
  const name = useId();
  const p = settings.panel;
  const setPanel = (patch: BoardSettingsPatch['panel']) => onChange({ panel: patch });
  return (
    <Modal labelledBy={id} onClose={onClose} className="pb-settings">
      <h3 id={id}>Settings</h3>
      <p className="small muted pb-set-note">Changes apply at once and are saved in this browser.</p>

      <fieldset>
        <legend>Paying costs</legend>
        <div className="pb-set-choices" role="radiogroup" aria-label="Paying costs">
          {PAY_MODES.map((m) => (
            <Choice key={m} name={`${name}-pay`} value={m} checked={settings.payMode === m} onPick={() => onChange({ payMode: m })}>
              <b>{PAY_MODE_LABEL[m]}</b>
              <span className="small muted">{PAY_MODE_HELP[m]}</span>
            </Choice>
          ))}
        </div>
        <p className="small muted pb-set-note">{PAY_NOTE}</p>
      </fieldset>

      <fieldset>
        <legend>Side panel (game log and coach)</legend>
        <Select<PanelPosition> label="Position" value={p.position} options={PANEL_POSITIONS.map((v) => ({ value: v, label: POSITION_LABEL[v] }))} onChange={(v) => setPanel({ position: v })} />
        <p className="small muted pb-set-note">Phones always show it as a sheet from the bottom; Hidden hides it there too.</p>
        <Select<PanelDensity>
          label="Lines"
          value={p.density}
          options={[
            { value: 'detailed', label: 'Detailed' },
            { value: 'compact', label: 'Compact (one line each)' },
          ]}
          onChange={(v) => setPanel({ density: v })}
        />
        <Select<TextSize>
          label="Text size"
          value={p.textSize}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
          onChange={(v) => setPanel({ textSize: v })}
        />
        <Select<PanelOrder>
          label="Newest line"
          value={p.order}
          options={[
            { value: 'newest-last', label: 'Last (at the bottom)' },
            { value: 'newest-first', label: 'First (at the top)' },
          ]}
          onChange={(v) => setPanel({ order: v })}
        />
        <Check label="Turn markers (turn lines, and the turn on each line when detailed)" checked={p.turnMarkers} onChange={(on) => setPanel({ turnMarkers: on })} />
        <Check label="Open it when the rival's turn starts" checked={p.autoOpenRivalTurn} onChange={(on) => setPanel({ autoOpenRivalTurn: on })} />
        {panels && (
          <>
            <Check label="Game log open now" checked={panels.logOpen} onChange={panels.setLogOpen} />
            <Check label='"All actions" list open now' checked={panels.allOpen} onChange={panels.setAllOpen} />
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>Colours</legend>
        <div className="pb-set-choices is-grid" role="radiogroup" aria-label="Accent colours">
          {ACCENTS.map((a) => (
            <Choice key={a} name={`${name}-accent`} value={a} checked={settings.accent === a} onPick={() => onChange({ accent: a })}>
              <span className="pb-accent-preview" data-accent={a} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="small">{ACCENT_LABEL[a]}</span>
            </Choice>
          ))}
        </div>
        <p className="small muted pb-set-note">The accent colours apply to the whole site. Light or dark is the ☀/☾ button in the site menu.</p>
      </fieldset>

      <fieldset>
        <legend>Board background</legend>
        <div className="pb-set-choices is-grid" role="radiogroup" aria-label="Board background">
          {BOARD_BACKGROUNDS.map((b) => (
            <Choice key={b} name={`${name}-board`} value={b} checked={settings.boardBg === b} onPick={() => onChange({ boardBg: b })}>
              <span className="pb-bg-preview" data-board-bg={b} aria-hidden="true" />
              <span className="small">{BOARD_BG_LABEL[b]}</span>
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Gig area background</legend>
        <div className="pb-set-choices is-grid" role="radiogroup" aria-label="Gig area background">
          {GIG_BACKGROUNDS.map((b) => (
            <Choice key={b} name={`${name}-gig`} value={b} checked={settings.gigBg === b} onPick={() => onChange({ gigBg: b })}>
              <span className="pb-gig-preview" data-gig-bg={b} aria-hidden="true" />
              <span className="small">{GIG_BG_LABEL[b]}</span>
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Bot</legend>
        <Select<string> label="Bot speed" value={String(speed)} options={BOT_SPEEDS.map((x) => ({ value: String(x.ms), label: x.label }))} onChange={(v) => setSpeed(+v)} />
      </fieldset>

      <div className="pb-settings-actions">
        <button type="button" onClick={onReset}>
          Reset to defaults
        </button>
        <button type="button" className="primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
