import { describe, it, expect } from 'vitest';
import '../js/engine-registry.js';
const { resolveEngines, getEngineById, resolveMenuItemLink, isClipboardLink, isEngineHidden, normalizeImageEngineId } = globalThis.FlowMouseEngineRegistry;

const CAT = [
  { id: 'google', name: 'Google', url: 'https://g/?q=', plus: true, icon: 'data:x' },
  { id: 'bing',   name: 'Bing',   url: 'https://b/?q=', icon: 'data:y' },
  { id: 'amazon', name: 'Amazon', url: 'https://a/?k=', plus: true, icon: 'data:z' },
];

describe('resolveEngines', () => {
  it('returns built-ins when no diffs', () => {
    const list = resolveEngines(CAT, { overrides:{}, hidden:[], custom:[], order:[] });
    expect(list.map(e => e.id)).toEqual(['google','bing','amazon']);
    expect(list[0].builtin).toBe(true);
    expect(list[0].plus).toBe(true);
  });
  it('applies overrides (shallow merge)', () => {
    const list = resolveEngines(CAT, { overrides:{ google:{ url:'https://g2/?q=', suffix:'&hl=de' } }, hidden:[], custom:[], order:[] });
    const g = list.find(e => e.id === 'google');
    expect(g.url).toBe('https://g2/?q=');
    expect(g.suffix).toBe('&hl=de');
    expect(g.name).toBe('Google'); // unchanged fields kept
  });
  it('excludes hidden built-ins', () => {
    const list = resolveEngines(CAT, { overrides:{}, hidden:['bing'], custom:[], order:[] });
    expect(list.map(e => e.id)).toEqual(['google','amazon']);
  });
  it('appends custom engines', () => {
    const list = resolveEngines(CAT, { overrides:{}, hidden:[], custom:[{ id:'c1', name:'Mine', url:'https://m/?s=', clipboardMode:true }], order:[] });
    const c = list.find(e => e.id === 'c1');
    expect(c.builtin).toBe(false);
    expect(c.clipboardMode).toBe(true);
  });
  it('sorts by order (listed first, rest after)', () => {
    const list = resolveEngines(CAT, { overrides:{}, hidden:[], custom:[{ id:'c1', name:'Mine', url:'https://m/' }], order:['amazon','c1'] });
    expect(list.map(e => e.id)).toEqual(['amazon','c1','google','bing']);
  });
  it('does not mutate inputs', () => {
    const se = { overrides:{ google:{ url:'x' } }, hidden:['bing'], custom:[], order:['amazon'] };
    const snap = JSON.stringify(se);
    resolveEngines(CAT, se);
    expect(JSON.stringify(se)).toBe(snap);
  });
});

describe('getEngineById', () => {
  it('resolves built-in with override', () => {
    expect(getEngineById(CAT, { overrides:{ bing:{ name:'B!' } }, hidden:[], custom:[], order:[] }, 'bing').name).toBe('B!');
  });
  it('resolves custom', () => {
    expect(getEngineById(CAT, { overrides:{}, hidden:[], custom:[{ id:'c1', name:'Mine', url:'u' }], order:[] }, 'c1').name).toBe('Mine');
  });
  it('returns undefined for unknown id', () => {
    expect(getEngineById(CAT, { overrides:{}, hidden:[], custom:[], order:[] }, 'nope')).toBeUndefined();
  });
  it('getEngineById resolves a hidden built-in (hide is visibility-only)', () => {
    expect(getEngineById(CAT, { overrides:{}, hidden:['bing'], custom:[], order:[] }, 'bing').name).toBe('Bing');
  });
});

