// The deck profile's evidence panel: the deck's findings counted by strength word, from the evidence index (fetched
// when the profile opens), with a link to its evidence page. Shown only for a deck the index has.
import '../../evidence.css';
import type { EvidenceIndex } from '../../../lib/findings';
import { countsWords, DECK_PANEL_WORDS } from '../../../lib/findingWords';
import { deckEvidenceHref } from '../../../lib/evidenceView';
import { useEvidenceIndex } from '../../evidenceData';
import { CountChips } from './parts';

/** The panel for an index entry (rendered directly by tests). */
export function DeckEvidenceSummary({ entry }: { entry: EvidenceIndex['decks'][number] }) {
  return (
    <div className="panel ev-profile-panel">
      <h3 className="ev-h3 rule-head">{DECK_PANEL_WORDS.title}</h3>
      <p className="ev-intro">{countsWords(entry.counts, entry.findings)}</p>
      <CountChips counts={entry.counts} />
      <p className="small muted">{DECK_PANEL_WORDS.intro}</p>
      <p>
        <a className="btn" href={deckEvidenceHref(entry.listId)}>
          {DECK_PANEL_WORDS.link}
        </a>
      </p>
    </div>
  );
}

export function DeckEvidencePanel({ file }: { file: string }) {
  const ix = useEvidenceIndex();
  if (ix.state !== 'ready') return null;
  const entry = ix.data.decks.find((d) => d.file === file);
  return entry ? <DeckEvidenceSummary entry={entry} /> : null;
}
