// The TURN relays for a private connection (src/net/, "Private connection" in the lobby; webrtc.ts ConnectOptions.relay).
// They come from the site config: a static list (`multiplayer.turnServers`, whose credentials are public, since the
// file is), and/or an endpoint the owner runs (`multiplayer.turnCredentialsUrl`) that answers with short-lived
// credentials. Nothing here runs until a player asks for a private code; with neither set, the mode is unavailable and
// nothing is fetched.
//
// The endpoint (the owner's; see docs/SITE_CONFIG.md): a GET with no cookies and no body, answered within
// TURN_FETCH_MS with JSON of at most TURN_RESPONSE_MAX characters:
//
//   { "iceServers": [ { "urls": ["turns:turn.example.com:5349"], "username": "1767225600:nct", "credential": "…" } ],
//     "ttl": 3600 }
//
// `iceServers` may also be one object; stun: addresses in it are skipped (a private connection asks no STUN server);
// `ttl` (seconds, optional) is how long the credentials last. Everything is checked as the config's own list is
// (parseTurnServers): turn:/turns: only, at most 3 servers, capped lengths. When the endpoint fails, the static list
// is used if there is one (and the player is told), else no private code is made: it never falls back to direct.
import { parseTurnServers, type SiteConfig, type TurnServer } from '../lib/siteConfig';

/** How long the endpoint may take. */
export const TURN_FETCH_MS = 5000;
/** The endpoint's answer, at most (characters). */
export const TURN_RESPONSE_MAX = 20_000;

type Multiplayer = Pick<SiteConfig['multiplayer'], 'turnServers' | 'turnCredentialsUrl'>;

/** Whether this site offers a private connection (a TURN list or a credentials endpoint). */
export const privateAvailable = (mp: Multiplayer) => mp.turnServers.length > 0 || !!mp.turnCredentialsUrl;

/** The endpoint's answer, checked: the TURN servers it names (stun: addresses skipped), or why it can't be used. */
export function readTurnResponse(text: string): { servers: TurnServer[]; ttl: number | null } | { error: string } {
  if (text.length > TURN_RESPONSE_MAX) return { error: 'the answer is too long' };
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { error: 'the answer is not JSON' };
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { error: 'the answer is not an object' };
  const o = v as Record<string, unknown>;
  if (o.iceServers === undefined) return { error: 'the answer has no iceServers' };
  // stun: addresses are dropped first (a private connection does not use them), so a mixed answer still works; a
  // server left with no address (it was STUN only) is skipped
  const list: unknown[] = Array.isArray(o.iceServers) ? o.iceServers : [o.iceServers];
  const isStun = (u: unknown) => typeof u === 'string' && /^stuns?:/.test(u);
  const raw: unknown[] = [];
  for (const x of list) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) {
      raw.push(x);
      continue;
    }
    const s = x as Record<string, unknown>;
    const urls = typeof s.urls === 'string' ? [s.urls] : s.urls;
    if (!Array.isArray(urls)) raw.push(s);
    else if (!urls.every(isStun)) raw.push({ ...s, urls: urls.filter((u) => !isStun(u)) });
  }
  const { servers, problems } = parseTurnServers(raw, 'iceServers');
  if (problems.length) return { error: `${problems[0]!.path} ${problems[0]!.message}` };
  if (!servers.length) return { error: 'the answer names no TURN server' };
  if (servers.some((s) => !s.username || !s.credential)) return { error: 'a server in the answer has no username or credential' };
  let ttl: number | null = null;
  if (o.ttl !== undefined) {
    if (typeof o.ttl !== 'number' || !Number.isFinite(o.ttl) || o.ttl <= 0 || o.ttl > 7 * 24 * 3600) return { error: 'ttl must be a number of seconds' };
    ttl = o.ttl;
  }
  return { servers, ttl };
}

export interface TurnDeps {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** What a private connection will go through: the servers, and a note for the player when the endpoint failed. */
export interface TurnChoice {
  servers: TurnServer[];
  /** the endpoint failed and the site's static list is used instead */
  fallback: string | null;
}

/**
 * The TURN relays for a private connection now: fresh credentials from the endpoint when the site has one (falling back
 * to the static list, said so), else the static list. Throws (with words for the player) when there is none to use;
 * the caller then makes no code at all.
 */
export async function turnServersFor(mp: Multiplayer, deps: TurnDeps = {}): Promise<TurnChoice> {
  if (mp.turnCredentialsUrl) {
    const why = await fetchCredentials(mp.turnCredentialsUrl, deps);
    if ('servers' in why) return { servers: why.servers, fallback: null };
    if (mp.turnServers.length) return { servers: mp.turnServers, fallback: `The relay's credentials could not be fetched (${why.error}); the site's fixed relay list is used.` };
    throw new Error(`Could not get the relay's credentials (${why.error}), so no private code was made (no direct connection was tried). Try again in a moment.`);
  }
  if (!mp.turnServers.length) throw new Error('This site has no relay server set up, so a private connection is not available.');
  return { servers: mp.turnServers, fallback: null };
}

async function fetchCredentials(url: string, deps: TurnDeps): Promise<{ servers: TurnServer[] } | { error: string }> {
  const f = deps.fetch ?? (typeof fetch === 'function' ? fetch : null);
  if (!f) return { error: 'this browser cannot fetch' };
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<{ error: string }>((res) => {
    timer = setTimeout(() => {
      ctl?.abort();
      res({ error: 'no answer in time' });
    }, deps.timeoutMs ?? TURN_FETCH_MS);
  });
  const get = (async (): Promise<{ servers: TurnServer[] } | { error: string }> => {
    try {
      const r = await f(url, { method: 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error', signal: ctl?.signal });
      if (!r.ok) return { error: `the endpoint answered ${r.status}` };
      const text = await r.text();
      const read = readTurnResponse(text);
      return 'error' in read ? read : { servers: read.servers };
    } catch {
      return { error: 'the endpoint could not be reached' };
    }
  })();
  try {
    return await Promise.race([get, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
