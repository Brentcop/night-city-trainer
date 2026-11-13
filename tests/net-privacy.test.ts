// What the live link's codes carry (src/net/webrtc.ts sanitizeSdp, describeSignal), codes locked with a phrase
// (src/net/codeLock.ts: the live link's codes and the multi-day invite and reply), and the chunk framing's limits
// (Reassembler). The session descriptions are fixtures shaped like Chrome's and Firefox's, with documentation addresses
// (RFC 5737 / RFC 3849) only; nothing here touches the network.
import { describe, expect, it } from 'vitest';
import {
  keyFromPhrase,
  LOCK_ITERATIONS,
  lockBytes,
  newPassphrase,
  normalizePhrase,
  phraseBits,
  phraseProblem,
  unlockBytes,
  WORDS,
  WRONG_PHRASE,
} from '../src/net/codeLock';
import {
  addressKind,
  CHUNK,
  decodeSignal,
  describeSdp,
  describeSignal,
  describeText,
  encodeLockedSignal,
  encodeSignal,
  inviteProblem,
  isLockedCode,
  MAX_HELD,
  MAX_IN_FLIGHT,
  MAX_PIECES,
  openCode,
  PIECE_TTL_MS,
  Reassembler,
  sanitizeSdp,
} from '../src/net/webrtc';
import { addressesIn, expectNoAddresses } from './netLeak';

const sdp = (lines: string[]) => `${lines.join('\r\n')}\r\n`;
const HEAD = ['v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=extmap-allow-mixed', 'a=msid-semantic: WMS'];
const TAIL = [
  'a=ice-ufrag:abcd',
  'a=ice-pwd:0123456789abcdefghijklmn',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
];
const MDNS1 = '3f9c1e2a-0b1c-4d2e-9f3a-5b6c7d8e9f01.local';
const MDNS2 = '6a7b8c9d-1e2f-4a3b-8c4d-5e6f7a8b9c0d.local';
const PUB4 = '203.0.113.7';
const PUB6 = '2001:db8:1234:5678:a1b2:c3d4:e5f6:7788';
/** A Chrome offer after gathering with one STUN server: mDNS host names, public IPv4 and IPv6 reflexive candidates. */
const CHROME = sdp([
  ...HEAD,
  'm=application 54321 UDP/DTLS/SCTP webrtc-datachannel',
  `c=IN IP4 ${PUB4}`,
  `a=candidate:1 1 udp 2113937151 ${MDNS1} 54321 typ host generation 0 network-cost 999`,
  `a=candidate:2 1 udp 2113939711 ${MDNS2} 54400 typ host generation 0 network-cost 999`,
  `a=candidate:3 1 udp 1677729535 ${PUB4} 54321 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999`,
  `a=candidate:4 1 udp 1677731839 ${PUB6} 54400 typ srflx raddr :: rport 0 generation 0 network-cost 999`,
  ...TAIL,
]);
/** A browser that shows raw addresses (no mDNS: an older one, or a policy): LAN, link-local, loopback and global IPv6. */
const RAW = sdp([
  ...HEAD,
  'm=application 50000 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 198.51.100.20',
  'a=rtcp:50000 IN IP4 198.51.100.20',
  'a=candidate:1 1 udp 2122260223 192.168.1.23 50000 typ host generation 0',
  'a=candidate:2 1 udp 2122262783 2001:db8:aaaa:bbbb::23 50001 typ host generation 0',
  'a=candidate:3 1 udp 2122194687 fe80::1c2d:3e4f:5a6b:7c8d 50002 typ host generation 0',
  'a=candidate:4 1 tcp 1518280447 192.168.1.23 9 typ host tcptype active generation 0',
  'a=candidate:5 1 udp 1686052607 198.51.100.20 50000 typ srflx raddr 192.168.1.23 rport 50000 generation 0',
  'a=candidate:6 1 udp 41885439 192.0.2.50 3478 typ relay raddr 198.51.100.20 rport 50000 generation 0',
  'a=candidate:7 1 udp 2122260223 127.0.0.1 50003 typ host generation 0',
  'a=candidate:8 1 udp 2122260223 10.0.0.5 50004 typ host generation 0',
  ...TAIL,
]);

const candidates = (s: string) => s.split('\r\n').filter((l) => l.startsWith('a=candidate:'));

