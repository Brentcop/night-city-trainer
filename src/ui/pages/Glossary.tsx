import { useState } from 'react';
import { GLOSSARY } from '../../content/glossary';
import { PageHead } from '../components/PageHead';
import { MentionText } from '../components/CardMention';

/** `initial`: a term to search for at once (`#/glossary?q=Lag`, the tutorial's links). */
export function GlossaryPage({ initial }: { initial?: string }) {
  const [q, setQ] = useState(initial ?? '');
  const groups = [...new Set(GLOSSARY.map((t) => t.group))];
  const match = (t: (typeof GLOSSARY)[number]) => !q || JSON.stringify(t).toLowerCase().includes(q.toLowerCase());
  return (
    <div className="grid">
      <PageHead kicker="Learn" title="Glossary & bot toolkit" actions={<input aria-label="Search terms" placeholder="Search terms…" value={q} onChange={(e) => setQ(e.target.value)} />}>
        Every term is defined from the official Comprehensive Rules (rule numbers cited). <b>Engine</b> notes say how this simulator models it;{' '}
        <b>Bot</b> notes say how the practice bots reason about it — so you know exactly what you are practicing against.
      </PageHead>
      {groups.every((g) => !GLOSSARY.some((t) => t.group === g && match(t))) && <div className="empty-state">No terms match “{q}”.</div>}
      {groups.map((g) => {
        const items = GLOSSARY.filter((t) => t.group === g && match(t));
        if (!items.length) return null;
        return (
          <div key={g} className="panel">
            <h2 className="rule-head">{g}</h2>
            {items.map((t) => (
              <div key={t.term} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="spread">
                  <b>{t.term}</b>
                  {t.rule && <span className="tag">{t.rule}</span>}
                </div>
                <div>
                  <MentionText text={t.def} />
                </div>
                {t.engine && (
                  <div className="small muted">
                    <b>Engine:</b> <MentionText text={t.engine} />
                  </div>
                )}
                {t.bot && (
                  <div className="small" style={{ color: 'var(--cyan)' }}>
                    <b>Bot:</b> <MentionText text={t.bot} />
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
