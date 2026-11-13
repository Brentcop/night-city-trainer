// Deck profile: where a deck comes from (origin, lineage, idea), its game plan, every measured stat for it, and the list shown visually.
import { useId, useState } from 'react';
import '../deckprofile.css';
import { CARD_BY_ID, cardLabel } from '../../engine/cards';
import { deckColors } from '../../engine/deck';
import { allDecks } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { bredInfo, deckStats, pct, statsName } from '../../lib/deckStats';
import { SEASONS } from '../../data/index';
import { classify } from '../../ai/archetype';
import { findDeck } from '../components/DeckPicker';
import { ColorPips, LegendStrip, OriginBadge, originKind, TierPair } from '../components/DeckIdentity';
import { ProvenanceBlock } from '../components/Provenance';
import { DeckInsights } from '../components/DeckInsights';
import { ok, profileHref, WrBar } from '../components/DeckStats';
import { deckReports, type MatchRec } from '../../data/deckReportsData';
import { telemetryReport } from '../../data/analysisData';
import { CurveAndTypes } from '../components/DeckCurve';
import { DeckStructure } from '../components/DeckCards';
import { DeckRecordPanel } from '../components/DeckRecord';
import { GamePlanPanel } from '../components/GamePlan';
import { DeckSynergies } from '../components/DeckSynergies';
import { objectiveFor } from '../../content/deckObjectives';
import { useDeckActions } from '../components/DeckActions';
import { useLibraryVersion } from '../useLibrary';
import { isBuiltin } from '../deckLookup';
import { loadHidden } from '../../lib/hiddenDecks';
import { pageOn } from '../../lib/siteConfig';
import { useSiteConfig } from '../useSiteConfig';
import { IfPage } from '../components/SiteChrome';

const S = SEASONS;

/** Library decks whose name appears in a free-text "parents" field (longest names first). */
function decksNamedIn(text: string | undefined, lib: readonly LibraryDeck[], self?: string) {
  if (!text) return [];
  const out: LibraryDeck[] = [];
  let rest = text;
  for (const d of [...lib].sort((a, b) => b.deck.name.length - a.deck.name.length)) {
    if (d.file === self) continue;
    if (rest.includes(d.deck.name)) {
      out.push(d);
      rest = rest.split(d.deck.name).join('');
    }
  }
  return out;
}

const METHOD_TEXT: Record<string, string> = {
  mutant: 'a mutant — one Legend of its parent swapped out, the rest re-fitted to the new RAM limits',
  crossover: 'a crossover — two parent decks combined, keeping the best performers of each',
  counter: 'a counter — built from the decks with the best head-to-head records against the current top decks',
  explorer: 'an explorer — an untested Legend trio, filled with cards chosen from format-wide card impact (no parent deck)',
};

function DeckLink({ d }: { d: LibraryDeck }) {
  return (
    <a href={profileHref(d.file)} className="tag" style={{ textDecoration: 'none' }}>
      <ColorPips legends={d.deck.legends} /> {d.deck.name}
    </a>
  );
}

// ---------- small visual pieces ----------

const frac = (w: number, g: number) => (g > 0 ? `${Math.round((100 * w) / g)}%` : '—');

function OppName({ name, file }: { name: string; file?: string }) {
  return file ? <a href={profileHref(file)}>{name}</a> : <>{name}</>;
}

function MatchRows({ rows }: { rows: MatchRec[] }) {
  return (
    <div className="dp-bars">
      {[...rows]
        .sort((a, b) => b.w - a.w)
        .map((r) => (
          <div key={r.opp} className="dp-bar-row">
            <span className="dp-bar-name" title={r.opp}>
              <OppName name={r.opp} file={r.oppFile} />
            </span>
            <WrBar v={r.w} title={`${pct(r.w, 1)} over ${r.g} games`} />
            <span className="dp-bar-val">{pct(r.w)}</span>
            <span className="dp-bar-sub">
              <span className="seat-split">
                <span>{r.g} games</span>
                {r.fg > 0 && (
                  <span>
                    on the play {frac(r.fw, r.fg)} ({r.fw}/{r.fg})
                  </span>
                )}
                {r.sg > 0 && (
                  <span>
                    on the draw {frac(r.sw, r.sg)} ({r.sw}/{r.sg})
                  </span>
                )}
                {ok(r.turns) && <span>{r.turns.toFixed(1)} turns avg</span>}
              </span>
            </span>
          </div>
        ))}
    </div>
  );
}

function Section({ title, caption, flair, children }: { title: string; caption?: React.ReactNode; flair?: boolean; children: React.ReactNode }) {
  return (
    <div className={`panel ${flair ? 'flair' : ''}`}>
      <h3 className="dp-section-title rule-head">{title}</h3>
      {caption && <p className="dp-caption">{caption}</p>}
      {children}
    </div>
  );
}