describe('resolveMenuItemLink', () => {
  const SE = { overrides:{}, hidden:[], custom:[{ id:'c1', name:'Mine', url:'https://m/?s=', clipboardMode:true }], order:[] };
  it('resolves an engine reference', () => {
    const l = resolveMenuItemLink(CAT, SE, { engineId:'amazon' });
    expect(l.url).toBe('https://a/?k='); expect(l.plus).toBe(true); expect(l.engine).toBe('custom');
  });
  it('applies a per-item exception over the engine', () => {
    const l = resolveMenuItemLink(CAT, SE, { engineId:'amazon', exception:{ suffix:'&x=1', plus:false } });
    expect(l.suffix).toBe('&x=1'); expect(l.plus).toBe(false); expect(l.url).toBe('https://a/?k=');
  });
  it('uses inline fields when no engineId', () => {
    const l = resolveMenuItemLink(CAT, SE, { name:'One', url:'https://o/?q=', plus:true });
    expect(l.url).toBe('https://o/?q='); expect(l.plus).toBe(true);
  });
  it('carries clipboardMode from a custom engine', () => {
    expect(resolveMenuItemLink(CAT, SE, { engineId:'c1' }).clipboardMode).toBe(true);
  });
  it('returns null for unknown engineId and empty item', () => {
    expect(resolveMenuItemLink(CAT, SE, { engineId:'nope' })).toBeNull();
    expect(resolveMenuItemLink(CAT, SE, {})).toBeNull();
  });
  it('resolves a reference to a hidden engine (hide must not break menu items)', () => {
    const l = resolveMenuItemLink(CAT, { overrides:{}, hidden:['amazon'], custom:[], order:[] }, { engineId:'amazon' });
    expect(l.url).toBe('https://a/?k=');
  });
});

describe('transform fields', () => {
  it('carries transform fields from a custom engine', () => {
    const se = { overrides:{}, hidden:[], custom:[{ id:'t1', name:'T', url:'https://t/?q=', transformEnabled:true, transformCode:'return selection', transformClipboard:true }], order:[] };
    const l = resolveMenuItemLink(CAT, se, { engineId:'t1' });
    expect(l.transformEnabled).toBe(true);
    expect(l.transformCode).toBe('return selection');
    expect(l.transformClipboard).toBe(true);
  });
  it('exception can override transformCode', () => {
    const se = { overrides:{}, hidden:[], custom:[{ id:'t1', name:'T', url:'u', transformEnabled:true, transformCode:'return selection' }], order:[] };
    const l = resolveMenuItemLink(CAT, se, { engineId:'t1', exception:{ transformCode:'return selection.trim()' } });
    expect(l.transformCode).toBe('return selection.trim()');
    expect(l.transformEnabled).toBe(true);
  });
  it('inline item carries its own transform fields', () => {
    const l = resolveMenuItemLink(CAT, { overrides:{},hidden:[],custom:[],order:[] }, { url:'https://x/?q=%s', transformEnabled:true, transformCode:'return clipboard' });
    expect(l.transformEnabled).toBe(true);
    expect(l.transformCode).toBe('return clipboard');
    expect(l.transformClipboard).toBe(false);
  });
  it('carries transformRawResult from a custom engine', () => {
    const se = { overrides:{}, hidden:[], custom:[{ id:'r1', name:'R', url:'https://r/?q=', transformRawResult:true }], order:[] };
    const l = resolveMenuItemLink(CAT, se, { engineId:'r1' });
    expect(l.transformRawResult).toBe(true);
  });
  it('exception can override transformRawResult to false', () => {
    const se = { overrides:{}, hidden:[], custom:[{ id:'r1', name:'R', url:'https://r/?q=', transformRawResult:true }], order:[] };
    const l = resolveMenuItemLink(CAT, se, { engineId:'r1', exception:{ transformRawResult:false } });
    expect(l.transformRawResult).toBe(false);
  });
  it('inline item with transformRawResult carries it', () => {
    const l = resolveMenuItemLink(CAT, { overrides:{},hidden:[],custom:[],order:[] }, { url:'https://x/?q=%s', transformRawResult:true });
    expect(l.transformRawResult).toBe(true);
  });
});

describe('isClipboardLink', () => {
  it('true only when clipboardMode set', () => {
    expect(isClipboardLink({ clipboardMode:true })).toBe(true);
    expect(isClipboardLink({ clipboardMode:false })).toBe(false);
    expect(isClipboardLink(null)).toBe(false);
  });
});

