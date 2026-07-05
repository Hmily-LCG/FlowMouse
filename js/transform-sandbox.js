// transform-sandbox.js
// Runs inside the sandboxed page (pages/transform-sandbox.html).
// Receives { type:'fm-transform', id, code, selection, clipboard } from the
// offscreen host via postMessage, executes the user code with a hard ~1000 ms
// timeout, and replies { type:'fm-transform-result', id, ok, result?|error? }.
//
// PRIMARY: spawns a terminable Web Worker from a Blob URL.
//   The worker body inlines the safe runner pattern (new Function with args)
//   so it needs no importScripts from an extension URL.
// FALLBACK: if Worker construction itself throws (e.g. blob: blocked by CSP),
//   falls back to calling self.FlowMouseTransformRunner.runTransformSync()
//   directly (no hard interrupt; a runaway loop would hang this iframe —
//   the offscreen host is expected to recreate the sandbox in that case).

(function () {
	'use strict';

	// Inline worker source — self-contained, no importScripts needed.
	// Uses the same safe pattern as transform-runner.js:
	//   new Function('selection', 'clipboard', code) called with string args.
	var WORKER_SRC = [
		'self.onmessage = function(e) {',
		'	var d = e.data;',
		'	var result;',
		'	try {',
		'		var fn = new Function("selection", "clipboard", String(d.code == null ? "" : d.code));',
		'		var out = fn(',
		'			String(d.selection == null ? "" : d.selection),',
		'			String(d.clipboard == null ? "" : d.clipboard)',
		'		);',
		'		result = { id: d.id, ok: true, result: String(out == null ? "" : out) };',
		'	} catch (err) {',
		'		result = { id: d.id, ok: false, error: String((err && err.message) || err || "error") };',
		'	}',
		'	self.postMessage(result);',
		'};'
	].join('\n');

	var TIMEOUT_MS = 1000;

	function replyTo(source, origin, payload) {
		// Sandbox pages have a null origin; use '*' as the target —
		// the offscreen host validates by matching the id field.
		var targetOrigin = (origin === 'null' || !origin) ? '*' : origin;
		source.postMessage(payload, targetOrigin);
	}

	function runWithWorker(msg, source, origin) {
		var blob = new Blob([WORKER_SRC], { type: 'text/javascript' });
		var blobUrl = URL.createObjectURL(blob);
		var worker = new Worker(blobUrl);

		var settled = false;

		var timer = setTimeout(function () {
			if (settled) return;
			settled = true;
			worker.terminate();
			URL.revokeObjectURL(blobUrl);
			replyTo(source, origin, {
				type: 'fm-transform-result',
				id: msg.id,
				ok: false,
				error: 'timeout'
			});
		}, TIMEOUT_MS);

		worker.onmessage = function (e) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			worker.terminate();
			URL.revokeObjectURL(blobUrl);
			var d = e.data || {};
			replyTo(source, origin, {
				type: 'fm-transform-result',
				id: msg.id,
				ok: !!d.ok,
				result: d.ok ? d.result : undefined,
				error: d.ok ? undefined : d.error
			});
		};

		worker.onerror = function (e) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			worker.terminate();
			URL.revokeObjectURL(blobUrl);
			replyTo(source, origin, {
				type: 'fm-transform-result',
				id: msg.id,
				ok: false,
				error: e.message || 'worker error'
			});
		};

		worker.postMessage({
			id: msg.id,
			code: msg.code,
			selection: msg.selection,
			clipboard: msg.clipboard
		});
	}

	function runWithFallback(msg, source, origin) {
		// FALLBACK: no Worker available. Call the runner synchronously.
		// NOTE: a runaway loop (while(true){}) will hang this iframe with no
		// hard interrupt. The offscreen host should recreate the sandbox if it
		// detects a stalled reply.
		var res;
		if (self.FlowMouseTransformRunner && typeof self.FlowMouseTransformRunner.runTransformSync === 'function') {
			res = self.FlowMouseTransformRunner.runTransformSync(msg.code, msg.selection, msg.clipboard);
		} else {
			// Runner not loaded — try inline.
			try {
				var fn = new Function('selection', 'clipboard', String(msg.code == null ? '' : msg.code));
				var out = fn(
					String(msg.selection == null ? '' : msg.selection),
					String(msg.clipboard == null ? '' : msg.clipboard)
				);
				res = { ok: true, result: String(out == null ? '' : out) };
			} catch (err) {
				res = { ok: false, error: String((err && err.message) || err || 'error') };
			}
		}
		replyTo(source, origin, {
			type: 'fm-transform-result',
			id: msg.id,
			ok: !!res.ok,
			result: res.ok ? res.result : undefined,
			error: res.ok ? undefined : res.error
		});
	}

	window.addEventListener('message', function (event) {
		var msg = event.data;
		// Validate message shape.
		if (!msg || msg.type !== 'fm-transform' || msg.id == null) return;
		if (typeof msg.code !== 'string') return;

		var source = event.source;
		if (!source) return; // no reply channel — ignore

		var origin = event.origin;

		// PRIMARY: try a terminable blob Worker.
		var workerAttempted = false;
		try {
			runWithWorker(msg, source, origin);
			workerAttempted = true;
		} catch (e) {
			// Worker construction failed (e.g. blob: CSP restriction).
			// Fall through to the synchronous fallback.
		}

		if (!workerAttempted) {
			runWithFallback(msg, source, origin);
		}
	});
}());
