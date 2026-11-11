import { useState } from 'react';
import { GLOSSARY } from '../../content/glossary';

export function GlossaryPage() {
  const [q, setQ] = useState('');
  const groups = [...new Set(GLOSSARY.map((t) => t.group))];
  const match = (t: (typeof GLOSSARY)[number]) => !q || JSON.stringify(t).toLowerCase().includes(q.toLowerCase());
  return (
    <div className="grid">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Glossary &amp; bot toolkit</h1>
        <input aria-label="Search terms" placeholder="Search terms…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="muted">
        Every term is defined from the official Comprehensive Rules (rule numbers cited). <b>Engine</b> notes say how this simulator models it;{' '}
        <b>Bot</b> notes say how the practice bots reason about it — so you know exactly what you are practicing against.
      </p>
      {groups.map((g) => {
        const items = GLOSSARY.filter((t) => t.group === g && match(t));
        if (!items.length) return null;
        return (
          <div key={g} className="panel">
            <h2>{g}</h2>
            {items.map((t) => (
              <div key={t.term} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="spread">
                  <b>{t.term}</b>
                  {t.rule && <span className="tag">{t.rule}</span>}
                </div>
                <div>{t.def}</div>
                {t.engine && (
                  <div className="small muted">
                    <b>Engine:</b> {t.engine}
                  </div>
                )}
                {t.bot && (
                  <div className="small" style={{ color: 'var(--cyan)' }}>
                    <b>Bot:</b> {t.bot}
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
