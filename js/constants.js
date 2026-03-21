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
		'refresh': 'actionRefresh',
		'refreshAllTabs': 'actionRefreshAllTabs',
		'stopLoading': 'actionStopLoading',
		'newWindow': 'actionNewWindow',
		'newIncognito': 'actionNewIncognito',
		'addToBookmarks': 'actionAddToBookmarks',
		'toggleFullscreen': 'actionToggleFullscreen',
		'toggleMaximize': 'actionToggleMaximize',
		'minimize': 'actionMinimize',
		'openCustomUrl': 'actionOpenCustomUrl',
		'copyUrl': 'actionCopyUrl',
		'copyTitle': 'actionCopyTitle',
		...({}),
		'printPage': 'actionPrintPage',
		'duplicateTab': 'actionDuplicateTab',
		'toggleMuteTab': 'actionToggleMuteTab',
		'toggleMuteAllTabs': 'actionToggleMuteAllTabs',
		'togglePinTab': 'actionTogglePinTab',
		'actionChain': 'actionActionChain',
		'delay': 'actionDelay',
		'sendCustomEvent': 'actionSendCustomEvent',
		'simulateKey': 'actionSimulateKey',
	};

	const ACTION_DEFAULTS = {
		closeTab: { keepWindow: false, afterClose: 'default', skipPinned: false }, 
		closeOtherTabs: { skipPinned: true },
		closeLeftTabs: { skipPinned: true },
		closeRightTabs: { skipPinned: true },
		closeAllTabs: { skipPinned: true },
		refresh: { hardReload: false },
		refreshAllTabs: { hardReload: false },
		newTab: { position: 'last' },
		openCustomUrl: { customUrl: '', position: 'last' },
		copyUrl: { includeTitle: false },
		scrollUp: { scrollDistance: 75, scrollSmoothness: 'auto', scrollAccel: 1, scrollAccelWindow: 500 },
		scrollDown: { scrollDistance: 75, scrollSmoothness: 'auto', scrollAccel: 1, scrollAccelWindow: 500 },
		scrollToTop: { scrollSmoothness: 'none' },
		scrollToBottom: { scrollSmoothness: 'none' },
		switchLeftTab: { noWrap: false, moveTab: false },
		switchRightTab: { noWrap: false, moveTab: false },
		switchFirstTab: { moveTab: false },
		switchLastTab: { moveTab: false },
		actionChain: { chainId: '' },
		delay: { delayMs: 500 },
		sendCustomEvent: { eventType: 'flowmouse:gesture', eventDetail: '{}' },
		simulateKey: { keyValue: 'ArrowLeft', modCtrl: false, modShift: false, modAlt: false, modMeta: false },
	};

	const LOCAL_ACTIONS = new Set([
		'none', 'scrollUp', 'scrollDown', 'scrollToTop', 'scrollToBottom',
		'stopLoading', 'copyUrl', 'copyTitle', 'printPage', 'sendCustomEvent', 'simulateKey'
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
		'copy': 'dragActionCopy'
	};

	const LINK_DRAG_ACTIONS = {
		'none': 'dragActionNone',
		'openTab': 'dragActionOpenTabLink',
		'copyLink': 'dragActionCopyLink',
		'copyLinkText': 'dragActionCopyLinkText'
	};

	const IMAGE_DRAG_ACTIONS = {
		'none': 'dragActionNone',
		'openTab': 'dragActionOpenTabImage',
		'saveImage': 'dragActionSaveImage',
		'copyImageUrl': 'dragActionCopyImageUrl',
		'imageSearch': 'dragActionImageSearch'
	};

	const TAB_POSITIONS = {
		'right': 'tabPositionRight',
		'left': 'tabPositionLeft',
		'first': 'tabPositionFirst',
		'last': 'tabPositionLast',
		'current': 'tabPositionCurrent'
	};


	const SEARCH_ENGINES = {
		'system': {
			name: 'Browser Default',
			i18nKey: 'searchEngine_system'
		},
		'google': {
			name: 'Google',
			url: 'https://www.google.com/search?q='
		},
		'bing': {
			name: 'Bing',
			url: 'https://www.bing.com/search?q='
		},
		'baidu': {
			name: 'Baidu',
			i18nKey: 'searchEngine_baidu',
			url: 'https://www.baidu.com/s?wd='
		},
		'360': {
			name: '360 Search',
			i18nKey: 'searchEngine_360',
			url: 'https://www.so.com/s?q='
		},
		'duckduckgo': {
			name: 'DuckDuckGo',
			url: 'https://duckduckgo.com/?q='
		},
		'yahoo': {
			name: 'Yahoo!',
			url: 'https://search.yahoo.com/search?p='
		},
		'yahoo_jp': {
			name: 'Yahoo! JAPAN',
			url: 'https://search.yahoo.co.jp/search?p='
		},
		'yandex': {
			name: 'Yandex',
			i18nKey: 'searchEngine_yandex',
			url: 'https://yandex.com/search/?text='
		},
		'naver': {
			name: 'Naver',
			url: 'https://search.naver.com/search.naver?query='
		},
		'seznam': {
			name: 'Seznam',
			url: 'https://search.seznam.cz/?q='
		},
	};

	const SEARCH_ENGINE_ORDER = {
		'default': ['system', 'google', 'bing', 'duckduckgo', 'yahoo'],
		'en': ['system', 'google', 'bing', 'duckduckgo', 'yahoo', 'baidu', '360', 'yandex', 'naver', 'seznam', 'yahoo_jp'],
		'zh_CN': ['system', 'google', 'bing', 'baidu', '360', 'duckduckgo', 'yahoo'],

		'cs': ['system', 'google', 'seznam', 'bing', 'duckduckgo', 'yahoo'],
		'ja': ['system', 'google', 'yahoo_jp', 'bing', 'duckduckgo', 'yahoo'],
		'ko': ['system', 'google', 'naver', 'bing', 'duckduckgo', 'yahoo'],
		'uk': ['system', 'google', 'bing', 'duckduckgo', 'yahoo'],
		'ru': ['system', 'google', 'yandex', 'bing', 'duckduckgo', 'yahoo'],
	};

	const IMAGE_SEARCH_ENGINES = {
		'google': {
			name: 'Google Lens',
			url: 'https://lens.google.com/uploadbyurl?url='
		},
		'bing': {
			name: 'Bing',
			url: 'https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:'
		},
		'yandex': {
			name: 'Yandex',
			i18nKey: 'searchEngine_yandex',
			url: 'https://yandex.com/images/search?rpt=imageview&url='
		},
		'tineye': {
			name: 'TinEye',
			url: 'https://www.tineye.com/search?url='
		},
		'saucenao': {
			name: 'SauceNAO',
			url: 'https://saucenao.com/search.php?db=999&url='
		},
		'iqdb': {
			name: 'IQDB',
			url: 'https://iqdb.org/?url='
		},
		'trace': {
			name: 'Trace.moe',
			url: 'https://trace.moe/?url='
		}
	};

	const IMAGE_SEARCH_ENGINE_ORDER = {
		'default': ['google', 'bing', 'tineye', 'yandex', 'saucenao', 'iqdb', 'trace'],
		'uk': ['google', 'bing', 'tineye', 'saucenao', 'iqdb', 'trace'],
	};

	const DEFAULT_SETTINGS = {
		theme: 'auto',
		language: 'auto',
		enableGesture: true, 
		gestureTriggerButtons: { right: true, middle: false, side1: false, side2: false, penRight: false }, 
		enableHUD: true,
		enableTrail: true,
		showTrailOrigin: true, 
		enableTrailSmooth: true, 
		enableGestureCustomization: false,
		mouseGestures: Object.fromEntries(
			Object.entries(DEFAULT_GESTURES).map(([p, a]) => [p, { action: a }])
		), 
		sectionAdvanced: {}, 
		enableTextDrag: true,
		enableImageDrag: true,
		enableLinkDrag: true,
		textDragGestures: [
			{ direction: '→', action: 'search', engine: 'system', position: 'right', active: true, url: '', autoDetectUrl: true, incognito: false }
		],
		linkDragGestures: [
			{ direction: '→', action: 'openTab', position: 'right', active: true, incognito: false }
		],
		imageDragGestures: [
			{ direction: '→', action: 'openTab', position: 'right', active: true, url: '', incognito: false }
		],
		hudBgColor: '#000000b3',
		hudTextColor: '#ffffff',
		hudBlurRadius: 5,
		enableHudShadow: true,
		trailColor: '#4285f4',
		trailWidth: 5,
		distanceThreshold: 20,
		gestureTurnTolerance: 0.10, 
		showRestrictedNotice: true, 
		macLinuxHintDismissed: false, 
		edgeGestureConflict: false, 
		enableWheelGestures: false, 
		wheelGestures: {
			scrollUpHoldingRight: { action: 'switchLeftTab' },
			scrollDownHoldingRight: { action: 'switchRightTab' },
		},
		enableSpecialGestures: false, 
		specialGestures: {
			leftClickHoldingRight: { action: 'back' },
			rightClickHoldingLeft: { action: 'forward' },
		},
		actionChains: {},
		showChainSection: false, 
		blacklist: [],
		enableBlacklistContextMenu: false,
		navCollapsed: false,
		lastSyncTime: null
	};

	const ARROW_SVG = {
		'↑': '<svg xmlns="http://www.w3.org/2000/svg" width="0.85em" height="0.85em" fill="currentColor" viewBox="5 3.5 6 9" style="vertical-align:-0.125em; margin:0.05em; display:inline"><path fill-rule="evenodd" d="M 8 12 a 0.5 0.5 0 0 0 0.5 -0.5 V 5.707 L 10.646 7.854 a 0.5 0.5 0 0 0 0.708 -0.708 l -3 -3 a 0.5 0.5 0 0 0 -0.708 0 l -3 3 a 0.5 0.5 0 0 0 0.708 0.708 L 7.5 5.707 V 11.5 A 0.5 0.5 0 0 0 8 12"/></svg>',
		'↓': '<svg xmlns="http://www.w3.org/2000/svg" width="0.85em" height="0.85em" fill="currentColor" viewBox="5 3.5 6 9" style="vertical-align:-0.125em; margin:0.05em; display:inline"><path fill-rule="evenodd" d="M 8 4 a 0.5 0.5 0 0 1 0.5 0.5 v 5.793 L 10.646 8.146 a 0.5 0.5 0 0 1 0.708 0.708 l -3 3 a 0.5 0.5 0 0 1 -0.708 0 l -3 -3 a 0.5 0.5 0 0 1 0.708 -0.708 L 7.5 10.293 V 4.5 A 0.5 0.5 0 0 1 8 4"/></svg>',
		'←': '<svg xmlns="http://www.w3.org/2000/svg" width="0.85em" height="0.85em" fill="currentColor" viewBox="3.5 5 9 6" style="vertical-align:-0.125em; margin:0.05em; display:inline"><path fill-rule="evenodd" d="M 12 8 a 0.5 0.5 0 0 0 -0.5 -0.5 H 5.707 L 7.854 5.354 a 0.5 0.5 0 1 0 -0.708 -0.708 l -3 3 a 0.5 0.5 0 0 0 0 0.708 l 3 3 a 0.5 0.5 0 0 0 0.708 -0.708 L 5.707 8.5 H 11.5 A 0.5 0.5 0 0 0 12 8"/></svg>',
		'→': '<svg xmlns="http://www.w3.org/2000/svg" width="0.85em" height="0.85em" fill="currentColor" viewBox="3.5 5 9 6" style="vertical-align:-0.125em; margin:0.05em; display:inline"><path fill-rule="evenodd" d="M 4 8 a 0.5 0.5 0 0 1 0.5 -0.5 h 5.793 L 8.146 5.354 a 0.5 0.5 0 1 1 0.708 -0.708 l 3 3 a 0.5 0.5 0 0 1 0 0.708 l -3 3 a 0.5 0.5 0 0 1 -0.708 -0.708 L 10.293 8.5 H 4.5 A 0.5 0.5 0 0 1 4 8"/></svg>'
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
		TAB_POSITIONS,

		SEARCH_ENGINES,
		SEARCH_ENGINE_ORDER,
		IMAGE_SEARCH_ENGINES,
		IMAGE_SEARCH_ENGINE_ORDER,

		DEFAULT_SETTINGS,

		arrowsToSvg,
	};

	window.litDisableBundleWarning = true;
})();