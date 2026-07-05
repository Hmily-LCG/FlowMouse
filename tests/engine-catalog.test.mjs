import { describe, it, expect } from 'vitest';
import '../js/search-engines-catalog.js';
const { ENGINE_CATALOG, getEngine } = globalThis.FlowMouseEngineCatalogApi;

describe('engine catalog', () => {
  it('has entries with required fields', () => {
    expect(ENGINE_CATALOG.length).toBeGreaterThanOrEqual(14);
    for (const e of ENGINE_CATALOG) {
      expect(typeof e.id).toBe('string');
      expect(e.id.length).toBeGreaterThan(0);
      expect(typeof e.name).toBe('string');
      expect(typeof e.url).toBe('string');
      expect(e.url).toMatch(/^https:\/\//);
      expect(typeof e.icon).toBe('string'); // '' allowed (favicon fallback)
    }
  });
  it('ids are unique', () => {
    const ids = ENGINE_CATALOG.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('getEngine resolves and misses correctly', () => {
    expect(getEngine('amazon')?.url).toContain('amazon.com');
    expect(getEngine('amazon').plus).toBe(true);
    expect(getEngine('brave').suffix).toBe('&summary=1');
    expect(getEngine('nope')).toBeUndefined();
  });
  it('catalog icons are data URIs or empty', () => {
    for (const e of ENGINE_CATALOG) {
      if (e.icon) expect(e.icon.startsWith('data:image/svg+xml;base64,')).toBe(true);
    }
  });
});

describe('legacy text engines added', () => {
  const byId = id => ENGINE_CATALOG.find(e => e.id === id);
  it('includes the 4 neutral legacy engines, visible', () => {
    for (const id of ['google_translate','bing_translate','duckduckgo','yahoo']) {
      expect(byId(id), id).toBeTruthy();
      expect(!!byId(id).defaultHidden, id).toBe(false);
    }
  });
  it('includes the 6 regional legacy engines, defaultHidden', () => {
    for (const id of ['baidu','360','yandex','naver','seznam','yahoo_jp']) {
      expect(byId(id), id).toBeTruthy();
      expect(byId(id).defaultHidden, id).toBe(true);
    }
  });
  it('every engine has a non-empty url', () => {
    for (const e of ENGINE_CATALOG) expect(typeof e.url === 'string' && e.url.length > 0, e.id).toBe(true);
  });
});

describe('neutral shipped catalog', () => {
  const ids = ENGINE_CATALOG.map(e => e.id);
  it('drops German-specific engines', () => {
    for (const id of ['geizhals','idealo','guenstiger','kleinanzeigen']) expect(ids).not.toContain(id);
  });
  it('no default-visible engine uses a .de domain', () => {
    for (const e of ENGINE_CATALOG) {
      if (e.defaultHidden) continue;
      expect(/:\/\/[^/]*\.de\//.test(e.url), `${e.id} -> ${e.url}`).toBe(false);
    }
  });
  it('no default-visible engine forces a regional hl=de locale', () => {
    for (const e of ENGINE_CATALOG) {
      if (e.defaultHidden) continue;
      expect(e.url.includes('hl=de'), `${e.id} -> ${e.url}`).toBe(false);
    }
  });
  it('no default-visible engine has a German display name', () => {
    for (const e of ENGINE_CATALOG) {
      if (e.defaultHidden) continue;
      expect(/Übersetzer|Bildersuche|Karten/.test(e.name), `${e.id} -> ${e.name}`).toBe(false);
    }
  });
});

describe('image engines', () => {
  const byId = id => ENGINE_CATALOG.find(e => e.id === id);
  const IMG = ['google-lens','bing-images','yandex-images','tineye','saucenao','iqdb','trace'];
  it('all 7 image engines present with type image', () => {
    for (const id of IMG) { expect(byId(id), id).toBeTruthy(); expect(byId(id).type, id).toBe('image'); }
  });
  it('all engine ids are unique', () => {
    const ids = ENGINE_CATALOG.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('image ids do not collide with text ids', () => {
    for (const id of ['google','bing','yandex']) {
      const hits = ENGINE_CATALOG.filter(e => e.id === id);
      expect(hits.every(e => (e.type || 'text') === 'text'), id).toBe(true);
    }
  });
});
