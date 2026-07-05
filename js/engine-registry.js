(function (root) {
	function mergeOverride(builtin, ov) {
		return ov ? { ...builtin, ...ov } : { ...builtin };
	}
	const LEGACY_IMAGE_ID_MAP = { google: 'google-lens', bing: 'bing-images', yandex: 'yandex-images' };
	function normalizeImageEngineId(id) {
		return (id && Object.prototype.hasOwnProperty.call(LEGACY_IMAGE_ID_MAP, id)) ? LEGACY_IMAGE_ID_MAP[id] : id;
	}
	function toEngine(src, builtin) {
		return {
			id: src.id,
			name: src.name || '',
			url: src.url || '',
			plus: !!src.plus,
			slug: !!src.slug,
			suffix: src.suffix || '',
			clipboardMode: !!src.clipboardMode,
			transformEnabled: !!src.transformEnabled,
			transformCode: src.transformCode || '',
			transformClipboard: !!src.transformClipboard,
			transformRawResult: !!src.transformRawResult,
			rawResult: !!src.rawResult,
			builtin: !!builtin,
			type: src.type === 'image' ? 'image' : 'text',
		};
	}
	function isEngineHidden(entry, hiddenList) {
		const inList = (hiddenList || []).includes(entry.id);
		return entry.defaultHidden ? !inList : inList;
	}
	function resolveEngines(catalog, se, type) {
		const s = se || {};
		const overrides = s.overrides || {};
		const custom = s.custom || [];
		const order = s.order || [];
		const list = [];
		for (const b of (catalog || [])) {
			if (isEngineHidden(b, s.hidden || [])) continue;
			list.push(toEngine(mergeOverride(b, overrides[b.id]), true));
		}
		for (const c of custom) list.push(toEngine(c, false));
		const filtered = type ? list.filter(e => e.type === type) : list;
		const pos = id => { const i = order.indexOf(id); return i === -1 ? Infinity : i; };
		// stable sort: ordered ids first (by order index), the rest keep natural order
		return filtered
			.map((e, i) => [e, i])
			.sort((a, b) => (pos(a[0].id) - pos(b[0].id)) || (a[1] - b[1]))
			.map(p => p[0]);
	}
	function getEngineById(catalog, se, id) {
		const s = se || {};
		const overrides = s.overrides || {};
		const custom = s.custom || [];
		const b = (catalog || []).find(e => e.id === id);
		if (b) return toEngine(mergeOverride(b, overrides[id]), true);
		const c = custom.find(e => e.id === id);
		if (c) return toEngine(c, false);
		return undefined;
	}
	function resolveMenuItemLink(catalog, se, item) {
		if (!item) return null;
		if (item.engineId) {
			const e = getEngineById(catalog, se, item.engineId);
			if (!e) return null;
			const ex = item.exception || {};
			return {
				name: ex.name ?? e.name,
				url: ex.url ?? e.url,
				plus: ex.plus ?? e.plus,
				slug: ex.slug ?? e.slug,
				suffix: ex.suffix ?? e.suffix,
				clipboardMode: ex.clipboardMode ?? e.clipboardMode,
				transformEnabled: ex.transformEnabled ?? e.transformEnabled,
				transformCode: ex.transformCode ?? e.transformCode,
				transformClipboard: ex.transformClipboard ?? e.transformClipboard,
				transformRawResult: ex.transformRawResult ?? e.transformRawResult,
				rawResult: ex.rawResult ?? e.rawResult,
				engine: 'custom',
			};
		}
		if (item.url) {
			return {
				name: item.name || item.url,
				url: item.url,
				plus: !!item.plus,
				slug: !!item.slug,
				suffix: item.suffix || '',
				clipboardMode: !!item.clipboardMode,
				transformEnabled: !!item.transformEnabled,
				transformCode: item.transformCode || '',
				transformClipboard: !!item.transformClipboard,
				transformRawResult: !!item.transformRawResult,
				rawResult: !!item.rawResult,
				engine: 'custom',
			};
		}
		return null;
	}
	function isClipboardLink(link) { return !!link && !!link.clipboardMode; }

	const api = { resolveEngines, getEngineById, resolveMenuItemLink, isClipboardLink, isEngineHidden, normalizeImageEngineId, LEGACY_IMAGE_ID_MAP };
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
	root.FlowMouseEngineRegistry = api;
})(typeof self !== 'undefined' ? self : globalThis);
