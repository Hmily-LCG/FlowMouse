(function () {
	'use strict';

	function detectIsSafari() {
		const ua = navigator.userAgent;
		if (!/Safari/.test(ua)) return false;
		return !/Chrome|Chromium|Edg\/|EdgA\/|OPR\/|CriOS/.test(ua);
	}

	const isSafari = detectIsSafari();

	const hasSessions = !!(chrome.sessions && chrome.sessions.restore);
	const hasSearch = !!(chrome.search && chrome.search.query);
	const hasPageCapture = !!(chrome.pageCapture && chrome.pageCapture.saveAsMHTML);
	const hasDownloads = !!(chrome.downloads && chrome.downloads.download);
	const hasTabZoom = !!(chrome.tabs && chrome.tabs.setZoom);
	const hasBookmarks = !!(chrome.bookmarks && chrome.bookmarks.create);
	const hasContextMenus = !!(chrome.contextMenus && chrome.contextMenus.create);
	const hasIncognitoQuery = !!(chrome.extension && chrome.extension.isAllowedIncognitoAccess);
	const hasFileSchemeQuery = !!(chrome.extension && chrome.extension.isAllowedFileSchemeAccess);

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
