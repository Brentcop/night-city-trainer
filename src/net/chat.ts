// The players' chat in an online game: plain text only, one line, capped at CHAT_MAX characters, and rate-limited on
// both ends (a sender is held to CHAT_RATE messages per CHAT_WINDOW_MS; the receiver drops anything faster). It lives in
// memory for the game only; it is kept after the game only when a player exports the game. Rendered as text by React
// (no HTML, no links).
export const CHAT_MAX = 300;
export const CHAT_RATE = 5;
export const CHAT_WINDOW_MS = 10_000;
/** what the receiver allows (a little looser than the sender's limit, so clock differences never drop a fair message) */
export const CHAT_RECEIVE_RATE = 8;
export const CHAT_KEEP = 200;
export const QUICK_PHRASES = ['gg', 'Good luck!', 'One moment…', 'Nice play!'] as const;

export interface ChatLine {
  from: 'me' | 'rival' | 'system';
  text: string;
  at: number;
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩]/g;

/** A message as it may be sent: control and direction characters out, one line, trimmed, capped. '' = nothing to send. */
export function cleanChat(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').replace(CONTROL, '').trim().slice(0, CHAT_MAX);
}

/** Times within the window, newest last; whether one more fits under `limit`. */
function underLimit(times: number[], now: number, limit: number): boolean {
  while (times.length && now - times[0]! >= CHAT_WINDOW_MS) times.shift();
  return times.length < limit;
}

export class Chat {
  lines: ChatLine[] = [];
  muted = false;
  /** messages from the rival not seen yet (counted while the panel is closed and not muted) */
  unread = 0;
  /** a line from the rival dropped by the rate limit (said once per burst) */
  private sent: number[] = [];
  private got: number[] = [];
  private droppedNoted = false;

  /** Ms until another message may be sent (0 = now). */
  waitMs(now = Date.now()): number {
    if (underLimit(this.sent, now, CHAT_RATE)) return 0;
    return CHAT_WINDOW_MS - (now - this.sent[0]!);
  }

  /** Record your own message; returns the text to send, or null when it is empty or over the rate limit. */
  outgoing(text: string, now = Date.now()): string | null {
    const t = cleanChat(text);
    if (!t || !underLimit(this.sent, now, CHAT_RATE)) return null;
    this.sent.push(now);
    this.push({ from: 'me', text: t, at: now });
    return t;
  }

  /** A message from the rival; false when dropped (rate limit or empty). `seen`: the panel is open. */
  incoming(text: string, seen: boolean, now = Date.now()): boolean {
    const t = cleanChat(text);
    if (!t) return false;
    if (!underLimit(this.got, now, CHAT_RECEIVE_RATE)) {
      if (!this.droppedNoted) this.push({ from: 'system', text: 'Some chat messages arrived too fast and were left out.', at: now });
      this.droppedNoted = true;
      return false;
    }
    this.droppedNoted = false;
    this.got.push(now);
    if (this.muted) return true;
    this.push({ from: 'rival', text: t, at: now });
    if (!seen) this.unread++;
    return true;
  }

  note(text: string, now = Date.now()) {
    this.push({ from: 'system', text, at: now });
  }

  private push(l: ChatLine) {
    this.lines.push(l);
    if (this.lines.length > CHAT_KEEP) this.lines.splice(0, this.lines.length - CHAT_KEEP);
  }
}
