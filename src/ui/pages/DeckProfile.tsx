// Deck profile: where a deck comes from (origin, lineage, idea) and every measured stat for it, plus the list shown visually.
import { useEffect, useMemo, useState } from 'react';
import '../deckprofile.css';
import seasonsData from '../../data/seasons.json';
import { CARD_BY_ID, cardLabel } from '../../engine/cards';
import { counts, deckColors } from '../../engine/deck';
import type { CardDef, DeckList } from '../../engine/types';
import { allDecks } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { bredInfo, deckStats, pct } from '../../lib/deckStats';
import { classify } from '../../ai/archetype';
import { findDeck } from '../components/DeckPicker';
import { ColorPips, LegendStrip, OriginBadge, originKind } from '../components/DeckIdentity';
import { ProvenanceBlock } from '../components/Provenance';
import { DeckInsights } from '../components/DeckInsights';
import { TcgCard } from '../components/TcgCard';
import { TypeLegend, TypeSplitBar } from '../components/TypeSplit';
import { MAIN_TYPES, typeSplit } from '../../lib/deckTypes';

// ---------- data helpers (moved to ../components/DeckStats; re-exported for older importers) ----------

import { ok, deckReports, profileHref, WrBar, StatTile, type MatchRec } from '../components/DeckStats';
export { ok, deckReports, profileHref, WrBar, StatTile, type MatchRec, type DeckReports } from '../components/DeckStats';

type SeasonsT = {
  leaderboard: { name: string; file: string; arch: string }[];
  seasons: { season: number; games: number; date: string; standings: { name: string; file: string; wr: number }[] }[];
};
const S = seasonsData as unknown as SeasonsT;

