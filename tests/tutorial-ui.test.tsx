// The tutorial's pages and ways in: the lesson list and the rules reference render, a lesson renders on the Play board
// with its tutor panel and without the practice game's tools, and every way in follows the site config's switch for
// the page (#/tutorial).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TutorialPage } from '../src/ui/pages/Tutorial';
import { TutorialNudge } from '../src/ui/components/TutorialNudge';
import { LESSONS } from '../src/content/tutorial/lessons';
import { previewDraft } from '../src/ui/useSiteConfig';
import { defaultSiteConfig, pageOn, parseSiteConfig, siteConfigText, visibleNav } from '../src/lib/siteConfig';
import { hideNudge, markDone } from '../src/lib/tutorialProgress';
import { setArtEnabled } from '../src/ui/art';
import { recordPractice } from '../src/lib/practiceLog';
import { LessonRun } from '../src/lib/tutorial';
import { lessonById } from '../src/content/tutorial/lessons';
import { TutorBox } from '../src/ui/components/board/TutorBox';
import { PromptPanel } from '../src/ui/components/board/PromptPanel';
import { PhonePanel } from '../src/ui/components/board/PhoneParts';
import { buildInteraction, coachMark } from '../src/ui/components/board/interaction';
import type { BoardCtx } from '../src/ui/components/board/BoardCard';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => {
  previewDraft(null);
  vi.unstubAllGlobals();
});

const tutorialOff = () => {
  const c = defaultSiteConfig();
  c.nav.sections.find((s) => s.id === 'learn')!.pages.find((p) => p.path === 'tutorial')!.hidden = true;
  return c;
};

describe('the How to play page', () => {
  it('lists every lesson with its goal and time, and a way to start', () => {
    const html = renderToStaticMarkup(<TutorialPage />);
    for (const l of LESSONS) {
      expect(html).toContain(l.title.split(':')[0]!.replace(/’/g, '’'));
      expect(html).toContain(`#/tutorial/${l.id}`);
    }
    expect(html).toContain('Start lesson 1');
    expect(html).toContain('#/tutorial/rules');
    expect(html).not.toContain('Start over'); // nothing done yet
  });

  it('shows progress, and Start over once a lesson is done', () => {
    markDone('table');
    const html = renderToStaticMarkup(<TutorialPage />);
    expect(html).toContain('1 of 8 lessons done');
    expect(html).toContain('Next lesson');
    expect(html).toContain('Start over');
  });

  it('the rules in five minutes: every section, with rule numbers and Glossary links', () => {
    const html = renderToStaticMarkup(<TutorialPage sub="rules" />);
    for (const h of ['The goal: 7 Gigs', 'The table', 'A turn', 'Money', 'Four kinds of card', 'Attacking', 'The rival', 'Legends', 'Gigs and Street Cred']) expect(html).toContain(h);
    expect(html).toContain('CR 1.10');
    expect(html).toContain('#/glossary?q=Lag');
  });

  it('without the Glossary page, terms are plain text', () => {
    const c = defaultSiteConfig();
    c.nav.sections.find((s) => s.id === 'learn')!.pages.find((p) => p.path === 'glossary')!.hidden = true;
    previewDraft(siteConfigText(c));
    expect(renderToStaticMarkup(<TutorialPage sub="rules" />)).not.toContain('#/glossary');
  });

  it('a lesson’s tutor sits where the coach box sits, on the full board and on a phone', async () => {
    const run = new LessonRun(lessonById('table')!);
    const done = run.start();
    for (let i = 0; i < 200 && !run.seat.pending; i++) await new Promise((r) => setTimeout(r, 0));
    const pend = run.seat.pending!.d;
    const g = run.g;
    const noop = () => undefined;
    const ix = buildInteraction(g, pend);
    const ctx: BoardCtx = { g, pend, ix, coach: coachMark(pend, run.marked()), targeting: null, narrow: false, menuUid: null, answer: noop, openMenu: noop, startTargeting: noop, cancelTargeting: noop, openTrash: noop, markLabel: 'Tutor' };
    const tutor = <TutorBox view={run.view()} onNext={noop} />;
    const full = renderToStaticMarkup(<PromptPanel ctx={ctx} hidePass tutor={tutor} />);
    expect(full).toContain('pb-tutor');
    expect(full).toContain('Welcome to the table');
    expect(full).toContain('Step 1 of 3');
    expect(full).toContain('Next ›');
    expect(full).not.toContain('Coach:');
    // the expected move is marked on the board
    expect(run.marked()).not.toBeNull();
    const phone = renderToStaticMarkup(<PhonePanel ctx={{ ...ctx, narrow: true }} state="open" tutor={tutor} tutorTitle="1. The table" onCollapse={noop} onPeek={noop} allActions={null} />);
    expect(phone).toContain('pb-tutor');
    // with nothing to decide (the rival's turn) the phone panel still shows the lesson
    const waiting = renderToStaticMarkup(<PhonePanel ctx={{ ...ctx, narrow: true, pend: null }} state="open" tutor={tutor} tutorTitle="1. The table" onCollapse={noop} onPeek={noop} allActions={null} />);
    expect(waiting).toContain('1. The table');
    run.stop();
    await done;
  });

  it('an unknown lesson id shows the list', () => {
    const html = renderToStaticMarkup(<TutorialPage sub="no-such-lesson" />);
    expect(html).toContain('There is no lesson called');
    expect(html).toContain('Start lesson 1');
  });
});

describe('ways in follow the page switch', () => {
  it('the page is first in Learn by default, and off when the owner hides it', () => {
    const learn = visibleNav(defaultSiteConfig()).find((s) => s.id === 'learn')!;
    expect(learn.landing).toBe('tutorial');
    expect(pageOn(defaultSiteConfig(), 'tutorial')).toBe(true);
    const off = tutorialOff();
    expect(pageOn(off, 'tutorial')).toBe(false);
    expect(visibleNav(off).find((s) => s.id === 'learn')!.landing).toBe('guides');
    // the round trip keeps the switch
    expect(pageOn(parseSiteConfig(JSON.parse(siteConfigText(off))).config, 'tutorial')).toBe(false);
  });

  it('the Play setup line: shown to a browser with no practice games, gone once hidden or with the page off', () => {
    expect(renderToStaticMarkup(<TutorialNudge />)).toContain('#/tutorial');
    previewDraft(siteConfigText(tutorialOff()));
    expect(renderToStaticMarkup(<TutorialNudge />)).toBe('');
    previewDraft(null);
    hideNudge();
    expect(renderToStaticMarkup(<TutorialNudge />)).toBe('');
  });

  it('the Play setup line stays away once a practice game was played', () => {
    expect(recordPractice({ id: 'x', date: '2026-11-01', deck: 'A', opp: 'B', level: 'easy', result: 'win', first: true, turns: 9, reason: 'won' })).toBe(true);
    expect(renderToStaticMarkup(<TutorialNudge />)).toBe('');
  });
});
