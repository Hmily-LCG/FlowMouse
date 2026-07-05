(function () {
	'use strict';



	const DEFAULT_GESTURES = {
		'←': 'back',
		'→': 'forward',
		'↑': 'scrollUp',
		'↓': 'scrollDown',
		'↑←': 'switchLeftTab',
		'↑→': 'switchRightTab',
		'→↑': 'newTab',
		'→↓': 'refresh',
		'↓←': 'stopLoading',
		'↓→': 'closeTab',
		'←↑': 'restoreTab',
		'←↓': 'closeAllTabs',
		'↑↓': 'scrollToBottom',
		'↓↑': 'scrollToTop',
		'←→': 'closeTab',
		'→←': 'restoreTab',
	};

	const ACTION_KEYS = {
		'none': 'actionNone',
		'back': 'actionBack',
		'forward': 'actionForward',
		'urlLevelUp': 'actionUrlLevelUp',
		'urlToRoot': 'actionUrlToRoot',
		'scrollUp': 'actionScrollUp',
		'scrollDown': 'actionScrollDown',
		'scrollToTop': 'actionScrollToTop',
		'scrollToBottom': 'actionScrollToBottom',
		'closeTab': 'actionCloseTab',
		'closeWindow': 'actionCloseWindow',
		'closeBrowser': 'actionCloseBrowser',
		'restoreTab': 'actionRestoreTab',
		'newTab': 'actionNewTab',
		'closeOtherTabs': 'actionCloseOtherTabs',
		'closeLeftTabs': 'actionCloseLeftTabs',
		'closeRightTabs': 'actionCloseRightTabs',
		'closeAllTabs': 'actionCloseAllTabs',
		'switchLeftTab': 'actionSwitchLeftTab',
		'switchRightTab': 'actionSwitchRightTab',
		'switchFirstTab': 'actionSwitchFirstTab',
		'switchLastTab': 'actionSwitchLastTab',
		'switchLastActiveTab': 'actionSwitchLastActiveTab',
		'refresh': 'actionRefresh',
		'refreshAllTabs': 'actionRefreshAllTabs',
		'stopLoading': 'actionStopLoading',
		...({
			'stopAllLoading': 'actionStopAllLoading',
		}),
		'newWindow': 'actionNewWindow',
		'newIncognito': 'actionNewIncognito',
		'addToBookmarks': 'actionAddToBookmarks',
		'toggleFullscreen': 'actionToggleFullscreen',
		'toggleMaximize': 'actionToggleMaximize',
		'minimize': 'actionMinimize',
		'openCustomUrl': 'actionOpenCustomUrl',
		'copyUrl': 'actionCopyUrl',
		'copyTitle': 'actionCopyTitle',
		'copyTitleAndUrl': 'actionCopyTitleAndUrl',
		...({
			'openDownloads': 'actionOpenDownloads',
			'openHistory': 'actionOpenHistory',
			'openExtensions': 'actionOpenExtensions',
			'saveAsMhtml': 'actionSaveAsMhtml',
		}),
		'printPage': 'actionPrintPage',
		'duplicateTab': 'actionDuplicateTab',
		'toggleMuteTab': 'actionToggleMuteTab',
		'toggleMuteAllTabs': 'actionToggleMuteAllTabs',
		'togglePinTab': 'actionTogglePinTab',
		'moveTabToNewWindow': 'actionMoveTabToNewWindow',
		'actionChain': 'actionActionChain',
		'customMenu': 'actionCustomMenu',
		'addSiteToMenu': 'actionAddSiteToMenu',
		'delay': 'actionDelay',
		'sendCustomEvent': 'actionSendCustomEvent',
		'sendExtensionMessage': 'actionSendExtensionMessage',
		'simulateKey': 'actionSimulateKey',
		'pasteClipboard': 'actionPasteClipboard',
		'pasteContent': 'actionPasteContent',
		'zoomIn': 'actionZoomIn',
		'zoomOut': 'actionZoomOut',
		'resetZoom': 'actionResetZoom',
		'searchClipboard': 'actionSearchClipboard',
		'searchLink': 'actionSearchLink',
		'viewPageSource': 'actionViewPageSource',
		'pauseGesture': 'actionPauseGesture',
		'areaSelect': 'actionAreaSelect',
		'menuShowTabs': 'actionMenuShowTabs',
		'menuRecentlyClosed': 'actionMenuRecentlyClosed',
		...({
			'menuShowBookmarks': 'actionMenuShowBookmarks',
		}),
	};

	const ACTION_DEFAULTS = {
		closeTab: { keepWindow: false, afterClose: 'default', skipPinned: false },
		closeOtherTabs: { skipPinned: true, preserveTab: false },
		closeLeftTabs: { skipPinned: true, preserveTab: false },
		closeRightTabs: { skipPinned: true, preserveTab: false },
		closeAllTabs: { skipPinned: true },
		refresh: { hardReload: false },
		refreshAllTabs: { hardReload: false },
		newWindow: { focused: true },
		newTab: { position: 'last', active: true },
		openCustomUrl: { customUrl: '', position: 'last', active: true, incognito: false },
		addToBookmarks: { folderId: '' },
		copyTitleAndUrl: { asMarkdown: false },
		scrollUp: { scrollDistance: 75, scrollSmoothness: 'auto', scrollAccel: 1, scrollAccelWindow: 500 },
		scrollDown: { scrollDistance: 75, scrollSmoothness: 'auto', scrollAccel: 1, scrollAccelWindow: 500 },
		scrollToTop: { scrollSmoothness: 'none' },
		scrollToBottom: { scrollSmoothness: 'none' },
		switchLeftTab: { noWrap: false, moveTab: false },
		switchRightTab: { noWrap: false, moveTab: false },
		switchFirstTab: { moveTab: false },
		switchLastTab: { moveTab: false },
		actionChain: { chainId: '' },
		customMenu: { menuId: '', contextual: false },
		addSiteToMenu: { menuId: '' },
		delay: { delayMs: 500 },
		sendCustomEvent: { eventType: 'flowmouse:gesture', eventDetail: '{}', gestureInfo: true },
		sendExtensionMessage: { extensionId: '', message: '{}' },
		simulateKey: { keyValue: 'ArrowLeft', modCtrl: false, modShift: false, modAlt: false, modMeta: false },
		pasteClipboard: {},
		pasteContent: { content: '' },
		searchClipboard: { engine: 'system', url: '', autoDetectUrl: true, position: 'right', active: true, incognito: false },
		searchLink: { engineId: '', name: '', url: '', plus: false, slug: false, suffix: '', clipboardMode: false, transformEnabled: false, transformCode: '', transformClipboard: false, transformRawResult: false, exception: {}, position: 'right', active: true, incognito: false },
		zoomIn: { zoomMode: 'browser', zoomDelta: 10 },
		zoomOut: { zoomMode: 'browser', zoomDelta: 10 },
		resetZoom: { resetZoomLevel: 0 },
		viewPageSource: { position: 'right', active: true },
		menuShowTabs: { sortOrder: 'default', maxItems: 0, scrollToBottom: false, timeDisplay: 'lastAccess' },
		menuRecentlyClosed: { maxItems: 12, sortOrder: 'default', scrollToBottom: false, timeDisplay: 'closedTime' },
		menuShowBookmarks: { folderId: '1', position: 'right', active: true, incognito: false, sortOrder: 'default', maxItems: 30, scrollToBottom: false, timeDisplay: 'dateAdded' },
	};

	const LOCAL_ACTIONS = new Set([
		'none', 'scrollUp', 'scrollDown', 'scrollToTop', 'scrollToBottom',
		'stopLoading', 'copyUrl', 'copyTitle', 'copyTitleAndUrl', 'printPage', 'sendCustomEvent', 'simulateKey',
		'pasteClipboard', 'pasteContent', 'searchClipboard', 'searchLink',
		'menuShowTabs', 'menuRecentlyClosed', 'menuShowBookmarks',
		'customMenu',
	]);


	const ACTION_SHORT_KEYS = {
		'back': 'popupBack',
		'forward': 'popupForward',
		'scrollUp': 'popupScrollUp',
		'scrollDown': 'popupScrollDown',
		'closeTab': 'popupClose',
		'restoreTab': 'popupRestore',
		'switchLeftTab': 'popupSwitchLeftTab',
		'switchRightTab': 'popupSwitchRightTab',
	};

	const TEXT_DRAG_ACTIONS = {
		'none': 'dragActionNone',
		'search': 'dragActionSearch',
		'copy': 'dragActionCopy',
		'sendCustomEvent': 'dragActionSendCustomEvent',
	};

	const LINK_DRAG_ACTIONS = {
		'none': 'dragActionNone',
		'openTab': 'dragActionOpenTabLink',
		'copyLink': 'dragActionCopyLink',
		'copyLinkText': 'dragActionCopyLinkText',
		'copyLinkAndText': 'dragActionCopyLinkAndText',
		'sendCustomEvent': 'dragActionSendCustomEvent',
	};

	const IMAGE_DRAG_ACTIONS = {
		'none': 'dragActionNone',
		'openTab': 'dragActionOpenTabImage',
		'saveImage': 'dragActionSaveImage',
		'copyImageUrl': 'dragActionCopyImageUrl',
		'imageSearch': 'dragActionImageSearch',
		'sendCustomEvent': 'dragActionSendCustomEvent',
	};

	const DRAG_ACTION_DEFAULTS = {
		search:          { engine: 'system', url: '', autoDetectUrl: true, position: 'right', active: true, incognito: false },
		openTab:         { position: 'right', active: true, incognito: false, preferLink: false },
		imageSearch:     { engine: 'google-lens', url: '', position: 'right', active: true, incognito: false },
		copyLinkAndText: { asMarkdown: false },
		sendCustomEvent: { eventType: 'flowmouse:drag', eventDetail: '{}', gestureInfo: true },
	};

	const TAB_POSITIONS = {
		'right': 'tabPositionRight',
		'left': 'tabPositionLeft',
		'first': 'tabPositionFirst',
		'last': 'tabPositionLast',
		'current': 'tabPositionCurrent',
		'newWindow': 'tabPositionNewWindow',
	};


	const DEFAULT_SETTINGS = {
		theme: 'auto',
		language: 'auto',
		enableGesture: true,
		gestureTriggerButtons: { right: true, middle: false, side1: false, side2: false, penRight: false },
		enableHUD: true,
		enableSuggestedGestures: true,
		enableTrail: true,
		showTrailOrigin: true,
		enableTrailSmooth: true,
		enableGestureCustomization: false,
		mouseGestures: Object.fromEntries(
			Object.entries(DEFAULT_GESTURES).map(([p, a]) => [p, { action: a }])
		),
		sectionAdvanced: {},
		enableTextDrag: true,
		textDragIgnoreInput: false,
		textDropIgnoreInput: false,
		enableImageDrag: true,
		enableLinkDrag: true,
		linkDropIgnoreInput: false,
		textDragGestures: [
			{ direction: '→', action: 'search' }
		],
		linkDragGestures: [
			{ direction: '→', action: 'openTab' }
		],
		imageDragGestures: [
			{ direction: '→', action: 'openTab' }
		],
		hudBgColor: '#000000b3',
		hudTextColor: '#ffffff',
		hudBlurRadius: 5,
		enableHudShadow: false,
		trailColor: '#4285f4',
		trailWidth: 5,
		customCss: '',
		distanceThreshold: 20,
		gestureTurnTolerance: 0.10,
		showRestrictedNotice: true,
		macLinuxHintDismissed: false,
		edgeGestureConflict: false,
		enableWheelGestures: false,
		wheelGestures: {
			scrollUpHoldingRight: { action: 'switchLeftTab' },
			scrollDownHoldingRight: { action: 'switchRightTab' },
			wheelClickHoldingRight: { action: 'toggleFullscreen' },
		},
		enableSpecialGestures: false,
		specialGestures: {
			leftClickHoldingRight: { action: 'back' },
			rightClickHoldingLeft: { action: 'forward' },
		},
		areaSelectModifierKey: 'Shift',
		areaSelectTextUrl: false,
		areaSelectWarnThreshold: 15,
		areaSelectDelay: 0.3,
		actionChains: {},
		customMenus: {},
		searchEngines: { overrides: {}, hidden: [], custom: [], order: [] },
		blacklist: [],
		enableBlacklistContextMenu: false,
		navCollapsed: false,
		engineManagerLocalOnly: true,
		lastSyncTime: null,
	};

	const ARROW_SVG = {
		'↑': '<svg xmlns="http://www.w3.org/2000/svg" width="0.85em" height="0.85em" fill="currentColor" viewBox="5 3.5 6 9" style="vertical-align:-0.125em; margin:0.05em; display:inline"><path fill-rule="evenodd" d="M 8 12 a 0.5 0.5 0 0 0 0.5 -0.5 V 5.707 L 10.646 7.854 a 0.5 0.5 0 0 0 0.708 -0.708 l -3 -3 a 0.5 0.5 0 0 0 -0.708 0 l -3 3 a 0.5 0.5 0 0 0 0.708 0.708 L 7.5 5.707 V 11.5 A 0.5 0.5 0 0 0 8 12"/></svg>',
		'↓': '<svg xmlns="http://www.w3.org/2000/svg" width="0.85em" height="0.85em" fill="currentColor" viewBox="5 3.5 6 9" style="vertical-align:-0.125em; margin:0.05em; display:inline"><path fill-rule="evenodd" d="M 8 4 a 0.5 0.5 0 0 1 0.5 0.5 v 5.793 L 10.646 8.146 a 0.5 0.5 0 0 1 0.708 0.708 l -3 3 a 0.5 0.5 0 0 1 -0.708 0 l -3 -3 a 0.5 0.5 0 0 1 0.708 -0.708 L 7.5 10.293 V 4.5 A 0.5 0.5 0 0 1 8 4"/></svg>',
		'←': '<svg xmlns="http://www.w3.org/2000/svg" width="0.85em" height="0.85em" fill="currentColor" viewBox="3.5 5 9 6" style="vertical-align:-0.125em; margin:0.05em; display:inline"><path fill-rule="evenodd" d="M 12 8 a 0.5 0.5 0 0 0 -0.5 -0.5 H 5.707 L 7.854 5.354 a 0.5 0.5 0 1 0 -0.708 -0.708 l -3 3 a 0.5 0.5 0 0 0 0 0.708 l 3 3 a 0.5 0.5 0 0 0 0.708 -0.708 L 5.707 8.5 H 11.5 A 0.5 0.5 0 0 0 12 8"/></svg>',
		'→': '<svg xmlns="http://www.w3.org/2000/svg" width="0.85em" height="0.85em" fill="currentColor" viewBox="3.5 5 9 6" style="vertical-align:-0.125em; margin:0.05em; display:inline"><path fill-rule="evenodd" d="M 4 8 a 0.5 0.5 0 0 1 0.5 -0.5 h 5.793 L 8.146 5.354 a 0.5 0.5 0 1 1 0.708 -0.708 l 3 3 a 0.5 0.5 0 0 1 0 0.708 l -3 3 a 0.5 0.5 0 0 1 -0.708 -0.708 L 10.293 8.5 H 4.5 A 0.5 0.5 0 0 1 4 8"/></svg>',
	};

	const CORNER_SVG = {
		'↓→': '<svg xmlns="http://www.w3.org/2000/svg" width="1.0em" height="1.0em" viewBox="1 1 23 23" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em; margin:0 0.05em; display:inline"><path d="M4 3v8a4 4 0 0 0 4 4h12"/><path d="m15 10 5 5-5 5"/></svg>',
		'←↑': '<svg xmlns="http://www.w3.org/2000/svg" width="1.0em" height="1.0em" viewBox="1 1 23 23" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em; margin:0 0.05em; display:inline"><path d="M21 20h-8a4 4 0 0 1-4-4V4"/><path d="m4 9 5-5 5 5"/></svg>',
		'→↑': '<svg xmlns="http://www.w3.org/2000/svg" width="1.0em" height="1.0em" viewBox="1 1 23 23" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em; margin:0 0.05em; display:inline"><path d="M3 20h8a4 4 0 0 0 4-4V4"/><path d="m10 9 5-5 5 5"/></svg>',
		'→↓': '<svg xmlns="http://www.w3.org/2000/svg" width="1.0em" height="1.0em" viewBox="1 1 23 23" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em; margin:0 0.05em; display:inline"><path d="M3 4h8a4 4 0 0 1 4 4v12"/><path d="m10 15 5 5 5-5"/></svg>',
		'↑←': '<svg xmlns="http://www.w3.org/2000/svg" width="1.0em" height="1.0em" viewBox="1 1 23 23" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em; margin:0 0.05em; display:inline"><path d="M20 21v-8a4 4 0 0 0-4-4H4"/><path d="m9 4-5 5 5 5"/></svg>',
		'↑→': '<svg xmlns="http://www.w3.org/2000/svg" width="1.0em" height="1.0em" viewBox="1 1 23 23" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em; margin:0 0.05em; display:inline"><path d="M4 21v-8a4 4 0 0 1 4-4h12"/><path d="m15 4 5 5-5 5"/></svg>',
		'↓←': '<svg xmlns="http://www.w3.org/2000/svg" width="1.0em" height="1.0em" viewBox="1 1 23 23" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em; margin:0 0.05em; display:inline"><path d="M20 3v8a4 4 0 0 1-4 4H4"/><path d="m9 10-5 5 5 5"/></svg>',
		'←↓': '<svg xmlns="http://www.w3.org/2000/svg" width="1.0em" height="1.0em" viewBox="1 1 23 23" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em; margin:0 0.05em; display:inline"><path d="M21 4h-8a4 4 0 0 0-4 4v12"/><path d="m14 15-5 5-5-5"/></svg>',
	};

	function arrowsToSvg(text) {
		if (CORNER_SVG[text]) return CORNER_SVG[text];
		return text.replace(/[↑↓←→]/g, match => ARROW_SVG[match] || match);
	}

	window.GestureConstants = {
		DEFAULT_GESTURES,
		ACTION_KEYS,
		LOCAL_ACTIONS,
		ACTION_SHORT_KEYS,
		ACTION_DEFAULTS,

		TEXT_DRAG_ACTIONS,
		LINK_DRAG_ACTIONS,
		IMAGE_DRAG_ACTIONS,
		DRAG_ACTION_DEFAULTS,
		TAB_POSITIONS,

		DEFAULT_SETTINGS,

		arrowsToSvg,
	};

	window.litDisableBundleWarning = true;
})();