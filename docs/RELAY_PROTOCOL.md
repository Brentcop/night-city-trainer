# Relay protocol (version 1)

"Play through the relay" lets two players reach each other through a small server instead of a direct browser-to-browser
link, so **neither player's network address reaches the other**. The site has no server today: this document is what a
relay must do so that one can be added later without touching the game code. The client is
`src/net/relayTransport.ts` (`RelayTransport`); it is switched on by the site config's `multiplayer.relayUrl`
(docs/SITE_CONFIG.md). `tests/fakeRelay.ts` is an in-memory relay that follows this document, and
`tests/net-relay.test.ts` plays full games through it; a real server can be checked against the same tests.

The relay is a **dumb forwarder**. It pairs two connections by a room id and passes each frame to the other one. It
runs no game logic, keeps nothing on disk, and cannot read what it forwards: the players encrypt every message end to
end with a key the relay never has.

## Who learns what

| Who | Learns | Does not learn |
| --- | --- | --- |
| The other player | Nothing about your network: the relay is the only address their browser talks to | Your IP address |
| The relay's operator | Both players' IP addresses (the relay is the other end of each connection), the room id, each side's role (host / guest), when they connect, and the size and timing of every frame | Names, decks, moves, chat: everything inside a frame is encrypted (AES-256-GCM) with a key derived from the invite, which the relay never sees |
| Anyone who sees the invite | The room and its key: they could join before your friend. Lock the invite with a phrase when it goes anywhere public | Any address (the invite holds none) |

## The invite and the keys

The host makes a **join secret**: 16 random bytes. The invite is `r1` + base64url(secret) (24 characters), sent as a link
`#/play/join/r1…` or locked with a phrase like the other codes (`2…`, purpose 7 `relay-invite`, `src/net/codeLock.ts`).
There is no reply code: the guest opens the invite and both join the same room.

From the secret both sides derive, with WebCrypto:

- **room id** = the first 22 characters of base64url(SHA-256(UTF-8 `"nct-relay-room:v1:"` ‖ secret)). This is all the
  relay is told. It is 132 bits and reveals nothing about the secret.
- **end-to-end key** = HKDF-SHA-256(input key = secret, salt = UTF-8 `"nct-relay:v1"`, info = UTF-8 `"nct-relay-e2e"`)
  → AES-256-GCM key.

The relay URL is never in the invite: both players use the relay their copy of the site names.

## Frames

One WebSocket **text** message is one frame: a JSON object with a string field `t`. Binary messages are not used. A
frame is at most **65,536 characters** in either direction.

### Client → relay

| Frame | When |
| --- | --- |
| `{"t":"join","v":1,"room":"<22 chars>","role":"host"\|"guest"}` | First frame on every connection, once. |
| `{"t":"msg","d":"<base64url>"}` | A sealed piece of a game message (below), for the other member of the room. |
| `{"t":"ping"}` | Keep-alive, every 25 s while connected. |
| `{"t":"leave"}` | The player left; the relay closes the connection. |

### Relay → client

| Frame | When |
| --- | --- |
| `{"t":"joined","peer":true\|false}` | Answer to `join`: whether the other seat is already in the room. |
| `{"t":"peer","here":true\|false}` | The other seat joined (again) or left / dropped. |
| `{"t":"msg","d":"<base64url>"}` | A frame from the other member, `d` exactly as it was sent. Only `t` and `d` are forwarded. |
| `{"t":"pong"}` | Answer to `ping`. |
| `{"t":"error","why":"<code>"}` | A refusal; the relay closes the connection after it, except where noted. |

Error codes: `join-first` (a frame before `join`), `version` (`v` is not 1), `room` (the room id is not 22 base64url
characters), `role` (not `host` or `guest`), `frame` (not JSON, not an object, an unknown `t`, a missing or wrong field,
or a second `join`), `too-big` (over 65,536 characters), `rate` (over the rate limits), `replaced` (sent to the older
connection of a seat that a newer connection took). The client stops for good on `version`, `room`, `role` and
`replaced` and says why; after the others it reconnects.

Close codes: 1000 after `leave`; 1008 after a refusal; 1009 after `too-big`; 4001 after `replaced`. The client does not
depend on them.

