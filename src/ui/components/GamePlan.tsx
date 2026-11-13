// The deck profile's "Game plan" block: the deck's strategy note from src/content/deckObjectives (objective, plan, key
// cards, success signals, risks), with where the note came from and whether it still matches the current list.
import { useId } from 'react';
import { CARD_BY_ID, cardLabel } from '../../engine/cards';
import type { LibraryDeck } from '../../lib/library';
import { objectiveFor, VOCABULARY, type DeckObjective, type PlanPhase, type SignalTerm } from '../../content/deckObjectives';
import { safeHref } from './Markdown';
import { profileHref } from './DeckStats';
import { CardMention, MentionText } from './CardMention';

const PHASE: Record<PlanPhase, string> = { early: 'Early', mid: 'Mid game', closing: 'Closing' };

function Credit({ note, lib }: { note: DeckObjective; lib: readonly LibraryDeck[] }) {
  if (note.status === 'needs-owner') return <>Needs the owner’s notes</>;
  const g = note.guide;
  const href = safeHref(g?.url);
  const external = !!href && !href.startsWith('#');
  const title =
    g &&
    (href ? (
      <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {g.title}
      </a>
    ) : (
      <>{g.title}</>
    ));
  const lead = note.status === 'owner' ? 'Owner’s notes' : 'Draft';
  if (note.source === 'guide' && g)
    return g.site === 'choom.gg' ? (
      <>
        {lead} from the choom.gg guide by {g.author} ({title})
      </>
    ) : (
      <>
        {lead} from the Strategy page guide {title}
      </>
    );
  if (note.source === 'parent') {
    const parents = (note.basedOn ?? []).map((f) => lib.find((d) => d.file === f));
    return (
      <>
        {lead} from the parent deck’s notes
        {parents.length > 0 && ' ('}
        {parents.map((p, i) => (
          <span key={note.basedOn![i]}>
            {i > 0 && ', '}
            {p ? <a href={profileHref(p.file)}>{p.deck.name}</a> : note.basedOn![i]}
          </span>
        ))}
        {parents.length > 0 && ')'}
        {' '}and what changed
      </>
    );
  }
  return <>{lead} from the list</>;
}

export function GamePlanPanel({ d, lib }: { d: Pick<LibraryDeck, 'file' | 'deck'>; lib: readonly LibraryDeck[] }) {
  const headingId = useId();
  const found = objectiveFor(d.file, d.deck);
  if (!found)
    return (
      <section className="panel flair dp-plan" aria-labelledby={headingId}>
        <h2 id={headingId} className="dp-section-title rule-head">
          Game plan
        </h2>
        <p className="dp-plan-status muted">No game plan has been written for this deck yet.</p>
      </section>
    );
  const { note, current } = found;
  const terms = [...new Set(note.signals.flatMap((s) => s.terms))] as SignalTerm[];
  return (
    <section className={`panel flair dp-plan is-${note.status}`} aria-labelledby={headingId}>
      <div className="rec-head">
        <h2 id={headingId} className="dp-section-title rule-head">
          Game plan
        </h2>
        <p className={`dp-plan-status status-${note.status}`}>
          <Credit note={note} lib={lib} />
        </p>
      </div>
      {!current && (
        <p className="dp-plan-warn" role="note">
          <span aria-hidden="true">⚠ </span>Written for an earlier version of this list, so the note may be out of date.
        </p>
      )}
      {note.placeholder && (
        <p className="dp-plan-warn" role="note">
          <span aria-hidden="true">✎ </span>Placeholder read off the list until the owner writes this deck’s plan.
        </p>
      )}
      <p className="dp-plan-objective">
        <MentionText text={note.objective} />
      </p>
      <div className="dp-plan-grid">
        <div>
          <h3 className="zone-label">Plan</h3>
          <ol className="dp-plan-steps">
            {note.plan.map((s, i) => (
              <li key={i}>
                <b>{PHASE[s.phase]}:</b> <MentionText text={s.text} />
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="zone-label">Key cards</h3>
          <ul className="dp-plan-list">
            {note.keyCards.map((k) => (
              <li key={k.id}>
                {/* the note knows the card: linked by id */}
                <b>{CARD_BY_ID[k.id] ? <CardMention id={k.id}>{cardLabel(CARD_BY_ID[k.id])}</CardMention> : k.id}</b> — <MentionText text={k.role} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="zone-label">Signs it’s working</h3>
          <ul className="dp-plan-list">
            {note.signals.map((s) => (
              <li key={s.text}>
                <MentionText text={s.text} />
              </li>
            ))}
          </ul>
          <details className="dp-plan-terms small">
            <summary>What these terms mean</summary>
            <dl>
              {terms.map((t) => (
                <div key={t}>
                  <dt>{t}</dt>
                  <dd>{VOCABULARY[t]}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
        {note.risks.length > 0 && (
          <div>
            <h3 className="zone-label">Risks</h3>
            <ul className="dp-plan-list">
              {note.risks.map((r) => (
                <li key={r}>
                  <MentionText text={r} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
