(function (root) {
	function siteToPattern(url) {
		try { return '*' + new URL(url).hostname.toLowerCase() + '*'; } catch { return null; }
	}
	function addSiteToMenuPatterns(menus, menuId, url) {
		const menu = menus && menus[menuId];
		const pattern = siteToPattern(url);
		if (!menu || !pattern) return { menus, added: null };
		const cur = menu.patterns || [];
		if (cur.includes(pattern)) return { menus, added: null };
		const next = { ...menus, [menuId]: { ...menu, patterns: [...cur, pattern] } };
		return { menus: next, added: pattern };
	}
	const api = { siteToPattern, addSiteToMenuPatterns };
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
	root.FlowMouseMenuPatterns = api;
})(typeof self !== 'undefined' ? self : globalThis);
