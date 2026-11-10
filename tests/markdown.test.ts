// Link safety for the Markdown renderer and provenance links (APP-10).
import { describe, expect, it } from 'vitest';
import { safeHref } from '../src/ui/components/Markdown';

describe('safeHref', () => {
  it('allows in-app hash routes and http(s)/mailto links', () => {
    expect(safeHref('#/deck?d=meta-x.txt')).toBe('#/deck?d=meta-x.txt');
    expect(safeHref('https://choom.gg/meta')).toBe('https://choom.gg/meta');
    expect(safeHref('http://example.com')).toBe('http://example.com');
    expect(safeHref('HTTPS://EXAMPLE.COM')).toBe('HTTPS://EXAMPLE.COM');
    expect(safeHref('mailto:someone@example.com')).toBe('mailto:someone@example.com');
    expect(safeHref('  https://example.com  ')).toBe('https://example.com');
  });
  it('rejects script and data URLs however they are written', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('JavaScript:alert(1)')).toBeNull();
    expect(safeHref('JAVASCRIPT:alert(1)')).toBeNull();
    expect(safeHref('  javascript:alert(1)')).toBeNull();
    expect(safeHref('\u0001\njavascript:alert(1)')).toBeNull();
    expect(safeHref('java\tscript:alert(1)')).toBeNull();
    expect(safeHref('java\nscript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(safeHref('DATA:text/html,x')).toBeNull();
    expect(safeHref('vbscript:msgbox(1)')).toBeNull();
  });
  it('rejects relative and empty targets', () => {
    expect(safeHref('')).toBeNull();
    expect(safeHref('   ')).toBeNull();
    expect(safeHref(undefined)).toBeNull();
    expect(safeHref('//evil.example/x')).toBeNull();
    expect(safeHref('foo/bar')).toBeNull();
  });
});
