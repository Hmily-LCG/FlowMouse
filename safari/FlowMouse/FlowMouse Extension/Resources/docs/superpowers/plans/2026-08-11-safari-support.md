# Safari Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FlowMouse installable and fully functional on Safari (macOS), degrading gracefully wherever Safari lacks a Chrome API FlowMouse currently depends on.

**Architecture:** A new capability-detection module (`js/browser-compat.js`) is loaded before every other script, in every context (content scripts, the background service worker, and every extension page). It exposes one flat object — `self.FlowMouseCompat` — with an `isSafari` flag and a set of `hasX` booleans, each computed by checking whether the relevant `chrome.*` method actually exists (not by browser-sniffing), so behavior self-corrects if Safari adds an API later. `background.js` reads these flags to no-op unsupported actions instead of throwing. `constants.js` reads them to filter unsupported actions and search-engine options out of every UI picker, and to remap the two default gesture bindings that use an unsupported action. Packaging is a generated Xcode project under `safari/`, produced by Apple's `safari-web-extension-converter` from the same `manifest.json` and source tree Chrome/Edge use — no manifest fork, no build-time flag flip.

**Tech Stack:** Vanilla JS (no bundler), Lit for UI components, Manifest V3, Xcode 26 / `safari-web-extension-converter` for Safari packaging.

## Global Constraints

- Target Safari 16.4+ / macOS 13.3+ only. No iOS/iPadOS.
- One shared `manifest.json` serves Chrome, Edge, and Safari. No build-time variant flip (unlike the external Firefox build process, which this plan does not touch).
- Graceful degradation only: hide/no-op what Safari can't do. No polyfills that fake unsupported APIs (no `<a download>` standing in for `chrome.downloads`, etc.).
- This project was git-initialized specifically for this implementation (baseline commit `e80c22c`), and work happens in an isolated worktree on branch `worktree-safari-support`. Each task commits its own changes with `git add`/`git commit` as normal — this supersedes any earlier no-git guidance.
- No automated test suite exists in this repo and this plan does not add one. Where a step below runs a Node script to verify pure logic, that script is scratch-only (write it under the scratchpad directory, not into the repo) — it is a verification aid, not a committed test.
- Follow existing code style: tabs for indentation in `.js` files (this repo does not use spaces), no semicolon-free style — match the file being edited.

---

### Task 1: Capability-detection module + wiring

**Files:**
- Create: `js/browser-compat.js`
- Modify: `manifest.json` (content_scripts.js array)
- Modify: `background.js:1` (top of file, before the existing `const isEdge = ...` line)
- Modify: `pages/about.html:23`, `pages/css-editor.html:24`, `pages/options.html:23`, `pages/permission.html:33`, `pages/popup.html:42`, `pages/tutorial.html:1202` (each: insert one `<script>` tag immediately before the existing `<script src="../js/i18n.js"></script>` line)

**Interfaces:**
- Produces: a global `FlowMouseCompat` object, reachable as `self.FlowMouseCompat` in the background service worker and content scripts, and `window.FlowMouseCompat` in every extension page (same object — `self === window` in those contexts). Shape:
  ```js
  {
    isSafari: boolean,
    hasSessions: boolean,
    hasSearch: boolean,
    hasPageCapture: boolean,
    hasDownloads: boolean,
    hasTabZoom: boolean,
    hasBookmarks: boolean,
    hasContextMenus: boolean,
    hasIncognitoQuery: boolean,
    hasFileSchemeQuery: boolean,
  }
  ```
  Every later task in this plan reads from this object; nothing later mutates it.

- [ ] **Step 1: Write `js/browser-compat.js`**

```js
(function () {
	'use strict';

	function detectIsSafari() {
		const ua = navigator.userAgent;
		if (!/Safari/.test(ua)) return false;
		return !/Chrome|Chromium|Edg\/|EdgA\/|OPR\/|CriOS/.test(ua);
	}

	const isSafari = detectIsSafari();

	// Derived from isSafari, not from chrome.X existence checks: this module
	// also loads in the content-script context (see manifest.json), where
	// Chrome/Edge restrict the chrome.* surface to a small subset regardless
	// of browser or actual support — chrome.sessions, chrome.tabs,
	// chrome.downloads, chrome.search, chrome.pageCapture, chrome.contextMenus
	// are all undefined there even on Chrome. An existence check would
	// misreport "unsupported" in that context. Basing these on isSafari keeps
	// the flags consistent across every context the extension runs in.
	const hasSessions = !isSafari;
	const hasSearch = !isSafari;
	const hasPageCapture = !isSafari;
	const hasDownloads = !isSafari;
	const hasTabZoom = !isSafari;
	const hasBookmarks = true;
	const hasContextMenus = true;
	const hasIncognitoQuery = !isSafari;
	const hasFileSchemeQuery = !isSafari;

	self.FlowMouseCompat = {
		isSafari,
		hasSessions,
		hasSearch,
		hasPageCapture,
		hasDownloads,
		hasTabZoom,
		hasBookmarks,
		hasContextMenus,
		hasIncognitoQuery,
		hasFileSchemeQuery,
	};
})();
```

- [ ] **Step 2: Verify the detection logic in isolation (Node, no browser)**

Create a scratch file (path from the scratchpad directory shown in your environment info, e.g. `<scratchpad>/verify-browser-compat.mjs`):