describe('sanitizeSdp: only what a connection needs', () => {
  it('classifies addresses', () => {
    expect(['x.local', '127.0.0.1', '0.0.0.0', '::1', '::', '10.1.2.3', '172.20.0.1', '172.32.0.1', '192.168.0.9', '169.254.1.1', '100.64.0.1', 'fd00::1', 'fe80::1', '203.0.113.7', PUB6, 'turn.example.com'].map(addressKind)).toEqual([
      'mdns',
      'loopback',
      'loopback',
      'loopback',
      'loopback',
      'lan',
      'lan',
      'public',
      'lan',
      'lan',
      'lan',
      'lan',
      'lan',
      'public',
      'public',
      'other',
    ]);
  });

  it('a table of candidate lines in and out, by mode', () => {
    const cases: [string, { net: string | null; lan: string | null; noV6: string | null; relay: string | null }][] = [
      [`a=candidate:1 1 udp 2113937151 ${MDNS1} 54321 typ host generation 0`, { net: 'same', lan: 'same', noV6: 'same', relay: null }],
      ['a=candidate:1 1 udp 2122260223 192.168.1.23 50000 typ host generation 0', { net: null, lan: 'same', noV6: null, relay: null }],
      ['a=candidate:1 1 udp 2122260223 127.0.0.1 50000 typ host generation 0', { net: null, lan: null, noV6: null, relay: null }],
      ['a=candidate:2 1 udp 2122262783 2001:db8:aaaa:bbbb::23 50001 typ host generation 0', { net: null, lan: 'same', noV6: null, relay: null }],
      ['a=candidate:3 1 udp 2122194687 fe80::1c2d:3e4f:5a6b:7c8d 50002 typ host generation 0', { net: null, lan: 'same', noV6: null, relay: null }],
      [
        'a=candidate:5 1 udp 1686052607 198.51.100.20 50000 typ srflx raddr 192.168.1.23 rport 50000 generation 0',
        {
          net: 'a=candidate:5 1 udp 1686052607 198.51.100.20 50000 typ srflx raddr 0.0.0.0 rport 0 generation 0',
          lan: 'a=candidate:5 1 udp 1686052607 198.51.100.20 50000 typ srflx raddr 0.0.0.0 rport 0 generation 0',
          noV6: 'a=candidate:5 1 udp 1686052607 198.51.100.20 50000 typ srflx raddr 0.0.0.0 rport 0 generation 0',
          relay: null,
        },
      ],
      [`a=candidate:4 1 udp 1677731839 ${PUB6} 54400 typ srflx raddr fe80::1 rport 9 generation 0`, { net: `a=candidate:4 1 udp 1677731839 ${PUB6} 54400 typ srflx raddr :: rport 0 generation 0`, lan: `a=candidate:4 1 udp 1677731839 ${PUB6} 54400 typ srflx raddr :: rport 0 generation 0`, noV6: null, relay: null }],
      [
        'a=candidate:6 1 udp 41885439 192.0.2.50 3478 typ relay raddr 198.51.100.20 rport 50000 generation 0',
        {
          net: 'a=candidate:6 1 udp 41885439 192.0.2.50 3478 typ relay raddr 0.0.0.0 rport 0 generation 0',
          lan: 'a=candidate:6 1 udp 41885439 192.0.2.50 3478 typ relay raddr 0.0.0.0 rport 0 generation 0',
          noV6: 'a=candidate:6 1 udp 41885439 192.0.2.50 3478 typ relay raddr 0.0.0.0 rport 0 generation 0',
          relay: 'a=candidate:6 1 udp 41885439 192.0.2.50 3478 typ relay raddr 0.0.0.0 rport 0 generation 0',
        },
      ],
      ['a=candidate:9 1 udp 1 203.0.113.9 1 typ weird generation 0', { net: null, lan: null, noV6: null, relay: null }],
      ['a=candidate:garbled', { net: null, lan: null, noV6: null, relay: null }],
    ];
    for (const [line, want] of cases) {
      const run = (o: Parameters<typeof sanitizeSdp>[1]) => candidates(sanitizeSdp(sdp(['v=0', line]), o))[0] ?? null;
      const exp = (w: string | null) => (w === 'same' ? line : w);
      expect(run({}), `internet: ${line}`).toBe(exp(want.net));
      expect(run({ sameNetwork: true }), `same network: ${line}`).toBe(exp(want.lan));
      expect(run({ dropIpv6: true }), `no IPv6: ${line}`).toBe(exp(want.noV6));
      expect(run({ relayOnly: true }), `relay only: ${line}`).toBe(exp(want.relay));
    }
  });

  it('the default-candidate lines carry placeholders; the other lines are kept as they were', () => {
    const out = sanitizeSdp(RAW);
    expect(out).toContain('m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n');
    expect(out).toContain('c=IN IP4 0.0.0.0\r\n');
    expect(out).toContain('a=rtcp:9 IN IP4 0.0.0.0\r\n');
    expect(out).toContain('o=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n');
    for (const l of TAIL) expect(out).toContain(`${l}\r\n`);
    expect(out).not.toContain('extmap-allow-mixed');
    expect(sanitizeSdp(out)).toBe(out);
  });

  it('what is left: the reflexive (and relay) addresses a direct connection needs, nothing from the LAN', () => {
    expectNoAddresses(sanitizeSdp(CHROME), 'a cleaned Chrome offer', [PUB4, PUB6]);
    expectNoAddresses(sanitizeSdp(CHROME, { dropIpv6: true }), 'a cleaned Chrome offer without IPv6', [PUB4]);
    expectNoAddresses(sanitizeSdp(RAW), 'a cleaned raw-address offer', ['198.51.100.20', '192.0.2.50']);
    expectNoAddresses(sanitizeSdp(RAW, { relayOnly: true }), 'a relay-only offer', ['192.0.2.50']);
    // the search itself finds what the raw fixture holds
    expect(new Set(addressesIn(RAW))).toEqual(new Set(['198.51.100.20', '192.168.1.23', '2001:db8:aaaa:bbbb::23', 'fe80::1c2d:3e4f:5a6b:7c8d', '192.0.2.50', '10.0.0.5']));
    expect(addressesIn(CHROME, true)).toContain(MDNS1);
  });

  it('describeSdp / describeText say what a code shows', () => {
    const c = describeSdp(sanitizeSdp(CHROME));
    expect(c).toMatchObject({ locked: false, readable: true, mdns: 2, lan: [], publicV4: [PUB4], publicV6: [PUB6], relay: [], candidates: 4 });
    expect(describeText(c)).toBe('This code shows your public internet address and IPv6 address (it can name the device itself): anyone who sees it can read that, so send it privately.');
    const lan = describeSdp(sanitizeSdp(RAW, { sameNetwork: true, dropIpv6: true }));
    expect(lan.lan).toEqual(['192.168.1.23', '10.0.0.5']);
    expect(describeText(describeSdp(sanitizeSdp(CHROME, { dropIpv6: true }), true))).toBe('Locked: without the phrase, nobody can read this code. With it, it shows your public internet address.');
    expect(describeText(describeSdp(sdp(['v=0', `a=candidate:1 1 udp 1 ${MDNS1} 1 typ host`])))).toMatch(/only a random name/);
    expect(describeText(describeSdp('v=0\r\n'))).toMatch(/no way to reach you/);
    expect(describeText(describeSdp(sanitizeSdp(RAW, { relayOnly: true })))).toBe("This code shows only a relay server's address (nothing that names you).");
    expect(describeText(describeSdp(sanitizeSdp(RAW)))).toMatch(/^This code shows your public internet address and a relay server's address: anyone/);
  });
});

describe('codes', () => {
  it('an unlocked code round-trips, cleaned; the bystander reads only the addresses a connection needs', async () => {
    const code = await encodeSignal({ k: 'o', sdp: RAW });
    expect(code).toMatch(/^[01][A-Za-z0-9_-]+$/);
    const back = await decodeSignal(code, 'o');
    expect(back!.sdp).toBe(sanitizeSdp(RAW));
    expectNoAddresses(back!.sdp, 'an unlocked code', ['198.51.100.20', '192.0.2.50']);
    expect(await describeSignal(code)).toMatchObject({ locked: false, publicV4: ['198.51.100.20'], lan: [] });
    // same-network mode keeps the LAN addresses (they are the way in there)
    const lan = await decodeSignal(await encodeSignal({ k: 'o', sdp: RAW }, { sameNetwork: true }), 'o');
    expect(lan!.sdp).toContain('192.168.1.23');
    expect(lan!.sdp).not.toContain('127.0.0.1 50003');
  });

  it('decodeSignal caps what it inflates (a small code cannot unpack into megabytes)', async () => {
    const bomb = new TextEncoder().encode(JSON.stringify({ k: 'o', s: `v=0${'a'.repeat(5_000_000)}` }));
    const deflated = new Uint8Array(await new Response(new Blob([bomb as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    const code = `1${Buffer.from(deflated).toString('base64url')}`;
    expect(code.length).toBeLessThan(20_000);
    expect(await decodeSignal(code, 'o')).toBeNull();
  });

  it('old-format codes ("0" and "1") still open', async () => {
    const json = JSON.stringify({ k: 'a', s: 'v=0\r\ns=-\r\n' });
    const plain = `0${Buffer.from(json).toString('base64url')}`;
    expect((await decodeSignal(plain, 'a'))?.sdp).toBe('v=0\r\ns=-\r\n');
    const r = await openCode(plain, 'a');
    expect(r.ok && r.key).toBe(null);
    expect(await openCode(plain, 'o')).toEqual({ ok: false, why: 'kind' });
    expect(await openCode('not a code at all', 'o')).toEqual({ ok: false, why: 'not-code' });
  });
});

describe('locked codes', () => {
  it('the phrase rule and the word list', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(1024);
    expect(new Set(WORDS).size).toBe(WORDS.length);
    expect(WORDS.every((w) => /^[a-z]{4,9}$/.test(w))).toBe(true);
    expect(phraseBits(4)).toBeGreaterThanOrEqual(40);
    expect(LOCK_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    for (let i = 0; i < 50; i++) {
      const p = newPassphrase();
      expect(p.split(' ')).toHaveLength(4);
      // a generated phrase always passes the rule (four words of four letters or more make at least 19 characters)
      if (new Set(p.split(' ')).size >= 3) expect(phraseProblem(p)).toBeNull();
    }
    expect(phraseProblem('1234')).toMatch(/four words/);
    expect(phraseProblem('cat dog emu ant')).toMatch(/16 characters/);
    expect(phraseProblem('amber amber amber amber')).toMatch(/different/);
    expect(phraseProblem('Lantern-orbit  RIVER.velvet')).toBeNull();
    expect(normalizePhrase('  Lantern-orbit  RIVER.velvet ')).toBe('lantern orbit river velvet');
  });

  it('a locked invite: nothing readable without the phrase; the right phrase (any spacing or case) opens it; the reply is locked with the same key', async () => {
    const phrase = 'lantern orbit river velvet';
    const key = await keyFromPhrase(phrase);
    const code = await encodeLockedSignal({ k: 'o', sdp: CHROME }, key);
    expect(code[0]).toBe('2');
    expect(isLockedCode(code)).toBe(true);
    expect(isLockedCode(`https://example.test/app/#/play/join/${code}`)).toBe(true);
    // a bystander: the old decoder sees no code, the bytes hold no address and no SDP
    expect(await decodeSignal(code, 'o')).toBeNull();
    const bytes = Buffer.from(code.slice(1), 'base64url').toString('latin1');
    expectNoAddresses(bytes, 'a locked code, decoded without the phrase', [], { mdns: false });
    expect(bytes).not.toMatch(/candidate|srflx|v=0/);
    expect(await describeSignal(code)).toMatchObject({ locked: true, readable: false });
    expect(await openCode(code, 'o')).toEqual({ ok: false, why: 'locked' });
    // the wrong phrase is told apart from a broken code, and never half-opens
    expect(await openCode(code, 'o', 'lantern orbit river velvets')).toEqual({ ok: false, why: 'phrase' });
    expect(inviteProblem('phrase')).toBe(WRONG_PHRASE);
    expect(await openCode(code, 'a', phrase)).toEqual({ ok: false, why: 'kind' });
    const opened = await openCode(code, 'o', ' Lantern ORBIT-river  velvet ');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.signal.sdp).toBe(sanitizeSdp(CHROME));
    expect(await describeSignal(code, phrase)).toMatchObject({ locked: true, readable: true, publicV4: [PUB4] });
    // the guest's reply, with the key the invite opened with: the host opens it with its own key, no phrase typed
    const reply = await encodeLockedSignal({ k: 'a', sdp: RAW }, opened.key!);
    const back = await openCode(reply, 'a', key);
    expect(back.ok && back.signal.sdp).toBe(sanitizeSdp(RAW));
    // ...but not with a key from another invite (same phrase, another salt)
    expect(await openCode(reply, 'a', await keyFromPhrase(phrase))).toEqual({ ok: false, why: 'phrase' });
    expect(await openCode(reply, 'o', key)).toEqual({ ok: false, why: 'kind' });
  }, 20_000);

  it('a changed code is refused as not opening, whatever byte was changed', async () => {
    const key = await keyFromPhrase('amber anchor apple atlas');
    const sealed = await lockBytes(new TextEncoder().encode('hello'), key, 'rtc-offer');
    expect((await unlockBytes(sealed, key, 'rtc-offer')).ok).toBe(true);
    for (const at of [1, 2, 3, 20, 31, sealed.length - 1]) {
      const bad = sealed.slice();
      bad[at] = bad[at]! ^ 1;
      const r = await unlockBytes(bad, key, 'rtc-offer');
      expect(r.ok, `byte ${at}`).toBe(false);
    }
    // the purpose is bound in: an invite's bytes don't open as a reply, nor as a multi-day invite
    expect(await unlockBytes(sealed, key, 'rtc-answer')).toEqual({ ok: false, why: 'purpose' });
    expect(await unlockBytes(sealed, key, 'corr-invite')).toEqual({ ok: false, why: 'purpose' });
    // an unknown cost or format is refused unread
    const odd = sealed.slice();
    odd[1] = 9;
    expect(await unlockBytes(odd, 'amber anchor apple atlas', 'rtc-offer')).toEqual({ ok: false, why: 'format' });
  }, 20_000);
});

describe('chunk framing: a peer sending odd pieces cannot stall or fill the page', () => {
  const piece = (id: number, k: number, n: number, body = 'x') => `~${id}|${k}|${n}|${body}`;
  it('joins a message in any order', () => {
    const r = new Reassembler();
    expect(r.push(piece(1, 1, 3, 'b'))).toBeNull();
    expect(r.push(piece(1, 2, 3, 'c'))).toBeNull();
    expect(r.push(piece(1, 0, 3, 'a'))).toBe('abc');
    expect(r.inFlight).toBe(0);
    expect(r.heldChars).toBe(0);
  });
  it('refuses a bad index or count at once (the 25-byte message that used to stall a tab)', () => {
    const r = new Reassembler();
    const t = performance.now();
    expect(r.push('~0|200000000|2|x')).toBeNull();
    expect(r.push(piece(0, 5, 3))).toBeNull();
    expect(r.push(piece(0, 0, 0))).toBeNull();
    expect(r.push(piece(0, 0, MAX_PIECES + 1))).toBeNull();
    expect(r.push(`~0|0|2|${'x'.repeat(CHUNK + 1)}`)).toBeNull();
    expect(r.push('~x|0|1|a')).toBeNull();
    expect(performance.now() - t).toBeLessThan(50);
    expect(r.inFlight).toBe(0);
  });
  it('a repeated piece is not counted twice; pieces that disagree on the count drop the message', () => {
    const r = new Reassembler();
    r.push(piece(1, 0, 2, 'a'));
    expect(r.push(piece(1, 0, 2, 'a'))).toBeNull();
    expect(r.push(piece(1, 1, 3, 'b'))).toBeNull();
    expect(r.inFlight).toBe(0);
  });
  it('at most a few messages in flight, expired after a while, and a cap on what is held', () => {
    let now = 0;
    const r = new Reassembler(() => now);
    for (let id = 0; id < 10; id++) r.push(piece(id, 0, 2));
    expect(r.inFlight).toBe(MAX_IN_FLIGHT);
    now += PIECE_TTL_MS + 1;
    r.push(piece(99, 0, 2));
    expect(r.inFlight).toBe(1);
    const big = 'y'.repeat(CHUNK);
    for (let k = 0; k < Math.ceil(MAX_HELD / CHUNK) + 5; k++) r.push(piece(200 + (k % 3), k, MAX_PIECES, big));
    expect(r.heldChars).toBeLessThanOrEqual(MAX_HELD);
  });
});
