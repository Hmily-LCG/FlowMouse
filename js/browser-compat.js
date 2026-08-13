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
