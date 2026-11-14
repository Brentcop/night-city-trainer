// Visual deck identity: origin badge, Legend art strip, colour pips, and a gallery tile.
import { CARD_BY_ID } from '../../engine/cards';
import { deckColors } from '../../engine/deck';
import type { LibraryDeck, Provenance } from '../../lib/library';
import { shortCredit } from '../../lib/library';
import { deckStats, pct } from '../../lib/deckStats';
import { artEnabled, useArt } from '../art';
import { typeSplit } from '../../lib/deckTypes';
import { ordinal, SMALL_SAMPLE, tileRecord } from '../../lib/playedRecord';
import { listOf } from '../../lib/listTwin';
import { TypeSplitBar } from './TypeSplit';
import { ChoomTierBadge, recordedRow, recordedSource, SimTierBadge, simTierOf, YourTierBadge } from './TierBadges';
import { useYourStats, yourStatsFor } from '../useYourStats';

export type OriginKind = 'choom-meta' | 'sim-ladder' | 'choom-guide' | 'nc-original' | 'nc-bred' | 'nc-variant' | 'nc-build' | 'mine' | 'other';

export function originKind(p: Provenance | undefined, kind?: string): OriginKind {
  const o = p?.origin ?? '';
  if (o.startsWith('choom.gg meta')) return 'choom-meta';
  if (o.startsWith('choom.gg community')) return 'choom-guide';
  if (o.startsWith('cyberpunk-tcg-sim.online')) return 'sim-ladder';
  if (o.startsWith('Night City Trainer original')) return 'nc-original';
  if (o.startsWith('Night City Trainer bred')) return 'nc-bred';
  if (o.startsWith('Night City Trainer optimizer')) return 'nc-variant';
  if (o.startsWith('Night City Trainer tournament')) return 'nc-build';
  if (o.startsWith('My deck') || kind === 'custom') return 'mine';
  return 'other';
}

const ORIGIN_META: Record<OriginKind, { icon: string; label: string }> = {
  'choom-meta': { icon: '◆', label: 'choom.gg meta' },
  'choom-guide': { icon: '✎', label: 'choom.gg guide' },
  'sim-ladder': { icon: '▲', label: 'Sim ladder' },
  'nc-original': { icon: '⚙', label: 'NC original' },
  'nc-bred': { icon: '🧬', label: 'Bred' },
  'nc-variant': { icon: '⟲', label: 'Optimizer variant' },
  'nc-build': { icon: '🏆', label: 'Tournament build' },
  mine: { icon: '★', label: 'My deck' },
  other: { icon: '•', label: 'Other' },
};

export function OriginBadge({ deck, full }: { deck: Pick<LibraryDeck, 'prov' | 'kind'>; full?: boolean }) {
  const k = originKind(deck.prov, deck.kind);
  const m = ORIGIN_META[k];
  const season = deck.prov.origin?.match(/season (\d+), (\w+)/);
  return (
    <span className={`origin-badge origin-${k}${full ? ' is-full' : ''}`} title={[deck.prov.origin, deck.prov.author].filter(Boolean).join(' — ')}>
      <span className="origin-icon">{m.icon}</span>
      {season ? `S${season[1]} ${season[2]}` : m.label}
      {full && deck.prov.author && <span className="origin-by"> · {shortCredit(deck).replace(/^[^·]*· ?/, '') || deck.prov.author}</span>}
    </span>
  );
}

export function ColorPips({ legends }: { legends: string[] }) {
  return (
    <span className="pips">
      {legends.map((id, i) => (
        <span key={i} className={`dot ${CARD_BY_ID[id]?.color}`} title={CARD_BY_ID[id]?.color} />
      ))}
    </span>
  );
}

function LegendArt({ id }: { id: string }) {
  const { url, onError } = useArt(id);
  const def = CARD_BY_ID[id];
  return (
    <div className={`legend-art ${def?.color}`} title={def?.displayName}>
      {artEnabled() && url ? <img src={url} alt={def?.displayName} loading="lazy" onError={onError} draggable={false} /> : <span>{def?.name}</span>}
    </div>
  );
}

/** Three Legend portraits side by side (crops the art). */
export function LegendStrip({ legends, height = 90 }: { legends: string[]; height?: number }) {
  return (
    <div className="legend-strip" style={{ height }}>
      {legends.map((id) => (
        <LegendArt key={id} id={id} />
      ))}
    </div>
  );
}