## The relay's rules

1. A room has two seats, `host` and `guest`. A `join` takes its seat. If that seat is held by another connection, the
   **newest wins**: the older one gets `{"t":"error","why":"replaced"}` and is closed (a reload, a second tab, or a
   connection whose drop the relay has not noticed yet). The other seat is then told `{"t":"peer","here":true}`.
2. `msg` frames are forwarded to the other seat at once, unchanged. With the other seat empty, the frame is
   **dropped**: the relay keeps no queue. (The game protocol resends what matters when a player comes back.)
3. When a connection closes or sends `leave`, its seat is emptied and the other seat gets `{"t":"peer","here":false}`. A
   room with both seats empty is forgotten.
4. A connection silent for 120 s (no frame, not even `ping`) is closed.
5. No game logic. The relay does not parse `d`, check sizes inside it, or look at timing beyond the limits below.

## Limits

These match the game protocol's own caps (`src/net/protocol.ts` `CAPS`: a guest message at most 20,000 characters, a
host message at most 1,500,000) and the piece framing shared with the data channel (`src/net/framing.ts`: pieces of at
most 15,000 characters, at most 110 pieces a message). A piece with its header is at most 15,021 characters, at most
45,063 bytes of UTF-8; sealed (12 + 12 + 16 bytes more) and in base64url it is at most 60,138 characters, so every
frame fits 65,536.

A relay **must accept at least** the following per connection, and may close a connection that goes beyond its own,
equal or larger, limits with `rate`:

- frames: a burst of 200, refilled at 50 a second;
- characters: a burst of 4,000,000, refilled at 1,000,000 a second.

(The largest host message, 110 pieces, fits one burst. Real games send far less: a few kilobytes per move.)

## Sealing a message (client side)

A game message (`src/net/protocol.ts`, JSON text) longer than 15,000 characters is cut into pieces
`~<id>|<k>|<n>|<piece>` exactly as on the data channel; shorter ones go whole. Each piece is sealed into one `msg`
frame:

```
plain = epoch (8 bytes) ‖ sequence (4 bytes, big-endian) ‖ UTF-8 text of the piece
d     = base64url( nonce (12 random bytes) ‖ AES-256-GCM(key, nonce, plain, additional data) )
additional data = UTF-8 "nct-relay:v1:" + room id + ":" + sender role
```

- Each new connection to the relay starts a new random **epoch** at sequence 0.
- The receiver keeps, for its peer, the current epoch and the next sequence. A frame of the current epoch must carry
  exactly the next sequence; a new epoch is taken only at sequence 0 and only if it was not seen before (the last 64
  are remembered). Anything else, and any frame that does not open (another key, another room, sent by the receiver
  itself and reflected back, or changed in any byte), is refused and dropped.
- So the relay can **drop** frames, but not read, change, reorder, replay, reflect or redirect them unnoticed. Replays
  across a reload of the receiving page are not caught by this layer; the game protocol's own numbers (`view` `n`,
  decision `seq`, the resume token) refuse stale moves there.

## Keep-alive and reconnection (client side)

- While connected, the client sends `ping` every 25 s. With no frame from the relay for 60 s it drops the connection and
  makes a new one.
- When the connection drops (or the relay closes it after a recoverable error), the client reconnects after 1 s, 2 s,
  4 s, 8 s, 15 s, then every 15 s, until the player leaves. On each new connection it joins the same room and seat.
- To the game, the other player leaving or the relay dropping is a lost link ("Connection lost, trying again…"; the
  host's turn timer pauses). When both seats are back, the link opens again, the guest says hello with its resume token
  and the game carries on from where it was, as after any reconnect. The game's own heartbeat (a ping every 2 s, lost
  after 8 s of silence) runs inside the sealed frames.

## What the relay must and must not keep

- **Must keep, in memory only, while a connection is open:** room id → the connection in each seat. Nothing else.
- **Must not** write frames, room ids or addresses to disk or to logs; must not keep a room after both seats are empty;
  must not queue frames for an absent seat.
- **May** keep aggregate counters (connections, frames, bytes) without room ids or addresses, and short-lived per-address
  connection limits against abuse.
