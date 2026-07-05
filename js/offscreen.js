/**
 * offscreen.js — relay between the service worker and the sandboxed transform iframe.
 *
 * Flow:
 *   SW → chrome.runtime.onMessage { target:'offscreen', type:'fm-transform', id, code, selection, clipboard }
 *        → postMessage to sandbox iframe
 *        ← window message { type:'fm-transform-result', id, ok, result|error }
 *        → sendResponse({ ok, result|error }) back to SW
 *
 * The offscreen document is a normal (non-sandboxed) extension page, so it can
 * use chrome.runtime APIs freely.  The sandbox iframe has a null origin, so we
 * always postMessage with targetOrigin '*' when sending to it.
 */

'use strict';

/** @type {Map<string, {resolve: function, timer: number}>} */
const pending = new Map();

const TIMEOUT_MS = 1300;

/** The sandboxed iframe element. */
const iframe = document.getElementById('sandbox');

// ---------------------------------------------------------------------------
// 1. Listen for results coming back from the sandbox iframe.
// ---------------------------------------------------------------------------
window.addEventListener('message', function (event) {
	// Security: only accept messages from the sandbox iframe's window.
	if (event.source !== iframe.contentWindow) {
		return;
	}

	const msg = event.data;
	if (!msg || msg.type !== 'fm-transform-result') {
		return;
	}

	const { id, ok, result, error } = msg;
	const entry = pending.get(id);
	if (!entry) {
		// Already timed out or duplicate — ignore.
		return;
	}

	clearTimeout(entry.timer);
	pending.delete(id);

	if (ok) {
		entry.resolve({ ok: true, result });
	} else {
		entry.resolve({ ok: false, error: error || 'transform-error' });
	}
});

// ---------------------------------------------------------------------------
// 2. Listen for requests from the service worker.
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
	if (!message || message.target !== 'offscreen' || message.type !== 'fm-transform') {
		// Not for us — let other listeners handle it.
		return false;
	}

	const { id, code, selection, clipboard } = message;

	// If the SW did not provide an id, we cannot correlate the reply — reject immediately.
	if (!id) {
		sendResponse({ ok: false, error: 'missing-id' });
		return false;
	}

	// Guard timeout: if the iframe does not reply in time, fail gracefully.
	const timer = setTimeout(function () {
		if (pending.has(id)) {
			pending.delete(id);
			sendResponse({ ok: false, error: 'timeout' });
		}
	}, TIMEOUT_MS);

	// Store the pending entry before postMessage so the reply handler can
	// find it even if the iframe is synchronously ready.
	pending.set(id, {
		resolve: sendResponse,
		timer: timer,
	});

	// Forward the transform request to the sandbox iframe.
	iframe.contentWindow.postMessage(
		{ type: 'fm-transform', id, code, selection, clipboard },
		'*'
	);

	// Return true to keep the sendResponse channel open for the async reply.
	return true;
});
