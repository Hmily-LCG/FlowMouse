# Safari Support — Design

**Date:** 2026-08-11
**Status:** Approved by user, pending implementation plan

## Goal

Add Safari (macOS only) as a supported browser for FlowMouse, alongside the existing Chrome/Edge build and the externally-built Firefox variant. Ship with graceful degradation: features with no Safari API equivalent are hidden or no-op cleanly rather than crashing or being silently broken.

## Non-goals

- iOS/iPadOS Safari (touch-based gesture UX is a different problem; out of scope for this round).
- Reimplementing unsupported Chrome APIs with polyfills (e.g. faking `chrome.downloads` via `<a download>`). Rejected in favor of graceful degradation — hide what can't work, keep everything else.
- Automated test suite. This repo currently has none; verification stays manual via Xcode + Safari's Extension settings.
- Distributing/notarizing/submitting the Safari build to the App Store. That's the user's own follow-up once the source and Xcode project are in place.

## Target platform

Safari 16.4+ / macOS 13.3+. This is the version where Apple added MV3 service-worker background scripts and `chrome.storage.session` — both of which FlowMouse's `background.js` already depends on for Chrome/Edge, so it's not an extra constraint, just a floor that falls out of code already written.

## Architecture

### 1. Capability-detection layer — new `js/browser-compat.js`

Computed once at load, exposed as `window.FlowMouseCompat` in page/content-script contexts and via `self.FlowMouseCompat` in the background service worker (loaded there via `importScripts()`):

- `isSafari` — UA sniff: contains `Safari` and none of `Chrome`, `Chromium`, `Edg`, `OPR`, `CriOS`.
- Feature flags derived from `isSafari`, not from `chrome.X` existence checks. Existence checks were the first design, but this module loads in the content-script context too (it's in `manifest.json`'s `content_scripts`), and Chrome/Edge restrict content scripts to a small API subset — `chrome.sessions`, `chrome.tabs`, `chrome.downloads`, `chrome.search`, `chrome.pageCapture`, `chrome.contextMenus` are all `undefined` there regardless of browser or actual support. An existence check would misreport "unsupported" in that context even on Chrome. Deriving from `isSafari` instead keeps the flags consistent across every context the extension runs in (content script, background service worker, extension pages):
  - `hasSessions`, `hasSearch`, `hasPageCapture`, `hasDownloads`, `hasTabZoom`, `hasIncognitoQuery`, `hasFileSchemeQuery` — all `!isSafari`
  - `hasBookmarks`, `hasContextMenus` — always `true` (supported on Safari 14+, the floor this plan already targets)

Loaded in three places since the project has no bundler:
- Prepended to the `content_scripts.js` array in `manifest.json`, before `constants.js`.
- `importScripts('browser-compat.js')` at the top of `background.js`.
- A `<script src="../js/browser-compat.js">` tag added before other script tags in every page under `pages/*.html`.

### 2. `background.js` — gate handlers that call unsupported APIs

Each case checks its capability flag first, returning `{ success: false, unsupported: true }` instead of letting an `undefined`-property `TypeError` fall into the generic `asyncMessageHandler` catch:

| Action(s) | Guard |
|---|---|
| `restoreTab`, `restoreSession`, `getRecentlyClosedTabs` | `hasSessions` |
| `systemSearch`; `chrome.search.query` calls inside `openIncognitoTabs` | `hasSearch` |
| `saveImage` (non-`data:` branch), `saveAsMhtml` | `hasPageCapture` |
| `saveImage` (all branches) | `hasDownloads` |
| `zoomIn`, `zoomOut`, `resetZoom` | `hasTabZoom` |
| incognito permission pre-check in `openTabAtPosition`/`openIncognitoTabs`/`systemSearch`/`openCustomUrl` | when `!hasIncognitoQuery`, skip the check and attempt the action directly — Safari has no runtime query for this, but `sender.tab.incognito` should still reflect reality |
| `fileSchemeAllowed` init (module load) | guarded; defaults to `false` if `hasFileSchemeQuery` is false |
| `openDownloads`, `openHistory`, `openExtensions` | gated on `isSafari` directly (not a capability flag) — these navigate to `chrome://downloads` etc., which Safari has no equivalent page for at all |

