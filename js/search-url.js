(function (root) {
	function looksLikeUrl(t) {
		if (!t) return false;
		const s = t.trim();
		if (/^https?:\/\/\S+$/i.test(s)) return true;
		return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s) && !/\s/.test(s);
	}
	function normalizeUrl(t) {
		const s = t.trim();
		return /^https?:\/\//i.test(s) ? s : "https://" + s;
	}
	function buildSearchUrl(config, text, SEARCH_ENGINES) {
		const engine = config.engine || "system";
		if (config.autoDetectUrl && looksLikeUrl(text)) return normalizeUrl(text);
		if (engine === "system") return null;
		const suffix = config.suffix || "";
		if (config.rawTerm) {
			const term = String(text == null ? '' : text);
			if (engine === "custom") {
				if (config.url && config.url.includes("%s")) return config.url.replace(/%s/g, term) + suffix;
				return (config.url || "") + term + suffix;
			}
			const e = SEARCH_ENGINES && SEARCH_ENGINES[engine] ? SEARCH_ENGINES[engine] : (SEARCH_ENGINES || {}).google;
			return (e ? e.url : "https://www.google.com/search?q=") + term + suffix;
		}
		// slug: term as hyphen path (no %s).
		if (config.slug) {
			const slug = encodeURIComponent(text.replace(/[^\p{L}\p{N}]/gu, "-"));
			const base = (engine === "custom") ? (config.url || "") : ((SEARCH_ENGINES && SEARCH_ENGINES[engine] ? SEARCH_ENGINES[engine] : (SEARCH_ENGINES || {}).google || { url: "https://www.google.com/search?q=" }).url);
			return base + slug + suffix;
		}
		let term = encodeURIComponent(text);
		if (config.plus) term = term.replace(/%20/g, "+");
		if (engine === "custom") {
			if (config.url && config.url.includes("%s")) {
				return config.url.replace(/%s/g, term) + suffix;   // legacy %s substitution
			}
			return (config.url || "") + term + suffix;              // prefix form (standalone parity)
		}
		const e = SEARCH_ENGINES && SEARCH_ENGINES[engine] ? SEARCH_ENGINES[engine] : (SEARCH_ENGINES || {}).google;
		return (e ? e.url : "https://www.google.com/search?q=") + term + suffix;
	}
	function patternToRegExp(pattern) {
		const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, m => m === '*' ? ' ' : '\\' + m);
		const body = escaped.replace(/ /g, '.*'); // '*' -> '.*', everything else literal
		return new RegExp(body, 'i');
	}
	function matchesPatterns(url, patterns) {
		if (!patterns || patterns.length === 0) return true;
		return patterns.some(p => { try { return patternToRegExp(p).test(url); } catch { return false; } });
	}
	function resolveSearchConfig(catalog, se, config) {
		const engine = config.engine || 'system';
		if (engine === 'system' || engine === 'custom') return { ...config };
		const reg = (typeof self !== 'undefined' ? self : globalThis).FlowMouseEngineRegistry;
		const eng = reg ? reg.getEngineById(catalog, se, engine) : null;
		if (!eng) return { ...config, engine: 'system' };
		const out = { ...config, engine: 'custom', url: eng.url, plus: eng.plus, slug: eng.slug, suffix: eng.suffix };
		if (eng.rawResult) out.rawTerm = true;
		return out;
	}
	const api = { buildSearchUrl, resolveSearchConfig, looksLikeUrl, normalizeUrl, matchesPatterns, patternToRegExp };
	if (typeof module !== "undefined" && module.exports) module.exports = api;
	root.FlowMouseSearchUrl = api;
})(typeof self !== "undefined" ? self : globalThis);
