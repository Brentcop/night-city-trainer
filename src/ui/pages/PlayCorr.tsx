// Multi-day games against a person (#/play/corr, #/play/corr/<game>/<host|guest>, #/play/turn/<packet>): the serverless form, played
// by turn packets (src/net/corrSession.ts). Loaded only when opened. The host makes a game and sends the invite; the
// guest opens it, picks a deck and sends back a reply; from then on, whenever the game waits on the other player, this
// page makes a packet (a link when it fits, else a code or a file) to send by any messenger, and opens the other's
// packets. The board is the Play board with the rival seat played by the other person.
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { loadProfile } from '../../lib/profile';
import { download } from '../../lib/download';
import type { PracticeReplay } from '../../lib/practiceReplays';
import { capProblem, DAY_MS, loadBotGames } from '../../lib/multiDay';
import { storageWorks } from '../../lib/savedGames';
import { clockState, spanText, type CorrGame } from '../../net/corr';
import { browserCorrStore } from '../../net/corrStore';
import { CorrSession, createInvite, joinGame, readInvite } from '../../net/corrSession';
import { codeFromText, MAX_LINK_PACKET, openPacket, packetsAvailable } from '../../net/packet';
import { NAME_MAX } from '../../net/session';
import { DeckPicker, findDeck, firstVisibleDeck } from '../components/DeckPicker';
import { Modal } from '../components/Modal';
import { MULTI_DAY_NOTE } from '../components/OngoingGames';
import { ChatPanel } from '../components/board/ChatPanel';
import { useSiteConfig } from '../useSiteConfig';
import { Board, type BoardRun, type OnlineBoard } from './Play';

const NAME_KEY = 'nct.online.name.v1';
type Role = 'host' | 'guest';
const kvGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const kvSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage blocked */
  }
};
/** The page's own address with a hash route (works from any GitHub Pages sub-path). */
const pageLink = (hash: string) => `${location.origin}${location.pathname}${location.search}${hash}`;
const packetLink = (code: string) => pageLink(`#/play/turn/${code}`);
/** Go to a route without the page reloading the game (a hash change would remount it). */
const go = (hash: string) => {
  location.hash = hash;
};

/** The two sentences of the trust model. */
export const CORR_TRUST =
  "The host's device runs the game, so this is for friendly play: a modified host could see hidden cards. The clocks are kept by each player's own device, so nothing happens by itself when time runs out: the other player may claim the win or give more time.";

/** Why the End turn setting does not apply here: each extra click would cost the guest another packet round trip. */
export const CORR_END_TURN =
  'In these games your turn ends by itself when nothing is left to do, whatever your End turn setting: a click to end it would cost another packet each turn.';

function TrustNotes() {
  return (
    <div className="small muted online-notes">
      <p>{CORR_TRUST}</p>
      <p>{MULTI_DAY_NOTE}</p>
      <p>{CORR_END_TURN}</p>
    </div>
  );
}

/** A packet to send: a link when it fits, else the code; Copy, Share and Save as a file. */
export function PacketBox({ code, rival, what = 'packet' }: { code: string; rival: string; what?: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const id = useId();
  const fits = code.length <= MAX_LINK_PACKET;
  const link = fits ? packetLink(code) : null;
  const copy = (label: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => setCopied(label),
      () => setCopied('Copy failed: select the text and copy it'),
    );
  };
  const share = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <div className="online-code">
      <label htmlFor={id} className="small muted">
        {fits ? `Send this link to ${rival} by any messenger.` : `Send this code to ${rival} (${code.length.toLocaleString()} characters: too long for a link), or save it as a file and send the file.`}
      </label>
      <textarea id={id} readOnly value={link ?? code} rows={3} onFocus={(e) => e.currentTarget.select()} />
      <div className="row">
        {link && (
          <button type="button" className="primary" onClick={() => copy('Link copied', link)}>
            Copy link
          </button>
        )}
        <button type="button" className={link ? '' : 'primary'} onClick={() => copy('Code copied', code)}>
          Copy code
        </button>
        {share && (
          <button type="button" onClick={() => void navigator.share({ title: 'Night City Trainer', text: link ? `My ${what}` : code, ...(link ? { url: link } : {}) }).catch(() => undefined)}>
            Share…
          </button>
        )}
        <button type="button" onClick={() => download(`nct-${what.replace(/\W+/g, '-')}-${Date.now().toString(36)}.txt`, `${link ?? code}\n`, 'text/plain')}>
          ⤓ Save as a file
        </button>
        {copied && (
          <span className="small muted" role="status">
            {copied}
          </span>
        )}
      </div>
    </div>
  );
}

