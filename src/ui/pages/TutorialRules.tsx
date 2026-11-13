// "The rules in five minutes" (#/tutorial/rules): the lessons' ground as short sections to read, with small diagrams
// made from the board's own pieces (cards, card backs, dice). Rule numbers are the Comprehensive Rules' (CR); terms
// link to the Glossary when that page is on.
import { CARD_BY_ID } from '../../engine/cards';
import { CardBack, TcgCard } from '../components/TcgCard';
import { Die } from '../components/Dice';
import { useSiteConfig } from '../useSiteConfig';
import { pageOn } from '../../lib/siteConfig';
import { C } from '../../content/tutorial/cards';

/** A term with a Glossary entry: a link to it (searched by name) when the Glossary is on, else plain text. */
function Term({ q, children }: { q: string; children: React.ReactNode }) {
  const on = pageOn(useSiteConfig(), 'glossary');
  if (!on) return <>{children}</>;
  return (
    <a href={`#/glossary?q=${encodeURIComponent(q)}`} title={`${q} in the Glossary`}>
      {children}
    </a>
  );
}

const Cite = ({ r }: { r: string }) => <span className="tag tut-cite">CR {r}</span>;

function Section({ id, title, rule, children, art }: { id: string; title: string; rule: string; children: React.ReactNode; art?: React.ReactNode }) {
  return (
    <section className="panel tut-rule" aria-labelledby={`tr-${id}`}>
      <div className="spread">
        <h2 id={`tr-${id}`} className="rule-head">
          {title}
        </h2>
        <Cite r={rule} />
      </div>
      <div className={art ? 'tut-rule-body has-art' : 'tut-rule-body'}>
        <div className="tut-rule-text">{children}</div>
        {art && (
          <div className="tut-art" aria-hidden="true">
            {art}
          </div>
        )}
      </div>
    </section>
  );
}

const DICE = [4, 6, 8, 10, 12, 20];

/** One side of the table, drawn small: field, then Legends | Gigs | piles. */
function MiniSide({ who, flip }: { who: string; flip?: boolean }) {
  const field = (
    <div className="tut-mini-zone tut-mini-field">
      <span className="tut-mini-label">Field (Units)</span>
      <div className="tut-mini-cards">
        <CardBack size="xs" />
        <CardBack size="xs" />
      </div>
    </div>
  );
  const back = (
    <div className="tut-mini-row">
      <div className="tut-mini-zone">
        <span className="tut-mini-label">Legends</span>
        <div className="tut-mini-cards">
          <CardBack size="xs" label="Legend" />
          <CardBack size="xs" label="Legend" />
          <CardBack size="xs" label="Legend" />
        </div>
      </div>
      <div className="tut-mini-zone">
        <span className="tut-mini-label">Gigs ☆</span>
        <div className="tut-mini-cards">
          <Die sides={6} value={4} size={24} owner={flip ? 'rival' : 'me'} />
          <Die sides={8} value={7} size={24} owner={flip ? 'rival' : 'me'} />
          <Die sides={12} size={20} owner={flip ? 'rival' : 'me'} pending />
        </div>
      </div>
      <div className="tut-mini-zone">
        <span className="tut-mini-label">€$ · Deck · Trash</span>
        <div className="tut-mini-cards">
          <CardBack size="xs" label="€$" />
          <CardBack size="xs" />
        </div>
      </div>
    </div>
  );
  return (
    <div className={`tut-mini-side ${flip ? 'is-rival' : 'is-me'}`}>
      <span className="tut-mini-who">{who}</span>
      {flip ? (
        <>
          {back}
          {field}
        </>
      ) : (
        <>
          {field}
          {back}
        </>
      )}
    </div>
  );
}