// ---------- the page ----------

export function DeckProfilePage({ file }: { file?: string }) {
  // follows the library: a deck deleted here or in another tab shows the "deleted" state instead of stale numbers
  useLibraryVersion();
  const lib = allDecks();
  const [deletedHere, setDeletedHere] = useState(false);
  const actions = useDeckActions({ onDeleted: () => setDeletedHere(true), onRestored: () => setDeletedHere(false) });
  const d = findDeck(file);
  if (!d)
    return (
      <>
        <DeckMissing file={file} deletedHere={deletedHere} />
        {actions.ui}
      </>
    );
  return (
    <>
      <Profile d={d} lib={lib} actions={actions} />
      {actions.ui}
    </>
  );
}

/** A link to a deck that is not in the library: deleted from this browser, saved in another browser, or a bad link. */
export function DeckMissing({ file, deletedHere }: { file?: string; deletedHere?: boolean }) {
  const saved = (file ?? '').startsWith('custom:');
  const name = saved ? (file ?? '').slice('custom:'.length) : (file ?? '');
  return (
    <div className="empty-state" role={deletedHere ? 'status' : undefined}>
      <h2>{deletedHere ? 'This deck was deleted' : saved ? 'This deck is not saved in this browser' : 'Deck not found'}</h2>
      {deletedHere ? (
        <p>“{name}” was deleted from this browser. Use Undo below while it shows to bring it back.</p>
      ) : saved ? (
        <p>
          No deck named “{name}” is saved in this browser. It was deleted, or it was saved in another browser: decks you save (and tuned decks) live in the browser that saved them.
        </p>
      ) : (
        <p>No deck in the library matches “{file ?? ''}”.</p>
      )}
      <p className="row">
        <a href="#/decks">Browse all decks →</a>
        <IfPage path="tuned">
          <a href="#/tuned">Tuned decks →</a>
        </IfPage>
      </p>
    </div>
  );
}