/**
 * The choom.gg tier (if the deck has one) and the Sim tier from our tournaments (if it has recorded games), side by side;
 * for a list with no recorded games, the provisional tier from your own tournaments when it has a letter.
 */
export function TierPair({ d, showUnrated = true }: { d: Pick<LibraryDeck, 'tier' | 'deck' | 'file'>; showUnrated?: boolean }) {
  const sim = simTierOf(d);
  const yours = yourStatsFor(useYourStats(), listOf(d.deck)).prov;
  const prov = sim.unrated === 'no-games' && yours?.tier?.letter ? yours.tier : null;
  if (!d.tier && !sim.letter && !(showUnrated && sim.unrated === 'few-games') && !prov) return null;
  return (
    <span className="tier-pair">
      <ChoomTierBadge tier={d.tier} />
      <SimTierBadge tier={sim} showUnrated={showUnrated} />
      <YourTierBadge tier={prov} />
    </span>
  );
}

/** Gallery tile for a deck: legends art, name, origin, key stats. With `href` the whole tile is a link; without, it is static. */
export function DeckTile({ d, selected, href }: { d: LibraryDeck; selected?: boolean; href?: string }) {
  // a deck saved here with a library deck's list shows that deck's recorded results
  const src = recordedSource(d);
  const st = deckStats(src?.file ?? d.file);
  const played = tileRecord(recordedRow(d));
  const yours = useYourStats();
  const mine = played ? undefined : yourStatsFor(yours, listOf(d.deck)).rec;
  const body = (
    <>
      <LegendStrip legends={d.deck.legends} />
      <div className="deck-tile-body">
        <div className="spread">
          <b className="deck-tile-name">{d.deck.name}</b>
          <TierPair d={d} />
        </div>
        <div className="row small">
          <ColorPips legends={d.deck.legends} />
          <span className="tag">{deckColors(d.deck)}</span>
          <OriginBadge deck={d} />
        </div>
        <div className="small muted deck-tile-by">{shortCredit(d)}</div>
        <div className="deck-tile-stats">
          {played ? (
            <span className="deck-tile-played" title="Swiss win rate: the raw record in the Swiss rounds of recorded tournament events">
              <b className={`num ${played.n < SMALL_SAMPLE ? 'thin' : ''}`}>{pct(played.wr)}</b> in {played.n.toLocaleString()} Swiss games
              {played.n < SMALL_SAMPLE ? ' (small sample)' : ''}
              {played.titles > 0 ? ` · ${played.titles} title${played.titles === 1 ? '' : 's'}` : played.top8 > 0 ? ` · top 8 ×${played.top8}` : ''}
            </span>
          ) : mine ? (
            <span className="deck-tile-played deck-tile-yours" title="Your tournaments: the games this list played in tournaments you ran in this browser, ties counting half. Kept apart from the recorded results.">
              <b className={`num ${mine.games < SMALL_SAMPLE ? 'thin' : ''}`}>{pct(mine.wr)}</b> in {mine.games.toLocaleString()} game{mine.games === 1 ? '' : 's'} of your tournaments
              {mine.games < SMALL_SAMPLE ? ' (small sample)' : ''}
              {mine.won > 0 ? ` · won ${mine.won} of ${mine.runs}` : ''}
            </span>
          ) : (
            !st.leader && !st.review && <span>No recorded games</span>
          )}
          {src?.twin && <span className="deck-tile-twin">Same list as {src.twin.deck.name}</span>}
          {st.leader && (
            <span title="Season rating: win rate vs the meta decks across the breeding seasons, adjusted for sample size (the Seasons leaderboard)">
              <b>{pct(st.leader.rating)}</b> season rating · {ordinal(st.leader.percentile)} percentile
            </span>
          )}
          {!st.leader && st.review && (
            <span title="Win rate in the bot round robin of the top decks (every deck against every other)">
              <b>{pct(st.review.winRate)}</b> round robin
            </span>
          )}
        </div>
        <TypeSplitBar split={typeSplit(d.deck.main)} mini />
      </div>
    </>
  );
  const cls = `deck-tile ${selected ? 'is-selected' : ''}`;
  if (href)
    return (
      <a className={cls} href={href}>
        {body}
      </a>
    );
  return <div className={cls}>{body}</div>;
}
