// APP-16: the shared <Modal> — dialog semantics, focus moved in on open, Tab trapped inside, Escape closes, focus
// returned to the opener. There is no DOM in this test setup (no jsdom), so the focus wiring (attachModal) runs on
// small fakes with the same shape as the DOM pieces it uses.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { attachModal, FOCUSABLE, Modal, stepTarget, trapTarget, type DialogNode, type DocumentLike, type KeyEventLike, type TrapOptions } from '../src/ui/components/Modal';

class FakeDoc implements DocumentLike {
  activeElement: unknown = null;
  handlers = new Set<(e: KeyEventLike) => void>();
  addEventListener(_t: 'keydown', fn: (e: KeyEventLike) => void) {
    this.handlers.add(fn);
  }
  removeEventListener(_t: 'keydown', fn: (e: KeyEventLike) => void) {
    this.handlers.delete(fn);
  }
  /** Dispatch a key; returns whether a handler called preventDefault (i.e. took over from the browser). */
  key(key: string, shiftKey = false) {
    let prevented = false;
    const e = { key, shiftKey, preventDefault: () => (prevented = true) };
    for (const h of [...this.handlers]) h(e);
    return prevented;
  }
}
class FakeEl {
  constructor(
    public name: string,
    private doc: FakeDoc,
  ) {}
  focus() {
    this.doc.activeElement = this;
  }
}
class FakeDialog extends FakeEl implements DialogNode {
  selector = '';
  /** the control marked data-autofocus, if any */
  auto: FakeEl | null = null;
  constructor(
    doc: FakeDoc,
    public items: FakeEl[],
  ) {
    super('dialog', doc);
  }
  contains(other: unknown) {
    return other === this || this.items.includes(other as FakeEl);
  }
  querySelectorAll(selector: string) {
    if (selector === '[data-autofocus]') return this.auto ? [this.auto] : [];
    this.selector = selector;
    return this.items;
  }
}

function setup(n = 3, opts?: TrapOptions & { closable?: boolean; doc?: FakeDoc; auto?: number }) {
  const doc = opts?.doc ?? new FakeDoc();
  const opener = new FakeEl('opener', doc);
  opener.focus();
  const items = Array.from({ length: n }, (_, i) => new FakeEl(`item${i}`, doc));
  const dialog = new FakeDialog(doc, items);
  if (opts?.auto !== undefined) dialog.auto = items[opts.auto];
  let closed = 0;
  const detach = attachModal(dialog, doc, opts?.closable === false ? null : () => closed++, opts);
  return { doc, opener, items, dialog, detach, closes: () => closed };
}