/** Library decks whose name appears in a free-text "parents" field (longest names first). */
function decksNamedIn(text: string | undefined, lib: LibraryDeck[], self?: string) {
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

function Section({ title, caption, children }: { title: string; caption?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel">
      <h3 className="dp-section-title">{title}</h3>
      {caption && <p className="dp-caption">{caption}</p>}
      {children}
    </div>
  );
}

// ---------- visual decklist ----------

const TYPES: CardDef['type'][] = MAIN_TYPES;

export function VisualDecklist({ deck, size = 'sm' }: { deck: DeckList; size?: 'sm' | 'md' }) {
  const main = counts(deck.main);
  const side = counts(deck.sideboard);
  const sorted = (m: Map<string, number>, t?: CardDef['type']) =>
    [...m.entries()]
      .filter(([id]) => CARD_BY_ID[id] && (!t || CARD_BY_ID[id].type === t))
      .sort((a, b) => (CARD_BY_ID[a[0]].cost ?? 0) - (CARD_BY_ID[b[0]].cost ?? 0) || cardLabel(CARD_BY_ID[a[0]]).localeCompare(cardLabel(CARD_BY_ID[b[0]])));
  return (
    <div>
      <div className="dp-cardgroup">
        <div className="zone-label">Legends</div>
        <div className="dp-cards">
          {deck.legends.filter((id) => CARD_BY_ID[id]).map((id) => (
            <TcgCard key={id} def={CARD_BY_ID[id]} size="md" />
          ))}
        </div>
      </div>
      {TYPES.map((t) => {
        const list = sorted(main, t);
        if (!list.length) return null;
        return (
          <div className="dp-cardgroup" key={t}>
            <div className="zone-label">
              {t}s ({list.reduce((a, [, n]) => a + n, 0)})
            </div>
            <div className="dp-cards">
              {list.map(([id, n]) => (
                <TcgCard key={id} def={CARD_BY_ID[id]} size={size} count={n} />
              ))}
            </div>
          </div>
        );
      })}
      {side.size > 0 && (
        <div className="dp-cardgroup">
          <div className="zone-label">Sideboard ({deck.sideboard.length})</div>
          <div className="dp-cards">
            {sorted(side).map(([id, n]) => (
              <TcgCard key={id} def={CARD_BY_ID[id]} size="sm" count={n} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CurveAndTypes({ deck }: { deck: DeckList }) {
  const ids = deck.main.filter((id) => CARD_BY_ID[id]);
  const curve: number[] = Array(9).fill(0);
  for (const id of ids) curve[Math.min(8, CARD_BY_ID[id].cost ?? 0)]++;
  const maxC = Math.max(1, ...curve);
  const split = typeSplit(ids);
  const n = Math.max(1, ids.length);
  const avg = ids.reduce((a, id) => a + (CARD_BY_ID[id].cost ?? 0), 0) / n;
  const sellable = ids.filter((id) => CARD_BY_ID[id].sellable).length;
  return (
    <div className="grid cols-2">
      <div>
        <div className="zone-label">Cost curve</div>
        <p className="dp-caption">Main-deck cards at each Eddie (€$) cost · average {avg.toFixed(2)}</p>
        <div className="dp-curve">
          {curve.map((c, i) => (
            <div key={i} title={`${c} cards at cost ${i}${i === 8 ? '+' : ''}`}>
              <span className="muted">{c || ''}</span>
              <div className="col" style={{ height: `${(80 * c) / maxC}%` }} />
              <span>
                {i}
                {i === 8 ? '+' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="zone-label">Card types</div>
        <p className="dp-caption">
          {ids.length} main-deck cards · {sellable} sellable for Eddies ({Math.round((100 * sellable) / n)}%)
        </p>
        <TypeSplitBar split={split} />
        <TypeLegend split={split} className="dp-type-legend" />
      </div>
    </div>
  );
}

// ---------- the page ----------

export function DeckProfilePage({ file }: { file?: string }) {
  const lib = useMemo(() => allDecks(), []);
  const d = findDeck(file);
  if (!d)
    return (
      <div className="panel">
        <h2>Deck not found</h2>
        <p className="muted">No deck in the library matches “{file ?? ''}”.</p>
        <a href="#/decks">Browse all decks →</a>
      </div>
    );
  return <Profile d={d} lib={lib} />;
}

function Profile({ d, lib }: { d: LibraryDeck; lib: LibraryDeck[] }) {
  const name = d.deck.name;
  const st = deckStats(d.file);
  const rep = deckReports(d.file);
  const bred = bredInfo(name);
  const kind = originKind(d.prov, d.kind);
  const arch = st.leader?.arch ?? classify(d.deck.main).arch;
  const slug = d.file.replace(/\.txt$/, '');
  const enc = encodeURIComponent(d.file);

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
  const finalsOverall = rep.finals?.overall ?? st.leader?.finals;
  const legendNames = d.deck.legends.map((id) => (CARD_BY_ID[id] ? cardLabel(CARD_BY_ID[id]) : id));

  return (
    <div className="grid">
      {/* ---- hero ---- */}
      <div className="dp-hero">
        <LegendStrip legends={d.deck.legends} height={240} />
        <div className="dp-hero-body">
          <div className="row">
            <OriginBadge deck={d} full />
            <ColorPips legends={d.deck.legends} />
            <span className="tag">{deckColors(d.deck)}</span>
            <span className="tag">{arch}</span>
            {d.tier && <span className={`tier tier-${d.tier}`}>{d.tier}</span>}
          </div>
          <h1 className="dp-title">{name}</h1>
          <div className="dp-legends">Legends: {legendNames.join(' · ')}</div>

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
          <div className="row dp-actions">
            <a href={`#/play?d=${enc}`}>
              <button className="primary">▶ Practice with it</button>
            </a>
            <a href={`#/play?o=${enc}`}>
              <button>⚔ Practice against it</button>
            </a>
            <a href="#/arena">
              <button>🧪 Test in Lab</button>
            </a>
            <a href={`#/decks?d=${enc}`}>
              <button>✎ Edit / Export</button>
            </a>
          </div>
        </div>
      </div>

      {/* ---- headline stats ---- */}
      {(st.leader || st.review || ok(finalsOverall)) && (
        <Section title="Headline stats" caption="Every number comes from bot-vs-bot simulation in this trainer. 50% is an even matchup.">
          <div className="dp-tiles">
            {ok(finalsOverall) && (
              <StatTile
                value={pct(finalsOverall)}
                label="Finals vs meta"
                caption={rep.finals ? `${rep.finals.games} deep-bot games vs the choom.gg meta archetypes, same seeds for every contender` : 'Large-sample run vs the meta archetypes'}
              />
            )}
            {st.leader && ok(st.leader.rating) && (
              <StatTile value={pct(st.leader.rating)} label="All-time rating" caption="Win rate vs the meta decks, shrunk toward 50% when the sample is small" />
            )}
            {st.leader && ok(st.leader.vsMeta) && <StatTile value={pct(st.leader.vsMeta)} label="Raw vs-meta win %" caption={`${st.leader.metaG} games vs the meta archetypes across all seasons`} />}
            {st.leader && (
              <StatTile
                value={`#${st.leader.rank}`}
                label={`of ${st.leader.of} on the leaderboard`}
                caption={ok(st.leader.percentile) ? `${st.leader.percentile}th percentile of every deck ever rated` : undefined}
              />
            )}
            {st.review && ok(st.review.winRate) && (
              <StatTile value={pct(st.review.winRate)} label="Grand-final round robin" caption={`Rank #${st.review.rank} of ${st.review.of} · ${st.review.games} games per pairing vs the strongest decks`} />
            )}
            {st.report && ok(st.report.wr) && (
              <StatTile value={pct(st.report.wrFirst)} label="On the play" caption={`vs ${pct(st.report.wrSecond)} on the draw (telemetry, ${st.report.games} games)`} />
            )}
          </div>
        </Section>
      )}

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
              The forge tries single-card swaps against the meta field, then re-tests the best one on fresh games and adopts it only if it still wins.{' '}
              {rep.forge.field && <span>Field: {rep.forge.field}.</span>}
            </>
          }
        >
          <div className="dp-forge">
            {rep.forge.gens.map((g) => (
              <div key={g.gen} className={`dp-forge-gen ${g.verdict}`}>
                <b>Generation {g.gen}</b> · baseline {ok(g.baseline) ? `${g.baseline.toFixed(1)}%` : '—'} ·{' '}
                <b className={g.verdict === 'adopted' ? 'dp-pos' : g.verdict === 'rejected' ? 'dp-neg' : ''}>
                  {g.verdict === 'adopted' ? 'swap adopted' : g.verdict === 'rejected' ? 'swap rejected on confirmation' : 'list kept (no swap beat it by 2+ pts)'}
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

      <Section title="Decklist" caption="Legends first, then each card type sorted by cost. Hover a card to zoom; ×N is the number of copies.">
        <CurveAndTypes deck={d.deck} />
        <VisualDecklist deck={d.deck} />
      </Section>

      {st.report && (
        <Section title="Telemetry insights" caption={`What the game logs say about how this deck wins: ${st.report.games} instrumented games against the field.`}>
          <DeckInsights r={st.report} />
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

      {!st.leader && !st.review && !st.report && !rep.finals && !rep.h2h && (
        <div className="panel muted small">
          No simulation data for this deck yet. Run it in the <a href="#/arena">Matchup Lab</a> to measure it in your browser.
        </div>
      )}
    </div>
  );
}
