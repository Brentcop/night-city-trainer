// A private connection (src/net/webrtc.ts with ConnectOptions.relay, src/net/turn.ts): relay-only codes marked so an
// older copy refuses them, the browser told to relay only, the host refusing a reply that would connect directly, the
// guest never answering a private invite directly, and the TURN credentials endpoint's answer checked strictly. The
// browser's RTCPeerConnection is a fake that hands out fixture session descriptions (documentation addresses only);
// the endpoint is a fake fetch. Nothing touches the network.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSiteConfig, type TurnServer } from '../src/lib/siteConfig';
import { keyFromPhrase, lockedPurpose, PURPOSES } from '../src/net/codeLock';
import { privateAvailable, readTurnResponse, turnServersFor } from '../src/net/turn';
import {
  decodeSignal,
  DIRECT_NOT_CHOSEN,
  encodeLockedSignal,
  encodeSignal,
  guestAnswer,
  hostOffer,
  inviteMode,
  inviteProblem,
  NEWER_CODE,
  NO_RELAY_HERE,
  NO_RELAY_REACHED,
  nonRelayCandidates,
  openCode,
  rtcConfig,
  sanitizeSdp,
  unb64url,
} from '../src/net/webrtc';
import { expectNoAddresses } from './netLeak';

const sdp = (lines: string[]) => `${lines.join('\r\n')}\r\n`;
const HEAD = ['v=0', 'o=- 4611731400430051336 2 IN IP4 198.51.100.20', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'm=application 50000 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 198.51.100.20'];
const TAIL = ['a=ice-ufrag:abcd', 'a=ice-pwd:0123456789abcdefghijklmn', 'a=fingerprint:sha-256 12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0', 'a=setup:actpass', 'a=mid:0', 'a=sctp-port:5000'];
const RELAY_ADDR = '192.0.2.50';
const MDNS = '3f9c1e2a-0b1c-4d2e-9f3a-5b6c7d8e9f01.local';
/** What a browser gathers with TURN configured: its own addresses as well as the relay's (the policy decides which are used). */
const GATHERED = sdp([
  ...HEAD,
  `a=candidate:1 1 udp 2113937151 ${MDNS} 50000 typ host generation 0`,
  'a=candidate:2 1 udp 2122260223 192.168.1.23 50000 typ host generation 0',
  'a=candidate:3 1 udp 1686052607 198.51.100.20 50000 typ srflx raddr 192.168.1.23 rport 50000 generation 0',
  'a=candidate:4 1 udp 1677731839 2001:db8:1234:5678:a1b2:c3d4:e5f6:7788 50001 typ srflx raddr :: rport 0 generation 0',
  `a=candidate:5 1 udp 41885439 ${RELAY_ADDR} 3478 typ relay raddr 198.51.100.20 rport 50000 generation 0`,
  ...TAIL,
]);
/** The same with no relay candidate (the relay could not be reached). */
const NO_RELAY = GATHERED.split('\r\n').filter((l) => !l.includes('typ relay')).join('\r\n');
const TURN: TurnServer[] = [{ urls: ['turns:turn.example.test:5349'], username: '1767225600:nct', credential: 'c2VjcmV0' }];

/** A stand-in for the browser's RTCPeerConnection: records its configuration and what it is told, gathers `FakePC.sdp`. */
class FakePC {
  static made: FakePC[] = [];
  static sdp = GATHERED;
  localDescription: { type: string; sdp: string } | null = null;
  remote: { type: string; sdp: string } | null = null;
  iceGatheringState = 'complete';
  connectionState = 'new';
  ondatachannel: unknown = null;
  closed = false;
  constructor(readonly config: RTCConfiguration) {
    FakePC.made.push(this);
  }
  createDataChannel() {
    return { readyState: 'connecting', send: () => undefined, close: () => undefined, onopen: null, onclose: null, onerror: null, onmessage: null };
  }
  async createOffer() {
    return { type: 'offer', sdp: FakePC.sdp };
  }
  async createAnswer() {
    return { type: 'answer', sdp: FakePC.sdp };
  }
  async setLocalDescription(d: { type: string; sdp: string }) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: { type: string; sdp: string }) {
    this.remote = d;
  }
  addEventListener() {}
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  FakePC.made = [];
  FakePC.sdp = GATHERED;
  vi.stubGlobal('RTCPeerConnection', FakePC);
});
afterEach(() => vi.unstubAllGlobals());

