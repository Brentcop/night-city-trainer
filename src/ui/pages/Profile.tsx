// #/profile and its sub-pages (#/profile/history, /decks, /my-decks, /sharing): the player's profile, kept in this
// browser only. The choices (name, picture, favourite deck, which sections are public) are src/lib/profile.ts; every
// number is derived at read time from the recorded practice games (src/lib/profileStats.ts); sharing builds a document
// of the public sections only (src/lib/profileShare.ts) carried by a link or a file. #/u/<payload> is the read-only
// viewer of someone else's shared profile.
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { CARD_BY_ID } from '../../engine/cards';
import { allDecks } from '../../lib/browserLibrary';
import { loadHidden } from '../../lib/hiddenDecks';
import type { LibraryDeck } from '../../lib/library';
import { clearPractice, loadPractice, PRACTICE_KEY, type PracticeGame } from '../../lib/practiceLog';
import { clearReplays, loadReplays, REPLAYS_KEY, type PracticeReplay } from '../../lib/practiceReplays';
import { clearGameReviews, GAME_REVIEWS_KEY } from '../../lib/gameReviewStore';
import { costlyText } from '../../lib/gameReview';
import { coachedReviewSource, OpenGameFile } from '../components/GameReviewOpen';
import { deleteProfile, loadProfile, NAME_MAX, PROFILE_CHANGED, PROFILE_KEY, PROFILE_SECTIONS, profileFromNewerVersion, saveProfile, SECTION_HELP, SECTION_LABEL, type ProfileDoc } from '../../lib/profile';
import {
  botTier,
  deckStatRows,
  filterHistory,
  headline,
  MY_DECK_GROUPS,
  MY_DECK_LABEL,
  myDeckCounts,
  myDecks,
  pageOf,
  type HistoryFilter,
} from '../../lib/profileStats';
import { buildShared, decodeShared, encodeShared, favouriteDeck, LINK_MAX, parseSharedText, shareFileName, shareLink, type ParseResult } from '../../lib/profileShare';
import { download } from '../../lib/download';
import { useLibraryVersion } from '../useLibrary';
import { PageHead } from '../components/PageHead';
import { ConfirmDialog } from '../components/SavedGames';
import { GameReviewModal, type GameReviewSource } from '../components/GameReview';
import { formatRecorded, RecordedAt } from '../components/RecordedAt';
import { profileHref } from '../components/DeckStats';
import { ColorPips, LegendStrip, OriginBadge, TierPair } from '../components/DeckIdentity';
import { Avatar, DeckStatsTable, HeadlineTiles, HistoryTable, PicturePicker, SharedProfileView, Tabs, type HistoryRow } from '../components/ProfileParts';
import { useFeature } from '../useSiteConfig';
import '../profile.css';

const TABS = [
  { key: 'overview', label: 'Overview', path: '' },
  { key: 'history', label: 'Game history', path: 'history' },
  { key: 'decks', label: 'Deck stats', path: 'decks' },
  { key: 'my-decks', label: 'My decks', path: 'my-decks' },
  { key: 'sharing', label: 'Sharing & privacy', path: 'sharing' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const STORED_HERE = 'Your profile lives in this browser only: nothing is uploaded, and there is no account.';

/** The practice log, re-read when another tab records a game or clears it. */
function usePracticeLog(): [PracticeGame[], Map<string, PracticeReplay>, () => void] {
  const [games, setGames] = useState(loadPractice);
  const [replays, setReplays] = useState(() => new Map(loadReplays().map((r) => [r.id, r])));
  const reload = useCallback(() => {
    setGames(loadPractice());
    setReplays(new Map(loadReplays().map((r) => [r.id, r])));
  }, []);
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (!e.key || e.key === PRACTICE_KEY || e.key === REPLAYS_KEY) reload();
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, [reload]);
  return [games, replays, reload];
}

/** The saved choices, re-read when they change here or in another tab. */
function useProfile(): [ProfileDoc, (p: ProfileDoc) => boolean] {
  const [p, setP] = useState(loadProfile);
  useEffect(() => {
    const re = () => setP(loadProfile());
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === PROFILE_KEY) re();
    };
    window.addEventListener(PROFILE_CHANGED, re);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PROFILE_CHANGED, re);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const save = useCallback((next: ProfileDoc) => {
    const saved = saveProfile(next);
    setP(saved ?? next);
    return !!saved;
  }, []);
  return [p, save];
}

