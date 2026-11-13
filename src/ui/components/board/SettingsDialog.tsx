// The Play board's settings dialog (gear on the full board's strip, "Settings" in the phone ☰ menu, and a button on
// the setup screen), in two groups. Game: paying costs, ending your turn, confirming before acting, the side panel
// (game log and coach notes), the bot's pace and the panels kept open for the session (board/prefs.ts). Look: a live mini-board showing the current
// choices, one-click presets (or Custom), colours, board and Gig area backgrounds, card backs, and the effects (glow,
// frames, numbers, motion). Every change applies at once (End of turn from the next game) and is saved in this browser
// (src/lib/boardSettings.ts, through src/ui/useBoardSettings.ts). The caller renders it at <body>.
import { useId } from 'react';
import {
  ACCENT_LABEL,
  ACCENTS,
  BOARD_BACKGROUNDS,
  BOARD_BG_LABEL,
  CARD_BACK_LABEL,
  CARD_BACKS,
  CONFIRM_ACTIONS_HELP,
  CONFIRM_ACTIONS_LABEL,
  END_TURN_HELP,
  END_TURN_LABEL,
  END_TURN_MODES,
  FRAME_LABEL,
  FRAMES,
  GIG_BACKGROUNDS,
  GIG_BG_LABEL,
  GLOW_LABEL,
  GLOWS,
  LOOK_PRESETS,
  matchingPreset,
  MOTION_HELP,
  MOTION_LABEL,
  MOTIONS,
  NUMERALS,
  NUMERALS_LABEL,
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
import { Die } from '../Dice';
import { Modal } from '../Modal';
import { CardBack } from '../TcgCard';
import { BOT_SPEEDS } from './prefs';
import { BoardFx } from './Zones';

export const END_TURN_NOTE = 'A change applies from your next game. In multi-day games against a person your turn always ends by itself.';
export const PAY_NOTE = 'Eddies are interchangeable in the current rules, so choosing changes nothing in the game unless a Legend could pay instead.';
export const GLOW_NOTE = 'Off keeps only the halo the action marks always had; their outline and icon say what a card can do at every level.';

/** Panels that stay open for the browser session (shown only during a game). */
export interface SessionPanels {
  logOpen: boolean;
  setLogOpen: (on: boolean) => void;
  allOpen: boolean;
  setAllOpen: (on: boolean) => void;
}

function Choice({ name, value, checked, onPick, disabled, children }: { name: string; value: string; checked: boolean; onPick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label className="pb-set-choice">
      <input type="radio" name={name} value={value} checked={checked} onChange={onPick} disabled={disabled} />
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

/**
 * A small board drawn with the real tokens and classes, so it shows the current accent, backgrounds, card back, glow,
 * frames, numbers and (with full motion) the active side's light. Decoration: hidden from screen readers.
 */
export function LookPreview({ settings }: { settings: BoardSettings }) {
  return (
    <div className="pb pb-set-preview" data-board-bg={settings.boardBg} data-gig-bg={settings.gigBg} aria-hidden="true">
      <BoardFx />
      <div className="pb-side pb-rival">
        <span className="pb-who">Rival</span>
        <CardBack size="xs" />
        <CardBack size="xs" />
        <div className="pb-gigs">
          <div className="pb-gigs-head">
            <b>1/7</b>
          </div>
          <div className="pb-dice">
            <Die sides={8} value={5} size={24} owner="rival" />
          </div>
        </div>
      </div>
      <div className="pb-prompt">Your move: a marked card can act</div>
      <div className="pb-side pb-me pb-active">
        <span className="pb-side-light" />
        <span className="pb-who">You</span>
        <div className="pb-slot pb-st-play">
          <div className="tcg tcg-xs Red pb-prev-face">
            <div className="tcg-inner" />
          </div>
          <span className="pb-st-badge">▶</span>
        </div>
        <div className="pb-slot pb-st-attack">
          <div className="tcg tcg-xs Blue pb-prev-face">
            <div className="tcg-inner" />
          </div>
          <span className="pb-st-badge">⚔</span>
        </div>
        <div className="pb-slot">
          <div className="tcg tcg-xs Green pb-prev-face">
            <div className="tcg-inner" />
          </div>
        </div>
        <CardBack size="xs" />
        <div className="pb-gigs">
          <div className="pb-gigs-head">
            <b>2/7</b> <span className="pb-cred">☆ 7</span>
          </div>
          <div className="pb-dice">
            <Die sides={6} value={4} size={24} owner="me" />
            <Die sides={4} value={3} size={24} owner="me" />
          </div>
        </div>
      </div>
    </div>
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
  /** absent in an online game (no bot): the Bot section is left out */
  setSpeed?: (ms: number) => void;
  /** during a game: the panels kept open for the session */
  panels?: SessionPanels;
  onClose: () => void;
}) {
  const id = useId();
  const name = useId();
  const p = settings.panel;
  const setPanel = (patch: BoardSettingsPatch['panel']) => onChange({ panel: patch });
  const preset = matchingPreset(settings);
  return (
    <Modal labelledBy={id} onClose={onClose} className="pb-settings">
      <h3 id={id}>Settings</h3>
      <p className="small muted pb-set-note">Changes apply at once and are saved in this browser.</p>

      <h4 className="pb-set-group">Game</h4>
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
        <legend>End of turn</legend>
        <div className="pb-set-choices" role="radiogroup" aria-label="End of turn">
          {END_TURN_MODES.map((m) => (
            <Choice key={m} name={`${name}-endturn`} value={m} checked={settings.endTurn === m} onPick={() => onChange({ endTurn: m })}>
              <b>{END_TURN_LABEL[m]}</b>
              <span className="small muted">{END_TURN_HELP[m]}</span>
            </Choice>
          ))}
        </div>
        <p className="small muted pb-set-note">{END_TURN_NOTE}</p>
      </fieldset>

      <fieldset>
        <legend>Confirming moves</legend>
        <Check label={CONFIRM_ACTIONS_LABEL} checked={settings.confirmActions} onChange={(on) => onChange({ confirmActions: on })} />
        <p className="small muted pb-set-note">{CONFIRM_ACTIONS_HELP}</p>
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

      {setSpeed && (
        <fieldset>
          <legend>Bot</legend>
          <Select<string> label="Bot speed" value={String(speed)} options={BOT_SPEEDS.map((x) => ({ value: String(x.ms), label: x.label }))} onChange={(v) => setSpeed(+v)} />
        </fieldset>
      )}

      <h4 className="pb-set-group">Look</h4>
      <LookPreview settings={settings} />

      <fieldset>
        <legend>Presets</legend>
        <div className="pb-set-choices is-grid is-thumbs" role="radiogroup" aria-label="Look presets">
          {LOOK_PRESETS.map((x) => (
            <Choice key={x.id} name={`${name}-preset`} value={x.id} checked={preset?.id === x.id} onPick={() => onChange({ ...x.look })}>
              <span className="pb-preset-thumb pb-accent-scope" data-accent={x.look.accent} data-board-bg={x.look.boardBg} data-card-back={x.look.cardBack} aria-hidden="true">
                <BoardFx />
                <span className="pb-preset-chip" />
                <CardBack size="xs" />
              </span>
              <b className="small">{x.label}</b>
              <span className="small muted">{x.blurb}</span>
            </Choice>
          ))}
          <Choice name={`${name}-preset`} value="custom" checked={!preset} disabled={!!preset} onPick={() => undefined}>
            <b className="small">Custom</b>
            <span className="small muted">Your own mix: change anything below and it shows here.</span>
          </Choice>
        </div>
        <p className="small muted pb-set-note">A preset sets the colours, both backgrounds, card backs, glow and frames together.</p>
      </fieldset>

      <fieldset>
        <legend>Colours</legend>
        <div className="pb-set-choices is-grid" role="radiogroup" aria-label="Accent colours">
          {ACCENTS.map((a) => (
            <Choice key={a} name={`${name}-accent`} value={a} checked={settings.accent === a} onPick={() => onChange({ accent: a })}>
              <span className="pb-accent-preview pb-accent-scope" data-accent={a} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="small">{ACCENT_LABEL[a]}</span>
            </Choice>
          ))}
        </div>
        <p className="small muted pb-set-note">The accent colours apply to the whole site, card backs included. Light or dark is the ☀/☾ button in the site menu.</p>
      </fieldset>

      <fieldset>
        <legend>Board background</legend>
        <div className="pb-set-choices is-grid" role="radiogroup" aria-label="Board background">
          {BOARD_BACKGROUNDS.map((b) => (
            <Choice key={b} name={`${name}-board`} value={b} checked={settings.boardBg === b} onPick={() => onChange({ boardBg: b })}>
              <span className="pb-bg-preview" data-board-bg={b} aria-hidden="true">
                <BoardFx />
              </span>
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
        <legend>Card backs</legend>
        <div className="pb-set-choices is-grid" role="radiogroup" aria-label="Card backs">
          {CARD_BACKS.map((b) => (
            <Choice key={b} name={`${name}-back`} value={b} checked={settings.cardBack === b} onPick={() => onChange({ cardBack: b })}>
              <span className="pb-back-thumb" data-card-back={b} aria-hidden="true">
                <CardBack size="xs" />
              </span>
              <span className="small">{CARD_BACK_LABEL[b]}</span>
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Effects</legend>
        <div className="pb-set-sub small muted">Glow</div>
        <div className="pb-set-choices is-grid" role="radiogroup" aria-label="Glow">
          {GLOWS.map((v) => (
            <Choice key={v} name={`${name}-glow`} value={v} checked={settings.glow === v} onPick={() => onChange({ glow: v })}>
              <span className="small">{GLOW_LABEL[v]}</span>
            </Choice>
          ))}
        </div>
        <p className="small muted pb-set-note">{GLOW_NOTE}</p>
        <div className="pb-set-sub small muted">Frames</div>
        <div className="pb-set-choices is-grid" role="radiogroup" aria-label="Frames">
          {FRAMES.map((v) => (
            <Choice key={v} name={`${name}-frame`} value={v} checked={settings.frame === v} onPick={() => onChange({ frame: v })}>
              <span className="small">{FRAME_LABEL[v]}</span>
            </Choice>
          ))}
        </div>
        <div className="pb-set-sub small muted">Numbers</div>
        <div className="pb-set-choices is-grid" role="radiogroup" aria-label="Numbers">
          {NUMERALS.map((v) => (
            <Choice key={v} name={`${name}-numerals`} value={v} checked={settings.numerals === v} onPick={() => onChange({ numerals: v })}>
              <span className="small">{NUMERALS_LABEL[v]}</span>
            </Choice>
          ))}
        </div>
        <div className="pb-set-sub small muted">Motion</div>
        <div className="pb-set-choices" role="radiogroup" aria-label="Motion">
          {MOTIONS.map((v) => (
            <Choice key={v} name={`${name}-motion`} value={v} checked={settings.motion === v} onPick={() => onChange({ motion: v })}>
              <b>{MOTION_LABEL[v]}</b>
              <span className="small muted">{MOTION_HELP[v]}</span>
            </Choice>
          ))}
        </div>
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