function Profile({ d, lib, actions }: { d: LibraryDeck; lib: readonly LibraryDeck[]; actions: ReturnType<typeof useDeckActions> }) {
  const site = useSiteConfig();
  const name = d.deck.name;
  const st = deckStats(d.file);
  const telemetry = telemetryReport(statsName(d.file));
  const rep = deckReports(d.file);
  const bred = bredInfo(name);
  const kind = originKind(d.prov, d.kind);
  const arch = st.leader?.arch ?? classify(d.deck.main).arch;
  const slug = d.file.replace(/\.txt$/, '');
  const enc = encodeURIComponent(d.file);
  const recordId = useId();
  const saved = !isBuiltin(d);
  const hidden = !saved && loadHidden().has(d.file);

  // lineage
  const bredParents = (bred?.parents ?? []).map((p) => lib.find((x) => x.deck.name === p) ?? p);
  const eorSibling = /-eor$/.test(slug) ? lib.find((x) => x.file === `${slug.replace(/-eor$/, '')}.txt`) : lib.find((x) => x.file === `${slug}-eor.txt`);
  const provParents = decksNamedIn(d.prov.parents, lib, d.file).filter((p) => p.file !== eorSibling?.file);
  const children = lib.filter(
    (x) => x.file !== d.file && x.file !== eorSibling?.file && (decksNamedIn(x.prov.parents, lib, x.file).some((p) => p.file === d.file) || bredInfo(x.deck.name)?.parents.includes(name)),
  );
  // per-season round robins
  const seasonRows = S.seasons
    .map((s) => {
      const i = s.standings.findIndex((x) => x.name === name);
      return i < 0 ? null : { season: s.season, games: s.games, wr: s.standings[i].wr, rank: i + 1, of: s.standings.length };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const reviewRows = st.review
    ? Object.entries(st.review.matrix)
        .filter(([o, v]) => o !== name && ok(v))
        .map(([o, v]) => ({ opp: o, oppFile: lib.find((x) => x.deck.name === o)?.file, w: v }))
        .sort((a, b) => b.w - a.w)
    : [];
  const legendNames = d.deck.legends.map((id) => (CARD_BY_ID[id] ? cardLabel(CARD_BY_ID[id]) : id));
  const hasOrigin = !!bred || provParents.length > 0 || !!eorSibling || !!d.idea || Object.values(d.prov).some(Boolean);

  return (
    <div className="grid">
      {/* ---- hero: the name, then the recorded results, then what to do with the deck ---- */}
      <div className="dp-hero">
        <LegendStrip legends={d.deck.legends} height={240} />
        <div className="dp-hero-body">
          <div className="row">
            <OriginBadge deck={d} full />
            <ColorPips legends={d.deck.legends} />
            <span className="tag">{deckColors(d.deck)}</span>
            <span className="tag">{arch}</span>
            <TierPair d={d} />
            {hidden && <span className="tag" title="Hidden from the gallery and deck pickers in this browser">hidden in this browser</span>}
          </div>
          <h1 className="dp-title">{name}</h1>
          <DeckRecordPanel d={d} headingId={recordId} />
          <div className="dp-legends">Legends: {legendNames.join(' · ')}</div>
          <div className="row">
            <IfPage path="play">
            <a className="btn primary" href={`#/play?d=${enc}`}>
              ▶ Practice with it
            </a>
            <a className="btn" href={`#/play?o=${enc}`}>
              ⚔ Practice against it
            </a>
            </IfPage>
            <IfPage path="arena">
            <a className="btn" href={`#/arena?d=${enc}`}>
              🧪 Test in Matchup Lab
            </a>
            </IfPage>
            <IfPage path="lab">
            <a className="btn" href={`#/lab?d=${enc}`}>
              🔧 Tune in Deck Lab
            </a>
            </IfPage>
            <a className="btn" href={`#/decks?d=${enc}`}>
              ✎ Edit / Export
            </a>
            {d.tuned && pageOn(site, 'tuned') && (
              <a className="btn" href="#/tuned">
                🔧 Tuning result
              </a>
            )}
            {saved ? (
              <button className="danger-soft" onClick={() => actions.askDelete([d])} title="Saved in this browser: delete it from here">
                🗑 Delete
              </button>
            ) : (
              <button onClick={() => actions.hide([d.file], !hidden)} title="Built-in decks ship with the site and cannot be deleted; hiding takes it out of the gallery and pickers in this browser">
                {hidden ? '👁 Unhide' : 'Hide from gallery'}
              </button>
            )}
          </div>
        </div>
      </div>

      <GamePlanPanel d={d} lib={lib} />

      <DeckSynergies deck={d.deck} named={objectiveFor(d.file, d.deck)?.note.synergies} />

      {hasOrigin && (
        <div className="panel dp-origin">
          <h3 className="dp-section-title rule-head">Origin</h3>
          {bred && (
            <div className="dp-lineage">
              🧬 <b>Bred in Season {bred.season}</b> by the automated breeder
              {bredParents.length > 0 && (
                <>
                  {' '}
                  from{' '}
                  {bredParents.map((p, i) => (
                    <span key={typeof p === 'string' ? p : p.file}>
                      {i > 0 && ' × '}
                      {typeof p === 'string' ? <b>{p}</b> : <DeckLink d={p} />}
                    </span>
                  ))}
                </>
              )}{' '}
              as {METHOD_TEXT[bred.method] ?? `a ${bred.method}`}
              .{' '}
              {bred.standing > 0 && (
                <>
                  It finished <b>#{bred.standing} of {bred.of}</b> in its debut season’s round robin.{' '}
                </>
              )}
              <a href="#/seasons">How seasons work →</a>
            </div>
          )}
          {!bred && provParents.length > 0 && (
            <div className={`dp-lineage ${kind === 'nc-build' || kind === 'nc-variant' ? 'build' : ''}`}>
              {kind === 'nc-build' ? '🏆 Tournament build of ' : kind === 'nc-variant' ? '⟲ Optimizer variant of ' : 'Derived from '}
              <span className="dp-links" style={{ display: 'inline-flex' }}>
                {provParents.map((p) => (
                  <DeckLink key={p.file} d={p} />
                ))}
              </span>
            </div>
          )}
          {eorSibling && (
            <div className="dp-lineage build">
              {/-eor$/.test(slug) ? (
                <>
                  This is the ready-to-register tournament build. Stats for the base list: <DeckLink d={eorSibling} />
                </>
              ) : (
                <>
                  🏆 Ready-to-register tournament build (same list + data-chosen 7-card sideboard): <DeckLink d={eorSibling} />
                </>
              )}
            </div>
          )}
          {d.idea && <div>💡 {d.idea}</div>}
          <ProvenanceBlock prov={d.prov} />
        </div>
      )}

      <Section title="Decklist" flair caption="Legends, then Units, Gear and Programs by cost. ×N is the number of copies.">
        <CurveAndTypes deck={d.deck} />
        <DeckStructure deck={d.deck} />
      </Section>

      <div className="grid cols-2">
        {rep.finals && rep.finals.rows.length > 0 && (
          <Section
            title="Finals: matchup by matchup"
            caption={`Win rate vs each meta archetype over ${rep.finals.games} deep-bot games; each pairing is played half on the play and half on the draw. The tick marks 50%.`}
          >
            <MatchRows rows={rep.finals.rows} />
          </Section>
        )}
        {rep.h2h && rep.h2h.length > 0 && (
          <Section title="Head-to-heads" caption="Large dedicated runs (often 400 games) against a single opponent: tighter numbers than the round robins.">
            <MatchRows rows={rep.h2h} />
          </Section>
        )}
        {reviewRows.length > 0 && st.review && (
          <Section title={`Grand-final round robin · #${st.review.rank} of ${st.review.of}`} caption={`Every top deck played every other ${st.review.games} times (${st.review.date.slice(0, 10)}). Overall ${pct(st.review.winRate, 1)}.`}>
            <div className="dp-bars">
              {reviewRows.map((r) => (
                <div key={r.opp} className="dp-bar-row">
                  <span className="dp-bar-name" title={r.opp}>
                    <OppName name={r.opp} file={r.oppFile} />
                  </span>
                  <WrBar v={r.w} />
                  <span className="dp-bar-val">{pct(r.w)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
        {seasonRows.length > 0 && (
          <Section title="Season results" caption="Each season is a round robin of the current pool plus that season’s newly bred decks. Green = debut season.">
            <div className="dp-seasons">
              {seasonRows.map((s) => (
                <div key={s.season} className={`dp-season ${bred?.season === s.season ? 'debut' : ''}`}>
                  <div className="spread" style={{ padding: 0 }}>
                    <b>Season {s.season}</b>
                    <span className="muted small">
                      #{s.rank}/{s.of}
                    </span>
                  </div>
                  <div className="dp-tile-val" style={{ fontSize: '1.4rem' }}>
                    {pct(s.wr)}
                  </div>
                  <WrBar v={s.wr} />
                  <div className="dp-tile-cap">{s.games} games per pairing</div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {rep.forge && (rep.forge.gens.length > 0 || rep.forge.summary.length > 0) && (
        <Section
          title="Forge history"
          caption={
            <>
              The forge screens single-card swaps against the meta field, then re-tests the best on fresh games paired with the list. Since 2026-11-11 it adopts a swap only
              when the held-out gain is clearly above 1 point; before that, any gain on the fresh games was adopted.{' '}
              {rep.forge.field && <span>Field: {rep.forge.field}.</span>}
            </>
          }
        >
          <div className="dp-forge">
            {rep.forge.gens.map((g) => (
              <div key={g.gen} className={`dp-forge-gen ${g.verdict}`}>
                <b>Generation {g.gen}</b> · baseline {ok(g.baseline) ? `${g.baseline.toFixed(1)}%` : '—'} ·{' '}
                <b className={g.verdict === 'adopted' ? 'dp-pos' : g.verdict === 'rejected' ? 'dp-neg' : ''}>
                  {g.verdict === 'adopted'
                    ? 'swap adopted'
                    : g.verdict === 'rejected'
                      ? 'swap rejected on confirmation'
                      : g.verdict === 'inconclusive'
                        ? 'could not tell on confirmation (list kept)'
                        : 'list kept (no swap beat it by 2+ pts)'}
                </b>
                {g.confirm && <div className="muted small">Confirmation {g.confirm}</div>}
                {g.swaps.length > 0 && (
                  <ul className="small">
                    {g.swaps.slice(0, 3).map((s) => (
                      <li key={s.swap}>
                        {s.swap} — {s.wr.toFixed(1)}% <span className={s.delta >= 0 ? 'dp-pos' : 'dp-neg'}>({s.delta >= 0 ? '+' : ''}{s.delta.toFixed(1)})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {rep.forge.gens.length === 0 &&
              rep.forge.summary.map((s) => (
                <div key={s.gen} className="dp-forge-gen">
                  <b>Generation {s.gen}</b> · {ok(s.wr) ? `${s.wr.toFixed(1)}%` : '—'} · {s.change}
                </div>
              ))}
          </div>
        </Section>
      )}

      {rep.optimize && rep.optimize.length > 0 && (
        <Section title="Optimizer suggestions" caption="Single-card and Legend changes tested on the same seeds as the stock list. Δ is in win-% points; ±3 is within noise.">
          <div className="grid cols-2">
            {rep.optimize.map((o) => (
              <div key={o.vs}>
                <div className="zone-label">
                  vs {o.vs} · baseline {ok(o.baseline) ? `${o.baseline.toFixed(1)}%` : '—'}
                </div>
                <table className="small">
                  <tbody>
                    {o.rows.slice(0, 5).map((r) => (
                      <tr key={r.change}>
                        <td>{r.change}</td>
                        <td className={r.delta >= 0 ? 'dp-pos' : 'dp-neg'} style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {r.delta >= 0 ? '+' : ''}
                          {r.delta.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Section>
      )}

      {telemetry && (
        <Section title="Telemetry insights" caption={`What the game logs say about how this deck wins: ${telemetry.games} instrumented games against the field.`}>
          <DeckInsights r={telemetry} />
        </Section>
      )}

      {children.length > 0 && (
        <Section title="Descendants" caption="Decks bred from, built on, or tuned from this list.">
          <div className="dp-links">
            {children.map((c) => (
              <DeckLink key={c.file} d={c} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
