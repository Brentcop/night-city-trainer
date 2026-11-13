// #/admin: the owner's editor for the site config (public/site-config.json, src/lib/siteConfig.ts). It is not in the nav
// and is not a security boundary: anyone can open it, and all it does is build a file. The owner downloads the file,
// replaces public/site-config.json in the repository, commits and pushes to main. The draft is kept in this browser,
// and "Preview this draft" shows the whole site with it, in this browser only.
import { useEffect, useId, useMemo, useState } from 'react';
import {
  BANNER_LEVELS,
  bannerActive,
  defaultSiteConfig,
  FEATURE_INFO,
  FEATURES,
  HOME_SECTION_LABEL,
  issueLine,
  LIMITS,
  NAV_CATALOG,
  PAGE_LABEL,
  parseSiteConfig,
  parseSiteConfigText,
  SITE_CONFIG_FILE,
  siteConfigText,
  TIER_KEYS,
  TURN_TIMERS,
  MULTI_DAY_BOUNDS,
  visibleNav,
  type ConfigIssue,
  type SiteConfig,
} from '../../lib/siteConfig';
import {
  ACCENT_LABEL,
  ACCENTS,
  BOARD_BACKGROUNDS,
  BOARD_BG_LABEL,
  END_TURN_LABEL,
  END_TURN_MODES,
  GIG_BACKGROUNDS,
  GIG_BG_LABEL,
  PANEL_POSITIONS,
  PAY_MODE_LABEL,
  PAY_MODES,
  POSITION_LABEL,
} from '../../lib/boardSettings';
import { SORT_LABEL, SORTS } from '../../lib/galleryView';
import { SOURCES } from '../../lib/deckSource';
import { BUILTIN } from '../../lib/browserLibrary';
import { TOURNAMENT_INDEX } from '../../data/tournamentIndex';
import { download } from '../../lib/download';
import { DRAFT_KEY, previewDraft, useSiteConfigState } from '../useSiteConfig';
import { SiteBanner } from '../components/SiteChrome';
import { Modal } from '../components/Modal';
import { PageHead } from '../components/PageHead';

/** The STUN server list as lines of text (blank lines are left out of the config). */
function IceServers({ servers, onChange }: { servers: string[]; onChange: (list: string[]) => void }) {
  const id = useId();
  const [text, setText] = useState(servers.join('\n'));
  return (
    <div className="grid">
      <label htmlFor={id}>STUN servers</label>
      <textarea
        id={id}
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split(/\s+/)
              .filter(Boolean),
          );
        }}
      />
    </div>
  );
}

const TIER_LABEL: Record<(typeof TIER_KEYS)[number], string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** The draft saved in this browser, or null. */
function loadDraft(): SiteConfig | null {
  try {
    const t = localStorage.getItem(DRAFT_KEY);
    return t ? parseSiteConfigText(t).config : null;
  } catch {
    return null;
  }
}

/** Move item `i` of a list one place up (-1) or down (1); a new list. */
export function moveItem<T>(list: readonly T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[i], out[j]] = [out[j] as T, out[i] as T];
  return out;
}

/** The file the editor downloads and copies for a draft (the same text the parser reads back). */
export const draftFileText = (c: SiteConfig): string => siteConfigText(c);

/** The problems of a draft, as the site would read it. */
export function draftIssues(c: SiteConfig): { errors: ConfigIssue[]; warnings: ConfigIssue[] } {
  const p = parseSiteConfig(JSON.parse(siteConfigText(c)));
  return { errors: p.errors, warnings: p.warnings };
}

function Errs({ issues, path }: { issues: ConfigIssue[]; path: string }) {
  const mine = issues.filter((i) => i.path === path || i.path.startsWith(`${path}.`) || i.path.startsWith(`${path}[`));
  if (!mine.length) return null;
  return (
    <>
      {mine.map((i, k) => (
        <span key={k} className="admin-err" role="alert">
          {issueLine(i)}
        </span>
      ))}
    </>
  );
}

