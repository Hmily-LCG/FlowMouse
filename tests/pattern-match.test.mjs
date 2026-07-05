import { describe, it, expect } from 'vitest';
import '../js/search-url.js';
const { matchesPatterns } = globalThis.FlowMouseSearchUrl;

describe('matchesPatterns', () => {
  it('empty patterns match everything (default menu)', () => {
    expect(matchesPatterns('https://anything.example/x', [])).toBe(true);
    expect(matchesPatterns('https://anything.example/x', undefined)).toBe(true);
  });
  it('contains wildcard matches host', () => {
    expect(matchesPatterns('https://github.com/foo/bar', ['*github.com*'])).toBe(true);
    expect(matchesPatterns('https://www.php.net/manual', ['*php.net*'])).toBe(true);
  });
  it('non-matching pattern returns false', () => {
    expect(matchesPatterns('https://example.com/', ['*github.com*'])).toBe(false);
  });
  it('any-of: true if any pattern matches', () => {
    expect(matchesPatterns('https://php.net/x', ['*github.com*', '*php.net*'])).toBe(true);
  });
  it('escapes regex metacharacters in patterns', () => {
    expect(matchesPatterns('https://a.com/?x=1', ['*a.com/?x=1*'])).toBe(true);
    expect(matchesPatterns('https://aXcom/', ['*a.com*'])).toBe(false); // '.' is literal, not "any char"
  });
  it('is case-insensitive', () => {
    expect(matchesPatterns('https://GitHub.com/', ['*github.com*'])).toBe(true);
  });
});