describe('private codes', () => {
  it('carry only the relay address, are marked "3" (or their own locked purposes), and an older copy refuses them', async () => {
    const code = await encodeSignal({ k: 'o', sdp: GATHERED, relayOnly: true });
    expect(code[0]).toBe('3');
    const back = await decodeSignal(code, 'o');
    expect(back?.relayOnly).toBe(true);
    expect(nonRelayCandidates(back!.sdp)).toBe(0);
    expectNoAddresses(back!.sdp, 'a private code', [RELAY_ADDR], { mdns: false });
    expect(inviteMode(code)).toBe('private');
    // an older copy of the site read only "0", "1" and "2" codes
    expect(/^[012][A-Za-z0-9_-]+$/.test(code)).toBe(false);
    // locked: its own purposes, which an older copy does not know (it knew 1–4)
    const key = await keyFromPhrase('lantern orbit river velvet');
    const locked = await encodeLockedSignal({ k: 'o', sdp: GATHERED, relayOnly: true }, key);
    const bytes = unb64url(locked.slice(1));
    expect(lockedPurpose(bytes)).toBe('rtc-offer-relay');
    expect(bytes[2]).toBe(PURPOSES['rtc-offer-relay']);
    expect([1, 2, 3, 4]).not.toContain(bytes[2]);
    expect(inviteMode(locked)).toBe('private');
    const opened = await openCode(locked, 'o', key);
    expect(opened.ok && opened.signal.relayOnly).toBe(true);
    expect(opened.ok && nonRelayCandidates(opened.signal.sdp)).toBe(0);
    // a direct code stays a direct one
    const direct = await encodeSignal({ k: 'o', sdp: GATHERED });
    expect(inviteMode(direct)).toBe('direct');
    expect((await decodeSignal(direct, 'o'))?.relayOnly).toBeUndefined();
    // a format from a newer version of the site is named as such, not as garbage
    expect(inviteMode('7AAAAAAAAAAAAAAAAAAAA')).toBe('newer');
    expect(await openCode('7AAAAAAAAAAAAAAAAAAAA', 'o')).toEqual({ ok: false, why: 'newer' });
    expect(inviteProblem('newer')).toBe(NEWER_CODE);
  }, 20_000);

  it('the browser is told to relay only, through the TURN servers, with no STUN server', () => {
    expect(rtcConfig({ iceServers: ['stun:stun.example.test:3478'] }, TURN)).toEqual({
      iceServers: [{ urls: ['turns:turn.example.test:5349'], username: '1767225600:nct', credential: 'c2VjcmV0' }],
      iceTransportPolicy: 'relay',
    });
    expect(rtcConfig({ iceServers: ['stun:stun.example.test:3478'] }, null)).toEqual({ iceServers: [{ urls: ['stun:stun.example.test:3478'] }] });
    expect(rtcConfig({ iceServers: [] }, [{ urls: ['turn:t.example.test'], username: '', credential: '' }])).toEqual({ iceServers: [{ urls: ['turn:t.example.test'] }], iceTransportPolicy: 'relay' });
  });
});