/** A library link for a deck by name (only decks this site knows: a shared name is never turned into a link itself). */
const deckLinker = (lib: readonly LibraryDeck[]) => {
  const byName = new Map(lib.map((d) => [d.deck.name, d.file]));
  return (name: string) => {
    const f = byName.get(name);
    return f ? profileHref(f) : null;
  };
};

export function ProfilePage({ sub }: { sub: string }) {
  // profile sharing turned off (site config): no Sharing & privacy tab
  const sharing = useFeature('profileSharing');
  const tabs = useMemo(() => TABS.filter((t) => sharing || t.key !== 'sharing'), [sharing]);
  const tab: TabKey = (tabs.find((t) => t.path === sub)?.key ?? 'overview') as TabKey;
  const idBase = useId();
  const v = useLibraryVersion();
  const lib = useMemo(() => {
    void v;
    return allDecks();
  }, [v]);
  const [profile, save] = useProfile();
  const [games, replays, reload] = usePracticeLog();
  const [saveFailed, setSaveFailed] = useState(false);
  const update = (p: ProfileDoc) => setSaveFailed(!save(p));
  const select = (key: string) => {
    const t = tabs.find((x) => x.key === key);
    if (t) window.location.hash = t.path ? `#/profile/${t.path}` : '#/profile';
  };
  const newer = useMemo(() => profileFromNewerVersion(), []);
  return (
    <div className="profile-page">
      <PageHead kicker="Profile" title={profile.name ? profile.name : 'Your profile'}>
        {STORED_HERE} Every number comes from the practice games recorded here.
      </PageHead>
      {newer && (
        <div className="panel small" role="alert">
          This browser holds a profile saved by a newer version of the site. It is left as it is; reload the page to get the latest version.
        </div>
      )}
      {saveFailed && (
        <div className="panel small" role="alert">
          Not saved: this browser's storage is full or blocked.
        </div>
      )}
      <Tabs tabs={tabs} active={tab} onSelect={select} idBase={idBase} label="Profile sections" />
      <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${tab}`} className="profile-panel">
        {tab === 'overview' && <Overview profile={profile} update={update} games={games} lib={lib} />}
        {tab === 'history' && <History games={games} replays={replays} reload={reload} />}
        {tab === 'decks' && <DeckStatsPage games={games} lib={lib} />}
        {tab === 'my-decks' && <MyDecksPage lib={lib} />}
        {tab === 'sharing' && <Sharing profile={profile} update={update} games={games} lib={lib} reload={reload} />}
      </div>
    </div>
  );
}

function Overview({ profile, update, games, lib }: { profile: ProfileDoc; update: (p: ProfileDoc) => void; games: PracticeGame[]; lib: readonly LibraryDeck[] }) {
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState(profile.name);
  useEffect(() => setName(profile.name), [profile.name]);
  const nameId = useId();
  const favId = useId();
  const fav = favouriteDeck(profile, games, lib);
  const favDeck = fav?.file ? lib.find((d) => d.file === fav.file) : undefined;
  const h = useMemo(() => headline(games), [games]);
  const options = useMemo(() => {
    const hidden = loadHidden();
    const played = new Set(games.map((g) => g.deck));
    const visible = lib.filter((d) => !hidden.has(d.file) || d.file === profile.favourite);
    return {
      played: visible.filter((d) => played.has(d.deck.name)),
      mine: visible.filter((d) => d.kind === 'custom' && !played.has(d.deck.name)),
      rest: visible.filter((d) => d.kind !== 'custom' && !played.has(d.deck.name)),
    };
  }, [lib, games, profile.favourite]);
  const commitName = () => {
    if (name.trim() !== profile.name) update({ ...profile, name });
  };
  return (
    <>
      <section className="panel profile-card" aria-label="Name and picture">
        <button type="button" className="avatar-btn" onClick={() => setPicking(true)} aria-label="Change the profile picture">
          <Avatar cardId={profile.picture} size={96} label="" />
          <span className="small">Change</span>
        </button>
        <div className="profile-card-main">
          <label htmlFor={nameId} className="small muted">
            Display name (optional, kept in this browser)
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={NAME_MAX}
            placeholder="No name"
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && commitName()}
          />
          <div className="small muted">Picture: {profile.picture ? <PictureName id={profile.picture} /> : 'none'}</div>
        </div>
      </section>
      {picking && (
        <PicturePicker
          current={profile.picture}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            update({ ...profile, picture: id });
            setPicking(false);
          }}
        />
      )}
      <section className="panel" aria-labelledby={favId}>
        <h2 id={favId} className="profile-h2">
          Favourite deck
        </h2>
        <label className="small muted">
          Choose one, or leave it on “most played”{' '}
          <select value={profile.favourite ?? ''} onChange={(e) => update({ ...profile, favourite: e.target.value || null })}>
            <option value="">Most played (automatic)</option>
            {options.played.length > 0 && (
              <optgroup label="Decks you played">
                {options.played.map((d) => (
                  <option key={d.file} value={d.file}>
                    {d.deck.name}
                  </option>
                ))}
              </optgroup>
            )}
            {options.mine.length > 0 && (
              <optgroup label="Saved in this browser">
                {options.mine.map((d) => (
                  <option key={d.file} value={d.file}>
                    {d.deck.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Library">
              {options.rest.map((d) => (
                <option key={d.file} value={d.file}>
                  {d.deck.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {fav ? (
          <div className="profile-fav">
            {favDeck && <LegendStrip legends={favDeck.deck.legends} height={70} />}
            <div className="profile-fav-body">
              <div className="spread">
                <b>{favDeck ? <a href={profileHref(favDeck.file)}>{fav.name}</a> : fav.name}</b>
                {favDeck && <TierPair d={favDeck} />}
              </div>
              <div className="row small">
                {favDeck && <ColorPips legends={favDeck.deck.legends} />}
                {favDeck && <OriginBadge deck={favDeck} />}
                <span className="muted">{fav.chosen ? 'your choice' : 'most played'}</span>
              </div>
              {!favDeck && <p className="small muted">This deck is no longer in the library (deleted or renamed).</p>}
            </div>
          </div>
        ) : (
          <p className="small muted">Play a game (or choose a deck above) to have a favourite.</p>
        )}
      </section>
      <section className="panel" aria-label="Headline numbers">
        <h2 className="profile-h2">Headline numbers</h2>
        {games.length ? (
          <HeadlineTiles h={h} />
        ) : (
          <p className="muted">
            No practice games recorded in this browser yet. <a href="#/play">Play a game →</a>
          </p>
        )}
      </section>
    </>
  );
}

function PictureName({ id }: { id: string }) {
  return <>{CARD_BY_ID[id]?.displayName ?? 'a card no longer in the catalogue'}</>;
}

const PAGE_SIZE = 20;

function History({ games, replays, reload }: { games: PracticeGame[]; replays: Map<string, PracticeReplay>; reload: () => void }) {
  const [f, setF] = useState<HistoryFilter>({ deck: '', result: '' });
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<{ src: GameReviewSource; title: string } | null>(null);
  const reviews = useFeature('gameReview');
  const [confirm, setConfirm] = useState(false);
  const decks = useMemo(() => [...new Set(games.map((g) => g.deck))].sort((a, b) => a.localeCompare(b)), [games]);
  const list = useMemo(() => filterHistory(games, f), [games, f]);
  const pg = pageOf(list, page, PAGE_SIZE);
  const rows: HistoryRow[] = pg.items.map((g, i) => {
    const r = g.id ? replays.get(g.id) : undefined;
    return {
      key: g.id ?? `${g.date}-${i}`,
      date: g.date,
      deck: g.deck,
      opp: g.opp,
      tier: botTier(g.level),
      result: g.result,
      turns: g.turns,
      first: g.first,
      gigs: g.gigs ?? null,
      conceded: !!g.conceded,
      grade: g.coach?.grade ?? null,
      review: r && reviews ? () => setReview({ src: { replay: r, coach: [], persist: true, turns: g.turns || undefined }, title: [`${r.decks[0].name} vs ${r.decks[1].name}`, formatRecorded(r.date)].filter(Boolean).join(' — ') }) : undefined,
      ...(g.review ? { ratings: [g.review.acc === null ? '' : `accuracy ${g.review.acc}`, costlyText(g.review.n) || 'no slips'].filter(Boolean).join(' · ') } : {}),
    };
  });
  if (!games.length)
    return (
      <p className="muted">
        No practice games recorded in this browser yet. Finished games against the bot are recorded here. <a href="#/play">Play a game →</a>
      </p>
    );
  return (
    <section aria-label="Game history">
      <div className="row profile-filters">
        <label className="small">
          Deck{' '}
          <select
            value={f.deck}
            onChange={(e) => {
              setF({ ...f, deck: e.target.value });
              setPage(1);
            }}
          >
            <option value="">Any deck</option>
            {decks.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="small">
          Result{' '}
          <select
            value={f.result}
            onChange={(e) => {
              setF({ ...f, result: e.target.value as HistoryFilter['result'] });
              setPage(1);
            }}
          >
            <option value="">Any result</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="draw">Draws</option>
          </select>
        </label>
        <span className="small muted" aria-live="polite">
          {list.length} of {games.length} games
        </span>
        {reviews && <OpenGameFile onOpen={(c, name) => setReview({ src: coachedReviewSource(c), title: `${c.replay.decks[0].name} vs ${c.replay.decks[1].name} (from ${name})` })} />}
        <button type="button" className="ghost danger-soft" onClick={() => setConfirm(true)} style={{ marginLeft: 'auto' }}>
          Clear history…
        </button>
      </div>
      {list.length ? <HistoryTable rows={rows} caption="Your practice games, newest first" /> : <p className="muted small">No game matches these filters.</p>}
      {pg.pages > 1 && (
        <nav className="row profile-pager" aria-label="History pages">
          <button type="button" disabled={pg.page <= 1} onClick={() => setPage(pg.page - 1)}>
            ← Newer
          </button>
          <span className="small">
            Page {pg.page} of {pg.pages}
          </span>
          <button type="button" disabled={pg.page >= pg.pages} onClick={() => setPage(pg.page + 1)}>
            Older →
          </button>
        </nav>
      )}
      <p className="small muted">
        The last 500 games are kept; the last 25 also keep a replay you can review. The coach grade is recorded for games played with the coach on; the review's accuracy and
        costly moves once you have opened its Game review. Open a game file exported from Play (⤓ Export game) to review it here.
      </p>
      {review && <GameReviewModal src={review.src} title={review.title} onClose={() => setReview(null)} />}
      {confirm && (
        <ConfirmDialog
          title="Clear your game history?"
          text={<p>This removes all {games.length} recorded practice games and their replays from this browser. Your profile stats start again from zero. This can't be undone.</p>}
          confirm="Clear history"
          danger
          onConfirm={() => {
            clearPractice();
            clearReplays();
            clearGameReviews();
            reload();
            setConfirm(false);
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </section>
  );
}

function DeckStatsPage({ games, lib }: { games: PracticeGame[]; lib: readonly LibraryDeck[] }) {
  const rows = useMemo(() => deckStatRows(games), [games]);
  const link = useMemo(() => deckLinker(lib), [lib]);
  if (!rows.length) return <p className="muted">No practice games recorded yet, so there are no deck stats. <a href="#/play">Play a game →</a></p>;
  return (
    <section aria-label="Deck stats">
      <p className="small muted">
        Every deck you played against the bot. Rates under 20 games are a small sample: dimmed, and best read as a rough guide. First / second is
        your win rate when you went first and when you went second.
      </p>
      <DeckStatsTable rows={rows} deckLink={link} />
    </section>
  );
}

function MyDecksPage({ lib }: { lib: readonly LibraryDeck[] }) {
  const decks = useMemo(() => myDecks(lib), [lib]);
  const counts = myDeckCounts(decks);
  if (!decks.length)
    return (
      <p className="muted">
        No decks saved in this browser yet. Build or import one in the <a href="#/decks">deck editor</a>, or tune or breed one in the <a href="#/lab">Deck Lab</a>.
      </p>
    );
  return (
    <section aria-label="My decks">
      <ul className="profile-counts" aria-label="Decks by origin">
        {MY_DECK_GROUPS.filter((g) => g !== 'unrecorded' || counts.unrecorded > 0).map((g) => (
          <li key={g}>
            <b>{counts[g]}</b> {MY_DECK_LABEL[g].toLowerCase()}
          </li>
        ))}
      </ul>
      {MY_DECK_GROUPS.map((g) => {
        const list = decks.filter((d) => d.group === g);
        if (!list.length) return null;
        return (
          <div key={g} className="panel">
            <h2 className="profile-h2">
              {MY_DECK_LABEL[g]} ({list.length})
            </h2>
            <ul className="plain-list profile-decklist">
              {list.map((d) => (
                <li key={d.file}>
                  <ColorPips legends={d.legends} /> <a href={profileHref(d.file)}>{d.name}</a>
                  <span className="small muted">{d.added ? <RecordedAt iso={d.added} compact prefix=" · added " /> : ' · date not recorded'}</span>
                </li>
              ))}
            </ul>
            {g === 'tuned' && (
              <p className="small muted">
                Results against the original list are on the <a href="#/tuned">Tuned decks</a> page.
              </p>
            )}
          </div>
        );
      })}
      <p className="small muted">Decks saved here before this page existed don't record whether they were imported or built, or when.</p>
    </section>
  );
}

type ShareState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'copied'; link: string } | { kind: 'manual'; link: string } | { kind: 'too-big'; size: number } | { kind: 'error'; text: string };

function Sharing({ profile, update, games, lib, reload }: { profile: ProfileDoc; update: (p: ProfileDoc) => void; games: PracticeGame[]; lib: readonly LibraryDeck[]; reload: () => void }) {
  const doc = useMemo(() => buildShared({ profile, games, lib, now: new Date().toISOString() }), [profile, games, lib]);
  const link = useMemo(() => deckLinker(lib), [lib]);
  const [st, setSt] = useState<ShareState>({ kind: 'idle' });
  const [ask, setAsk] = useState<'profile' | 'history' | null>(null);
  const [done, setDone] = useState('');
  const anyPublic = PROFILE_SECTIONS.some((k) => profile.public[k]);
  const copy = async () => {
    setSt({ kind: 'busy' });
    try {
      const payload = await encodeShared({ ...doc, createdAt: new Date().toISOString() });
      const url = shareLink(window.location.href.split('#')[0] ?? '', payload);
      if (!url) return setSt({ kind: 'too-big', size: payload.length });
      try {
        await navigator.clipboard.writeText(url);
        setSt({ kind: 'copied', link: url });
      } catch {
        setSt({ kind: 'manual', link: url });
      }
    } catch {
      setSt({ kind: 'error', text: 'The link could not be made in this browser. Export the file instead.' });
    }
  };
  const exportFile = () => {
    const d = { ...doc, createdAt: new Date().toISOString() };
    download(shareFileName(d), JSON.stringify(d, null, 1), 'application/json');
  };
  return (
    <>
      <section className="panel" aria-labelledby="share-h">
        <h2 id="share-h" className="profile-h2">
          What is public
        </h2>
        <p className="small muted">
          Everything is private until you switch it on. “Public” means only this: the section goes into the link or file you make below. Nothing is
          uploaded, and anyone you give the link or file to sees those sections.
        </p>
        <ul className="plain-list share-switches">
          {PROFILE_SECTIONS.map((k) => (
            <li key={k}>
              <label className="share-switch">
                <input type="checkbox" role="switch" aria-label={`${SECTION_LABEL[k]}: public`} aria-describedby={`share-help-${k}`} checked={profile.public[k]} onChange={(e) => update({ ...profile, public: { ...profile.public, [k]: e.target.checked } })} />
                <span>
                  <b>{SECTION_LABEL[k]}</b> <span className="muted">{profile.public[k] ? 'public' : 'private'}</span>
                  <span className="small muted share-help" id={`share-help-${k}`}>
                    {SECTION_HELP[k]}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="row">
          <button type="button" className="primary" onClick={copy} disabled={!anyPublic || st.kind === 'busy'}>
            Copy share link
          </button>
          <button type="button" onClick={exportFile} disabled={!anyPublic}>
            ⤓ Export profile file
          </button>
          {!anyPublic && <span className="small muted">Make a section public to share it.</span>}
        </div>
        <div aria-live="polite" className="small">
          {st.kind === 'copied' && <p>Link copied. Anyone with it sees the public sections as they are now; it does not update when you play more.</p>}
          {st.kind === 'manual' && (
            <p>
              Copying is blocked here; select the link and copy it yourself:
              <input className="share-link" readOnly value={st.link} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
            </p>
          )}
          {st.kind === 'too-big' && (
            <p>
              Too big for a link ({st.size.toLocaleString()} characters; the limit is {LINK_MAX.toLocaleString()}). Export the profile file and send that,
              or make fewer sections public.
            </p>
          )}
          {st.kind === 'error' && <p>{st.text}</p>}
        </div>
      </section>
      <section className="panel" aria-label="Preview of your shared profile">
        <h2 className="profile-h2">Preview</h2>
        <SharedProfileView p={doc} mode="preview" deckLink={link} />
      </section>
      <section className="panel" aria-labelledby="data-h">
        <h2 id="data-h" className="profile-h2">
          Your data
        </h2>
        <p className="small">
          {STORED_HERE} No identifiers are made and nothing is tracked. In this browser's storage:
        </p>
        <ul className="small">
          <li>
            <code>{PROFILE_KEY}</code>: your name, picture card, favourite deck and the public/private switches.
          </li>
          <li>
            <code>{PRACTICE_KEY}</code>: the practice game log (up to 500 games) that every number here is worked out from.
          </li>
          <li>
            <code>{REPLAYS_KEY}</code>: replays of your last 25 games, for review.
          </li>
          <li>
            <code>{GAME_REVIEWS_KEY}</code>: the Game reviews of those games, and the coach's grades from play they start from.
          </li>
          <li>Your saved decks stay in the deck library (delete them from the deck pages).</li>
        </ul>
        <p className="small muted">With card art on, the pictures load from the card database like every card on the site; nothing about you is sent.</p>
        <div className="row">
          <button type="button" className="danger-soft" onClick={() => setAsk('profile')}>
            Delete my profile data…
          </button>
          <button type="button" className="danger-soft" onClick={() => setAsk('history')} disabled={!games.length}>
            Delete my game history…
          </button>
        </div>
        <p className="small" aria-live="polite">
          {done}
        </p>
      </section>
      {ask === 'profile' && (
        <ConfirmDialog
          title="Delete your profile data?"
          text={<p>This removes your name, picture, favourite deck and privacy switches from this browser. Your game history and saved decks are kept. This can't be undone.</p>}
          confirm="Delete profile data"
          danger
          onConfirm={() => {
            deleteProfile();
            setAsk(null);
            setDone('Profile data deleted.');
          }}
          onCancel={() => setAsk(null)}
        />
      )}
      {ask === 'history' && (
        <ConfirmDialog
          title="Delete your game history?"
          text={<p>This removes all {games.length} recorded practice games and their replays from this browser. Your profile choices and saved decks are kept. This can't be undone.</p>}
          confirm="Delete game history"
          danger
          onConfirm={() => {
            clearPractice();
            clearReplays();
            clearGameReviews();
            reload();
            setAsk(null);
            setDone('Game history deleted.');
          }}
          onCancel={() => setAsk(null)}
        />
      )}
    </>
  );
}

/** #/u/<payload>: someone else's shared profile, read only. Without a payload: open a shared profile file. */
export function ProfileViewPage({ payload }: { payload: string }) {
  const [res, setRes] = useState<ParseResult | null>(null);
  const v = useLibraryVersion();
  const link = useMemo(() => {
    void v;
    return deckLinker(allDecks());
  }, [v]);
  useEffect(() => {
    let live = true;
    if (!payload) return;
    void decodeShared(payload).then((r) => live && setRes(r));
    return () => {
      live = false;
    };
  }, [payload]);
  const open = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024) return setRes({ ok: false, why: 'This file is too large to be a shared profile.' });
    setRes(parseSharedText(await file.text()));
  };
  return (
    <div className="profile-page">
      <PageHead kicker="Shared profile" title={res?.ok && res.profile.identity?.name ? res.profile.identity.name : 'A shared profile'}>
        Shared by its owner as a link or file. It is not your profile and is not saved here.
      </PageHead>
      {!payload && !res && (
        <div className="panel">
          <label>
            Open a shared profile file{' '}
            <input type="file" accept="application/json,.json" onChange={(e) => void open(e.target.files?.[0])} />
          </label>
        </div>
      )}
      {payload && !res && (
        <p className="muted" aria-live="polite">
          Opening…
        </p>
      )}
      {res && !res.ok && (
        <div className="panel" role="alert">
          <p>{res.why}</p>
          <a href="#/profile">Go to your own profile →</a>
        </div>
      )}
      {res?.ok && <SharedProfileView p={res.profile} mode="viewer" deckLink={link} />}
    </div>
  );
}
