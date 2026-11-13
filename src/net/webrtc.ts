// The WebRTC link (src/net/): one data channel between the two browsers, set up by hand with no signalling server.
// The host makes an offer and gets an invite code (its connection details, compressed); the guest opens it and gets a
// reply code; the host pastes the reply and the channel opens. Each code holds the whole session description with its
// network candidates (gathered before the code is shown, so there is nothing more to exchange). The STUN servers come
// from the site config (`multiplayer.iceServers`); none means same-network play only. Kept thin: the browser does the
// work, and the codes are the only part that can be tested without one (encodeSignal / decodeSignal).
import type { LinkState, Transport } from './transport';

/** What a code carries. */
export interface Signal {
  /** 'o' an invite (offer), 'a' a reply (answer) */
  k: 'o' | 'a';
  sdp: string;
}

/** Codes over this length don't go in a link (the invite is then copied as a code). */
export const MAX_LINK_CODE = 1800;
/** A message over this size is sent in pieces (data channels differ in what they take in one message). */
const CHUNK = 15_000;
/** How long to wait for the network candidates before making the code with what there is. */
const GATHER_MS = 5000;

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const t = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i);
  return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/**
 * A signal as a code: "1" + deflate + base64url where the browser can compress, else "0" + base64url. Only the lines a
 * data channel needs are kept, so the code stays short enough for a link.
 */
export async function encodeSignal(s: Signal): Promise<string> {
  const text = JSON.stringify({ k: s.k, s: trimSdp(s.sdp) });
  const raw = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'undefined') {
    try {
      return `1${b64url(await pipe(raw, new CompressionStream('deflate-raw')))}`;
    } catch {
      /* fall through to plain */
    }
  }
  return `0${b64url(raw)}`;
}

/** A code back to its signal, or null when it is not one (pasted wrong, cut short, or not a code at all). */
export async function decodeSignal(code: string, want: Signal['k']): Promise<Signal | null> {
  const c = code.trim().replace(/\s+/g, '');
  if (c.length < 10 || c.length > 20_000 || !/^[01][A-Za-z0-9_-]+$/.test(c)) return null;
  try {
    let bytes = unb64url(c.slice(1));
    if (c[0] === '1') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    const v = JSON.parse(new TextDecoder().decode(bytes)) as { k?: unknown; s?: unknown };
    if (v.k !== want || typeof v.s !== 'string' || !v.s.startsWith('v=0') || v.s.length > 20_000) return null;
    return { k: want, sdp: v.s };
  } catch {
    return null;
  }
}

/** The invite's code from a link (#/play/join/<code>) or the code itself, pasted. */
export function codeFromText(text: string): string {
  const t = text.trim();
  const m = t.match(/#\/play\/join\/([A-Za-z0-9_-]+)/);
  return m ? m[1]! : t;
}

/** Drop SDP lines a data channel doesn't use (they only make the code longer). */
export function trimSdp(sdp: string): string {
  const drop = /^a=(extmap-allow-mixed|msid-semantic)/;
  return sdp
    .split(/\r?\n/)
    .filter((l) => l && !drop.test(l))
    .join('\r\n')
    .concat('\r\n');
}

function waitForCandidates(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((res) => {
    const t = setTimeout(res, GATHER_MS);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        res();
      }
    });
  });
}

