// Play online (#/play/online, #/play/join/<invite>): the lobby and the board of a game against another person
// (src/net/). Loaded only when opened. Connecting: the host makes an invite (a link or a code), the guest opens it and
// sends back a reply code, the host pastes it, and the browsers talk directly (WebRTC). "Two tabs on this device" does
// the same between two tabs of this browser without any network. The board is the Play board with the rival seat
// played by the other person; the side panel gets a Chat tab.
import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { loadProfile } from '../../lib/profile';
import { download } from '../../lib/download';
import type { PracticeReplay } from '../../lib/practiceReplays';
import { gameDeck } from '../../lib/tournament';
import { TURN_TIMERS } from '../../lib/siteConfig';
import { OnlineGuest, OnlineHost, NAME_MAX, type OnlineSessionAny } from '../../net/session';
import { BroadcastTransport, newRoomCode } from '../../net/transport';
import { guestAnswer, hostOffer, MAX_LINK_CODE, webrtcAvailable } from '../../net/webrtc';
import { DeckPicker, findDeck, firstVisibleDeck } from '../components/DeckPicker';
import { Modal } from '../components/Modal';
import { ChatPanel } from '../components/board/ChatPanel';
import { SettingsDialog } from '../components/board/SettingsDialog';
import { useBoardSettings } from '../useBoardSettings';
import { useSiteConfig } from '../useSiteConfig';
import { Board, type BoardRun, type OnlineBoard } from './Play';

type Role = 'host' | 'guest';
type Via = 'net' | 'tabs';

const NAME_KEY = 'nct.online.name.v1';
const ROOM_KEY = 'nct.online.room.v1';
const LOCAL_PREFIX = 'local-';

const kv = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage blocked */
    }
  },
};

/** The page's own address with a hash route (works from any GitHub Pages sub-path). */
const pageLink = (hash: string) => `${location.origin}${location.pathname}${location.search}${hash}`;

/** The plain-words notes every lobby shows. */
function LobbyNotes({ ice, tabs }: { ice: readonly string[]; tabs?: boolean }) {
  return (
    <div className="small muted online-notes">
      <p>
        {tabs
          ? 'Two tabs on this device talk inside this browser only: nothing goes over the network. Over the internet, connecting shares your network address with the other player and with a STUN service.'
          : ice.length
          ? 'Connecting shares your network address with the other player and with the STUN service this site uses to find it (' + ice.map((s) => s.replace(/^stuns?:/, '')).join(', ') + ').'
          : 'Connecting shares your network address with the other player; this site uses no STUN service, so it only connects players on the same network.'}
      </p>
      <p>The host's browser runs the game, so this is for friendly play. A modified host could see hidden cards.</p>
    </div>
  );
}

/** A code with Copy and (where the device offers it) Share. */
function CodeBox({ label, code, link }: { label: string; code: string; link?: string | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  const id = useId();
  const copy = (what: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => setCopied(what),
      () => setCopied('Copy failed: select the text and copy it'),
    );
  };
  const share = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const text = link ?? code;
  return (
    <div className="online-code">
      <label htmlFor={id} className="small muted">
        {label}
      </label>
      <textarea id={id} readOnly value={text} rows={3} onFocus={(e) => e.currentTarget.select()} />
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
          <button type="button" onClick={() => void navigator.share({ title: 'Night City Trainer', text: link ? 'Join my game' : 'My code', ...(link ? { url: link } : { text: code }) }).catch(() => undefined)}>
            Share…
          </button>
        )}
        {copied && (
          <span className="small muted" role="status">
            {copied}
          </span>
        )}
      </div>
    </div>
  );
}

