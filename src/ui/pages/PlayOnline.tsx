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
import { TURN_TIMERS, type SiteConfig } from '../../lib/siteConfig';
import { OnlineGuest, OnlineHost, NAME_MAX, type OnlineSessionAny } from '../../net/session';
import { BroadcastTransport, newRoomCode } from '../../net/transport';
import { newPassphrase, phraseProblem } from '../../net/codeLock';
import { lockRelayInvite, newRelayInvite, openRelayInvite, relaySecret, RelayTransport, type RelayStatus } from '../../net/relayTransport';
import { privateAvailable, turnServersFor } from '../../net/turn';
import { describeText, guestAnswer, hostOffer, inviteMode, inviteProblem, isLockedCode, MAX_LINK_CODE, NEWER_CODE, webrtcAvailable, type SignalInfo } from '../../net/webrtc';
import { DeckPicker, findDeck, firstVisibleDeck } from '../components/DeckPicker';
import { Modal } from '../components/Modal';
import { ChatPanel } from '../components/board/ChatPanel';
import { SettingsDialog } from '../components/board/SettingsDialog';
import { useBoardSettings } from '../useBoardSettings';
import { useSiteConfig } from '../useSiteConfig';
import { Board, type BoardRun, type OnlineBoard } from './Play';

type Role = 'host' | 'guest';
type Via = 'net' | 'tabs';
/** How a host's game goes over the internet: the relay server's room, a private (TURN relay only) link, or direct. */
export type NetMode = 'relay' | 'private' | 'direct';

const NAME_KEY = 'nct.online.name.v1';
const ROOM_KEY = 'nct.online.room.v1';
/** the host's last relay invite (a reload of a saved game rejoins the same room, where the guest is still waiting) */
const RELAY_KEY = 'nct.online.relay.v1';
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

/** What a direct connection shares, in plain words (shown before any code is made, and under the lobby). */
export function addressNote(ice: readonly string[], tabs = false): string {
  if (tabs) return 'Two tabs on this device talk inside this browser only: nothing goes over the network. Over the internet, a direct connection shares your internet address with the other player and with a STUN service.';
  if (!ice.length)
    return 'A direct connection shares your address on the local network with the other player, and the invite and reply codes carry it too unless they are locked with a phrase. This site uses no STUN service, so it only connects players on the same network.';
  const stun = ice.map((s) => s.replace(/^stuns?:/, '')).join(', ');
  return `A direct connection shares your internet address (IP) with the other player, and with the STUN service this site uses to find it (${stun}) when you make a code. The invite and reply codes carry your address too unless they are locked with a phrase: send codes only in a private message, never in a public channel.`;
}
export const NO_ADDRESS_NOTE = 'To play without sharing any address, play a multi-day game: its turn packets carry no network address, and the site contacts no one.';
export const TRUST_NOTE = "The host's browser runs the game, so this is for friendly play. A modified host could see hidden cards.";
export const DECK_NOTE = "The other player's board shows only your deck's name; the host's device holds both lists to run the game.";
/** The connection choices (the host's lobby), each with what it shares. */
export const RELAY_LABEL = 'Through the relay server';
const RELAY_WHAT =
  "neither player sees the other's address. The invite is a room on the relay with nothing to send back. The relay's operator sees both players' addresses and when you play, but not the game: it is encrypted end to end.";
export const RELAY_NOTE = `Through the relay server: ${RELAY_WHAT}`;
export const PRIVATE_LABEL = 'Private connection (through a TURN relay)';
const PRIVATE_WHAT =
  "the other player sees only the relay's address, never yours, and so does anyone who reads your codes. The relay's operator sees both players' addresses (not the game: the link is encrypted).";