```js
import vm from 'node:vm';
import fs from 'node:fs';

const source = fs.readFileSync('js/browser-compat.js', 'utf8');

function run(userAgent) {
	const sandbox = {
		navigator: { userAgent },
		chrome: {},
		self: {},
		console,
	};
	vm.createContext(sandbox);
	vm.runInContext(source, sandbox);
	return sandbox.self.FlowMouseCompat;
}

const chromeUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const safariUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

// Note: chrome is passed as an empty object in both cases on purpose — the
// flags must not depend on which chrome.* methods exist, since this module
// also runs in the content-script context where most of the chrome.*
// surface is undefined regardless of browser (see the comment in
// browser-compat.js). Only the User-Agent should move these flags.
const chromeResult = run(chromeUA);
console.assert(chromeResult.isSafari === false, 'FAIL: Chrome UA misdetected as Safari');
console.assert(chromeResult.hasSessions === true, 'FAIL: Chrome should have sessions');
console.assert(chromeResult.hasDownloads === true, 'FAIL: Chrome should have downloads');
console.assert(chromeResult.hasBookmarks === true, 'FAIL: Chrome should have bookmarks');

const safariResult = run(safariUA);
console.assert(safariResult.isSafari === true, 'FAIL: Safari UA not detected');
console.assert(safariResult.hasSessions === false, 'FAIL: Safari should not have sessions');
console.assert(safariResult.hasSearch === false, 'FAIL: Safari should not have search');
console.assert(safariResult.hasDownloads === false, 'FAIL: Safari should not have downloads');
console.assert(safariResult.hasBookmarks === true, 'FAIL: Safari bookmarks flag is always true (supported on Safari 14+)');
console.assert(safariResult.hasContextMenus === true, 'FAIL: Safari contextMenus flag is always true (supported on Safari 14+)');

console.log('All browser-compat assertions passed');
```

Run: `node <scratchpad>/verify-browser-compat.mjs`
Expected output: `All browser-compat assertions passed` with no `FAIL:` lines.

- [ ] **Step 3: Wire into `manifest.json`**

Find the `content_scripts` block:

```json
    "content_scripts": [
        {
            "matches": [
                "<all_urls>"
            ],
            "js": [
                "js/constants.js",
                "js/gesture-visual.js",
                "js/gesture-recognizer.js",
                "js/content.js"
            ],
```

Change the `js` array so `browser-compat.js` loads first:

```json
            "js": [
                "js/browser-compat.js",
                "js/constants.js",
                "js/gesture-visual.js",
                "js/gesture-recognizer.js",
                "js/content.js"
            ],
```

- [ ] **Step 4: Wire into `background.js`**

At the very top of the file, before the existing first line:

```js
const isEdge = navigator.userAgent.includes('Edg/') || navigator.userAgent.includes('EdgA/');
```

add:

```js
importScripts('browser-compat.js');

const isEdge = navigator.userAgent.includes('Edg/') || navigator.userAgent.includes('EdgA/');
```

- [ ] **Step 5: Wire into every page that loads `i18n.js`**

In each of `pages/about.html`, `pages/css-editor.html`, `pages/options.html`, `pages/permission.html`, `pages/popup.html`, `pages/tutorial.html`, find:

```html
	<script src="../js/i18n.js"></script>
```

and insert immediately before it:

```html
	<script src="../js/browser-compat.js"></script>
	<script src="../js/i18n.js"></script>
```

(`pages/context-menu.html` does not load `i18n.js` or `constants.js` and does not call any gated API — leave it untouched.)

- [ ] **Step 6: Manual smoke test in Chrome**

1. Open `chrome://extensions`, enable Developer mode, "Load unpacked", select the FlowMouse repo root.
2. Click "service worker" under the loaded extension to open its DevTools console. Type `self.FlowMouseCompat` — expect an object with all `has*` flags `true` and `isSafari: false`.
3. Open the options page (extension icon → gear, or right-click icon → Options), open DevTools console, type `window.FlowMouseCompat` — expect the same object.

Expected: both consoles print the full flag object with every `has*` flag `true`.

---

### Task 2: `background.js` — gate unsupported-API handlers

**Files:**
- Modify: `background.js`

**Interfaces:**
- Consumes: `self.FlowMouseCompat` (produced by Task 1) — `hasSessions`, `hasSearch`, `hasPageCapture`, `hasDownloads`, `hasTabZoom`, `hasIncognitoQuery`, `hasFileSchemeQuery`, `isSafari`.
- Produces: no new interface; existing message-handler contract (`{ success, ... }` responses) is preserved, with `{ success: false, unsupported: true }` added as the response for gated actions when the capability is missing.

- [ ] **Step 1: Guard `restoreTab`**

Find:
```js
		case 'restoreTab':
			if (sender.tab?.incognito) return { success: false };
			await chrome.sessions.restore(null).catch(() => { });
			return { success: true };
```
Replace with:
```js
		case 'restoreTab':
			if (!self.FlowMouseCompat.hasSessions) return { success: false, unsupported: true };
			if (sender.tab?.incognito) return { success: false };
			await chrome.sessions.restore(null).catch(() => { });
			return { success: true };
```

- [ ] **Step 2: Guard `restoreSession`**

Find:
```js
		case 'restoreSession':
			if (request.sessionId) {
				await chrome.sessions.restore(request.sessionId).catch(() => {});
			}
			return { success: true };
```
Replace with:
```js
		case 'restoreSession':
			if (!self.FlowMouseCompat.hasSessions) return { success: false, unsupported: true };
			if (request.sessionId) {
				await chrome.sessions.restore(request.sessionId).catch(() => {});
			}
			return { success: true };
```

- [ ] **Step 3: Guard `getRecentlyClosedTabs`**

Find:
```js
		case 'getRecentlyClosedTabs': {
			const maxItems = request.maxItems ?? 12;
```
Replace with:
```js
		case 'getRecentlyClosedTabs': {
			if (!self.FlowMouseCompat.hasSessions) return { success: false, unsupported: true, tabs: [] };
			const maxItems = request.maxItems ?? 12;
```