export function RulesInFive() {
  const card = (id: string) => CARD_BY_ID[id];
  return (
    <div className="grid tut-rules">
      <p className="muted">
        The same ground as the lessons, to read. Rule numbers are the official Comprehensive Rules (CR); underlined terms open the Glossary.
      </p>

      <Section
        id="goal"
        title="1. The goal: 7 Gigs"
        rule="1.10–1.14"
        art={
          <div className="tut-dice">
            {DICE.map((s) => (
              <Die key={s} sides={s} value={Math.ceil(s / 2)} size={32} owner="me" />
            ))}
            <Die sides={6} value={3} size={32} owner="rival" />
          </div>
        }
      >
        <p>
          A <Term q="Gig">Gig</Term> is a die. You win when you hold <b>7 or more Gigs at the start of your turn</b>. Each player brings six dice (d4 to d20); you get more by
          rolling yours in and by stealing the rival’s.
        </p>
        <p>
          Once both players have started a turn with no dice left to roll in, <Term q="Overtime">overtime</Term> begins: from then on, 7 Gigs wins at once. You lose if you have
          to draw from an empty deck.
        </p>
      </Section>

      <Section
        id="table"
        title="2. The table"
        rule="5"
        art={
          <div className="tut-mini">
            <MiniSide who="Rival" flip />
            <MiniSide who="You" />
          </div>
        }
      >
        <p>Each side has the same areas:</p>
        <ul>
          <li>
            <b>Field</b>: your Units, the cards that attack.
          </li>
          <li>
            <b>Legends</b>: your three Legends, face-down at the start.
          </li>
          <li>
            <b>Gig area</b>: your dice. ☆ beside them is your <Term q="Street Cred">Street Cred</Term>, the sum of their values. Dice not rolled in yet wait in the fixer area.
          </li>
          <li>
            <b>Piles</b>: €$ (your <Term q="Eddies">Eddies</Term>, face-down cards that are your money), Deck and Trash.
          </li>
        </ul>
      </Section>

      <Section id="turn" title="3. A turn" rule="8">
        <p>
          <b>Start</b> (it happens by itself): your spent cards ready, you draw 1, and you <Term q="Roll in">roll in</Term> one die from your fixer area. The d20 comes last.
        </p>
        <p>
          <b>Main phase</b>: do any of these, in any order, then press <b>End turn</b>:
        </p>
        <ul>
          <li>
            <Term q="Sell">Sell</Term> one card from your hand for an Eddie (once a turn; it needs a sell tag: Programs and Gear have one).
          </li>
          <li>
            <Term q="Call a Legend">Call a Legend</Term>: pay 1 €$ to turn one face-up (once a turn).
          </li>
          <li>Play cards from your hand by paying their cost.</li>
          <li>Attack with your ready Units.</li>
        </ul>
        <p>
          <b>End</b>: effects that last “this turn” stop, and every Unit loses its <Term q="Lag">Lag</Term>.
        </p>
      </Section>

      <Section
        id="money"
        title="4. Money (€$)"
        rule="5.7.2, 5.8, 8.11"
        art={
          <div className="tut-cards">
            <CardBack size="sm" label="€$" />
            <CardBack size="sm" label="Legend" />
          </div>
        }
      >
        <p>
          Costs are paid in €$. Each <b>ready Eddie</b> pays 1, and so does each <b>ready Legend</b> in your Legends area. Paying spends them (turns them sideways); they ready
          at the start of your turn.
        </p>
        <p>Selling a card turns it into a new Eddie, ready at once. A card you won’t play soon is often worth more as an Eddie.</p>
      </Section>

      <Section
        id="cards"
        title="5. Four kinds of card"
        rule="4"
        art={
          <div className="tut-cards">
            <TcgCard def={card(C.psycho)} size="sm" />
            <TcgCard def={card(C.blades)} size="sm" />
            <TcgCard def={card(C.surveillance)} size="sm" />
            <TcgCard def={card(C.v)} size="sm" />
          </div>
        }
      >
        <ul>
          <li>
            <b>Unit</b>: goes on your field. It arrives with <Term q="Lag">Lag</Term>, so it can’t attack the turn you play it.
          </li>
          <li>
            <b>Gear</b>: goes onto one of your Units (or a face-up Legend), which gets its power and text.
          </li>
          <li>
            <b>Program</b>: does what it says once, then goes to the trash.
          </li>
          <li>
            <b>Legend</b>: three per deck, not in your hand. See 8 below.
          </li>
        </ul>
        <p>A card’s cost is in its top left corner. Point at a card in the app (or press and hold it on a touch screen) to read it.</p>
      </Section>

      <Section
        id="attack"
        title="6. Attacking"
        rule="9, 11.4"
        art={
          <table className="tut-steal">
            <caption>Gigs stolen by power</caption>
            <thead>
              <tr>
                <th scope="col">Power</th>
                <th scope="col">Steals</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>0</td>
                <td>0</td>
              </tr>
              <tr>
                <td>1–9</td>
                <td>1</td>
              </tr>
              <tr>
                <td>10–19</td>
                <td>2</td>
              </tr>
              <tr>
                <td>20+</td>
                <td>3</td>
              </tr>
            </tbody>
          </table>
        }
      >
        <p>
          Attack with a <b>ready Unit without Lag</b>; attacking spends it. It may attack a <b>spent</b> rival Unit, or the rival’s Gig area if it has dice. A ready rival
          Unit can’t be attacked unless a card says so.
        </p>
        <p>
          A <Term q="Fight">fight</Term>: higher power wins, the loser is defeated and goes to the trash. Equal power: both lose. An attack on the Gig area{' '}
          <Term q="Steal">steals</Term> dice instead, as many as the table shows; the attacker picks which.
        </p>
        <p>Remember: your attackers stay spent through the rival’s turn, so the rival may attack them.</p>
      </Section>

      <Section id="react" title="7. The rival’s turn" rule="9.7–9.14, 11.28, 11.30">
        <p>
          When a rival Unit attacks, you may react before the fight or the steal (the <Term q="React Step">React Step</Term>):
        </p>
        <ul>
          <li>
            Block with a ready <Term q="Blocker">Blocker</Term>: the attack is now on it, so an attack on your Gigs becomes a fight.
          </li>
          <li>
            Play a <Term q="Quick">Quick</Term> Program, or use a Quick ability.
          </li>
          <li>Call a Legend (if you haven’t this turn).</li>
        </ul>
      </Section>

      <Section
        id="legends"
        title="8. Legends"
        rule="4.3–4.5, 11.14, 11.29"
        art={
          <div className="tut-cards">
            <CardBack size="sm" label="Legend" />
            <TcgCard def={card(C.v)} size="sm" />
          </div>
        }
      >
        <p>
          Your Legends start face-down, hidden even from you; face-down, each pays 1 €$. Once a turn you may <Term q="Call a Legend">Call</Term> one: pay 1 €$ and turn it
          face-up. Some do something as they are called; a face-up Legend’s text works from the Legends area.
        </p>
        <p>
          A Legend with <Term q="Go Solo">Go Solo</Term> can be paid for and put on the field as a ready Unit that may attack at once. If it leaves the field, it is removed from
          the game.
        </p>
      </Section>

      <Section id="gigs" title="9. Gigs and Street Cred" rule="6, 8.6.5, 11.2">
        <p>
          Each turn you roll in one die, so a bigger die tends to give a bigger value. <Term q="Street Cred">Street Cred</Term> (☆) is the sum of your dice; with no dice it is
          “–”, which counts as less than 0. Many cards look at your dice: a high value, a pair, an even ☆. Some raise, lower or swap dice.
        </p>
      </Section>
    </div>
  );
}