### 3. UI — hide only what can't work, at the narrowest scope that's true

`action-select.js` has a single array, `ACTION_CATEGORIES`, that drives every action picker (gesture assignment, wheel gestures, special gestures, action chains, custom menus). Filtering that one array's `actions` lists through the capability flags before rendering covers all pickers in one change.

Actions hidden on Safari (via `ACTION_CATEGORIES` filtering):
- `restoreTab` (needs `hasSessions`)
- `menuRecentlyClosed` (needs `hasSessions`)
- `saveAsMhtml` (needs `hasPageCapture`)
- `zoomIn`, `zoomOut`, `resetZoom` (need `hasTabZoom`)
- `openDownloads`, `openHistory`, `openExtensions` (need `isSafari` to be false)

**Not** hidden wholesale — handled at a narrower scope:
- `searchClipboard` and the text/image-drag "search" actions stay available. Only their `engine: 'system'` ("Browser Default") option depends on `chrome.search`; every named engine (Google, Bing, DuckDuckGo, …) works via a plain URL template and needs nothing extra. `SEARCH_ENGINE_ORDER` gets the `system` entry filtered out per-list when `!hasSearch`, leaving the rest of the engine picker intact.
- `saveImage` inside `IMAGE_DRAG_ACTIONS` needs `hasDownloads` unconditionally (even `data:` URLs go through `chrome.downloads.download`) — hidden from that action list when absent.

Other UI-side changes:
- `DEFAULT_SETTINGS.mouseGestures`, when computed on Safari, remaps the two default bindings that use `restoreTab` (`←↑`, `→←`) to `none` instead, so a fresh install doesn't ship two dead gestures out of the box.
- `options-page.js`'s feedback-copy condition (`!isFirefox && !isEdge ? 'feedbackTextChrome' : 'feedbackText'`) needs `&& !isSafari` added — otherwise Safari installs get told to leave a Chrome Web Store review.

### 4. Manifest & Safari packaging

One shared `manifest.json` continues to serve Chrome, Edge, and Safari (per the "runtime detection, no build-time flip" decision). The Safari converter tolerates permission keys it doesn't recognize or can't grant (`sessions`, `search`, `downloads`, `pageCapture`) — they're simply requested-but-unfulfilled, which is exactly what the capability-detection layer above already checks for at runtime, so no manifest split is needed for that reason.

Packaging:
- Run `xcrun safari-web-extension-converter` against the repo root, macOS-only target, project name `FlowMouse`.
- Output committed into this repo under `safari/` (an Xcode project + its generated Swift/App wrapper).
- `safari/README.md` documents the exact regenerate command and flags, since re-running the converter overwrites hand-edits to the generated project — anyone touching Xcode-side config later needs to know what's safe to hand-edit vs. what gets clobbered.

### 5. Testing

No automated suite exists in this repo. Verification is manual:
1. Build via Xcode, enable the extension in Safari → Settings → Extensions.
2. Walk every action picker (gestures, wheel, special, chains, custom menus, drag actions) confirming gated actions are absent and everything else is present and correctly labeled.
3. Exercise a representative gesture from each `ACTION_CATEGORIES` group end-to-end in Safari.
4. Sanity-check `options.html`/`popup.html`/`tutorial.html` rendering under WebKit (Lit-based UI, not gesture-specific, but WebKit CSS/JS quirks are a known source of subtle breakage).
5. Confirm the Chrome/Edge build still passes the same manual gesture walkthrough (regression check — capability flags must evaluate `true` there, not accidentally hide anything).

## Open questions for implementation time

None blocking — the plan below is ready to execute. Anything found to be wrong during implementation (e.g. `chrome.bookmarks` behaving differently than expected in Safari, an API flag misfiring) gets corrected in the code directly; this doc reflects the intended design, not a contract that can't flex against real Safari behavior once tested.