/** The invite exchange over WebRTC (host: make an invite, take the reply; guest: take the invite, make the reply). */
function NetExchange({ role, session, ice, invite, onCancel }: { role: Role; session: OnlineSessionAny; ice: readonly string[]; invite?: string | null; onCancel?: () => void }) {
  const [step, setStep] = useState<{ k: 'idle' } | { k: 'busy' } | { k: 'invite'; code: string; accept: (r: string) => Promise<string | null> } | { k: 'reply'; code: string } | { k: 'sent' }>({ k: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState(invite && !invite.startsWith(LOCAL_PREFIX) ? invite : '');
  const id = useId();
  const makeInvite = async () => {
    setStep({ k: 'busy' });
    setError(null);
    try {
      const o = await hostOffer(ice);
      session.attach(o.transport);
      setStep({ k: 'invite', code: o.code, accept: o.accept });
    } catch (e) {
      setError(`Could not make an invite: ${(e as Error).message}`);
      setStep({ k: 'idle' });
    }
  };
  const makeReply = async () => {
    setStep({ k: 'busy' });
    setError(null);
    try {
      const r = await guestAnswer(paste, ice);
      if ('error' in r) {
        setError(r.error);
        setStep({ k: 'idle' });
        return;
      }
      session.attach(r.transport);
      setStep({ k: 'reply', code: r.code });
    } catch (e) {
      setError(`Could not make a reply: ${(e as Error).message}`);
      setStep({ k: 'idle' });
    }
  };
  if (!webrtcAvailable()) return <p className="muted">This browser can't make direct connections (WebRTC). Use "Two tabs on this device", or another browser.</p>;
  return (
    <div className="grid online-exchange">
      {role === 'host' ? (
        <>
          {step.k === 'idle' && (
            <div className="row">
              <button type="button" className="primary" onClick={() => void makeInvite()}>
                Create invite
              </button>
              {onCancel && <button onClick={onCancel}>Cancel</button>}
            </div>
          )}
          {step.k === 'busy' && <p className="muted">Making the invite (finding your network address)…</p>}
          {step.k === 'invite' && (
            <>
              <p>
                <b>Step 1.</b> Send this invite to the other player (any messenger). {step.code.length <= MAX_LINK_CODE ? 'The link opens the game for them.' : 'It is too long for a link here, so send the code: they open Play → Join a game and paste it.'}
              </p>
              <CodeBox label="Invite" code={step.code} link={step.code.length <= MAX_LINK_CODE ? pageLink(`#/play/join/${step.code}`) : null} />
              <p>
                <b>Step 2.</b> Paste the reply code they send back.
              </p>
              <form
                className="grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  void step.accept(paste).then((why) => {
                    setError(why);
                    if (!why) setStep({ k: 'sent' });
                  });
                }}
              >
                <label htmlFor={id} className="sr-only">
                  Reply code
                </label>
                <textarea id={id} rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the reply code here" />
                <div className="row">
                  <button type="submit" className="primary" disabled={!paste.trim()}>
                    Connect
                  </button>
                  {onCancel && (
                    <button type="button" onClick={onCancel}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
          {step.k === 'sent' && <p className="muted">Connecting…</p>}
        </>
      ) : (
        <>
          {step.k === 'idle' && (
            <form
              className="grid"
              onSubmit={(e) => {
                e.preventDefault();
                void makeReply();
              }}
            >
              <label htmlFor={id}>Invite link or code from the host</label>
              <textarea id={id} rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the invite here" />
              <div className="row">
                <button type="submit" className="primary" disabled={!paste.trim()}>
                  Make my reply code
                </button>
                {onCancel && (
                  <button type="button" onClick={onCancel}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
          {step.k === 'busy' && <p className="muted">Making your reply (finding your network address)…</p>}
          {step.k === 'reply' && (
            <>
              <p>
                <b>Send this reply code back to the host.</b> The game connects as soon as they paste it.
              </p>
              <CodeBox label="Reply code" code={step.code} />
            </>
          )}
        </>
      )}
      {error && (
        <p className="online-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** "Two tabs on this device": a room over BroadcastChannel. */
function joinRoom(session: OnlineSessionAny, room: string) {
  session.attach(new BroadcastTransport(room));
}

function useSession(s: OnlineSessionAny | null): number {
  const sub = useCallback((fn: () => void) => (s ? s.subscribe(fn) : () => undefined), [s]);
  const snap = () => s?.version ?? -1;
  return useSyncExternalStore(sub, snap, snap);
}

/** Seconds left on the turn timer, ticking. */
function Countdown({ at }: { at: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [at]);
  const s = Math.max(0, Math.ceil((at - now) / 1000));
  return <span className={`online-timer ${s <= 10 ? 'low' : ''}`}>⏱ {s} s</span>;
}

/** The thin bar under the board's turn strip: whose turn, the timer, and the connection. */
function OnlineStatus({ session, onReconnect }: { session: OnlineSessionAny; onReconnect: () => void }) {
  const rival = session.rivalName ?? 'the other player';
  const conn = session.conn;
  const waiting = session.over ? null : session.waiting === 0 ? 'Your decision' : session.waiting === 1 ? `Waiting for ${rival}…` : null;
  return (
    <div className={`online-status ${conn === 'lost' || conn === 'idle' ? 'is-lost' : ''}`} role="status">
      {conn === 'open' ? <span>Connected to {rival}</span> : conn === 'connecting' ? <span>Connecting…</span> : <span>{conn === 'idle' ? `Not connected to ${rival} yet` : 'Connection lost, trying again…'}</span>}
      {waiting && <span>{waiting}</span>}
      {session.deadlineAt !== null && !session.over && <Countdown at={session.deadlineAt} />}
      {(conn === 'lost' || conn === 'idle') && !session.over && (
        <span className="row">
          <button type="button" className="ghost" onClick={onReconnect}>
            {session.role === 'host' ? 'New invite' : 'Paste a new invite'}
          </button>
          <button type="button" className="ghost" onClick={() => session.giveUp()} title="End the game as abandoned (recorded as a draw)">
            End the game
          </button>
        </span>
      )}
    </div>
  );
}

const NO_GRADES: never[] = [];

export function PlayOnline({ invite, mode, initialDeck }: { invite: string | null; mode: 'host' | 'join'; initialDeck?: string }) {
  const site = useSiteConfig();
  const ice = site.multiplayer.iceServers;
  const chatOn = site.features.chat;
  const [role, setRole] = useState<Role>(invite || mode === 'join' ? 'guest' : 'host');
  const [via, setVia] = useState<Via>(invite?.startsWith(LOCAL_PREFIX) ? 'tabs' : 'net');
  const [name, setName] = useState(() => kv.get(NAME_KEY) ?? loadProfile().name ?? '');
  const [deckKey, setDeckKey] = useState(() => findDeck(initialDeck)?.file ?? firstVisibleDeck()?.file ?? '');
  const [timer, setTimer] = useState<number>(site.multiplayer.turnTimer);
  const [roomIn, setRoomIn] = useState(invite?.startsWith(LOCAL_PREFIX) ? invite.slice(LOCAL_PREFIX.length) : '');
  const [session, setSession] = useState<OnlineSessionAny | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [saved, setSaved] = useState(() => OnlineHost.saved());
  const [problem, setProblem] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, updateSettings, resetSettings] = useBoardSettings();
  const v = useSession(session);
  const deck = findDeck(deckKey);

  // leaving the page: the host keeps its save (a reload brings the game back); the link closes
  useEffect(() => {
    if (!session) return;
    const flush = () => {
      if (session instanceof OnlineHost) session.flush();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      if (session instanceof OnlineHost) session.quit();
      else session.close();
    };
  }, [session]);

  const start = (r: Role) => {
    if (!deck) return;
    const n = name.trim().slice(0, NAME_MAX);
    kv.set(NAME_KEY, n);
    const o = { name: n || (r === 'host' ? 'Host' : 'Guest'), deck: gameDeck(deck.deck), timer };
    const s = r === 'host' ? new OnlineHost(o) : new OnlineGuest(o);
    setSession(s);
    setProblem(null);
    if (via === 'tabs') {
      const code = r === 'host' ? newRoomCode() : roomIn.trim().replace(new RegExp(`^${LOCAL_PREFIX}`), '');
      if (!/^[a-z0-9]{4,16}$/.test(code)) {
        setProblem('That is not a room code (letters and digits from the host’s link).');
        s.close();
        setSession(null);
        return;
      }
      if (r === 'host') kv.set(ROOM_KEY, code);
      setRoom(code);
      joinRoom(s, code);
    }
  };

  const resumeSaved = () => {
    if (!saved) return;
    void OnlineHost.restore(saved, {}).then(
      (h) => {
        setSession(h);
        setRole('host');
        const last = kv.get(ROOM_KEY);
        if (via === 'tabs' && last) {
          setRoom(last);
          joinRoom(h, last);
        } else setReconnect(true);
      },
      (e: unknown) => setProblem(`The saved game could not be brought back: ${(e as Error).message}`),
    );
  };

  const backToLobby = () => {
    if (session) session.leave();
    setSession(null);
    setRoom(null);
    setSaved(OnlineHost.saved());
    location.hash = '#/play/online';
  };

  const board = session?.board ?? null;
  const inGame = !!session && session.stage === 'game' && !!board;

  // the board's game (a view: you are player 0)
  const run: BoardRun | null = useMemo(
    () =>
      session && board
        ? {
            match: session.match,
            g: board,
            human: session.seat,
            grades: NO_GRADES,
            replay: DUMMY_REPLAY,
            error: session.error,
            cancelled: false,
            conceded: !!session.over?.conceded,
            stable: null,
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the session changes in place; `v` says when
    [session, board, v],
  );

  const onSeen = useCallback((open: boolean) => session?.setChatSeen(open), [session]);
  const online: OnlineBoard | null = session
    ? {
        rivalName: session.rivalName ?? 'Rival',
        canConcede: session.canConcede(),
        status: <OnlineStatus session={session} onReconnect={() => setReconnect(true)} />,
        ...(chatOn
          ? {
              chat: {
                node: <ChatPanel chat={session.chat} rival={session.rivalName ?? 'Rival'} onSend={(t) => session.sendChat(t)} onMute={(on) => session.setMuted(on)} v={v} />,
                unread: session.chat.unread,
                onSeen,
              },
            }
          : {}),
        rematchLabel: session.rematch.mine ? 'Rematch offered…' : session.rematch.theirs ? 'Accept the rematch' : 'Offer a rematch',
        rematchDisabled: session.rematch.mine || session.conn !== 'open',
        overNote: (
          <p className="small muted">
            {session.rematch.theirs && !session.rematch.mine ? `${session.rivalName} offers a rematch. ` : ''}
            {session.over?.abandoned ? 'Recorded as a draw (abandoned). ' : ''}
            {session.reviewReplay() ? 'Recorded in your Profile under "vs players".' : session.role === 'guest' ? 'Getting the full record from the host for the Game review…' : ''}
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
          download(`online-${r.decks[0].name}-vs-${r.decks[1].name}.json`.replace(/[^A-Za-z0-9._-]+/g, '-'), JSON.stringify(file, null, 1), 'application/json');
        },
      }
    : null;

  if (inGame && run && online && session) {
    return (
      <>
        <Board
          key={session.match}
          session={session}
          game={run}
          coach={false}
          speed={0}
          setSpeed={() => undefined}
          onQuit={backToLobby}
          onConcede={() => session.concede()}
          onRematch={() => session.offerRematch()}
          onUndo={() => undefined}
          canSave={false}
          canReview={site.features.gameReview}
          online={online}
        />
        {reconnect && (
          <Modal label="Reconnect" onClose={() => setReconnect(false)} className="online-reconnect">
            <h3 style={{ marginTop: 0 }}>Reconnect to {session.rivalName}</h3>
            {room ? (
              <p className="muted">Two tabs on this device: the other tab reconnects by itself when it is open on the room link.</p>
            ) : (
              <NetExchange role={session.role} session={session} ice={ice} onCancel={() => setReconnect(false)} />
            )}
            <div className="row">
              <button onClick={() => setReconnect(false)}>Close</button>
            </div>
          </Modal>
        )}
        {reconnect && session.conn === 'open' && <AutoClose onClose={() => setReconnect(false)} />}
      </>
    );
  }

  // ---------------------------------------------------------------- the lobby
  return (
    <div className="grid online-lobby" style={{ maxWidth: 760 }}>
      <h1>Play online</h1>
      <p className="muted">
        <a href="#/play">← Play vs Bot</a>
      </p>
      {!session && (
        <div className="panel grid">
          <div className="row" role="radiogroup" aria-label="Host or join">
            <label>
              <input type="radio" name="online-role" checked={role === 'host'} onChange={() => setRole('host')} /> Host a game
            </label>
            <label>
              <input type="radio" name="online-role" checked={role === 'guest'} onChange={() => setRole('guest')} /> Join a game
            </label>
          </div>
          <div className="row" role="radiogroup" aria-label="How to connect">
            <label>
              <input type="radio" name="online-via" checked={via === 'net'} onChange={() => setVia('net')} /> Over the internet (invite codes)
            </label>
            <label>
              <input type="radio" name="online-via" checked={via === 'tabs'} onChange={() => setVia('tabs')} /> Two tabs on this device
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
              <span className="muted small">Turn timer</span>
              <select value={timer} onChange={(e) => setTimer(+e.target.value)}>
                {TURN_TIMERS.map((t) => (
                  <option key={t} value={t}>
                    {t ? `${t} seconds per decision` : 'Off'}
                  </option>
                ))}
              </select>
            </label>
          )}
          {role === 'guest' && via === 'tabs' && (
            <label className="row">
              <span className="muted small">Room code</span>
              <input type="text" value={roomIn} onChange={(e) => setRoomIn(e.target.value)} placeholder="From the host's tab" />
            </label>
          )}
          <div className="row">
            <button className="primary" disabled={!deck} onClick={() => start(role)}>
              {role === 'host' ? 'Host the game' : via === 'tabs' ? 'Join the room' : 'Continue'}
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)}>
              ⚙ Board settings
            </button>
          </div>
          {saved && role === 'host' && (
            <div className="online-saved">
              <span>
                Your game with <b>{saved.setup.names[1]}</b> ({saved.setup.decks[0].name} vs {saved.setup.decks[1].name}) can be brought back.
              </span>
              <div className="row">
                <button className="primary" onClick={resumeSaved}>
                  Resume it
                </button>
                <button
                  onClick={() => {
                    OnlineHost.clearSaved();
                    setSaved(null);
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
          {problem && (
            <p className="online-error" role="alert">
              {problem}
            </p>
          )}
          <LobbyNotes ice={ice} tabs={via === 'tabs' || !!room} />
        </div>
      )}

      {session && (
        <div className="panel grid">
          <div className="spread">
            <span>
              You: <b>{session.name}</b> with <b>{session.deck.name}</b>
            </span>
            <button onClick={backToLobby}>Cancel</button>
          </div>
          {session.stage === 'refused' && (
            <p className="online-error" role="alert">
              The host could not take you: {session.problem}
            </p>
          )}
          {session.rivalName && (
            <p>
              Playing <b>{session.rivalName}</b> ({session.rivalDeck}). {session.timer ? `Turn timer: ${session.timer} s per decision.` : 'No turn timer.'}
            </p>
          )}
          {session.stage === 'waiting' && !room && session.conn !== 'open' && <NetExchange role={session.role} session={session} ice={ice} invite={invite} />}
          {session.stage === 'waiting' && room && session.role === 'host' && (
            <>
              <p>Open this link in another tab of this browser (it joins room {room}):</p>
              <CodeBox label="Room link" code={`${LOCAL_PREFIX}${room}`} link={pageLink(`#/play/join/${LOCAL_PREFIX}${room}`)} />
              <p>
                <a href={pageLink(`#/play/join/${LOCAL_PREFIX}${room}`)} target="_blank" rel="noopener noreferrer">
                  Open it in a new tab →
                </a>
              </p>
            </>
          )}
          {session.stage === 'waiting' && (session.conn === 'open' || (room && session.role === 'guest')) && (
            <p className="muted">{session.role === 'host' ? 'Connected. Waiting for the other player…' : 'Waiting for the host…'}</p>
          )}
          {session.stage === 'roll' && <p className="muted">Rolling for who picks first or second…</p>}
          {session.stage === 'choose' && session.chooser === 'me' && (
            <div className="grid">
              <p>The roll chose you: go first or second?</p>
              <div className="row">
                <button className="primary" onClick={() => session.chooseFirst(true)}>
                  Go first
                </button>
                <button onClick={() => session.chooseFirst(false)}>Go second</button>
              </div>
            </div>
          )}
          {session.stage === 'choose' && session.chooser !== 'me' && <p className="muted">The roll chose {session.rivalName}: waiting for them to pick first or second…</p>}
          {session.stage === 'game' && !board && <p className="muted">Starting the game…</p>}
          {session.problem && session.stage !== 'refused' && (
            <p className="online-error" role="alert">
              {session.problem}
            </p>
          )}
          {session.conn === 'lost' && <p className="online-error">The connection was lost.</p>}
          <LobbyNotes ice={ice} tabs={via === 'tabs' || !!room} />
        </div>
      )}
      {settingsOpen &&
        createPortal(
          <SettingsDialog settings={settings} onChange={updateSettings} onReset={resetSettings} speed={0} onClose={() => setSettingsOpen(false)} />,
          document.body,
        )}
    </div>
  );
}

function AutoClose({ onClose }: { onClose: () => void }) {
  useEffect(() => onClose(), [onClose]);
  return null;
}

const DUMMY_REPLAY: PracticeReplay = { id: '', date: '', decks: [{ name: '', legends: [], main: [], sideboard: [] }, { name: '', legends: [], main: [], sideboard: [] }], seed: 0, botLevel: 'pvp', botSeed: 0, choices: [], result: 'draw' };