describe('defaultHidden', () => {
  const CAT2 = [
    { id: 'a', name: 'A', url: 'https://a/?q=' },
    { id: 'r', name: 'R', url: 'https://r/?q=', defaultHidden: true },
  ];
  it('defaultHidden engine is excluded when not in hidden list', () => {
    const list = resolveEngines(CAT2, { overrides:{}, hidden:[], custom:[], order:[] });
    expect(list.map(e => e.id)).toEqual(['a']);
  });
  it('defaultHidden engine becomes visible when its id is in hidden list (toggle)', () => {
    const list = resolveEngines(CAT2, { overrides:{}, hidden:['r'], custom:[], order:[] });
    expect(list.map(e => e.id)).toEqual(['a','r']);
  });
  it('normal engine is hidden when in hidden list', () => {
    const list = resolveEngines(CAT2, { overrides:{}, hidden:['a'], custom:[], order:[] });
    expect(list.map(e => e.id)).toEqual([]);
  });
  it('isEngineHidden matches the toggle semantics', () => {
    expect(isEngineHidden({ id:'a' }, [])).toBe(false);
    expect(isEngineHidden({ id:'a' }, ['a'])).toBe(true);
    expect(isEngineHidden({ id:'r', defaultHidden:true }, [])).toBe(true);
    expect(isEngineHidden({ id:'r', defaultHidden:true }, ['r'])).toBe(false);
  });
});

describe('type filter', () => {
  const CATT = [
    { id: 't1', name: 'T1', url: 'https://t1/?q=' },                 // no type => text
    { id: 't2', name: 'T2', url: 'https://t2/?q=', type: 'text' },
    { id: 'i1', name: 'I1', url: 'https://i1/?url=', type: 'image' },
  ];
  const SE0 = { overrides:{}, hidden:[], custom:[], order:[] };
  it('no type arg returns all (back-compat)', () => {
    expect(resolveEngines(CATT, SE0).map(e => e.id)).toEqual(['t1','t2','i1']);
  });
  it('type text returns text engines (missing type = text)', () => {
    expect(resolveEngines(CATT, SE0, 'text').map(e => e.id)).toEqual(['t1','t2']);
  });
  it('type image returns image engines', () => {
    expect(resolveEngines(CATT, SE0, 'image').map(e => e.id)).toEqual(['i1']);
  });
  it('custom engines respect their type', () => {
    const se = { ...SE0, custom:[{ id:'c1', name:'C', url:'u', type:'image' }] };
    expect(resolveEngines(CATT, se, 'image').map(e => e.id)).toEqual(['i1','c1']);
    expect(resolveEngines(CATT, se, 'text').map(e => e.id)).toEqual(['t1','t2']);
  });
  it('toEngine carries type (default text)', () => {
    const list = resolveEngines(CATT, SE0);
    expect(list.find(e => e.id === 't1').type).toBe('text');
    expect(list.find(e => e.id === 'i1').type).toBe('image');
  });
});

describe('normalizeImageEngineId', () => {
  it('maps the 3 colliding legacy image keys', () => {
    expect(normalizeImageEngineId('google')).toBe('google-lens');
    expect(normalizeImageEngineId('bing')).toBe('bing-images');
    expect(normalizeImageEngineId('yandex')).toBe('yandex-images');
  });
  it('passes through non-colliding / new / custom / undefined', () => {
    expect(normalizeImageEngineId('tineye')).toBe('tineye');
    expect(normalizeImageEngineId('google-lens')).toBe('google-lens');
    expect(normalizeImageEngineId('custom')).toBe('custom');
    expect(normalizeImageEngineId(undefined)).toBeUndefined();
  });
});

describe('rawResult field', () => {
  it('toEngine carries rawResult from a custom engine', () => {
    const se = { overrides:{}, hidden:[], custom:[{ id:'r', name:'R', url:'https://r/?url=', rawResult:true }], order:[] };
    expect(resolveEngines([], se).find(e => e.id === 'r').rawResult).toBe(true);
  });
});