/** One data channel as a Transport. Long messages go in pieces ("<id>|<k>|<n>|" + piece) and are joined on arrival. */
class ChannelTransport implements Transport {
  onMessage: ((text: string) => void) | null = null;
  onState: ((s: LinkState) => void) | null = null;
  state: LinkState = 'connecting';
  private parts = new Map<string, string[]>();
  private seq = 0;
  constructor(
    private pc: RTCPeerConnection,
    private ch: RTCDataChannel,
  ) {
    ch.onopen = () => this.set('open');
    ch.onclose = () => this.set('closed');
    ch.onerror = () => this.set('closed');
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.set('closed');
    });
    ch.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      this.piece(e.data);
    };
    if (ch.readyState === 'open') this.state = 'open';
  }
  private set(s: LinkState) {
    if (this.state === s || this.state === 'closed') return;
    this.state = s;
    this.onState?.(s);
  }
  private piece(data: string) {
    if (data[0] !== '~') {
      this.onMessage?.(data);
      return;
    }
    const m = data.match(/^~(\d+)\|(\d+)\|(\d+)\|/);
    if (!m) return;
    const [, id, k, n] = m;
    const total = Number(n);
    if (total > 200) return;
    const list = this.parts.get(id!) ?? [];
    list[Number(k)] = data.slice(m[0].length);
    this.parts.set(id!, list);
    if (list.filter((x) => x !== undefined).length === total) {
      this.parts.delete(id!);
      this.onMessage?.(list.join(''));
    }
  }
  send(text: string) {
    if (this.state !== 'open') return;
    try {
      if (text.length <= CHUNK && text[0] !== '~') {
        this.ch.send(text);
        return;
      }
      const id = this.seq++;
      const n = Math.ceil(text.length / CHUNK);
      for (let k = 0; k < n; k++) this.ch.send(`~${id}|${k}|${n}|${text.slice(k * CHUNK, (k + 1) * CHUNK)}`);
    } catch {
      this.set('closed');
    }
  }
  close() {
    this.set('closed');
    try {
      this.ch.close();
      this.pc.close();
    } catch {
      /* already closed */
    }
  }
}

const rtcConfig = (iceServers: readonly string[]): RTCConfiguration => ({ iceServers: iceServers.length ? [{ urls: [...iceServers] }] : [] });

export const webrtcAvailable = () => typeof RTCPeerConnection !== 'undefined';

/** The host's side: make the invite code, then take the guest's reply code. */
export async function hostOffer(iceServers: readonly string[]): Promise<{ code: string; transport: Transport; accept: (reply: string) => Promise<string | null> }> {
  const pc = new RTCPeerConnection(rtcConfig(iceServers));
  const ch = pc.createDataChannel('nct', { ordered: true });
  const transport = new ChannelTransport(pc, ch);
  await pc.setLocalDescription(await pc.createOffer());
  await waitForCandidates(pc);
  const code = await encodeSignal({ k: 'o', sdp: pc.localDescription?.sdp ?? '' });
  const accept = async (reply: string): Promise<string | null> => {
    const s = await decodeSignal(codeFromText(reply), 'a');
    if (!s) return 'That is not a reply code. Ask your friend to copy the whole reply code again.';
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp: s.sdp });
      return null;
    } catch (e) {
      return `The reply code could not be used (${(e as Error).message}). Make a new invite and try again.`;
    }
  };
  return { code, transport, accept };
}

/** The guest's side: take the invite code, make the reply code. */
export async function guestAnswer(invite: string, iceServers: readonly string[]): Promise<{ code: string; transport: Transport } | { error: string }> {
  const s = await decodeSignal(codeFromText(invite), 'o');
  if (!s) return { error: 'That is not an invite code or link. Ask the host to copy it again.' };
  const pc = new RTCPeerConnection(rtcConfig(iceServers));
  let transport: Transport | null = null;
  const ready = new Promise<Transport>((res) => {
    pc.ondatachannel = (e) => {
      transport = new ChannelTransport(pc, e.channel);
      res(transport);
    };
  });
  try {
    await pc.setRemoteDescription({ type: 'offer', sdp: s.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
  } catch (e) {
    pc.close();
    return { error: `The invite could not be used (${(e as Error).message}). Ask the host for a new one.` };
  }
  await waitForCandidates(pc);
  const code = await encodeSignal({ k: 'a', sdp: pc.localDescription?.sdp ?? '' });
  // the channel object arrives once the host has the reply; until then a stand-in forwards to it
  return { code, transport: deferredTransport(ready, pc) };
}

/** A transport whose channel arrives later (the guest's, before the host has pasted the reply). */
function deferredTransport(ready: Promise<Transport>, pc: RTCPeerConnection): Transport {
  const t: Transport & { state: LinkState } = {
    onMessage: null,
    onState: null,
    state: 'connecting',
    send: () => undefined,
    close: () => {
      t.state = 'closed';
      pc.close();
    },
  };
  void ready.then((real) => {
    if (t.state === 'closed') {
      real.close();
      return;
    }
    real.onMessage = (x) => t.onMessage?.(x);
    real.onState = (s) => {
      t.state = s;
      t.onState?.(s);
    };
    t.send = (x) => real.send(x);
    t.close = () => {
      t.state = 'closed';
      real.close();
    };
    if (real.state === 'open') {
      t.state = 'open';
      t.onState?.('open');
    }
  });
  return t;
}
