import { describe, it, expect } from 'vitest';
import '../js/menu-patterns.js';
const { addSiteToMenuPatterns, siteToPattern } = globalThis.FlowMouseMenuPatterns;

describe('siteToPattern', () => {
  it('builds *host* from a url', () => {
    expect(siteToPattern('https://www.github.com/foo')).toBe('*www.github.com*');
  });
  it('returns null for invalid url', () => {
    expect(siteToPattern('not a url')).toBeNull();
  });
});
describe('addSiteToMenuPatterns', () => {
  const base = { m1: { name: 'Coding', items: [], patterns: ['*php.net*'] } };
  it('appends a new pattern', () => {
    const { menus, added } = addSiteToMenuPatterns(base, 'm1', 'https://github.com/x');
    expect(added).toBe('*github.com*');
    expect(menus.m1.patterns).toEqual(['*php.net*', '*github.com*']);
    expect(base.m1.patterns).toEqual(['*php.net*']); // original untouched (immutability)
  });
  it('dedups (no double add)', () => {
    const { menus, added } = addSiteToMenuPatterns(base, 'm1', 'https://php.net/x');
    expect(added).toBeNull();
    expect(menus.m1.patterns).toEqual(['*php.net*']);
  });
  it('initializes patterns when absent', () => {
    const { menus } = addSiteToMenuPatterns({ m2: { name: 'X', items: [] } }, 'm2', 'https://a.com/');
    expect(menus.m2.patterns).toEqual(['*a.com*']);
  });
  it('no-op for unknown menu', () => {
    const { menus, added } = addSiteToMenuPatterns(base, 'nope', 'https://a.com/');
    expect(added).toBeNull();
    expect(menus).toBe(base);
  });
});