describe('hostOffer / guestAnswer in a private connection', () => {
  it('the host: relay only, a private invite that names only the relay, and no code when no relay was reached', async () => {
    const h = await hostOffer({ iceServers: ['stun:stun.example.test:3478'], relay: TURN });
    expect(FakePC.made[0]!.config).toMatchObject({ iceTransportPolicy: 'relay' });
    expect(h.code[0]).toBe('3');
    expect(h.info).toMatchObject({ relay: [RELAY_ADDR], publicV4: [], publicV6: [], lan: [], mdns: 0 });
    const inv = await decodeSignal(h.code, 'o');
    expectNoAddresses(inv!.sdp, 'the private invite', [RELAY_ADDR], { mdns: false });
    FakePC.sdp = NO_RELAY;
    await expect(hostOffer({ iceServers: [], relay: TURN })).rejects.toThrow(NO_RELAY_REACHED);
    expect(FakePC.made.at(-1)!.closed).toBe(true);
  });

  it("the host refuses a reply that would connect directly (an older copy's, or one naming another address), and says why", async () => {
    const h = await hostOffer({ iceServers: [], relay: TURN });
    const pc = FakePC.made[0]!;
    const direct = await encodeSignal({ k: 'a', sdp: GATHERED });
    expect(await h.accept(direct)).toMatch(/would connect directly/);
    // a "private" reply carrying a reflexive candidate (made by hand: the site never makes one)
    const json = JSON.stringify({ k: 'a', s: sdp([...HEAD, 'a=candidate:3 1 udp 1686052607 198.51.100.20 50000 typ srflx raddr 0.0.0.0 rport 0', `a=candidate:5 1 udp 41885439 ${RELAY_ADDR} 3478 typ relay raddr 0.0.0.0 rport 0`, ...TAIL]) });
    const forged = `3${Buffer.from([0, ...Buffer.from(json)]).toString('base64url')}`;
    expect((await decodeSignal(forged, 'a'))?.relayOnly).toBe(true);
    expect(await h.accept(forged)).toMatch(/would connect directly/);
    expect(pc.remote).toBeNull();
    const good = await encodeSignal({ k: 'a', sdp: GATHERED, relayOnly: true });
    expect(await h.accept(good)).toBeNull();
    expect(nonRelayCandidates(pc.remote!.sdp)).toBe(0);
    // and a direct host refuses a private reply (it belongs to another invite)
    const d = await hostOffer({ iceServers: ['stun:stun.example.test:3478'] });
    expect(FakePC.made.at(-1)!.config.iceTransportPolicy).toBeUndefined();
    expect(await d.accept(good)).toMatch(/private invite/);
  });

  it('the guest answers a private invite privately, or not at all; a direct invite only when allowed', async () => {
    const inv = await encodeSignal({ k: 'o', sdp: GATHERED, relayOnly: true });
    expect(await guestAnswer(inv, { iceServers: ['stun:stun.example.test:3478'] })).toEqual({ error: NO_RELAY_HERE, why: 'no-relay' });
    expect(await guestAnswer(inv, { iceServers: [], relayFor: async () => [] })).toEqual({ error: NO_RELAY_HERE, why: 'no-relay' });
    expect(await guestAnswer(inv, { iceServers: [], relayFor: async () => Promise.reject(new Error('no credentials')) })).toEqual({ error: 'no credentials', why: 'no-relay' });
    expect(FakePC.made).toHaveLength(0);
    const r = await guestAnswer(inv, { iceServers: ['stun:stun.example.test:3478'], relayFor: async () => TURN });
    expect('code' in r).toBe(true);
    if (!('code' in r)) return;
    expect(FakePC.made[0]!.config).toMatchObject({ iceTransportPolicy: 'relay' });
    expect(nonRelayCandidates(FakePC.made[0]!.remote!.sdp)).toBe(0);
    expect(r.code[0]).toBe('3');
    const reply = await decodeSignal(r.code, 'a');
    expectNoAddresses(reply!.sdp, 'the private reply', [RELAY_ADDR], { mdns: false });
    // no relay reached: no reply, and nothing direct
    FakePC.sdp = NO_RELAY;
    expect(await guestAnswer(inv, { iceServers: [], relayFor: async () => TURN })).toEqual({ error: NO_RELAY_REACHED, why: 'no-relay' });
    // a direct invite on a site that offers private ones: only when the player chose it
    FakePC.sdp = GATHERED;
    const direct = await encodeSignal({ k: 'o', sdp: GATHERED });
    expect(await guestAnswer(direct, { iceServers: [], directOk: false })).toEqual({ error: DIRECT_NOT_CHOSEN, why: 'direct' });
    const ok = await guestAnswer(direct, { iceServers: ['stun:stun.example.test:3478'], directOk: true });
    expect('code' in ok && ok.code[0]).toBe('1');
  });
});