export const PRIVATE_NOTE = `Private connection: ${PRIVATE_WHAT}`;
export const PRIVATE_UNAVAILABLE = 'Unavailable: this site has no relay server set up, so a private connection can’t be made (and the site never switches to a direct one by itself).';
export const DIRECT_LABEL = 'Direct connection';
export const DIRECT_CONSEQUENCE = 'The other player sees your internet address (IP), and so does anyone who reads an unlocked code.';
export const GUEST_MODES_NOTE = 'How you connect follows the host’s invite: a relay or private invite keeps your address from the host; a direct one shares it, and you are asked first.';
export const RELAY_BACK = 'Through the relay: the link comes back by itself once you are both online again (it keeps trying), and the game picks up where it was. If the other page was closed, send a new invite.';
export const RELAY_NOT_HERE = 'This invite is for the relay server, but this copy of the site has no relay set up. Check that you both use the same site.';

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** The connections this site offers a host, and the one picked at first (the most private one available). */
export function netModes(mp: Pick<SiteConfig['multiplayer'], 'relayUrl' | 'turnServers' | 'turnCredentialsUrl'>): { relay: boolean; private: boolean; initial: NetMode } {
  const relay = !!mp.relayUrl;
  const priv = privateAvailable(mp);
  return { relay, private: priv, initial: relay ? 'relay' : priv ? 'private' : 'direct' };
}

/** The host's choice of connection (shown for "Over the internet"). */
function ConnectionChoice({ mode, setMode, corr }: { mode: NetMode; setMode: (m: NetMode) => void; corr: boolean }) {
  const site = useSiteConfig();
  const m = netModes(site.multiplayer);
  return (
    <div className="grid online-modes" role="radiogroup" aria-label="Connection">
      {m.relay && (
        <label className="online-check">
          <input type="radio" name="online-mode" checked={mode === 'relay'} onChange={() => setMode('relay')} />
          <span>
            {RELAY_LABEL} <span className="small muted">— {cap(RELAY_WHAT)}</span>
          </span>
        </label>
      )}
      <label className="online-check">
        <input type="radio" name="online-mode" checked={mode === 'private'} disabled={!m.private} onChange={() => setMode('private')} />
        <span>
          {PRIVATE_LABEL}{' '}
          {m.private ? (
            <span className="small muted">— {cap(PRIVATE_WHAT)}</span>
          ) : (
            <span className="small muted">
              — {PRIVATE_UNAVAILABLE}{' '}
              {corr ? (
                <>
                  To play without sharing any address, play a <a href="#/play/corr">multi-day game</a>.
                </>
              ) : null}
            </span>
          )}
        </span>
      </label>
      <label className="online-check">
        <input type="radio" name="online-mode" checked={mode === 'direct'} onChange={() => setMode('direct')} />
        <span>
          {DIRECT_LABEL}
          {(m.relay || m.private) && <span className="small muted"> — {DIRECT_CONSEQUENCE}</span>}
        </span>
      </label>
    </div>
  );
}

/** The plain-words notes every lobby shows. */
function LobbyNotes({ ice, tabs, corr, mode, guest }: { ice: readonly string[]; tabs?: boolean; corr?: boolean; mode?: NetMode; guest?: boolean }) {
  return (
    <div className="small muted online-notes">
      <p>{tabs || !mode || mode === 'direct' ? addressNote(ice, tabs) : mode === 'relay' ? RELAY_NOTE : PRIVATE_NOTE}</p>
      {guest && !tabs && <p>{GUEST_MODES_NOTE}</p>}
      {corr && (
        <p>
          To play without sharing any address, play a <a href="#/play/corr">multi-day game</a>: its turn packets carry no network address, and the site contacts no one.
        </p>
      )}
      <p>{TRUST_NOTE}</p>
    </div>
  );
}

