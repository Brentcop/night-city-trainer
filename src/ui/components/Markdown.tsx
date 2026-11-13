// Tiny markdown renderer (headings, lists, tables, bold/italic/code, links, blockquotes, paragraphs). Card names in
// the text, bold and italics are card mentions (CardMention.tsx); never inside code or a link's text.
import { Fragment } from 'react';
import { MentionText } from './CardMention';

/**
 * Link targets we render as clickable: in-app hash routes and http(s)/mailto URLs. Anything else (javascript:, data:,
 * vbscript:, relative paths…) is shown as plain text. Text can come from user-supplied deck names, so this matters.
 */
export function safeHref(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  // browsers ignore leading/trailing whitespace and control characters, and strip tabs/newlines inside a scheme
  const href = raw.replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  if (!href) return null;
  if (href.startsWith('#')) return href;
  const scheme = href.replace(/[\t\n\r]/g, '').match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto' ? href : null;
}

function inline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(<MentionText key={k++} text={s.slice(last, m.index)} />);
    const t = m[0];
    if (t.startsWith('**'))
      out.push(
        <b key={k++}>
          <MentionText text={t.slice(2, -2)} />
        </b>,
      );
    else if (t.startsWith('`')) out.push(<code key={k++}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) {
      const mm = t.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      const href = safeHref(mm[2]);
      out.push(
        href ? (
          <a key={k++} href={href} target={href.startsWith('#') ? undefined : '_blank'} rel="noreferrer">
            {mm[1]}
          </a>
        ) : (
          <span key={k++}>{mm[1]}</span>
        ),
      );
    } else
      out.push(
        <i key={k++}>
          <MentionText text={t.slice(1, -1)} />
        </i>,
      );
    last = m.index + t.length;
  }
  if (last < s.length) out.push(<MentionText key={k++} text={s.slice(last)} />);
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lvl = Math.min(4, h[1].length + 1);
      const content = inline(h[2]);
      blocks.push(lvl === 2 ? <h2 key={key++}>{content}</h2> : lvl === 3 ? <h3 key={key++}>{content}</h3> : <h4 key={key++}>{content}</h4>);
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s|:-]+\|$/.test(lines[i].trim())) rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      blocks.push(
        <div className="scroll-x" key={key++}>
          <table>
            <thead>
              <tr>{rows[0].map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      const lis = items.map((it, j) => <li key={j}>{inline(it)}</li>);
      blocks.push(ordered ? <ol key={key++}>{lis}</ol> : <ul key={key++}>{lis}</ul>);
      continue;
    }
    if (line.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key++}>{inline(q.join(' '))}</blockquote>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||>|\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key++}>{inline(para.join(' '))}</p>);
  }
  return (
    <div className="md">
      {blocks.map((b, j) => (
        <Fragment key={j}>{b}</Fragment>
      ))}
    </div>
  );
}
