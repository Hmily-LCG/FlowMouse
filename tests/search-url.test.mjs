import { describe, it, expect } from "vitest";
import "../js/engine-registry.js";
import "../js/search-url.js";
const { buildSearchUrl, resolveSearchConfig } = globalThis.FlowMouseSearchUrl;
const ENG = { system: { url: "" }, google: { url: "https://www.google.com/search?q=" } };

describe("buildSearchUrl", () => {
  it("custom engine replaces %s and encodes", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://amazon.de/s?k=%s" }, "a b", ENG))
      .toBe("https://amazon.de/s?k=a%20b");
  });
  it("custom url without %s uses prefix form (term appended)", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://amazon.de/" }, "x", ENG)).toBe("https://amazon.de/x");
  });
  it("predefined engine appends encoded query", () => {
    expect(buildSearchUrl({ engine: "google", url: "" }, "a b", ENG)).toBe("https://www.google.com/search?q=a%20b");
  });
  it("system engine returns null (router handles it)", () => {
    expect(buildSearchUrl({ engine: "system" }, "x", ENG)).toBeNull();
  });
  it("autoDetectUrl returns the URL itself", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://amazon.de/s?k=%s", autoDetectUrl: true }, "https://example.com/a", ENG))
      .toBe("https://example.com/a");
  });
  it("plus replaces spaces with + in custom url", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://ebay.de/sch?q=%s", plus: true }, "a b c", ENG))
      .toBe("https://ebay.de/sch?q=a+b+c");
  });
  it("suffix is appended", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://geizhals.de/?fs=%s", plus: true, suffix: "&hloc=de" }, "a b", ENG))
      .toBe("https://geizhals.de/?fs=a+b&hloc=de");
  });
  it("slug builds a hyphen path and appends suffix", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://www.guenstiger.de/Katalog/Suche/", slug: true, suffix: ".html" }, "Xiaomi 17T Pro!", ENG))
      .toBe("https://www.guenstiger.de/Katalog/Suche/Xiaomi-17T-Pro-.html");
  });
  it("slug preserves non-ASCII letters as UTF-8 percent-encoding (not hyphens)", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://www.kleinanzeigen.de/s-50937/", slug: true, suffix: "/k0l18675r50" }, "wünschen", ENG))
      .toBe("https://www.kleinanzeigen.de/s-50937/w%C3%BCnschen/k0l18675r50");
  });
  it("plus + predefined engine", () => {
    expect(buildSearchUrl({ engine: "google", url: "", plus: true }, "a b", { google: { url: "https://g/q=" } }))
      .toBe("https://g/q=a+b");
  });
  it("append-only custom (no %s) still appends suffix", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://x.de/q=", suffix: "&l=de" }, "a b", ENG))
      .toBe("https://x.de/q=a%20b&l=de");
  });
  it("rawTerm inserts the term verbatim (no encoding, no plus)", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://x/?q=%s", rawTerm: true }, "a b+c/d", ENG)).toBe("https://x/?q=a b+c/d");
  });
  it("rawTerm ignores plus and slug", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://x/?q=%s", rawTerm: true, plus: true, slug: true }, "a b", ENG)).toBe("https://x/?q=a b");
  });
  it("rawTerm prefix form appends verbatim + suffix", () => {
    expect(buildSearchUrl({ engine: "custom", url: "https://x/?q=", rawTerm: true, suffix: "&l=de" }, "a b", ENG)).toBe("https://x/?q=a b&l=de");
  });
});

const CAT = [
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  { id: 'geizhals',   name: 'Geizhals',   url: 'https://geizhals.de/?fs=', suffix: '&hloc=de', plus: true },
];
const SE = { overrides:{}, hidden:[], custom:[], order:[] };

describe('resolveSearchConfig', () => {
  it('system stays system (buildSearchUrl → null)', () => {
    const r = resolveSearchConfig(CAT, SE, { engine:'system' });
    expect(buildSearchUrl(r, 'x', {})).toBeNull();
  });
  it('custom passes through unchanged', () => {
    const r = resolveSearchConfig(CAT, SE, { engine:'custom', url:'https://x/?q=%s' });
    expect(buildSearchUrl(r, 'a b', {})).toBe('https://x/?q=a%20b');
  });
  it('catalog engine yields its url via custom path', () => {
    const r = resolveSearchConfig(CAT, SE, { engine:'duckduckgo' });
    expect(buildSearchUrl(r, 'a b', {})).toBe('https://duckduckgo.com/?q=a%20b');
  });
  it('catalog engine applies its own plus/suffix (not config toggles)', () => {
    const r = resolveSearchConfig(CAT, SE, { engine:'geizhals' });
    expect(buildSearchUrl(r, 'a b', {})).toBe('https://geizhals.de/?fs=a+b&hloc=de');
  });
  it('unknown engine falls back to system (null)', () => {
    const r = resolveSearchConfig(CAT, SE, { engine:'nope' });
    expect(buildSearchUrl(r, 'x', {})).toBeNull();
  });
});

describe('resolveSearchConfig rawResult', () => {
  const CATr = [
    { id: 'img-raw', name: 'ImgRaw', url: 'https://s/?url=', rawResult: true },
    { id: 'img-enc', name: 'ImgEnc', url: 'https://s/?url=' },
  ];
  const SEr = { overrides:{}, hidden:[], custom:[], order:[] };
  it('rawResult engine inserts the term verbatim', () => {
    const r = resolveSearchConfig(CATr, SEr, { engine:'img-raw' });
    expect(buildSearchUrl(r, 'https://x/a b.jpg', {})).toBe('https://s/?url=https://x/a b.jpg');
  });
  it('non-raw engine still encodes', () => {
    const r = resolveSearchConfig(CATr, SEr, { engine:'img-enc' });
    expect(buildSearchUrl(r, 'https://x/a b.jpg', {})).toBe('https://s/?url=https%3A%2F%2Fx%2Fa%20b.jpg');
  });
});