function Text({
  label,
  value,
  onChange,
  max,
  issues,
  path,
  hint,
  area,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  issues: ConfigIssue[];
  path: string;
  hint?: string;
  area?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="admin-field">
      <label htmlFor={id}>
        {label} <span className="small muted">({value.length}/{max})</span>
      </label>
      {area ? (
        <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint && <span className="small muted">{hint}</span>}
      <Errs issues={issues} path={path} />
    </div>
  );
}

function Check({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <label className="admin-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {help && <span className="small muted"> — {help}</span>}
      </span>
    </label>
  );
}

function Select<T extends string>({ label, value, options, labels, onChange }: { label: string; value: T; options: readonly T[]; labels?: Partial<Record<T, string>>; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}

function UpDown({ i, n, onMove, what }: { i: number; n: number; onMove: (dir: -1 | 1) => void; what: string }) {
  return (
    <>
      <button type="button" className="ghost small" disabled={i === 0} onClick={() => onMove(-1)} aria-label={`Move ${what} up`}>
        ↑
      </button>
      <button type="button" className="ghost small" disabled={i === n - 1} onClick={() => onMove(1)} aria-label={`Move ${what} down`}>
        ↓
      </button>
    </>
  );
}

function Confirm({ title, text, confirm, onConfirm, onCancel }: { title: string; text: string; confirm: string; onConfirm: () => void; onCancel: () => void }) {
  const id = useId();
  return (
    <Modal labelledBy={id} onClose={onCancel}>
      <h2 id={id}>{title}</h2>
      <p>{text}</p>
      <div className="row">
        <button type="button" className="primary" onClick={onConfirm}>
          {confirm}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/** `initial` starts from a given draft (tests); else the draft kept in this browser, else the published config. */
export function AdminPage({ initial }: { initial?: SiteConfig } = {}) {
  const { published, previewing } = useSiteConfigState();
  const [draft, setDraft] = useState<SiteConfig>(() => structuredClone(initial ?? loadDraft() ?? published));
  const [ask, setAsk] = useState<'load' | 'reset' | null>(null);
  const [status, setStatus] = useState('');
  const [copyText, setCopyText] = useState<string | null>(null);
  const [deckFilter, setDeckFilter] = useState('');
  const text = useMemo(() => draftFileText(draft), [draft]);
  const { errors, warnings } = useMemo(() => draftIssues(draft), [draft]);
  const issues = errors;
  const nav = useMemo(() => visibleNav(parseSiteConfig(JSON.parse(text)).config), [text]);

  // the draft is kept in this browser; while previewing, the preview follows every edit
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, text);
    } catch {
      /* storage blocked: the draft lasts while this page is open */
    }
    if (previewing) previewDraft(text);
  }, [text, previewing]);

  const up = (fn: (c: SiteConfig) => void) =>
    setDraft((c) => {
      const n = structuredClone(c);
      fn(n);
      return n;
    });
  const replace = (c: SiteConfig, what: string) => {
    setDraft(structuredClone(c));
    setStatus(what);
    setAsk(null);
  };
  const blocked = errors.length > 0;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied the JSON.');
    } catch {
      setCopyText(text); // no clipboard here: show the text to copy by hand
    }
  };
  const builtin = useMemo(() => BUILTIN.slice().sort((a, b) => a.file.localeCompare(b.file)), []);
  const unknownHidden = draft.decks.hidden.filter((f) => !builtin.some((d) => d.file === f));
  const now = Date.now();

  return (
    <div className="grid admin-page">
      <PageHead kicker="Owner" title="Site config editor">
        This page is not a security boundary: anyone can open it, and it only builds a file that changes nothing until you commit it. The site reads{' '}
        <code>public/{SITE_CONFIG_FILE}</code>; edit it here, then:
      </PageHead>
      <ol className="small">
        <li>Fix any problems listed below, then press Download {SITE_CONFIG_FILE} (or Copy JSON).</li>
        <li>
          Replace <code>public/{SITE_CONFIG_FILE}</code> in the repository with it, and run <code>npm run check:data</code> to check it.
        </li>
        <li>Commit and push to main. GitHub Pages deploys it; visitors get it on their next visit.</li>
      </ol>
      <p className="small muted">
        Every key, its default and what it does are in <code>docs/SITE_CONFIG.md</code>. Your draft is kept in this browser until you reset it.
      </p>

      <div className="row admin-toolbar">
        <button type="button" onClick={() => setAsk('load')}>
          Load current
        </button>
        <button type="button" onClick={() => setAsk('reset')}>
          Reset to defaults
        </button>
        <button type="button" className="primary" disabled={blocked} onClick={() => (download(SITE_CONFIG_FILE, text, 'application/json'), setStatus(`Downloaded ${SITE_CONFIG_FILE}.`))}>
          Download {SITE_CONFIG_FILE}
        </button>
        <button type="button" disabled={blocked} onClick={() => void copy()}>
          Copy JSON
        </button>
        {previewing ? (
          <button type="button" onClick={() => (previewDraft(null), setStatus('Preview ended: this browser shows the published config again.'))}>
            Exit preview
          </button>
        ) : (
          <button type="button" onClick={() => (previewDraft(text), setStatus('Previewing this draft in this browser only.'))}>
            Preview this draft in this browser only
          </button>
        )}
        <span className="small muted" role="status" aria-live="polite">
          {blocked ? `Fix ${errors.length} problem${errors.length === 1 ? '' : 's'} to download.` : status}
        </span>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="panel small" role="alert">
          <b>Problems</b>
          <ul>
            {errors.map((e, i) => (
              <li key={`e${i}`} className="admin-err">
                {issueLine(e)}
              </li>
            ))}
            {warnings.map((w, i) => (
              <li key={`w${i}`}>{issueLine(w)}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="panel" aria-label="Preview">
        <h2 style={{ marginTop: 0 }}>Preview</h2>
        <div className="small muted">Banner {draft.banner.text.trim() ? (bannerActive(draft.banner, now) ? '(showing now)' : '(not showing now: outside its dates)') : '(no text: hidden)'}</div>
        <SiteBanner key={text} banner={draft.banner} preview />
        <div className="small muted" style={{ marginTop: 8 }}>
          Nav
        </div>
        <div className="admin-nav-preview" aria-label="Nav preview">
          {nav.map((s) => (
            <span key={s.id}>
              <b>
                {s.icon} {s.label}
              </b>
              {s.subnav && <span className="admin-sub"> ({s.pages.map((p) => p.label).join(', ')})</span>}
            </span>
          ))}
        </div>
        {draft.maintenance.on && <p className="small admin-err">Maintenance mode is on: visitors see only the maintenance notice{draft.maintenance.allowPlay ? ' and Play' : ''}.</p>}
      </section>

      <fieldset>
        <legend>Site</legend>
        <Text label="Title" value={draft.site.title} onChange={(v) => up((c) => void (c.site.title = v))} max={LIMITS.title} issues={issues} path="site.title" hint="The header (in capitals) and the browser tab." />
        <Text label="Tagline" value={draft.site.tagline} onChange={(v) => up((c) => void (c.site.tagline = v))} max={LIMITS.tagline} issues={issues} path="site.tagline" hint="The page description search engines show." />
        <Text
          label="Footer"
          area
          value={draft.site.footer}
          onChange={(v) => up((c) => void (c.site.footer = v))}
          max={LIMITS.footer}
          issues={issues}
          path="site.footer"
          hint="Plain text. Write a link as [label](#/page) or [label](https://…)."
        />
      </fieldset>

      <fieldset>
        <legend>Navigation</legend>
        <p className="small muted">Tabs and their pages, in order. A hidden page's address shows “This page is turned off”. Home and Play cannot both be hidden.</p>
        <Errs issues={issues} path="nav" />
        {draft.nav.sections.map((s, i) => {
          const cat = NAV_CATALOG.find((x) => x.id === s.id);
          return (
            <div key={s.id}>
              <div className="admin-row">
                <b>{cat?.icon}</b>
                <input type="text" aria-label={`Label of the ${s.id} tab`} value={s.label} onChange={(e) => up((c) => void (c.nav.sections[i]!.label = e.target.value))} />
                <label>
                  <input type="checkbox" checked={!s.hidden} onChange={(e) => up((c) => void (c.nav.sections[i]!.hidden = !e.target.checked))} /> shown
                </label>
                <UpDown i={i} n={draft.nav.sections.length} what={`the ${s.id} tab`} onMove={(d) => up((c) => void (c.nav.sections = moveItem(c.nav.sections, i, d)))} />
              </div>
              <Errs issues={issues} path={`nav.sections[${i}]`} />
              {cat?.subnav && (
                <div className="admin-pages">
                  {s.pages.map((p, j) => (
                    <div className="admin-row" key={p.path}>
                      <code className="small">#/{p.path}</code>
                      <input type="text" aria-label={`Label of the page ${p.path}`} value={p.label} onChange={(e) => up((c) => void (c.nav.sections[i]!.pages[j]!.label = e.target.value))} placeholder={PAGE_LABEL[p.path]} />
                      <label>
                        <input type="checkbox" checked={!p.hidden} onChange={(e) => up((c) => void (c.nav.sections[i]!.pages[j]!.hidden = !e.target.checked))} /> shown
                      </label>
                      <UpDown i={j} n={s.pages.length} what={`the page ${p.path}`} onMove={(d) => up((c) => void (c.nav.sections[i]!.pages = moveItem(c.nav.sections[i]!.pages, j, d)))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      <fieldset>
        <legend>Features</legend>
        <p className="small muted">A feature that is off loses its buttons and links, and its pages show “This page is turned off”.</p>
        {FEATURES.map((f) => (
          <Check key={f} label={FEATURE_INFO[f].label} help={FEATURE_INFO[f].help} checked={draft.features[f]} onChange={(v) => up((c) => void (c.features[f] = v))} />
        ))}
      </fieldset>

      <fieldset>
        <legend>Announcement banner</legend>
        <Text label="Text" value={draft.banner.text} onChange={(v) => up((c) => void (c.banner.text = v))} max={LIMITS.bannerText} issues={issues} path="banner.text" hint="Empty: no banner." />
        <Text label="Link" value={draft.banner.link} onChange={(v) => up((c) => void (c.banner.link = v))} max={LIMITS.link} issues={issues} path="banner.link" placeholder="#/play or https://…" hint="Optional: a page of this site (#/…) or an https:// address." />
        <Text label="Link text" value={draft.banner.linkText} onChange={(v) => up((c) => void (c.banner.linkText = v))} max={LIMITS.linkText} issues={issues} path="banner.linkText" placeholder="Read more" />
        <Select label="Level" value={draft.banner.level} options={BANNER_LEVELS} labels={{ info: 'Information', warning: 'Warning' }} onChange={(v) => up((c) => void (c.banner.level = v))} />
        <Text label="Starts" value={draft.banner.start} onChange={(v) => up((c) => void (c.banner.start = v))} max={40} issues={issues} path="banner.start" placeholder="YYYY-MM-DD" hint="Optional. A date (from that day's start, the visitor's time) or an ISO date-time." />
        <Text label="Ends" value={draft.banner.end} onChange={(v) => up((c) => void (c.banner.end = v))} max={40} issues={issues} path="banner.end" placeholder="YYYY-MM-DD" hint="Optional. A date (to the end of that day) or an ISO date-time." />
        <Check label="Visitors can dismiss it" help="remembered per browser until the text changes" checked={draft.banner.dismissible} onChange={(v) => up((c) => void (c.banner.dismissible = v))} />
      </fieldset>

      <fieldset>
        <legend>Home page</legend>
        <p className="small muted">Sections, in order.</p>
        {draft.home.sections.map((s, i) => (
          <div className="admin-row" key={s.id}>
            <label>
              <input type="checkbox" checked={!s.hidden} onChange={(e) => up((c) => void (c.home.sections[i]!.hidden = !e.target.checked))} /> {HOME_SECTION_LABEL[s.id]}
            </label>
            <UpDown i={i} n={draft.home.sections.length} what={HOME_SECTION_LABEL[s.id]} onMove={(d) => up((c) => void (c.home.sections = moveItem(c.home.sections, i, d)))} />
          </div>
        ))}
        <Errs issues={issues} path="home.sections" />
        <Select
          label="Featured deck"
          value={draft.home.featuredDeck}
          options={['', ...(builtin.some((d) => d.file === draft.home.featuredDeck) || !draft.home.featuredDeck ? [] : [draft.home.featuredDeck]), ...builtin.map((d) => d.file)]}
          labels={Object.fromEntries([['', 'The recommended deck (generated)'], ...builtin.map((d) => [d.file, `${d.deck.name} (${d.file})`])])}
          onChange={(v) => up((c) => void (c.home.featuredDeck = v))}
        />
        <Errs issues={issues} path="home.featuredDeck" />
        <Select
          label="Featured event"
          value={draft.home.featuredEvent}
          options={['', ...TOURNAMENT_INDEX.events.map((e) => String(e.id))]}
          labels={Object.fromEntries([['', 'None'], ...TOURNAMENT_INDEX.events.map((e) => [String(e.id), `Event ${e.id} (${e.date.slice(0, 10)}${e.champion ? `, won by ${e.champion}` : ''})`])])}
          onChange={(v) => up((c) => void (c.home.featuredEvent = v))}
        />
        <Errs issues={issues} path="home.featuredEvent" />
        <Text label="Next event: name" value={draft.home.nextEvent.name} onChange={(v) => up((c) => void (c.home.nextEvent.name = v))} max={LIMITS.eventName} issues={issues} path="home.nextEvent.name" />
        <Text
          label="Next event: start"
          value={draft.home.nextEvent.start}
          onChange={(v) => up((c) => void (c.home.nextEvent.start = v))}
          max={40}
          issues={issues}
          path="home.nextEvent.start"
          hint="An ISO date-time with its time zone, e.g. 2026-12-11T09:00:00-06:00. The countdown runs to it."
        />
        <Text label="Next event: details" value={draft.home.nextEvent.detail} onChange={(v) => up((c) => void (c.home.nextEvent.detail = v))} max={LIMITS.eventDetail} issues={issues} path="home.nextEvent.detail" />
      </fieldset>

      <fieldset>
        <legend>Play</legend>
        <p className="small muted">Bot tiers offered in Play setup.</p>
        {TIER_KEYS.map((t) => (
          <Check
            key={t}
            label={TIER_LABEL[t]}
            checked={draft.play.tiers.includes(t)}
            onChange={(v) => up((c) => void (c.play.tiers = TIER_KEYS.filter((x) => (x === t ? v : c.play.tiers.includes(x)))))}
          />
        ))}
        <Errs issues={issues} path="play.tiers" />
        <Select label="Default bot tier" value={draft.play.defaultTier} options={TIER_KEYS} labels={TIER_LABEL} onChange={(v) => up((c) => void (c.play.defaultTier = v))} />
        <Errs issues={issues} path="play.defaultTier" />
        <p className="small muted">Board settings for visitors who have not saved their own (theirs always win).</p>
        <Select label="Accent colours" value={draft.play.board.accent} options={ACCENTS} labels={ACCENT_LABEL} onChange={(v) => up((c) => void (c.play.board.accent = v))} />
        <Select label="Board background" value={draft.play.board.boardBg} options={BOARD_BACKGROUNDS} labels={BOARD_BG_LABEL} onChange={(v) => up((c) => void (c.play.board.boardBg = v))} />
        <Select label="Gig area background" value={draft.play.board.gigBg} options={GIG_BACKGROUNDS} labels={GIG_BG_LABEL} onChange={(v) => up((c) => void (c.play.board.gigBg = v))} />
        <Select label="Paying costs" value={draft.play.board.payMode} options={PAY_MODES} labels={PAY_MODE_LABEL} onChange={(v) => up((c) => void (c.play.board.payMode = v))} />
        <Select label="End of turn" value={draft.play.board.endTurn} options={END_TURN_MODES} labels={END_TURN_LABEL} onChange={(v) => up((c) => void (c.play.board.endTurn = v))} />
        <Select label="Side panel position" value={draft.play.board.panelPosition} options={PANEL_POSITIONS} labels={POSITION_LABEL} onChange={(v) => up((c) => void (c.play.board.panelPosition = v))} />
      </fieldset>

      <fieldset>
        <legend>Online play</legend>
        <p className="small muted">
          Games against another person (the “Play online” feature). The STUN servers tell each browser its public network address so players on different networks can connect; connecting shares each
          player's address with the other player and with these servers. Leave the list empty for same-network play only. One address per line, such as stun:stun.l.google.com:19302.
        </p>
        <IceServers servers={draft.multiplayer.iceServers} onChange={(list) => up((c) => void (c.multiplayer.iceServers = list))} />
        <Errs issues={issues} path="multiplayer.iceServers" />
        <Select
          label="Turn timer a host starts with"
          value={String(draft.multiplayer.turnTimer)}
          options={TURN_TIMERS.map(String)}
          labels={Object.fromEntries(TURN_TIMERS.map((t) => [String(t), t ? `${t} seconds per decision` : 'Off']))}
          onChange={(v) => up((c) => void (c.multiplayer.turnTimer = Number(v) as SiteConfig['multiplayer']['turnTimer']))}
        />
        <Errs issues={issues} path="multiplayer.turnTimer" />
      </fieldset>

      <fieldset>
        <legend>Multi-day games</legend>
        <p className="small muted">
          Games played over days (the “Multi-day games” feature): against the bot, kept until finished; against a person, by turn packets. The lengths offered, in whole days, and how many ongoing games one
          browser keeps (bot and person together).
        </p>
        {(
          [
            ['minDays', 'Shortest game (days)', MULTI_DAY_BOUNDS.days],
            ['maxDays', 'Longest game (days)', MULTI_DAY_BOUNDS.days],
            ['defaultDays', 'Length picked at first (days)', MULTI_DAY_BOUNDS.days],
            ['maxOngoing', 'Ongoing games kept per browser', MULTI_DAY_BOUNDS.ongoing],
          ] as const
        ).map(([k, label, [lo, hi]]) => (
          <div key={k}>
            <Select
              label={label}
              value={String(draft.multiDay[k])}
              options={Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i))}
              onChange={(v) => up((c) => void (c.multiDay[k] = Number(v)))}
            />
            <Errs issues={issues} path={`multiDay.${k}`} />
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>Decks</legend>
        <p className="small muted">Deck sources the gallery shows.</p>
        {SOURCES.map((s) => (
          <Check
            key={s.key}
            label={s.label}
            checked={draft.decks.sources.includes(s.key)}
            onChange={(v) => up((c) => void (c.decks.sources = SOURCES.map((x) => x.key).filter((k) => (k === s.key ? v : c.decks.sources.includes(k)))))}
          />
        ))}
        <Errs issues={issues} path="decks.sources" />
        <Select label="Default gallery sort (first visit)" value={draft.decks.defaultSort} options={SORTS} labels={SORT_LABEL} onChange={(v) => up((c) => void (c.decks.defaultSort = v))} />
        <p className="small muted">
          Built-in decks hidden for everyone by default ({draft.decks.hidden.length}). A visitor can still unhide one for themselves with “Show hidden”, and a hidden deck stays reachable by link.
        </p>
        <input type="search" aria-label="Filter decks" placeholder="Filter decks…" value={deckFilter} onChange={(e) => setDeckFilter(e.target.value)} />
        <div className="admin-list">
          {unknownHidden.map((f) => (
            <Check key={f} label={`${f} (not in the library)`} checked onChange={() => up((c) => void (c.decks.hidden = c.decks.hidden.filter((x) => x !== f)))} />
          ))}
          {builtin
            .filter((d) => !deckFilter || `${d.file} ${d.deck.name}`.toLowerCase().includes(deckFilter.toLowerCase()))
            .map((d) => (
              <Check
                key={d.file}
                label={`${d.deck.name} (${d.file})`}
                checked={draft.decks.hidden.includes(d.file)}
                onChange={(v) => up((c) => void (c.decks.hidden = v ? [...c.decks.hidden, d.file].sort() : c.decks.hidden.filter((x) => x !== d.file)))}
              />
            ))}
        </div>
        <Errs issues={issues} path="decks.hidden" />
      </fieldset>

      <fieldset>
        <legend>Maintenance</legend>
        <Check label="Maintenance mode" help="every page shows only the message below (this editor stays open)" checked={draft.maintenance.on} onChange={(v) => up((c) => void (c.maintenance.on = v))} />
        <Text label="Message" area value={draft.maintenance.message} onChange={(v) => up((c) => void (c.maintenance.message = v))} max={LIMITS.maintenance} issues={issues} path="maintenance.message" />
        <Check label="Play against the bot stays open" checked={draft.maintenance.allowPlay} onChange={(v) => up((c) => void (c.maintenance.allowPlay = v))} />
      </fieldset>

      {ask === 'load' && (
        <Confirm
          title="Load the current config?"
          text="This replaces your draft with the config the site has published now."
          confirm="Load current"
          onConfirm={() => replace(published, 'Loaded the published config.')}
          onCancel={() => setAsk(null)}
        />
      )}
      {ask === 'reset' && (
        <Confirm
          title="Reset to defaults?"
          text="This replaces your draft with the built-in defaults (the site as it is with no changes)."
          confirm="Reset to defaults"
          onConfirm={() => replace(defaultSiteConfig(), 'Reset to the defaults.')}
          onCancel={() => setAsk(null)}
        />
      )}
      {copyText !== null && (
        <Modal label="Copy the JSON" onClose={() => setCopyText(null)}>
          <h2>Copy the JSON</h2>
          <p className="small">This browser would not copy it for you. Select the text and copy it.</p>
          <textarea readOnly rows={12} style={{ width: '100%' }} value={copyText} onFocus={(e) => e.currentTarget.select()} aria-label="Site config JSON" />
        </Modal>
      )}
    </div>
  );
}