/** Paste a packet (link, code) or open its file. */
function PacketInput({ label, onOpen, busy }: { label: string; onOpen: (text: string) => Promise<string | null>; busy?: boolean }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const id = useId();
  const file = useRef<HTMLInputElement>(null);
  const open = (t: string) =>
    void onOpen(t).then((why) => {
      setMsg(why ? { ok: false, text: why } : { ok: true, text: 'Opened.' });
      if (!why) setText('');
    });
  return (
    <form
      className="grid"
      onSubmit={(e) => {
        e.preventDefault();
        open(text);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the link or code here" />
      <div className="row">
        <button type="submit" className="primary" disabled={!text.trim() || busy}>
          Open it
        </button>
        <button type="button" onClick={() => file.current?.click()} disabled={busy}>
          Open a file…
        </button>
        <input
          ref={file}
          type="file"
          accept=".txt,text/plain"
          hidden
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void f.text().then(open, () => setMsg({ ok: false, text: 'That file could not be read.' }));
          }}
        />
      </div>
      {msg && (
        <p className={msg.ok ? 'small' : 'small online-error'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

function useCorr(s: CorrSession | null): number {
  const sub = useCallback((fn: () => void) => (s ? s.subscribe(fn) : () => undefined), [s]);
  const snap = () => s?.version ?? -1;
  return useSyncExternalStore(sub, snap, snap);
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function PlayCorr({ sub, initialDeck }: { sub: string; initialDeck?: string }) {
  const [storageOk] = useState(storageWorks);
  if (!storageOk) return <Blocked why="This browser blocks site storage, so a multi-day game can't be kept here. Allow site data for this site, or use another browser." />;
  if (!packetsAvailable()) return <Blocked why="This browser can't sign turn packets here (Web Crypto needs a secure page: https or localhost)." />;
  if (sub.startsWith('corr/')) {
    const [id = '', role] = sub.slice(5).split('/');
    return <GamePage id={id} role={role === 'host' || role === 'guest' ? role : null} incoming={null} />;
  }
  if (sub.startsWith('turn/')) return <PacketLink code={sub.slice(5)} initialDeck={initialDeck} />;
  return <Lobby initialDeck={initialDeck} invite={null} />;
}

function Blocked({ why }: { why: string }) {
  return (
    <div className="grid online-lobby" style={{ maxWidth: 760 }}>
      <h1>Multi-day game vs a person</h1>
      <p className="online-error">{why}</p>
      <p>
        <a href="#/play">← Play</a>
      </p>
    </div>
  );
}

/** A packet link opened: an invite goes to the join form; a game's packet opens that game and is applied. */
function PacketLink({ code, initialDeck }: { code: string; initialDeck?: string }) {
  const [state, setState] = useState<{ k: 'reading' } | { k: 'invite' } | { k: 'game'; id: string; role: Role } | { k: 'bad'; why: string }>({ k: 'reading' });
  useEffect(() => {
    let alive = true;
    void openPacket(code).then((r) => {
      if (!alive) return;
      if (!r.ok) return setState({ k: 'bad', why: r.why });
      const p = r.value.packet;
      if (p.b.t === 'invite') return setState({ k: 'invite' });
      // a packet from the host is for the guest's copy of the game, and the other way round
      const role: Role = p.f === 'h' ? 'guest' : 'host';
      const known = browserCorrStore()
        .load()
        .some((g) => g.id === p.g && g.role === role);
      setState(known ? { k: 'game', id: p.g, role } : { k: 'bad', why: 'This packet belongs to a game that is not in this browser. Open it on the device you play that game on (or import the game there first: Ongoing games → Import).' });
    });
    return () => {
      alive = false;
    };
  }, [code]);
  if (state.k === 'reading') return <p className="muted">Reading the packet…</p>;
  if (state.k === 'invite') return <Lobby initialDeck={initialDeck} invite={code} />;
  if (state.k === 'game') return <GamePage id={state.id} role={state.role} incoming={code} />;
  return <Blocked why={state.why} />;
}

function Lobby({ initialDeck, invite }: { initialDeck?: string; invite: string | null }) {
  const site = useSiteConfig();
  const md = site.multiDay;
  const [role, setRole] = useState<'host' | 'guest'>(invite ? 'guest' : 'host');
  const [name, setName] = useState(() => kvGet(NAME_KEY) ?? loadProfile().name ?? '');
  const [deckKey, setDeckKey] = useState(() => findDeck(initialDeck)?.file ?? firstVisibleDeck()?.file ?? '');
  const [days, setDays] = useState(md.defaultDays);
  const [prefFirst, setPrefFirst] = useState(true);
  const [auto, setAuto] = useState(true);
  const [paste, setPaste] = useState(invite ? packetLink(invite) : '');
  const [info, setInfo] = useState<Awaited<ReturnType<typeof readInvite>> | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deck = findDeck(deckKey);
  const store = useMemo(() => browserCorrStore(), []);
  const open = store.load().filter((g) => g.stage !== 'over' && g.stage !== 'refused').length;
  const blocked = capProblem({ bot: loadBotGames().length, pvp: open }, md.maxOngoing);
  useEffect(() => {
    const c = codeFromText(paste);
    if (!c) {
      setInfo(null);
      return;
    }
    let alive = true;
    void readInvite(c).then((r) => alive && setInfo(r));
    return () => {
      alive = false;
    };
  }, [paste]);
  const host = async () => {
    if (!deck || blocked) return;
    setBusy(true);
    kvSet(NAME_KEY, name.trim().slice(0, NAME_MAX));
    try {
      const r = await createInvite({ name: name || 'Host', deck: deck.deck, days, prefFirst }, Date.now());
      const why = store.save(r.game);
      if (why) setProblem(why);
      else go(`#/play/corr/${r.game.id}/host`);
    } catch (e) {
      setProblem(`Could not make the game: ${(e as Error).message}`);
    }
    setBusy(false);
  };
  const join = async () => {
    if (!deck || blocked) return;
    setBusy(true);
    kvSet(NAME_KEY, name.trim().slice(0, NAME_MAX));
    const r = await joinGame(paste, { name: name || 'Guest', deck: deck.deck, days: 0, prefFirst, auto }, Date.now());
    setBusy(false);
    if (!r.ok) return setProblem(r.why);
    if (store.load().some((g) => g.id === r.game.id && g.role === 'guest')) return setProblem('This invite is already in your Ongoing games: open it from there.');
    const why = store.save(r.game);
    if (why) setProblem(why);
    else go(`#/play/corr/${r.game.id}/guest`);
  };
  return (
    <div className="grid online-lobby" style={{ maxWidth: 760 }}>
      <h1>Multi-day game vs a person</h1>
      <p className="muted">
        <a href="#/play">← Play</a>
      </p>
      <div className="panel grid">
        <p style={{ margin: 0 }}>
          Play over days, whenever you like: each move goes to the other player as a <b>turn packet</b> (a link, or a code or file when it is too long) that you send by any messenger. The host takes a whole turn before
          a packet is needed; each decision of the guest's, including a reaction during the host's turn, is a round trip.
        </p>
        <div className="row" role="radiogroup" aria-label="Host or join">
          <label>
            <input type="radio" name="corr-role" checked={role === 'host'} onChange={() => setRole('host')} /> Start a game (you host)
          </label>
          <label>
            <input type="radio" name="corr-role" checked={role === 'guest'} onChange={() => setRole('guest')} /> Join with an invite
          </label>
        </div>
        <label className="row">
          <span className="muted small">Your name</span>
          <input type="text" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Shown to the other player" />
        </label>
        <DeckPicker label="Your deck" value={deckKey} onChange={setDeckKey} />
        <p className="small muted" style={{ margin: 0 }}>
          The other player sees your deck's name only.
        </p>
        {role === 'host' && (
          <label className="row">
            <span className="muted small">Game length</span>
            <select value={days} onChange={(e) => setDays(+e.target.value)}>
              {Array.from({ length: md.maxDays - md.minDays + 1 }, (_, k) => md.minDays + k).map((d) => (
                <option key={d} value={d}>
                  {d} days ({spanText((d * DAY_MS) / 2)} on each clock)
                </option>
              ))}
            </select>
          </label>
        )}
        {role === 'host' && (
          <p className="small muted" style={{ margin: 0 }}>
            The clock: each player has half the game's length, and a player's clock runs from the moment the other's packet was made until they make theirs (like a chess clock, in days).
          </p>
        )}
        {role === 'guest' && (
          <>
            <label className="grid">
              <span>Invite link or code from the host</span>
              <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the invite here" />
            </label>
            {info && (info.ok ? <p className="small">{`${info.host} invites you to a ${info.days}-day game; they play ${info.deck}.`}</p> : <p className="small online-error">{info.why}</p>)}
            <label className="row">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              <span>Pay my costs and order my effects the automatic way (each choice by hand would cost a round trip)</span>
            </label>
          </>
        )}
        <label className="row">
          <span className="muted small">If the roll picks you</span>
          <select value={prefFirst ? 'first' : 'second'} onChange={(e) => setPrefFirst(e.target.value === 'first')}>
            <option value="first">Go first</option>
            <option value="second">Go second</option>
          </select>
        </label>
        {blocked && <p className="small online-error">{blocked}</p>}
        <div className="row">
          {role === 'host' ? (
            <button className="primary" disabled={!deck || busy || !!blocked} onClick={() => void host()}>
              Make the game and its invite
            </button>
          ) : (
            <button className="primary" disabled={!deck || busy || !!blocked || !info?.ok} onClick={() => void join()}>
              Join and make my reply
            </button>
          )}
        </div>
        {problem && (
          <p className="online-error" role="alert">
            {problem}
          </p>
        )}
        <TrustNotes />
      </div>
    </div>
  );
}

const NO_GRADES: never[] = [];
const DUMMY_REPLAY: PracticeReplay = { id: '', date: '', decks: [{ name: '', legends: [], main: [], sideboard: [] }, { name: '', legends: [], main: [], sideboard: [] }], seed: 0, botLevel: 'pvp', botSeed: 0, choices: [], result: 'draw' };

/** One game: the invite / reply stage, or the board with the packet controls. */
function GamePage({ id, role, incoming }: { id: string; role: Role | null; incoming: string | null }) {
  const site = useSiteConfig();
  const store = useMemo(() => browserCorrStore(), []);
  const [session, setSession] = useState<CorrSession | null>(null);
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState(false);
  const shown = useRef(-1);
  const v = useCorr(session);
  const now = useNow();

  useEffect(() => {
    const g = store.load().find((x) => x.id === id && (!role || x.role === role));
    if (!g) {
      setMissing(true);
      return;
    }
    let alive = true;
    let s: CorrSession | null = null;
    void CorrSession.open(g, { store, now: Date.now }).then(async (x) => {
      if (!alive) return x.close();
      s = x;
      shown.current = x.outbox?.n ?? -1;
      setSession(x);
      if (incoming) {
        const why = await x.receive(incoming);
        setNote(why ? { ok: false, text: why } : { ok: true, text: `Opened ${x.rivalName}'s packet.` });
        try {
          history.replaceState(history.state, '', `#/play/corr/${id}/${x.role}`);
        } catch {
          /* history unavailable */
        }
      }
    });
    return () => {
      alive = false;
      s?.close();
    };
  }, [id, role, incoming, store]);

  // a packet of yours was just made (after your move): show it to send
  const out = session?.outbox;
  const mine = session && out && session.g.head?.f === (session.role === 'host' ? 'h' : 'g') && out.n === session.g.head.n;
  useEffect(() => {
    if (!session || !out || !mine || session.g.stage === 'invited' || session.g.stage === 'joined') return;
    if (out.n > shown.current) {
      shown.current = out.n;
      setSending(true);
    }
  }, [session, out, mine, v]);

  const board = session?.board ?? null;
  const run: BoardRun | null = useMemo(
    () =>
      session && board
        ? { match: session.match, g: board, human: session.seat, grades: NO_GRADES, replay: DUMMY_REPLAY, error: session.g.problem, cancelled: false, conceded: !!session.over?.conceded, stable: null }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the session changes in place; `v` says when
    [session, board, v],
  );
  const onSeen = useCallback((open: boolean) => session?.setChatSeen(open), [session]);

  if (missing) return <Blocked why="This game is not in this browser (it was deleted, or it is kept on another device)." />;
  if (!session) return <p className="muted">Opening the game…</p>;
  const g = session.g;
  const rival = session.rivalName;
  const receive = (text: string) => session.receive(text);

  if (g.stage === 'invited' || g.stage === 'joined' || g.stage === 'refused' || !run) {
    return (
      <div className="grid online-lobby" style={{ maxWidth: 760 }}>
        <h1>Multi-day game vs a person</h1>
        <p className="muted">
          <a href="#/play">← Play</a>
        </p>
        <div className="panel grid">
          <span>
            You: <b>{g.me}</b> with <b>{g.myDeck.name}</b> · {g.days}-day game
          </span>
          {g.stage === 'refused' && <p className="online-error">{g.problem}</p>}
          {g.stage === 'invited' && g.outbox && (
            <>
              <p>
                <b>Step 1.</b> Send this invite to the other player.
              </p>
              <PacketBox code={g.outbox.code} rival="the other player" what="invite" />
              <p>
                <b>Step 2.</b> Open the reply they send back.
              </p>
              <PacketInput label="Their reply" onOpen={receive} busy={session.busy} />
            </>
          )}
          {g.stage === 'joined' && g.outbox && (
            <>
              <p>
                <b>Send this reply to {rival}.</b> Their first packet starts the game: open it here (or just open its link).
              </p>
              <PacketBox code={g.outbox.code} rival={rival} what="reply" />
              <PacketInput label={`${rival}'s first packet`} onOpen={receive} busy={session.busy} />
            </>
          )}
          {g.stage === 'playing' && !run && <p className="muted">Waiting for the first board…</p>}
          {note && <p className={note.ok ? 'small' : 'small online-error'}>{note.text}</p>}
          <TrustNotes />
        </div>
      </div>
    );
  }

  const c = clockState(g, now);
  const yourMove = !!session.seat.pending;
  const reaction = g.role === 'host' && g.summary.reaction;
  const status = (
    <div className={`online-status ${c.late ? 'is-lost' : ''}`} role="status">
      <span>{session.over ? 'Game over' : yourMove ? 'Your move' : reaction ? `Waiting for ${rival}'s reaction (a round trip)` : session.busy ? 'Working…' : `Waiting for ${rival}`}</span>
      {!session.over && (
        <span className="online-timer">
          You {spanText(c.mine)} · {rival} {spanText(c.theirs)}
        </span>
      )}
      {!session.over && !yourMove && out && mine && (
        <button type="button" className="ghost" onClick={() => setSending(true)}>
          Send move again
        </button>
      )}
      {!session.over && (
        <button type="button" className="ghost" onClick={() => setOpening(true)}>
          Open {rival}'s packet
        </button>
      )}
      {session.over && g.role === 'guest' && !g.end?.replay && (
        <button type="button" className="ghost" onClick={() => setOpening(true)}>
          Open the host's last packet
        </button>
      )}
      {c.canClaim && (
        <span className="row">
          <button type="button" className="ghost" onClick={() => void session.claimWin()}>
            Claim win on time
          </button>
          <button type="button" className="ghost" onClick={() => session.giveTime(DAY_MS)}>
            Give 1 more day
          </button>
        </span>
      )}
      {note && <span className={note.ok ? '' : 'online-error'}>{note.text}</span>}
    </div>
  );
  const online: OnlineBoard = {
    rivalName: rival,
    canConcede: session.canConcede(),
    status,
    ...(site.features.chat
      ? {
          chat: {
            node: <ChatPanel chat={session.chat} rival={rival} onSend={(t) => session.sendChat(t)} onMute={(on) => session.setMuted(on)} v={v} />,
            unread: session.chat.unread,
            onSeen,
          },
        }
      : {}),
    rematchLabel: 'New game vs a person',
    rematchDisabled: false,
    overNote: (
      <p className="small muted">
        {session.reviewReplay() ? 'Recorded in your Profile under "vs players" (multi-day).' : `Recorded in your Profile. The Game review needs the full record from ${rival}'s last packet: open it when it arrives.`}
        {out && mine ? ` Send ${rival} your last packet so their device records the end too.` : ''}
      </p>
    ),
    review: () => {
      const r = session.reviewReplay();
      return r ? { replay: r, coach: [], persist: true, turns: board?.s.turn } : null;
    },
    exportGame: () => {
      const r = session.reviewReplay();
      if (!r) return;
      const file = { kind: 'nct-online-game', schema: 1, exported: new Date().toISOString(), replay: r, chat: session.chat.lines };
      download(`multiday-${r.decks[0].name}-vs-${r.decks[1].name}.json`.replace(/[^A-Za-z0-9._-]+/g, '-'), JSON.stringify(file, null, 1), 'application/json');
    },
    exitNote: 'You leave the game for now. It stays in Ongoing games on the Play screen; nothing is sent and nothing is recorded.',
    ...(g.role === 'guest' && g.auto ? { autoPay: true } : {}),
  };
  return (
    <>
      <Board
        key={session.match}
        session={session}
        game={run}
        coach={false}
        speed={0}
        setSpeed={() => undefined}
        onQuit={() => go('#/play')}
        onConcede={() => void session.concede()}
        onRematch={() => go('#/play/corr')}
        onUndo={() => undefined}
        canSave={false}
        canReview={site.features.gameReview}
        online={online}
      />
      {sending && out && (
        <Modal label="Send your move" onClose={() => setSending(false)} className="online-reconnect corr-send">
          <h3 style={{ marginTop: 0 }}>{session.over ? `Send ${rival} the last packet` : `Send this packet to ${rival}`}</h3>
          <p className="small muted">
            {session.over
              ? 'It tells their device how the game ended and carries the full record for their Game review.'
              : g.role === 'host'
                ? `The game now waits for ${rival}${reaction ? "'s reaction: each reaction or block costs a round trip" : ''}. Nothing else is needed from you until their packet comes back.`
                : `Only the host's device knows the hidden cards, so each of your decisions goes to ${rival} and back.`}
          </p>
          <PacketBox code={out.code} rival={rival} what="move" />
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => setSending(false)}>Done</button>
          </div>
        </Modal>
      )}
      {opening && (
        <Modal label={`Open ${rival}'s packet`} onClose={() => setOpening(false)} className="online-reconnect corr-open">
          <h3 style={{ marginTop: 0 }}>Open {rival}'s packet</h3>
          <PacketInput
            label="Their link, code or file"
            busy={session.busy}
            onOpen={async (t) => {
              const why = await receive(t);
              if (!why) {
                setOpening(false);
                setNote({ ok: true, text: `Opened ${rival}'s packet.` });
              }
              return why;
            }}
          />
        </Modal>
      )}
    </>
  );
}

export type { CorrGame };
