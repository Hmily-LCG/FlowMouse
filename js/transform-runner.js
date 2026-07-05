(function (root) {
	function runTransformSync(code, selection, clipboard) {
		try {
			// SECURITY: selection/clipboard are ARGUMENTS, never interpolated into `code`.
			const fn = new Function('selection', 'clipboard', String(code == null ? '' : code));
			const out = fn(String(selection == null ? '' : selection), String(clipboard == null ? '' : clipboard));
			return { ok: true, result: String(out == null ? '' : out) };
		} catch (err) {
			return { ok: false, error: String((err && err.message) || err || 'error') };
		}
	}
	const api = { runTransformSync };
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
	root.FlowMouseTransformRunner = api;
})(typeof self !== 'undefined' ? self : globalThis);