describe('TURN relays from the site config and the credentials endpoint', () => {
  const mp = (o: Partial<{ turnServers: TurnServer[]; turnCredentialsUrl: string }> = {}) => ({ ...defaultSiteConfig().multiplayer, ...o });
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

  it('a private connection is offered only with a list or an endpoint', () => {
    expect(privateAvailable(defaultSiteConfig().multiplayer)).toBe(false);
    expect(privateAvailable(mp({ turnServers: TURN }))).toBe(true);
    expect(privateAvailable(mp({ turnCredentialsUrl: 'https://creds.example.test/' }))).toBe(true);
  });

  it("the endpoint's answer is checked strictly", () => {
    expect(readTurnResponse(JSON.stringify({ iceServers: [{ urls: ['stun:s.example.test', 'turns:t.example.test:5349'], username: 'u', credential: 'c' }, { urls: 'stun:only.example.test' }], ttl: 3600 }))).toEqual({
      servers: [{ urls: ['turns:t.example.test:5349'], username: 'u', credential: 'c' }],
      ttl: 3600,
    });
    expect(readTurnResponse(JSON.stringify({ iceServers: { urls: 'turn:t.example.test', username: 'u', credential: 'c' } }))).toMatchObject({ servers: [{ urls: ['turn:t.example.test'] }], ttl: null });
    for (const bad of [
      'not json',
      '[]',
      JSON.stringify({}),
      JSON.stringify({ iceServers: [] }),
      JSON.stringify({ iceServers: [{ urls: ['http://t.example.test'], username: 'u', credential: 'c' }] }),
      JSON.stringify({ iceServers: [{ urls: ['turn:t.example.test'] }] }),
      JSON.stringify({ iceServers: [{ urls: ['turn:t.example.test'], username: 'u', credential: 'x'.repeat(600) }] }),
      JSON.stringify({ iceServers: [{ urls: ['turn:t.example.test'], username: 'u', credential: 'c' }], ttl: -1 }),
      `{"iceServers":[],"pad":"${'x'.repeat(20_000)}"}`,
    ])
      expect('error' in readTurnResponse(bad), bad.slice(0, 80)).toBe(true);
  });

  it('fresh credentials when the endpoint answers; the static list, said so, when it fails; otherwise no private code at all', async () => {
    const url = 'https://creds.example.test/turn';
    const good = answer({ iceServers: [{ urls: ['turns:fresh.example.test:5349'], username: '1767225600:x', credential: 'abc' }], ttl: 600 });
    expect(await turnServersFor(mp({ turnCredentialsUrl: url, turnServers: TURN }), { fetch: good })).toEqual({ servers: [{ urls: ['turns:fresh.example.test:5349'], username: '1767225600:x', credential: 'abc' }], fallback: null });
    expect(good).toHaveBeenCalledWith(url, expect.objectContaining({ method: 'GET', credentials: 'omit', cache: 'no-store' }));
    const down = answer('nope', 503);
    const fb = await turnServersFor(mp({ turnCredentialsUrl: url, turnServers: TURN }), { fetch: down });
    expect(fb.servers).toEqual(TURN);
    expect(fb.fallback).toMatch(/503.*fixed relay list/);
    await expect(turnServersFor(mp({ turnCredentialsUrl: url }), { fetch: down })).rejects.toThrow(/no direct connection was tried/);
    const garbage = answer({ iceServers: [{ urls: ['turn:t.example.test'] }] });
    await expect(turnServersFor(mp({ turnCredentialsUrl: url }), { fetch: garbage })).rejects.toThrow(/no username or credential/);
    // an endpoint that never answers is given up on in time
    const hang = vi.fn(() => new Promise<Response>(() => undefined));
    const t = Date.now();
    await expect(turnServersFor(mp({ turnCredentialsUrl: url }), { fetch: hang as unknown as typeof fetch, timeoutMs: 30 })).rejects.toThrow(/no answer in time/);
    expect(Date.now() - t).toBeLessThan(2000);
    // no endpoint: the static list, or nothing
    expect(await turnServersFor(mp({ turnServers: TURN }), { fetch: hang as unknown as typeof fetch })).toEqual({ servers: TURN, fallback: null });
    expect(hang).toHaveBeenCalledTimes(1);
    await expect(turnServersFor(mp())).rejects.toThrow(/no relay server/);
  });

  it('sanitizeSdp relay-only keeps the relay candidate and nothing that names the player', () => {
    const out = sanitizeSdp(GATHERED, { relayOnly: true });
    expectNoAddresses(out, 'relay-only', [RELAY_ADDR], { mdns: false });
    expect(out).toContain('typ relay raddr 0.0.0.0 rport 0');
  });
});
