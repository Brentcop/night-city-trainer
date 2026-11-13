// The online game's chat (src/net/chat.ts) in the side panel's Chat tab: plain text only (React renders it as text, no
// links), capped and rate-limited, a few quick phrases, and a mute switch. Nothing is kept after the game unless the
// game is exported.
import { useEffect, useId, useRef, useState } from 'react';
import { CHAT_MAX, QUICK_PHRASES, type Chat } from '../../../net/chat';

export function ChatPanel({ chat, rival, onSend, onMute, v }: { chat: Chat; rival: string; onSend: (text: string) => boolean; onMute: (on: boolean) => void; v: number }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const n = chat.lines.length;
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [n, v]);
  const send = (t: string) => {
    if (!t.trim()) return;
    if (onSend(t)) {
      setText('');
      setNote(null);
    } else {
      const wait = Math.ceil(chat.waitMs() / 1000);
      setNote(wait > 0 ? `Slow down: you can send again in ${wait} s.` : 'Not sent.');
    }
  };
  return (
    <div className="pb-chat">
      <div className="pb-chat-lines" ref={list} aria-live="polite" aria-label={`Chat with ${rival}`}>
        {!n && <div className="muted small">No messages yet. Messages are plain text and are not kept after the game unless you export it.</div>}
        {chat.lines.map((l, i) => (
          <div key={i} className={`pb-chat-line pb-chat-${l.from}`}>
            {l.from !== 'system' && <b>{l.from === 'me' ? 'You' : rival}: </b>}
            {l.text}
          </div>
        ))}
      </div>
      <div className="pb-chat-quick" aria-label="Quick phrases">
        {QUICK_PHRASES.map((p) => (
          <button key={p} type="button" className="ghost" onClick={() => send(p)}>
            {p}
          </button>
        ))}
      </div>
      <form
        className="pb-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label htmlFor={id} className="sr-only">
          Message
        </label>
        <input id={id} type="text" value={text} maxLength={CHAT_MAX} onChange={(e) => setText(e.target.value)} placeholder="Message" autoComplete="off" />
        <button type="submit" disabled={!text.trim()}>
          Send
        </button>
      </form>
      <div className="pb-chat-foot small muted">
        <label>
          <input type="checkbox" checked={chat.muted} onChange={(e) => onMute(e.target.checked)} /> Mute {rival}
        </label>
        {note && <span role="status">{note}</span>}
      </div>
    </div>
  );
}