- **May** check the `Origin` header against the site's address, so other sites can't use the relay. It is not a
  security boundary (any program can send any header) but cuts casual misuse.
- Run it behind TLS (`wss://`). The site config accepts `ws://` only for `localhost` (development).

## Versioning

`v` in `join` is the protocol version. A relay that does not speak it answers `{"t":"error","why":"version"}`. A new
version of the invite format would start `r2`; this version of the site says "made by a newer version of the site" for
it. Older copies of the site, which know no relay at all, refuse an `r1` invite (and a locked one, purpose 7) as "not an
invite code": they never connect directly in its place.

## Reference sketch (untested)

**Not part of the build and never run.** A starting point for the owner, using Node and the `ws` package; it follows
the rules above but has not been tested against `tests/fakeRelay.ts` or a browser, and has no rate limit or
per-address cap yet.

```js
// relay.mjs — UNTESTED SKETCH. npm i ws; node relay.mjs (behind a TLS proxy that serves wss://)
import { WebSocketServer } from 'ws';

const MAX_FRAME = 65_536;
const rooms = new Map(); // room id -> { host?: ws, guest?: ws }
const wss = new WebSocketServer({ port: 8787, maxPayload: MAX_FRAME * 4 });
const send = (ws, f) => ws.readyState === 1 && ws.send(JSON.stringify(f));
const fail = (ws, why, code = 1008) => { send(ws, { t: 'error', why }); ws.close(code); };

wss.on('connection', (ws) => {
  let seat = null; // { room, role }
  let heard = Date.now();
  const idle = setInterval(() => Date.now() - heard > 120_000 && ws.terminate(), 10_000);
  const other = () => seat && rooms.get(seat.room)?.[seat.role === 'host' ? 'guest' : 'host'];
  ws.on('message', (data, isBinary) => {
    heard = Date.now();
    const text = isBinary ? null : data.toString('utf8');
    if (text === null || text.length > MAX_FRAME) return fail(ws, 'too-big', 1009);
    let f;
    try { f = JSON.parse(text); } catch { return fail(ws, 'frame'); }
    if (!f || typeof f !== 'object' || Array.isArray(f)) return fail(ws, 'frame');
    if (!seat) {
      if (f.t !== 'join') return fail(ws, 'join-first');
      if (f.v !== 1) return fail(ws, 'version');
      if (typeof f.room !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(f.room)) return fail(ws, 'room');
      if (f.role !== 'host' && f.role !== 'guest') return fail(ws, 'role');
      const room = rooms.get(f.room) ?? {};
      rooms.set(f.room, room);
      const old = room[f.role];
      if (old && old !== ws) { send(old, { t: 'error', why: 'replaced' }); old.close(4001); }
      room[f.role] = ws;
      seat = { room: f.room, role: f.role };
      const o = other();
      send(ws, { t: 'joined', peer: !!o });
      if (o) send(o, { t: 'peer', here: true });
      return;
    }
    if (f.t === 'msg' && typeof f.d === 'string' && /^[A-Za-z0-9_-]+$/.test(f.d)) { const o = other(); if (o) send(o, { t: 'msg', d: f.d }); return; }
    if (f.t === 'ping') return send(ws, { t: 'pong' });
    if (f.t === 'leave') return ws.close(1000);
    return fail(ws, 'frame');
  });
  ws.on('close', () => {
    clearInterval(idle);
    if (!seat) return;
    const room = rooms.get(seat.room);
    if (room?.[seat.role] !== ws) return; // replaced: the new connection holds the seat
    delete room[seat.role];
    const o = room[seat.role === 'host' ? 'guest' : 'host'];
    if (o) send(o, { t: 'peer', here: false });
    if (!room.host && !room.guest) rooms.delete(seat.room);
  });
});
```

## Switching it on

1. Run a relay that follows this document at a `wss://` address (behind TLS), with logging of frames and addresses off.
2. In `#/admin` → Online play, set **Relay server (wss)** to its address; download the file, replace
   `public/site-config.json`, run `npm run check:data`, commit and push.
3. The lobby then offers "Through the relay server" first. Clearing the field hides it again; nothing else changes.