/** The phrase that opens a locked code, to copy and send by another route. */
function PhraseBox({ phrase }: { phrase: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const id = useId();
  return (
    <div className="online-code online-phrase">
      <label htmlFor={id} className="small muted">
        The phrase that opens it
      </label>
      <div className="online-phrase-row">
        <input id={id} type="text" readOnly value={phrase} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard?.writeText(phrase).then(
              () => setCopied('Phrase copied'),
              () => setCopied('Copy failed: select the text and copy it'),
            )
          }
        >
          Copy phrase
        </button>
        {copied && (
          <span className="small muted" role="status">
            {copied}
          </span>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Send the phrase separately from the link (another app, or say it). If the link goes anywhere public, the phrase must not: anyone with both can read the code.
      </p>
    </div>
  );
}

/** A code with Copy and (where the device offers it) Share, and a line on what it shows. */
function CodeBox({ label, code, link, note }: { label: string; code: string; link?: string | null; note?: string }) {
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
      {note && (
        <p className="small muted online-code-note" style={{ margin: 0 }}>
          {note}
        </p>
      )}
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

/** Where the relay link is, in a line. */
function RelayLine({ status, onRetry }: { status: RelayStatus | null; onRetry?: () => void }) {
  if (!status) return null;
  const text =
    status.k === 'connecting'
      ? 'Connecting to the relay…'
      : status.k === 'waiting'
        ? 'In the room: waiting for the other player…'
        : status.k === 'open'
          ? 'Connected through the relay.'
          : status.k === 'retrying'
            ? `Lost the relay (${status.why}); trying again in ${Math.ceil(status.inMs / 1000)} s.`
            : status.why;
  return (
    <p className={`small ${status.k === 'stopped' ? 'online-error' : 'muted'}`} role="status">
      {text}{' '}
      {status.k === 'retrying' && onRetry && (
        <button type="button" className="ghost" onClick={onRetry}>
          Try now
        </button>
      )}
    </p>
  );
}

/** The guest's line on what the pasted invite asks for (shown when the site offers more than a direct connection). */
export function inviteModeNote(mode: ReturnType<typeof inviteMode>): string | null {
  switch (mode) {
    case 'relay':
      return 'This invite is through the relay server: the host never sees your address (the relay’s operator does).';
    case 'private':
      return 'This is a private invite: your reply names only the relay, never your address.';
    case 'direct':
      return 'This is a direct invite: your reply carries your internet address, and the host will see it.';
    case 'newer':
      return NEWER_CODE;
    default:
      return null;
  }
}

/**
 * The invite exchange (host: make an invite, take the reply; guest: take the invite, make the reply). `mode` is the
 * host's choice: a direct or private (TURN relay only) WebRTC link with invite and reply codes, or the relay server's
 * room (an invite only). The guest follows whatever the invite asks for.
 */
function NetExchange({
  role,
  session,
  ice,
  mode,
  invite,
  onCancel,
  onRelay,
}: {
  role: Role;
  session: OnlineSessionAny;
  ice: readonly string[];
  mode: NetMode;
  invite?: string | null;
  onCancel?: () => void;
  onRelay?: (t: RelayTransport, invite: string) => void;
}) {
  const site = useSiteConfig();
  const mp = site.multiplayer;
  const choices = !!mp.relayUrl || privateAvailable(mp);
  const [step, setStep] = useState<
    | { k: 'idle' }
    | { k: 'busy' }
    | { k: 'invite'; code: string; info: SignalInfo; phrase: string | null; accept: (r: string) => Promise<string | null> }
    | { k: 'reply'; code: string; info: SignalInfo }
    | { k: 'sent' }
    | { k: 'relay'; code: string; phrase: string | null }
    | { k: 'joined' }
  >({ k: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paste, setPaste] = useState(invite && !invite.startsWith(LOCAL_PREFIX) ? invite : '');
  const [lock, setLock] = useState(mp.lockCodes);
  const [phrase, setPhrase] = useState(newPassphrase);
  const [theirPhrase, setTheirPhrase] = useState('');
  const [noV6, setNoV6] = useState(false);
  const [direct, setDirect] = useState(false);
  const [relayStatus, setRelayStatus] = useState<RelayStatus | null>(null);
  const [relayLink, setRelayLink] = useState<RelayTransport | null>(null);
  const id = useId();
  const weak = lock ? phraseProblem(phrase) : null;
  const lockedInvite = role === 'guest' && isLockedCode(paste);
  const pasted = role === 'guest' && paste.trim() ? inviteMode(paste) : null;
  const relayFor = privateAvailable(mp)
    ? async () => {
        const c = await turnServersFor(mp);
        setNotice(c.fallback);
        return c.servers;
      }
    : null;
  const joinRelay = (inv: string, r: Role) => {
    const t = new RelayTransport({ url: mp.relayUrl, invite: inv, role: r, onStatus: setRelayStatus });
    session.attach(t);
    setRelayLink(t);
    onRelay?.(t, inv);
  };
  const makeInvite = async () => {
    if (weak) return;
    setStep({ k: 'busy' });
    setError(null);
    setNotice(null);
    try {
      if (mode === 'relay') {
        const inv = newRelayInvite();
        const code = lock ? await lockRelayInvite(inv, phrase) : inv;
        joinRelay(inv, 'host');
        setStep({ k: 'relay', code, phrase: lock ? phrase : null });
        return;
      }
      let relay = null;
      if (mode === 'private') {
        const c = await turnServersFor(mp);
        setNotice(c.fallback);
        relay = c.servers;
      }
      const o = await hostOffer({ iceServers: ice, dropIpv6: noV6, phrase: lock ? phrase : null, relay });
      session.attach(o.transport);
      setStep({ k: 'invite', code: o.code, info: o.info, phrase: lock ? phrase : null, accept: o.accept });
    } catch (e) {
      setError(`Could not make an invite: ${(e as Error).message}`);
      setStep({ k: 'idle' });
    }
  };
  const makeReply = async () => {
    setStep({ k: 'busy' });
    setError(null);
    setNotice(null);
    try {
      if (pasted === 'relay') {
        if (!mp.relayUrl) throw new Error(RELAY_NOT_HERE);
        const r = await openRelayInvite(paste, lockedInvite ? theirPhrase : null);
        if (!r.ok) {
          setError(inviteProblem(r.why));
          setStep({ k: 'idle' });
          return;
        }
        joinRelay(r.invite, 'guest');
        setStep({ k: 'joined' });
        return;
      }
      const r = await guestAnswer(paste, { iceServers: ice, dropIpv6: noV6, phrase: lockedInvite ? theirPhrase : null, relayFor, ...(choices ? { directOk: direct } : {}) });
      if ('error' in r) {
        setError(r.error);
        setStep({ k: 'idle' });
        return;
      }
      session.attach(r.transport);
      setStep({ k: 'reply', code: r.code, info: r.info });
    } catch (e) {
      setError(`Could not ${pasted === 'relay' ? 'join' : 'make a reply'}: ${(e as Error).message}`);
      setStep({ k: 'idle' });
    }
  };
  const v6 = (
    <label className="online-check">
      <input type="checkbox" checked={noV6} onChange={(e) => setNoV6(e.target.checked)} />
      <span>
        Leave out my IPv6 address <span className="small muted">(it can name the device itself; without it, a player who has only IPv6 may not be able to connect)</span>
      </span>
    </label>
  );
  if (mode !== 'relay' && pasted !== 'relay' && !webrtcAvailable()) return <p className="muted">This browser can't make direct connections (WebRTC). Use "Two tabs on this device", or another browser.</p>;
  const relayCode = mode === 'relay';
  return (
    <div className="grid online-exchange">
      {role === 'host' ? (
        <>
          {step.k === 'idle' && (
            <>
              <div className="grid online-lock">
                <label className="online-check">
                  <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
                  <span>Lock the invite with a phrase</span>
                </label>
                <p className="small muted" style={{ margin: 0 }}>
                  {relayCode
                    ? lock
                      ? 'Locked: without the phrase, nobody who sees the invite can open it or join your room. You send the phrase by another route.'
                      : 'Unlocked: the invite holds no address, but anyone who sees it could join your room before your friend. Send it only in a private message.'
                    : lock
                      ? 'Locked: without the phrase, nobody who sees the invite or the reply can read anything in them. You send the phrase by another route; their reply is locked with it too.'
                      : mode === 'private'
                        ? 'Unlocked: anyone who sees the invite or the reply can read the relay’s address in it (not yours). Send it only in a private message.'
                        : 'Unlocked: anyone who sees the invite or the reply can read your internet address in it. Send it only in a private message.'}
                </p>
                {lock && (
                  <div className="online-phrase-row">
                    <label className="online-phrase-row" style={{ flex: '1 1 18em' }}>
                      <span className="muted small">Phrase</span>
                      <input type="text" value={phrase} onChange={(e) => setPhrase(e.target.value)} maxLength={200} autoComplete="off" spellCheck={false} aria-invalid={!!weak} />
                    </label>
                    <button type="button" className="ghost" onClick={() => setPhrase(newPassphrase())}>
                      New phrase
                    </button>
                  </div>
                )}
                {weak && <p className="small online-error">{weak}</p>}
                {mode === 'direct' && v6}
              </div>
              <div className="row">
                <button type="button" className="primary" disabled={!!weak} onClick={() => void makeInvite()}>
                  {mode === 'private' ? 'Create a private invite' : mode === 'direct' && choices ? 'Create a direct invite' : 'Create invite'}
                </button>
                {onCancel && <button onClick={onCancel}>Cancel</button>}
              </div>
            </>
          )}
          {step.k === 'busy' && (
            <p className="muted">
              {relayCode ? 'Making the invite…' : `Making the invite (${lock ? 'locking it, ' : ''}${mode === 'private' ? 'reaching the relay' : 'finding your network address'})…`}
            </p>
          )}
          {step.k === 'relay' && (
            <>
              <p>
                <b>Send this invite to the other player in a private message.</b> {step.code.length <= MAX_LINK_CODE ? 'The link opens the game for them.' : 'They open Play → Join a game and paste it.'} There is nothing to send back.
              </p>
              <CodeBox
                label="Invite"
                code={step.code}
                link={step.code.length <= MAX_LINK_CODE ? pageLink(`#/play/join/${step.code}`) : null}
                note={step.phrase ? 'Locked: without the phrase, nobody can read anything in this invite.' : 'This invite shows no address: only a room on the relay and the key to it. Anyone who has it could join before your friend, so send it privately.'}
              />
              {step.phrase && <PhraseBox phrase={step.phrase} />}
              <RelayLine status={relayStatus} onRetry={() => relayLink?.retryNow()} />
              {onCancel && (
                <div className="row">
                  <button type="button" onClick={onCancel}>
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
          {step.k === 'invite' && (
            <>
              <p>
                <b>Step 1.</b> Send this invite to the other player in a private message. {step.code.length <= MAX_LINK_CODE ? 'The link opens the game for them.' : 'It is too long for a link here, so send the code: they open Play → Join a game and paste it.'}
              </p>
              <CodeBox label="Invite" code={step.code} link={step.code.length <= MAX_LINK_CODE ? pageLink(`#/play/join/${step.code}`) : null} note={describeText(step.info)} />
              {step.phrase && <PhraseBox phrase={step.phrase} />}
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
              {(choices || (pasted !== 'direct' && pasted !== null)) && inviteModeNote(pasted) && <p className="small muted">{inviteModeNote(pasted)}</p>}
              {lockedInvite && (
                <label className="grid">
                  <span>This invite is locked: type the phrase the host sent you.</span>
                  <input type="text" value={theirPhrase} onChange={(e) => setTheirPhrase(e.target.value)} maxLength={200} autoComplete="off" spellCheck={false} placeholder="four words" />
                </label>
              )}
              {choices && pasted === 'direct' && (
                <label className="online-check">
                  <input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} />
                  <span>Connect directly: the host will see my internet address</span>
                </label>
              )}
              {pasted !== 'relay' && pasted !== 'private' && v6}
              <div className="row">
                <button type="submit" className="primary" disabled={!paste.trim() || (lockedInvite && !theirPhrase.trim()) || pasted === 'newer' || (choices && pasted === 'direct' && !direct)}>
                  {pasted === 'relay' ? 'Join through the relay' : 'Make my reply code'}
                </button>
                {onCancel && (
                  <button type="button" onClick={onCancel}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
          {step.k === 'busy' && (
            <p className="muted">
              {pasted === 'relay' ? 'Joining the room…' : `Making your reply (${lockedInvite ? 'opening the invite, ' : ''}${pasted === 'private' ? 'reaching the relay' : 'finding your network address'})…`}
            </p>
          )}
          {step.k === 'joined' && <RelayLine status={relayStatus} onRetry={() => relayLink?.retryNow()} />}
          {step.k === 'reply' && (
            <>
              <p>
                <b>Send this reply code back to the host in a private message.</b> The game connects as soon as they paste it.{step.info.locked ? ' It is locked with the same phrase: there is nothing else to send.' : ''}
              </p>
              <CodeBox label="Reply code" code={step.code} note={describeText(step.info)} />
            </>
          )}
        </>
      )}
      {notice && <p className="small muted">{notice}</p>}
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
      {session.timerPaused ? <span className="online-timer">⏸ Turn timer paused while the connection is lost</span> : session.deadlineAt !== null && !session.over && <Countdown at={session.deadlineAt} />}
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
  const corrOn = site.features.multiDayGames;
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
  const modes = netModes(site.multiplayer);
  const [netMode, setNetMode] = useState<NetMode>(modes.initial);
  // a choice the config no longer offers (it was re-read) falls back to the most private one it does
  const connMode: NetMode = (netMode === 'relay' && !modes.relay) || (netMode === 'private' && !modes.private) ? modes.initial : netMode;
  const [relayLink, setRelayLink] = useState<RelayTransport | null>(null);
  const v = useSession(session);
  const deck = findDeck(deckKey);
  const onRelay = (t: RelayTransport, inv: string) => {
    setRelayLink(t);
    if (session?.role === 'host') kv.set(RELAY_KEY, inv);
  };

  // an invite read from a join link: take the code out of the address bar (and so the browser's history) at once
  useEffect(() => {
    if (!invite || invite.startsWith(LOCAL_PREFIX)) return;
    try {
      if (location.hash.startsWith('#/play/join/')) history.replaceState(history.state, '', '#/play/online?mode=join');
    } catch {
      /* history unavailable (sandboxed frame) */
    }
  }, [invite]);

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
    // your End turn setting goes to the host with your hello, and holds for the games of this session
    const o = { name: n || (r === 'host' ? 'Host' : 'Guest'), deck: gameDeck(deck.deck), timer, endTurnClick: settings.endTurn === 'click' };
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
        const lastRelay = kv.get(RELAY_KEY);
        if (via === 'tabs' && last) {
          setRoom(last);
          joinRoom(h, last);
        } else if (via === 'net' && connMode === 'relay' && lastRelay && relaySecret(lastRelay)) {
          // back in the same room on the relay: a guest whose page is still open comes back by itself
          const t = new RelayTransport({ url: site.multiplayer.relayUrl, invite: lastRelay, role: 'host' });
          h.attach(t);
          setRelayLink(t);
          setReconnect(true);
        } else setReconnect(true);
      },
      (e: unknown) => setProblem(`The saved game could not be brought back: ${(e as Error).message}`),
    );
  };

  const backToLobby = () => {
    if (session) session.leave();
    setSession(null);
    setRoom(null);
    setRelayLink(null);
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
              <>
                {relayLink && (
                  <p className="muted">
                    {RELAY_BACK}{' '}
                    <button type="button" className="ghost" onClick={() => relayLink.retryNow()}>
                      Try now
                    </button>
                  </p>
                )}
                <NetExchange role={session.role} session={session} ice={ice} mode={relayLink ? 'relay' : connMode} onCancel={() => setReconnect(false)} onRelay={onRelay} />
              </>
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
          {via === 'net' && role === 'host' && <ConnectionChoice mode={connMode} setMode={setNetMode} corr={corrOn} />}
          <label className="row">
            <span className="muted small">Your name</span>
            <input type="text" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Shown to the other player" />
          </label>
          <DeckPicker label="Your deck" value={deckKey} onChange={setDeckKey} />
          <p className="small muted" style={{ margin: 0 }}>
            {DECK_NOTE}
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
          <LobbyNotes ice={ice} tabs={via === 'tabs' || !!room} corr={corrOn} mode={role === 'host' ? connMode : undefined} guest={role === 'guest' && (modes.relay || modes.private)} />
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
          {!room && session.conn !== 'open' && !board && session.stage !== 'refused' && (
            <>
              {session.stage !== 'waiting' && (
                <p className="online-error">
                  The connection was lost before the game started.{' '}
                  {relayLink ? RELAY_BACK : `${session.role === 'host' ? 'Make a new invite and send it' : "Open the host's new invite"}: the roll picks up where it was.`}
                </p>
              )}
              <NetExchange
                key={session.stage === 'waiting' ? 'first' : 'again'}
                role={session.role}
                session={session}
                ice={ice}
                mode={connMode}
                invite={session.stage === 'waiting' ? invite : null}
                onRelay={onRelay}
              />
            </>
          )}
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
          {session.conn === 'lost' && session.stage === 'waiting' && <p className="online-error">The connection was lost.</p>}
          <LobbyNotes
            ice={ice}
            tabs={via === 'tabs' || !!room}
            corr={corrOn}
            mode={session.role === 'host' ? (relayLink ? 'relay' : connMode) : undefined}
            guest={session.role === 'guest' && (modes.relay || modes.private)}
          />
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