describe('Modal markup', () => {
  it('is a modal dialog named by its title, with a labelled close button', () => {
    const html = renderToStaticMarkup(
      <Modal labelledBy="t1" onClose={() => undefined} className="modal-wide">
        <h2 id="t1">Title</h2>
      </Modal>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="t1"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('class="modal modal-wide"');
    expect(html).toMatch(/<button type="button" class="ghost modal-close" aria-label="Close">/);
  });
});

describe('Modal focus', () => {
  it('moves focus into the dialog when it opens', () => {
    const { doc, dialog } = setup();
    expect(doc.activeElement).toBe(dialog);
  });

  it('keeps Tab inside: wraps at both ends and enters from the dialog itself', () => {
    const { doc, items, dialog } = setup();
    // from the dialog: Tab goes to the first control, Shift+Tab to the last
    expect(doc.key('Tab')).toBe(true);
    expect(doc.activeElement).toBe(items[0]);
    dialog.focus();
    doc.key('Tab', true);
    expect(doc.activeElement).toBe(items[2]);
    // in the middle the browser moves focus normally
    items[1].focus();
    expect(doc.key('Tab')).toBe(false);
    expect(doc.key('Tab', true)).toBe(false);
    // wraps: last → first, first → last
    items[2].focus();
    doc.key('Tab');
    expect(doc.activeElement).toBe(items[0]);
    doc.key('Tab', true);
    expect(doc.activeElement).toBe(items[2]);
    expect(dialog.selector).toBe(FOCUSABLE);
  });

  it('pulls focus back in when it has escaped the dialog', () => {
    const { doc, items } = setup();
    doc.activeElement = new FakeEl('outside', doc);
    doc.key('Tab');
    expect(doc.activeElement).toBe(items[0]);
  });

  it('holds focus on the dialog when it has no controls', () => {
    const { doc, dialog } = setup(0);
    expect(doc.key('Tab')).toBe(true);
    expect(doc.activeElement).toBe(dialog);
  });

  it('closes on Escape and ignores other keys', () => {
    const { doc, closes } = setup();
    doc.key('a');
    doc.key('Enter');
    expect(closes()).toBe(0);
    expect(doc.key('Escape')).toBe(true);
    expect(closes()).toBe(1);
  });

  it('returns focus to the opener and stops listening when it closes', () => {
    const { doc, opener, detach, closes } = setup();
    detach();
    expect(doc.activeElement).toBe(opener);
    expect(doc.handlers.size).toBe(0);
    doc.key('Escape');
    expect(closes()).toBe(0);
  });
});

describe('trapTarget', () => {
  it('only steps in at the edges or from outside', () => {
    const xs = ['a', 'b', 'c'];
    expect(trapTarget(xs, 'c', false)).toBe('a');
    expect(trapTarget(xs, 'a', true)).toBe('c');
    expect(trapTarget(xs, 'b', false)).toBeNull();
    expect(trapTarget(xs, null, false)).toBe('a');
    expect(trapTarget(xs, null, true)).toBe('c');
    expect(trapTarget([], null, false)).toBeNull();
  });
});

// PLAY-9: the Play board's overlays and menus use the same wiring through useFocusTrap (Overlays.tsx, PhoneParts.tsx,
// drag.tsx, LogDrawer.tsx, and the site header in Play.tsx).
describe('board overlay focus (useFocusTrap options)', () => {
  it('a dialog opened over another takes the keys until it closes, then the first gets them back', () => {
    const doc = new FakeDoc();
    const under = setup(2, { doc, closable: false }); // the opening-hand choice
    const over = setup(2, { doc }); // Concede, opened over it
    expect(doc.activeElement).toBe(over.dialog);
    doc.key('Tab');
    expect(doc.activeElement).toBe(over.items[0]); // not pulled into the dialog underneath
    doc.key('Tab', true);
    expect(doc.activeElement).toBe(over.items[1]);
    expect(doc.key('Escape')).toBe(true);
    expect(over.closes()).toBe(1);
    over.detach();
    expect(doc.activeElement).toBe(over.opener);
    doc.key('Tab');
    expect(doc.activeElement).toBe(under.items[0]);
  });

  it('one that cannot be dismissed ignores Escape (and leaves it to the page)', () => {
    const { doc } = setup(2, { closable: false });
    expect(doc.key('Escape')).toBe(false);
  });

  it('menus: focus starts on the first item, arrows move and wrap, Home and End jump', () => {
    const { doc, items } = setup(3, { initial: 'first', arrows: true });
    expect(doc.activeElement).toBe(items[0]);
    expect(doc.key('ArrowDown')).toBe(true);
    expect(doc.activeElement).toBe(items[1]);
    doc.key('ArrowUp');
    doc.key('ArrowUp');
    expect(doc.activeElement).toBe(items[2]);
    doc.key('ArrowDown');
    expect(doc.activeElement).toBe(items[0]);
    doc.key('End');
    expect(doc.activeElement).toBe(items[2]);
    doc.key('Home');
    expect(doc.activeElement).toBe(items[0]);
  });

  it('arrows are left to a focused form field (the bot speed select in the game menu)', () => {
    const { doc, items } = setup(2, { initial: 'first', arrows: true });
    (items[1] as unknown as { tagName: string }).tagName = 'SELECT';
    items[1].focus();
    expect(doc.key('ArrowDown')).toBe(false);
    expect(doc.activeElement).toBe(items[1]);
  });

  it('a control marked data-autofocus takes the initial focus (the card reader starts on Close)', () => {
    const { doc, items } = setup(2, { auto: 1 });
    expect(doc.activeElement).toBe(items[1]);
  });

  it('a non-modal panel (the full-board log drawer) takes focus and closes on Escape but lets Tab leave', () => {
    const { doc, items, opener, detach, closes } = setup(2, { initial: 'first', trap: false });
    expect(doc.activeElement).toBe(items[0]);
    items[1].focus();
    expect(doc.key('Tab')).toBe(false);
    doc.key('Escape');
    expect(closes()).toBe(1);
    detach();
    expect(doc.activeElement).toBe(opener);
  });

  it('stepTarget wraps and enters from outside', () => {
    expect(stepTarget(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(stepTarget(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(stepTarget(['a', 'b', 'c'], null, 1)).toBe('a');
    expect(stepTarget(['a', 'b', 'c'], null, -1)).toBe('c');
    expect(stepTarget([], null, 1)).toBeNull();
  });
});