- [ ] **Step 4: Guard `systemSearch`**

Find:
```js
		case 'systemSearch': {
			if (sender.tab) {
```
Replace with:
```js
		case 'systemSearch': {
			if (!self.FlowMouseCompat.hasSearch) return { success: false, unsupported: true };
			if (sender.tab) {
```

- [ ] **Step 5: Drop search queries in `openIncognitoTabs` when unsupported**

Find:
```js
		case 'openIncognitoTabs': {
			const urls = request.urls || [];
			const queries = request.queries || [];
```
Replace with:
```js
		case 'openIncognitoTabs': {
			const urls = request.urls || [];
			const queries = self.FlowMouseCompat.hasSearch ? (request.queries || []) : [];
```
(The rest of that case body is unchanged — every loop over `queries` becomes a no-op when the array is empty, and URL-only opening still works.)

- [ ] **Step 6: Guard `saveImage`**

Find:
```js
		case 'saveImage':
			if (request.url) {
				requestPermission(['downloads', 'pageCapture'], sender.tab?.windowId ?? null).then(async (granted) => {
```
Replace with:
```js
		case 'saveImage':
			if (request.url) {
				if (!self.FlowMouseCompat.hasDownloads || (!request.url.startsWith('data:') && !self.FlowMouseCompat.hasPageCapture)) {
					notifyDownloadError(sender.tab?.id);
					return { success: true };
				}
				requestPermission(['downloads', 'pageCapture'], sender.tab?.windowId ?? null).then(async (granted) => {
```

- [ ] **Step 7: Guard `saveAsMhtml`**

Find:
```js
		case 'saveAsMhtml':
			if (sender.tab?.id) {
				requestPermission(['downloads', 'pageCapture'], sender.tab.windowId).then(async (granted) => {
```
Replace with:
```js
		case 'saveAsMhtml':
			if (sender.tab?.id) {
				if (!self.FlowMouseCompat.hasPageCapture || !self.FlowMouseCompat.hasDownloads) {
					return { success: false, unsupported: true };
				}
				requestPermission(['downloads', 'pageCapture'], sender.tab.windowId).then(async (granted) => {
```

- [ ] **Step 8: Guard zoom actions**

Find:
```js
		case 'zoomIn':
		case 'zoomOut': {
			if (!sender.tab?.id) return { success: false };
```
Replace with:
```js
		case 'zoomIn':
		case 'zoomOut': {
			if (!self.FlowMouseCompat.hasTabZoom) return { success: false, unsupported: true };
			if (!sender.tab?.id) return { success: false };
```

Find:
```js
		case 'resetZoom': {
			if (!sender.tab?.id) return { success: false };
```
Replace with:
```js
		case 'resetZoom': {
			if (!self.FlowMouseCompat.hasTabZoom) return { success: false, unsupported: true };
			if (!sender.tab?.id) return { success: false };
```

- [ ] **Step 9: Guard the browser-internal-page actions**

Find:
```js
		case 'openDownloads':
			{
				await chrome.tabs.create({ url: 'chrome://downloads', active: true, windowId: sender.tab.windowId });
			}
			return { success: true };

		case 'openHistory':
			{
				await chrome.tabs.create({ url: 'chrome://history', active: true, windowId: sender.tab.windowId });
			}
			return { success: true };

		case 'openExtensions':
			{
				await chrome.tabs.create({ url: 'chrome://extensions', active: true, windowId: sender.tab.windowId });
			}
			return { success: true };
```
Replace with:
```js
		case 'openDownloads':
			if (self.FlowMouseCompat.isSafari) return { success: false, unsupported: true };
			{
				await chrome.tabs.create({ url: 'chrome://downloads', active: true, windowId: sender.tab.windowId });
			}
			return { success: true };

		case 'openHistory':
			if (self.FlowMouseCompat.isSafari) return { success: false, unsupported: true };
			{
				await chrome.tabs.create({ url: 'chrome://history', active: true, windowId: sender.tab.windowId });
			}
			return { success: true };

		case 'openExtensions':
			if (self.FlowMouseCompat.isSafari) return { success: false, unsupported: true };
			{
				await chrome.tabs.create({ url: 'chrome://extensions', active: true, windowId: sender.tab.windowId });
			}
			return { success: true };
```

- [ ] **Step 10: Guard the incognito-permission query inside `requestPermission`**

Find:
```js
async function requestPermission(permissions, windowId) {
	if (permissions.includes('incognito')) {
		const isAllowed = await chrome.extension.isAllowedIncognitoAccess();
		if (isAllowed) return true;
	} else {
```
Replace with:
```js
async function requestPermission(permissions, windowId) {
	if (permissions.includes('incognito')) {
		if (!self.FlowMouseCompat.hasIncognitoQuery) return true;
		const isAllowed = await chrome.extension.isAllowedIncognitoAccess();
		if (isAllowed) return true;
	} else {
```

Find:
```js
		const checkGranted = async () => {
			if (permissions.includes('incognito')) {
				return await chrome.extension.isAllowedIncognitoAccess();
			}
			return await chrome.permissions.contains({ permissions: permissions });
		};
```
Replace with:
```js
		const checkGranted = async () => {
			if (permissions.includes('incognito')) {
				if (!self.FlowMouseCompat.hasIncognitoQuery) return true;
				return await chrome.extension.isAllowedIncognitoAccess();
			}
			return await chrome.permissions.contains({ permissions: permissions });
		};
```

