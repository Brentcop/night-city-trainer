// One recorded run (#/evidence/<listId>/run/<token>; docs/EVIDENCE.md "The page"): the tool, date, bot and simulator
// version (greyed when stale), its rule in words, its games, what it could detect when it was recorded, and its trials
// as a table: the change with its cards, card or package, the screening figure (greyed, named as screening), the
// held-out figure with its looks, the outcome, and the figure over all runs when there is one.
import { type DeckEvidence, type RunRecord } from '../../../lib/findings';
import { pooledWords, RUN_WORDS, runBotWords, runDetectWords, runTitleWords, staleWords, TRIAL_KIND_WORDS, TRIAL_OUTCOME_WORDS, trialHeldOutWords, trialScreenWords } from '../../../lib/findingWords';
import { cardNamesIn, deckEvidenceHref, overviewHref, parseChangeKey } from '../../../lib/evidenceView';
import { CURRENT_SIM_VERSION } from '../../../lib/playedRecord';
import { PageHead } from '../PageHead';
import { DeckName } from './DeckView';
import { ChangeLabel } from './parts';

const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function RunView({ deck, run }: { deck: Pick<DeckEvidence, 'listId' | 'deck' | 'file' | 'findings'>; run: RunRecord }) {
  const names = cardNamesIn([...run.trials.map((t) => t.label), ...deck.findings.flatMap((f) => (f.subject.change ? [f.subject.change.label] : []))]);
  return (
    <div className="grid ev-page">
      <PageHead kicker="Evidence · a recorded run" title={runTitleWords(run)}>
        <DeckName name={deck.deck} file={deck.file} /> · <a href={deckEvidenceHref(deck.listId)}>{RUN_WORDS.backToDeck}</a> · <a href={overviewHref}>{RUN_WORDS.allDecks}</a>
      </PageHead>
      <section className={`panel ev-block${run.stale ? ' is-stale' : ''}`} aria-labelledby="ev-run-h">
        <h2 className="ev-h2 rule-head" id="ev-run-h">
          {RUN_WORDS.howTitle}
        </h2>
        <p>
          {runBotWords(run)}, simulator version {run.simVersion}
          {run.games !== null ? ` · ${thousands(run.games)} games` : ''}
        </p>
        {run.stale && <p className="ev-note ev-stale-note small">{staleWords(run.simVersion, CURRENT_SIM_VERSION)}</p>}
        {!run.rule && !run.detect ? (
          <p>{RUN_WORDS.noRuleNorDetect}</p>
        ) : (
          <>
            <p>{run.rule ?? RUN_WORDS.noRule}</p>
            <p>{run.detect ? runDetectWords(run.detect) : RUN_WORDS.noDetect}</p>
          </>
        )}
        {run.ledgerRun && <p className="small">{RUN_WORDS.keptAcross}</p>}
        <p className="small muted">
          {RUN_WORDS.source} <code>{run.source.file}</code> <code>{run.source.path}</code>
        </p>
      </section>
      <section className="panel ev-block" aria-labelledby="ev-trials-h">
        <h2 className="ev-h2 rule-head" id="ev-trials-h">
          {RUN_WORDS.trialsTitle}
        </h2>
        <p className="ev-intro">{RUN_WORDS.trialsIntro}</p>
        <div className="ev-table-wrap">
          <table className="ev-trials">
            <caption className="sr-only">{RUN_WORDS.trialsTitle}</caption>
            <thead>
              <tr>
                <th scope="col">Change</th>
                <th scope="col" className="ev-col-kind">Kind</th>
                <th scope="col">Screening (not the result)</th>
                <th scope="col">Held-out games</th>
                <th scope="col" className="ev-col-outcome">Outcome</th>
                <th scope="col" className="ev-col-pooled">{RUN_WORDS.pooledHead}</th>
              </tr>
            </thead>
            <tbody>
              {run.trials.map((t, i) => {
                const parts = parseChangeKey(t.key);
                return (
                  <tr key={`${t.key ?? t.label}:${i}`}>
                    <th scope="row" data-label="Change" className="ev-trial-change">
                      {parts ? <ChangeLabel change={{ ...parts, label: t.label }} names={names} /> : t.label}
                    </th>
                    <td data-label="Kind" className="ev-col-kind">{TRIAL_KIND_WORDS[t.kind]}</td>
                    <td data-label="Screening (not the result)" className="ev-screen">
                      {t.screen ? trialScreenWords(t.screen) : RUN_WORDS.none}
                    </td>
                    <td data-label="Held-out games">{t.heldOut ? trialHeldOutWords(t.heldOut) : RUN_WORDS.notConfirmed}</td>
                    <td data-label="Outcome" className="ev-col-outcome">{TRIAL_OUTCOME_WORDS[t.outcome] ?? t.outcome}</td>
                    <td data-label={RUN_WORDS.pooledLabel} className="ev-col-pooled">
                      {t.pooled ? pooledWords(t.pooled) : RUN_WORDS.none}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