- [ ] **Step 11: Guard the file-scheme-access check at module load**

Find:
```js
let fileSchemeAllowed = false;
chrome.extension.isAllowedFileSchemeAccess().then(v => { fileSchemeAllowed = v; });
```
Replace with:
```js
let fileSchemeAllowed = false;
if (self.FlowMouseCompat.hasFileSchemeQuery) {
	chrome.extension.isAllowedFileSchemeAccess().then(v => { fileSchemeAllowed = v; });
}
```

- [ ] **Step 12: Manual verification in Chrome (regression)**

1. Reload the unpacked extension in `chrome://extensions`.
2. In the service worker console, confirm no errors were logged on load.
3. On any normal webpage (not `chrome://`), trigger the default `←↑` gesture (draw left then up with the right mouse button held) — expect the "restore last closed tab" behavior to still work (Chrome has `hasSessions: true`, so the guard is a no-op).
4. In the service worker console, run `self.FlowMouseCompat.hasSessions = false;` then repeat step 3 — expect nothing to happen (no error thrown, no tab restored). This simulates the Safari code path without needing a Safari build yet.
5. Restore correct behavior by reloading the extension (the console override doesn't persist).

---

### Task 3: `constants.js` — capability-aware action & search-engine helpers

**Files:**
- Modify: `js/constants.js`

**Interfaces:**
- Consumes: `window.FlowMouseCompat` (produced by Task 1).
- Produces, added to `window.GestureConstants`:
  - `isActionSupported(action: string): boolean`
  - `getDefaultGestures(): Record<string, string>` — same shape as `DEFAULT_GESTURES` (pattern → action string), with unsupported actions remapped to `'none'`.
  - `getSearchEngineOrder(lang: string): string[]` — same shape as `SEARCH_ENGINE_ORDER[lang]`, with `'system'` removed when `hasSearch` is false.
  - `DEFAULT_SETTINGS.mouseGestures` (already existed) now derives from `getDefaultGestures()` instead of the raw `DEFAULT_GESTURES` map.

- [ ] **Step 1: Add the two capability-lookup tables, then the three helper functions**

The two lookup tables must be declared with `const` *before* `DEFAULT_SETTINGS`, not after: `DEFAULT_SETTINGS.mouseGestures` calls `getDefaultGestures()` during its own object-literal evaluation, and that call reads these tables. Function declarations (`isActionSupported`, `getDefaultGestures`, `getSearchEngineOrder`) hoist their full body regardless of textual position, so they can stay near `arrowsToSvg` as below — but `const` bindings do not hoist a value, only the declaration; a `const` read before its own declaration line throws `ReferenceError` (temporal dead zone). Putting the tables after `DEFAULT_SETTINGS` (as an earlier draft of this plan had it) would throw as soon as the file loads.

Find (right before `const DEFAULT_SETTINGS = {`):
```js
	const IMAGE_SEARCH_ENGINE_ORDER = {
		'default': ['google', 'bing', 'tineye', 'yandex', 'saucenao', 'iqdb', 'trace'],
		'uk': ['google', 'bing', 'tineye', 'saucenao', 'iqdb', 'trace'],
	};

	const DEFAULT_SETTINGS = {
```
Replace with:
```js
	const IMAGE_SEARCH_ENGINE_ORDER = {
		'default': ['google', 'bing', 'tineye', 'yandex', 'saucenao', 'iqdb', 'trace'],
		'uk': ['google', 'bing', 'tineye', 'saucenao', 'iqdb', 'trace'],
	};

	const UNSUPPORTED_ACTION_CAPABILITY = {
		restoreTab: 'hasSessions',
		menuRecentlyClosed: 'hasSessions',
		saveAsMhtml: 'hasPageCapture',
		zoomIn: 'hasTabZoom',
		zoomOut: 'hasTabZoom',
		resetZoom: 'hasTabZoom',
		saveImage: 'hasDownloads',
	};

	const SAFARI_ONLY_HIDDEN_ACTIONS = new Set(['openDownloads', 'openHistory', 'openExtensions']);

	const DEFAULT_SETTINGS = {
```

Then find (near the end of the file, right before the `window.GestureConstants = {` assignment):
```js
	function arrowsToSvg(text) {
		if (CORNER_SVG[text]) return CORNER_SVG[text];
		return text.replace(/[↑↓←→]/g, match => ARROW_SVG[match] || match);
	}

	window.GestureConstants = {
```
Replace with:
```js
	function arrowsToSvg(text) {
		if (CORNER_SVG[text]) return CORNER_SVG[text];
		return text.replace(/[↑↓←→]/g, match => ARROW_SVG[match] || match);
	}

	function isActionSupported(action) {
		const compat = window.FlowMouseCompat;
		if (!compat) return true;
		if (compat.isSafari && SAFARI_ONLY_HIDDEN_ACTIONS.has(action)) return false;
		const capKey = UNSUPPORTED_ACTION_CAPABILITY[action];
		if (capKey && !compat[capKey]) return false;
		return true;
	}

	function getDefaultGestures() {
		const result = {};
		for (const [pattern, action] of Object.entries(DEFAULT_GESTURES)) {
			result[pattern] = isActionSupported(action) ? action : 'none';
		}
		return result;
	}

	function getSearchEngineOrder(lang) {
		const order = SEARCH_ENGINE_ORDER[lang] || SEARCH_ENGINE_ORDER['default'];
		const compat = window.FlowMouseCompat;
		if (compat && !compat.hasSearch) {
			return order.filter(key => key !== 'system');
		}
		return order;
	}

	window.GestureConstants = {
```

- [ ] **Step 2: Point `DEFAULT_SETTINGS.mouseGestures` at the capability-aware defaults**

Find:
```js
		mouseGestures: Object.fromEntries(
			Object.entries(DEFAULT_GESTURES).map(([p, a]) => [p, { action: a }])
		),
```
Replace with:
```js
		mouseGestures: Object.fromEntries(
			Object.entries(getDefaultGestures()).map(([p, a]) => [p, { action: a }])
		),
```

- [ ] **Step 3: Export the new functions**

Find:
```js
		DEFAULT_SETTINGS,

		arrowsToSvg,
	};
```
Replace with:
```js
		DEFAULT_SETTINGS,

		arrowsToSvg,
		isActionSupported,
		getDefaultGestures,
		getSearchEngineOrder,
	};
```

- [ ] **Step 4: Verify the logic in isolation (Node, no browser)**

Create a scratch file at `<scratchpad>/verify-constants.mjs`:

```js
import vm from 'node:vm';
import fs from 'node:fs';

const source = fs.readFileSync('js/constants.js', 'utf8');

function run(compat) {
	const sandbox = { window: { FlowMouseCompat: compat }, console };
	vm.createContext(sandbox);
	vm.runInContext(source, sandbox);
	return sandbox.window.GestureConstants;
}

const chromeCompat = { isSafari: false, hasSessions: true, hasSearch: true, hasPageCapture: true, hasDownloads: true, hasTabZoom: true, hasBookmarks: true, hasContextMenus: true, hasIncognitoQuery: true, hasFileSchemeQuery: true };
const safariCompat = { isSafari: true, hasSessions: false, hasSearch: false, hasPageCapture: false, hasDownloads: false, hasTabZoom: false, hasBookmarks: true, hasContextMenus: true, hasIncognitoQuery: false, hasFileSchemeQuery: false };

const onChrome = run(chromeCompat);
console.assert(onChrome.isActionSupported('restoreTab') === true, 'FAIL: restoreTab should be supported on Chrome');
console.assert(onChrome.getDefaultGestures()['←↑'] === 'restoreTab', 'FAIL: Chrome default for ←↑ should stay restoreTab');
console.assert(onChrome.getSearchEngineOrder('default').includes('system'), 'FAIL: Chrome should keep the system search engine option');

const onSafari = run(safariCompat);
console.assert(onSafari.isActionSupported('restoreTab') === false, 'FAIL: restoreTab should be unsupported on Safari');
console.assert(onSafari.isActionSupported('openDownloads') === false, 'FAIL: openDownloads should be unsupported on Safari');
console.assert(onSafari.isActionSupported('back') === true, 'FAIL: back should remain supported on Safari');
console.assert(onSafari.getDefaultGestures()['←↑'] === 'none', 'FAIL: Safari default for ←↑ should fall back to none');
console.assert(onSafari.getDefaultGestures()['→←'] === 'none', 'FAIL: Safari default for →← should fall back to none');
console.assert(!onSafari.getSearchEngineOrder('default').includes('system'), 'FAIL: Safari should drop the system search engine option');

console.log('All constants assertions passed');
```

Run: `node <scratchpad>/verify-constants.mjs`
Expected output: `All constants assertions passed` with no `FAIL:` lines.

---

### Task 4: Wire `content.js` and `popup-page.js` to capability-aware defaults

**Files:**
- Modify: `js/content.js:2008-2020`
- Modify: `js/components/popup-page.js:464-477`

**Interfaces:**
- Consumes: `window.GestureConstants.getDefaultGestures()` (produced by Task 3).

- [ ] **Step 1: Compute the active defaults once in `content.js`**

Find:
```js
		let SETTINGS = {
			...DEFAULT_SETTINGS,
			enableDrag: DEFAULT_SETTINGS.enableTextDrag || DEFAULT_SETTINGS.enableImageDrag || DEFAULT_SETTINGS.enableLinkDrag
		};

		function getGestureAction(pattern) {
			if (!SETTINGS.enableGestureCustomization) {
				return DEFAULT_GESTURES[pattern];
			}

			const config = SETTINGS.mouseGestures?.[pattern];
			return config?.action;
		}
```
Replace with:
```js
		let SETTINGS = {
			...DEFAULT_SETTINGS,
			enableDrag: DEFAULT_SETTINGS.enableTextDrag || DEFAULT_SETTINGS.enableImageDrag || DEFAULT_SETTINGS.enableLinkDrag
		};

		const ACTIVE_DEFAULT_GESTURES = window.GestureConstants.getDefaultGestures();

		function getGestureAction(pattern) {
			if (!SETTINGS.enableGestureCustomization) {
				return ACTIVE_DEFAULT_GESTURES[pattern];
			}

			const config = SETTINGS.mouseGestures?.[pattern];
			return config?.action;
		}
```

(Leave the `DEFAULT_GESTURES` reference at the `getSuggestedGestures` function — around line 2059, `: DEFAULT_GESTURES` — untouched. It's only used there to enumerate gesture *patterns*, and the action for each pattern is re-resolved through `getGestureAction`, which now reads `ACTIVE_DEFAULT_GESTURES`.)

- [ ] **Step 2: Use capability-aware defaults in the popup's quick-actions list**

Find:
```js
			let actionMap;
			if (settings.enableGestureCustomization) {
				actionMap = {};
				for (const [pattern, config] of Object.entries(settings.mouseGestures || {})) {
					actionMap[pattern] = config.action;
				}
			} else {
				actionMap = { ...DEFAULT_GESTURES };
			}
```
Replace with:
```js
			let actionMap;
			if (settings.enableGestureCustomization) {
				actionMap = {};
				for (const [pattern, config] of Object.entries(settings.mouseGestures || {})) {
					actionMap[pattern] = config.action;
				}
			} else {
				actionMap = { ...window.GestureConstants.getDefaultGestures() };
			}
```

- [ ] **Step 3: Manual verification in Chrome (regression)**

1. Reload the unpacked extension.
2. In the options page, confirm "Enable gesture customization" is off (default).
3. Open the popup — confirm the quick-actions list still shows the same six default gestures as before this change (including "Restore Tab" for `←↑`), since Chrome has `hasSessions: true`.
4. On any webpage, draw the `←↑` gesture — confirm it still restores the last closed tab.

---

### Task 5: Filter unsupported actions and search engines out of the picker UI

**Files:**
- Modify: `js/components/action-select.js:752-776` (`#getFilteredCategories`) and `:1538-1544` (`searchClipboard` config renderer)
- Modify: `js/components/drag-gesture-manager.js:209-212` (`#visibleActions`) and `:423-427` (`#renderSearchEngineOptions`)

**Interfaces:**
- Consumes: `window.GestureConstants.isActionSupported(action)` and `window.GestureConstants.getSearchEngineOrder(lang)` (both produced by Task 3).

- [ ] **Step 1: Filter the action picker categories**

In `js/components/action-select.js`, find:
```js
			for (const action of cat.actions) {
				if (!ACTION_KEYS[action]) continue;
				if (action === 'actionChain' && ctx === 'chain-step') continue;
```
Replace with:
```js
			for (const action of cat.actions) {
				if (!ACTION_KEYS[action]) continue;
				if (!window.GestureConstants.isActionSupported(action)) continue;
				if (action === 'actionChain' && ctx === 'chain-step') continue;
```

- [ ] **Step 2: Use the filtered search-engine order in the `searchClipboard` config UI**

In `js/components/action-select.js`, find:
```js
			const { SEARCH_ENGINES, SEARCH_ENGINE_ORDER } = window.GestureConstants;
			const lang = window.i18n.getCurrentLanguage();
			const order = SEARCH_ENGINE_ORDER[lang] || SEARCH_ENGINE_ORDER['default'];
			const displayKeys = [...order];
			if (engine && engine !== 'custom' && !displayKeys.includes(engine) && SEARCH_ENGINES[engine]) {
```
Replace with:
```js
			const { SEARCH_ENGINES, getSearchEngineOrder } = window.GestureConstants;
			const lang = window.i18n.getCurrentLanguage();
			const order = getSearchEngineOrder(lang);
			const displayKeys = [...order];
			if (engine && engine !== 'custom' && !displayKeys.includes(engine) && SEARCH_ENGINES[engine]) {
```

- [ ] **Step 3: Filter the drag-action picker**

In `js/components/drag-gesture-manager.js`, find:
```js
	#visibleActions(currentAction) {
		return Object.entries(this._actions)
			.filter(([v]) => !DragGestureManager.ADVANCED_ACTIONS.has(v) || this.advancedMode || v === currentAction);
	}
```
Replace with:
```js
	#visibleActions(currentAction) {
		return Object.entries(this._actions)
			.filter(([v]) => window.GestureConstants.isActionSupported(v))
			.filter(([v]) => !DragGestureManager.ADVANCED_ACTIONS.has(v) || this.advancedMode || v === currentAction);
	}
```

- [ ] **Step 4: Use the filtered search-engine order in the drag-action config UI**

In `js/components/drag-gesture-manager.js`, find:
```js
	#renderSearchEngineOptions(current) {
		const { SEARCH_ENGINES, SEARCH_ENGINE_ORDER } = window.GestureConstants;
		const lang = window.i18n.getCurrentLanguage();
		const order = SEARCH_ENGINE_ORDER[lang] || SEARCH_ENGINE_ORDER['default'];
		const displayKeys = [...order];
```
Replace with:
```js
	#renderSearchEngineOptions(current) {
		const { SEARCH_ENGINES, getSearchEngineOrder } = window.GestureConstants;
		const lang = window.i18n.getCurrentLanguage();
		const order = getSearchEngineOrder(lang);
		const displayKeys = [...order];
```

- [ ] **Step 5: Manual verification in Chrome — regression, then simulated Safari**

1. Reload the unpacked extension, open the options page.
2. Open any gesture's action picker — confirm "Restore Tab", "Zoom In/Out", "Reset Zoom", "Save Page as MHTML", "Open Downloads/History/Extensions" are all present (Chrome has every capability).
3. Open DevTools console on the options page and run:
   ```js
   window.FlowMouseCompat.isSafari = true;
   window.FlowMouseCompat.hasSessions = false;
   window.FlowMouseCompat.hasTabZoom = false;
   window.FlowMouseCompat.hasPageCapture = false;
   window.FlowMouseCompat.hasSearch = false;
   ```
4. Close and reopen the action picker (no page reload) — confirm "Restore Tab", "Zoom In/Out", "Reset Zoom", "Save Page as MHTML", "Open Downloads/History/Extensions" are now absent, and everything else (Back, Forward, New Tab, Close Tab, etc.) is still present.
5. Open a `searchClipboard` action's config — confirm "Browser Default" is gone from the engine dropdown but Google/Bing/DuckDuckGo/etc. remain.
6. Reload the extension to clear the console override before continuing.

---

### Task 6: `options-page.js` — feedback copy and incognito-query guard

**Files:**
- Modify: `js/components/options-page.js:883` and `:1370-1376`

**Interfaces:**
- Consumes: `window.FlowMouseCompat.isSafari` and `window.FlowMouseCompat.hasIncognitoQuery` (both produced by Task 1). This task does not depend on Task 7 — it reads the Safari flag straight from `FlowMouseCompat` rather than through `window.i18n`, so it can run in either order relative to Task 7.

- [ ] **Step 1: Fix the feedback-copy condition**

Find:
```js
								<span>${unsafeHTML(i18n.getMessage(!i18n.isFirefox && !i18n.isEdge ? 'feedbackTextChrome' : 'feedbackText'))}</span>
```
Replace with:
```js
								<span>${unsafeHTML(i18n.getMessage(!i18n.isFirefox && !i18n.isEdge && !window.FlowMouseCompat.isSafari ? 'feedbackTextChrome' : 'feedbackText'))}</span>
```

- [ ] **Step 2: Guard the incognito-access query**

Find:
```js
		if ((action === 'newIncognito' && window.i18n.isFirefox) || action === 'openInIncognito') {
			const isAllowed = await chrome.extension.isAllowedIncognitoAccess();
			if (!isAllowed) {
				await openPopup('incognito');
			}
			return;
		}
```
Replace with:
```js
		if ((action === 'newIncognito' && window.i18n.isFirefox) || action === 'openInIncognito') {
			if (window.FlowMouseCompat.hasIncognitoQuery) {
				const isAllowed = await chrome.extension.isAllowedIncognitoAccess();
				if (!isAllowed) {
					await openPopup('incognito');
				}
			}
			return;
		}
```

- [ ] **Step 3: Manual verification in Chrome**

1. Reload the unpacked extension, open the options page.
2. Confirm the feedback section still shows the Chrome-specific copy (asking for a Chrome Web Store review).
3. Trigger an action that opens a link in incognito (e.g. a gesture configured with `incognito: true`, or the "Open in Incognito" option if present in the UI) — confirm the existing permission-prompt flow is unaffected.

---

### Task 7: `i18n.js` — Safari detection and browser metadata

**Files:**
- Modify: `js/i18n.js:4-6`, `:206-228` (`browsers` map), `:194-204` (`getBrowserType`), `:317-337` (`window.i18n` export)
- Modify: `_locales/en/messages.json` (add `storeNameSafari`)

**Interfaces:**
- Consumes: `window.FlowMouseCompat.isSafari` (Task 1).
- Produces: `window.i18n.isSafari: boolean`; `window.i18n.getBrowserInfo()` returns `{ browserType: 'safari', name: 'Safari', ... }` when running on Safari.

- [ ] **Step 1: Add `isSafari` detection**

Find:
```js
	const isFirefox = false;
	const isEdgeDesktop = navigator.userAgent.includes('Edg/');
	const isEdge = navigator.userAgent.includes('Edg/') || navigator.userAgent.includes('EdgA/');
```
Replace with:
```js
	const isFirefox = false;
	const isEdgeDesktop = navigator.userAgent.includes('Edg/');
	const isEdge = navigator.userAgent.includes('Edg/') || navigator.userAgent.includes('EdgA/');
	const isSafari = !!(window.FlowMouseCompat && window.FlowMouseCompat.isSafari);
```

- [ ] **Step 2: Add the `safari` entry to the `browsers` map**

Find:
```js
		'firefox': {
			name: 'Firefox',
			storeLink: 'https://addons.mozilla.org/',
			storeNameKey: 'storeNameFirefox',
			flowmouseStoreLink: 'https://addons.mozilla.org/firefox/addon/flowmouse/',
			protocol: 'about:'
		}
	}
```
Replace with:
```js
		'firefox': {
			name: 'Firefox',
			storeLink: 'https://addons.mozilla.org/',
			storeNameKey: 'storeNameFirefox',
			flowmouseStoreLink: 'https://addons.mozilla.org/firefox/addon/flowmouse/',
			protocol: 'about:'
		},
		'safari': {
			name: 'Safari',
			storeLink: 'https://apps.apple.com/',
			storeNameKey: 'storeNameSafari',
			flowmouseStoreLink: '',
			protocol: ''
		}
	}
```
(`flowmouseStoreLink` is left empty until the App Store listing exists — `options-page.js` already checks `if (browserInfo.flowmouseStoreLink)` before rendering a link, so an empty string just skips the link instead of rendering a broken one.)

- [ ] **Step 3: Detect Safari in `getBrowserType()`**

Find:
```js
	let browserType;
	function getBrowserType() {
		if (browserType) return browserType;
		{
			if (isEdge) {
				browserType = 'edge';
			} else {
				browserType = 'chrome';
			}
			return browserType;
		}
	}
```
Replace with:
```js
	let browserType;
	function getBrowserType() {
		if (browserType) return browserType;
		{
			if (isSafari) {
				browserType = 'safari';
			} else if (isEdge) {
				browserType = 'edge';
			} else {
				browserType = 'chrome';
			}
			return browserType;
		}
	}
```

- [ ] **Step 4: Export `isSafari` on `window.i18n`**

Find:
```js
		waitForInit,
		isFirefox,
		isEdge,
		isEdgeDesktop,
```
Replace with:
```js
		waitForInit,
		isFirefox,
		isEdge,
		isEdgeDesktop,
		isSafari,
```

- [ ] **Step 5: Add the `storeNameSafari` locale key**

In `_locales/en/messages.json`, find:
```json
	"storeNameFirefox": {
		"message": "Firefox Add-ons",
		"description": "Firefox Add-ons name"
	},
```
Replace with:
```json
	"storeNameFirefox": {
		"message": "Firefox Add-ons",
		"description": "Firefox Add-ons name"
	},
	"storeNameSafari": {
		"message": "Mac App Store",
		"description": "Mac App Store name"
	},
```

- [ ] **Step 6: Verify JSON validity and manual check in Chrome**

Run: `node -e "JSON.parse(require('fs').readFileSync('_locales/en/messages.json', 'utf8')); console.log('valid JSON')"`
Expected: `valid JSON` with no error.

Then in Chrome: reload the extension, open the options page console, run `window.i18n.getBrowserInfo()` — expect `{ browserType: 'chrome', name: 'Chrome', ... }` (unaffected, since `window.FlowMouseCompat.isSafari` is `false` there).

---

### Task 8: Safari Xcode packaging and full acceptance walkthrough

**Files:**
- Create: `safari/` (generated Xcode project — output of `xcrun safari-web-extension-converter`)
- Create: `safari/README.md`

**Interfaces:**
- Consumes: the finished, capability-gated extension source from Tasks 1–7 (must be complete before running this task, since the converter copies the current source tree into the generated project).

- [ ] **Step 1: Generate the Xcode project**

Run from the repo root:
```bash
xcrun safari-web-extension-converter . \
  --project-location safari \
  --app-name FlowMouse \
  --bundle-identifier com.hmilylcg.flowmouse \
  --swift \
  --macos-only \
  --copy-resources \
  --no-open \
  --no-prompt \
  --force
```
Expected: a new `safari/FlowMouse/` (or similarly named) Xcode project directory is created, containing an `.xcodeproj` and a copy of the extension's source files.

If you already registered a different bundle identifier in App Store Connect, replace `com.hmilylcg.flowmouse` with that value — it only affects code signing and App Store identity, not runtime behavior.

- [ ] **Step 2: Set the deployment target**

Open the generated `.xcodeproj` in Xcode, select the app target and the extension target, and set **macOS Deployment Target** to **13.3** on both (matches the Safari 16.4+ floor from the Global Constraints — this is the version that added the MV3 service-worker background and `chrome.storage.session` APIs this extension already relies on).

- [ ] **Step 3: Write `safari/README.md`**

```markdown
# FlowMouse for Safari

This directory is generated by Apple's `safari-web-extension-converter` from the
repo root's `manifest.json` and `js/`/`pages/`/`_locales/` source — it is not
hand-written and gets overwritten if regenerated.

## Regenerating

Only regenerate if the extension's manifest or top-level file layout changed in
a way Xcode needs to know about (new content script, new permission, etc.) —
day-to-day JS/CSS/HTML edits do NOT require regeneration; Xcode picks up
changes to the copied source files on rebuild.

From the repo root:

\`\`\`bash
xcrun safari-web-extension-converter . \\
  --project-location safari \\
  --app-name FlowMouse \\
  --bundle-identifier com.hmilylcg.flowmouse \\
  --swift \\
  --macos-only \\
  --copy-resources \\
  --no-open \\
  --no-prompt \\
  --force
\`\`\`

`--force` overwrites the existing `safari/` output. Re-apply the deployment
target change (macOS 13.3) after regenerating, since the converter resets
project settings to Xcode's defaults.

## Building and running

1. Open the generated `.xcodeproj` in Xcode.
2. Select the macOS app scheme, build and run (⌘R). This launches a thin host
   app whose only job is to register the extension with Safari.
3. In Safari: Settings → Extensions → enable "FlowMouse".
4. If gestures don't respond on a page, check Safari's per-site permission for
   the extension (Settings → Extensions → FlowMouse → allow on the site you're
   testing, or "Allow on All Websites").

## Minimum version

Safari 16.4 / macOS 13.3. Earlier versions lack MV3 service-worker background
scripts and `chrome.storage.session`, both of which this extension already
requires on Chrome/Edge.
```

- [ ] **Step 4: Full acceptance walkthrough — Safari**

1. Build and run per the README above; enable the extension in Safari.
2. Open Safari's Web Inspector on the extension's background service worker (Develop menu → your Mac → Extension Background Content), run `self.FlowMouseCompat` — confirm `isSafari: true` and `hasSessions`/`hasSearch`/`hasPageCapture`/`hasDownloads`/`hasTabZoom` are all `false`.
3. Open the options page (from the popup or Safari's extension settings) and walk every category in the action picker: confirm "Restore Tab", "Zoom In/Out", "Reset Zoom", "Save Page as MHTML", "Open Downloads/History/Extensions" are absent from every picker (gesture, wheel, special, chain-step, custom menu), and every other action from `ACTION_CATEGORIES` in `constants.js` is present and assignable.
4. Confirm the default gesture set (customization off) shows `none` for `←↑` and `→←` in the popup's quick-actions list, instead of a dead "Restore Tab".
5. Exercise one working action from each `ACTION_CATEGORIES` group end-to-end on a real page (e.g. Back, a tab-switch gesture, New Window, Copy URL, Search Clipboard with a named engine) — confirm each behaves correctly.
6. Confirm the options, popup, and tutorial pages render correctly (no layout breakage, no console errors) under Safari's WebKit engine.
7. Confirm the feedback section on the options page shows generic feedback copy (not the Chrome-specific "rate us on the Chrome Web Store" text).

- [ ] **Step 5: Full acceptance walkthrough — Chrome/Edge regression**

1. Reload the unpacked extension in Chrome (`chrome://extensions`) one more time with the final code from all 8 tasks.
2. Repeat steps 2–5 above in Chrome: confirm every action (including "Restore Tab", zoom, MHTML save, and the browser-internal-page shortcuts) is present and functional, since all capability flags are `true` there.
3. Load the same unpacked extension in Edge (`edge://extensions`) and spot-check the same picker + a couple of gestures, confirming Edge is unaffected (it already had every capability Chrome has).
