(function () {
	'use strict';

	class EventManager {
		constructor() {
			this._bindings = [];
			this._onUpdateCallbacks = [];
		}

		add(condition, target, event, handler, options) {
			this._bindings.push({ target, event, handler, options, condition, active: false });
			return this;
		}

		onUpdate(fn) {
			this._onUpdateCallbacks.push(fn);
			return this;
		}

		update() {
			for (const b of this._bindings) {
				const shouldBeActive = b.condition ? b.condition() : true;
				if (shouldBeActive && !b.active) {
					b.target.addEventListener(b.event, b.handler, b.options);
					b.active = true;
				} else if (!shouldBeActive && b.active) {
					b.target.removeEventListener(b.event, b.handler, b.options);
					b.active = false;
				}
			}
			for (const fn of this._onUpdateCallbacks) fn();
		}

		dispose() {
			for (const b of this._bindings) {
				if (b.active) {
					b.target.removeEventListener(b.event, b.handler, b.options);
					b.active = false;
				}
			}
			this._bindings.length = 0;
		}
	}

	window.EventManager = EventManager;
})();


(function () {
	'use strict';

	let i18nMessages = null;
	let currentLanguage = null;

	function msg(key, defaultText) {
		if (i18nMessages && i18nMessages[key]) {
			return i18nMessages[key].message;
		}
		return chrome.i18n.getMessage(key) || defaultText;
	}

	async function loadLanguage(language) {
		const uiLang = chrome.i18n.getUILanguage().replace('-', '_');
		if (!language || language === 'auto' || language === uiLang || (language === 'en' && uiLang.startsWith('en_'))) {
			currentLanguage = null;
			i18nMessages = null;
			return;
		}

		currentLanguage = language;
		try {
			const url = chrome.runtime.getURL(`_locales/${currentLanguage}/messages.json`);
			const response = await fetch(url);
			i18nMessages = await response.json();
		} catch (e) {
			i18nMessages = null;
		}
	}

	function getHtmlLang() {
		return currentLanguage
			? currentLanguage.replace('_', '-')
			: chrome.i18n.getUILanguage();
	}

	function getDir() {
		const lang = getHtmlLang();
		const rtlLangs = ['ar', 'he', 'fa', 'ps', 'ur', 'yi', 'sd', 'ug', 'ku'];
		return rtlLangs.some(l => lang === l || lang.startsWith(l + '-')) ? 'rtl' : 'ltr';
	}

	window.ContentI18n = {
		msg,
		loadLanguage,
		getHtmlLang,
		getDir,
	};
})();


(function () {
	'use strict';


	function getRoot() {
		return document.scrollingElement || document.documentElement;
	}

	function getScrollTarget(forceTargetWindow = false, cursorX, cursorY) {
		const root = getRoot();
		if (forceTargetWindow) return root;

		const isRootScrollable = root.scrollHeight > window.innerHeight &&
			getComputedStyle(root).overflowY !== 'hidden' &&
			(!document.body || getComputedStyle(document.body).overflowY !== 'hidden');

		const x = cursorX;
		const y = cursorY;
		if (!isRootScrollable) {
			let el = document.elementFromPoint(x, y);
			while (el && el !== root && el !== document.body) {
				const s = window.getComputedStyle(el);
				if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
					return el;
				}
				el = el.parentElement;
			}
		}
		return root;
	}

	function checkScrollFeasibility(action, cursorX, cursorY) {
		const tolerance = 1; 
		const target = getScrollTarget(false, cursorX, cursorY);

		const currentScrollTop = target.scrollTop;
		const maxScrollTop = target.scrollHeight - target.clientHeight;

		if (action === 'scrollUp' || action === 'scrollToTop') {
			return currentScrollTop > tolerance; 
		} else if (action === 'scrollDown' || action === 'scrollToBottom') {
			return currentScrollTop < maxScrollTop - tolerance; 
		}
		return true; 
	}

	function resolveScrollSmoothness(value) {
		if (value === 'auto') {
			const systemHasAnimation = window.matchMedia && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
			return systemHasAnimation ? 'system' : 'smooth';
		}
		return value;
	}

	const scrollGoals = new WeakMap(); 
	let scrollRafId = null;
	let scrollActiveTarget = null; 
	let scrollVersion = 0; 

	let scrollAccelLastTime = 0;
	let scrollAccelCount = 0;
	let scrollAccelLastDir = null;

	function startScrollListeners() {
		document.addEventListener('wheel', cancelEaseScroll, { capture: true, passive: true });
	}

	function stopScrollListeners() {
		document.removeEventListener('wheel', cancelEaseScroll, { capture: true });
	}

	function cancelEaseScroll() {
		if (scrollRafId) {
			cancelAnimationFrame(scrollRafId);
			scrollRafId = null;
		}
		if (scrollActiveTarget) {
			scrollGoals.delete(scrollActiveTarget);
			scrollActiveTarget = null;
		}
		stopScrollListeners();
	}

	function easeScrollTo(target, goalY, unclampedGoalY) {
		scrollActiveTarget = target;

		const startY = target.scrollTop;
		if (startY === goalY) {
			scrollActiveTarget = null;
			return;
		}

		const deltaY = goalY - startY;
		const startTime = performance.now();

		const realDist = Math.abs(deltaY);
		const unclampedDist = Math.abs(unclampedGoalY - startY);
		let duration = 500;
		if (unclampedDist > 0 && realDist < unclampedDist) {
			duration = Math.max(16, duration * (realDist / unclampedDist));
		}

		startScrollListeners();

		function step(now) {
			const elapsed = now - startTime;
			if (elapsed >= duration) {
				target.scrollTo({ top: goalY, behavior: 'instant' });
				scrollRafId = null;
				scrollActiveTarget = null;
				scrollGoals.delete(target);
				stopScrollListeners();
				return;
			}
			const ease = 1 - Math.pow(1 - elapsed / duration, 3);
			const y = startY + deltaY * ease;
			target.scrollTo({ top: y, behavior: 'instant' });
			scrollRafId = requestAnimationFrame(step);
		}

		scrollRafId = requestAnimationFrame(step);
	}

	function handleScroll(action, scrollConfig, forceTargetWindow = false, cursorX, cursorY) {
		const target = getScrollTarget(forceTargetWindow, cursorX, cursorY);
		const smoothness = resolveScrollSmoothness(scrollConfig.scrollSmoothness);

		const curY = target.scrollTop;
		const maxY = target.scrollHeight - target.clientHeight;

		let goalY, unclampedGoalY;
		if (action === 'scrollUp' || action === 'scrollDown') {
			const containerHeight = target.clientHeight;
			let delta = containerHeight * (scrollConfig.scrollDistance / 100) * (action === 'scrollUp' ? -1 : 1);

			const accel = scrollConfig.scrollAccel ?? 1;
			const accelWindow = scrollConfig.scrollAccelWindow ?? 400;
			if (accel != 1) {
				const now = performance.now();
				if (now - scrollAccelLastTime < accelWindow && scrollAccelLastDir === action) {
					scrollAccelCount++;
				} else {
					scrollAccelCount = 0;
				}
				scrollAccelLastTime = now;
				scrollAccelLastDir = action;
				if (scrollAccelCount > 0) {
					delta *= accel;
				}
			}

			unclampedGoalY = (scrollGoals.get(target) ?? curY) + delta;
			goalY = Math.max(0, Math.min(unclampedGoalY, maxY));
		} else if (action === 'scrollToTop') {
			goalY = unclampedGoalY = 0;
		} else if (action === 'scrollToBottom') {
			goalY = unclampedGoalY = maxY;
		} else {
			return;
		}

		cancelEaseScroll();
		scrollGoals.set(target, goalY);
		if (curY === goalY) return;

		if (smoothness === 'none') {
			scrollGoals.delete(target);
			target.scrollTo({ top: goalY, behavior: 'instant' });
		} else if (smoothness === 'system') {
			target.scrollTo({ top: goalY, behavior: 'smooth' });
			const version = ++scrollVersion;
			const eventTarget = target === getRoot() ? document : target;
			eventTarget.addEventListener('scrollend', () => {
				if (scrollVersion === version) {
					scrollGoals.delete(target);
				}
			}, { once: true });
		} else {
			easeScrollTo(target, goalY, unclampedGoalY);
		}
	}


	function copyTextFallback(text) {
		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
		} catch (err) {
		}
	}

	function copyText(text) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).catch(err => {
				copyTextFallback(text);
			});
		} else {
			copyTextFallback(text);
		}
	}


	function tryParseAsUrl(text, requireProtocol = false) {
		if (!text || typeof text !== 'string') return null;
		text = text.trim();
		if (!text) return null;

		const protocolRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
		if (protocolRegex.test(text)) {
			const ignoreProtocol = /^(javascript|data|blob):/i;
			if (ignoreProtocol.test(text)) return null;
			if (/^(mailto|tel|sms|magnet):/i.test(text) || text.includes('://')) return text;
			return null;
		}

		if (requireProtocol) return null;

		const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;
		if (ipRegex.test(text)) {
			return 'http://' + text;
		}

		const localhostRegex = /^localhost(:\d+)?(\/.*)?$/i;
		if (localhostRegex.test(text)) {
			return 'http://' + text;
		}

		const domainRegex = /^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)*(:\d+)?(\/.*)?$/;
		const commonTlds = /\.(com|cn|net|org|gov|edu|io|co|cc|me|tv|info|biz|xyz|top|vip|club|shop|site|online|tech|app|dev|ai|uk|de|fr|jp|kr|ru|br|in|au|ca|hk|tw|sg)\b/i;
		if (domainRegex.test(text) && commonTlds.test(text)) {
			return 'http://' + text;
		}

		return null;
	}

	function showToast(message, options = {}) {
		const {
			duration = 8000,
			onClick = null,
			bgColor = 'rgba(0,0,0,0.75)',
			textColor = '#fff',
		} = options;

		const toast = document.createElement('div');
		toast.style.cssText = [
			'position:fixed',
			'bottom:20%',
			'left:50%',
			'transform:translateX(-50%) translateY(20px)',
			`background-color:${bgColor}`,
			`color:${textColor}`,
			'padding:12px 24px',
			'border-radius:8px',
			'font-size:14px',
			'line-height:1.5',
			'max-width:80%',
			'text-align:center',
			'opacity:0',
			'transition:opacity 0.3s,transform 0.3s',
			'box-shadow:0 4px 15px rgba(0,0,0,0.3)',
			'z-index:2147483647',
			onClick ? 'pointer-events:auto;cursor:pointer' : 'pointer-events:none',
		].join(';');
		toast.textContent = message;

		document.documentElement.appendChild(toast);
		void toast.offsetWidth;
		requestAnimationFrame(() => {
			toast.style.opacity = '1';
			toast.style.transform = 'translateX(-50%) translateY(0)';
		});

		function dismiss() {
			toast.style.opacity = '0';
			toast.style.transform = 'translateX(-50%) translateY(20px)';
			setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
		}

		if (onClick) {
			toast.addEventListener('click', () => { onClick(); dismiss(); });
		}

		setTimeout(dismiss, duration);
		return dismiss;
	}

	window.FlowMouseUtils = {
		handleScroll,
		checkScrollFeasibility,
		copyText,
		tryParseAsUrl,
		showToast,
	};
})();

(function () {
	'use strict';

	const isEdgeDesktop = navigator.userAgent.includes('Edg/');

	const currentDomain = location.hostname;
	
	function checkBlacklist(blacklist) {
		if (blacklist.includes(currentDomain)) return true;
		try {
			const origins = location.ancestorOrigins;
			if (origins && origins.length > 0) {
				return blacklist.includes(new URL(origins[origins.length - 1]).hostname);
			}
		} catch (e) {}
		return false;
	}

	let isBlacklisted = false;
	let initGesturesCalled = false;

	try {
		if (chrome.storage && chrome.storage.sync) {
			chrome.storage.sync.get({ blacklist: [] }, (items) => {
				if (chrome.runtime.lastError) return; 
				isBlacklisted = checkBlacklist(items.blacklist);
				if (!isBlacklisted) {
					initGestures();
				}
			});
		} else {
			initGestures();
		}
	} catch (e) {
		initGestures();
	}

	try {
		if (chrome.storage && chrome.storage.onChanged) {
			chrome.storage.onChanged.addListener((changes, namespace) => {
				if (namespace === 'sync') {
					if (changes.blacklist) {
						const oldBlacklist = changes.blacklist.oldValue || [];
						const newBlacklist = changes.blacklist.newValue || [];
						const wasBlacklisted = checkBlacklist(oldBlacklist);
						const nowBlacklisted = checkBlacklist(newBlacklist);

						if (wasBlacklisted !== nowBlacklisted) {
							isBlacklisted = nowBlacklisted;
							if (nowBlacklisted === false && !initGesturesCalled) {
								initGestures();
							}
						}
					}
				}
			});
		}
	} catch (e) {
	}


	function initGestures() {
		initGesturesCalled = true;
		const { DEFAULT_GESTURES, DEFAULT_SETTINGS, ACTION_DEFAULTS, ACTION_KEYS, LOCAL_ACTIONS, TEXT_DRAG_ACTIONS, LINK_DRAG_ACTIONS, IMAGE_DRAG_ACTIONS } = window.GestureConstants;
		const { handleScroll, checkScrollFeasibility, copyText, tryParseAsUrl } = window.FlowMouseUtils;
		const { msg } = window.ContentI18n;

		const CONFIG = {
			DISTANCE_THRESHOLD: DEFAULT_SETTINGS.distanceThreshold,
			SCROLL_AMOUNT: window.innerHeight * 0.75
		};

		const recognizer = new window.GestureRecognizer({
			distanceThreshold: CONFIG.DISTANCE_THRESHOLD
		});

		let isIframe = false;
		try {
			isIframe = window.self !== window.top;
		} catch (e) {
			isIframe = true;
		}

		const isIncognito = chrome.extension.inIncognitoContext;

		async function safeSendMessage(message) {
			try {
				if (chrome.runtime && chrome.runtime.sendMessage) {
					return await chrome.runtime.sendMessage(message);
				}
			} catch (e) {
			}
		}

		function getActionHintText(action, type) {
			const dragActionKeyMap = { text: TEXT_DRAG_ACTIONS, link: LINK_DRAG_ACTIONS, image: IMAGE_DRAG_ACTIONS };
			const key = dragActionKeyMap[type]?.[action];
			return key ? msg(key) : '';
		}

		function getDragHints(type, pattern, dragContent) {
			const gestures = getGesturesForDragType(type);
			if (!gestures) return [];

			const configs = getDragGestureConfigs(gestures, pattern);
			const rawHints = [];
			for (const cfg of configs) {
				let action = cfg.action || 'none';
				if (action === 'none') continue;
				if (action === 'search' && type === 'text' && cfg.autoDetectUrl === true && dragContent && tryParseAsUrl(dragContent, false)) {
					rawHints.push(msg('dragActionOpenTabLink'));
				} else {
					const hint = getActionHintText(action, type);
					if (hint) rawHints.push(hint);
				}
			}

			const countMap = new Map();
			for (const h of rawHints) {
				countMap.set(h, (countMap.get(h) || 0) + 1);
			}
			const hints = [];
			const seen = new Set();
			for (const h of rawHints) {
				if (seen.has(h)) continue;
				seen.add(h);
				const count = countMap.get(h);
				hints.push(count > 1 ? `${h} × ${count}` : h);
			}
			return hints;
		}

		function getGesturesForDragType(dragType) {
			if (dragType === 'text') return SETTINGS.textDragGestures;
			if (dragType === 'link') return SETTINGS.linkDragGestures;
			if (dragType === 'image') return SETTINGS.imageDragGestures;
			return null;
		}

		function getDragGestureConfigs(gestures, dir) {
			if (!Array.isArray(gestures)) return [];
			return gestures.filter(g => g.direction === dir);
		}

		function hasDragAction(dragType, pattern) {
			if (!pattern) return false;
			const gestures = getGesturesForDragType(dragType);
			if (!gestures) return false;
			return getDragGestureConfigs(gestures, pattern).some(g => g.action && g.action !== 'none');
		}

		let SETTINGS = {
			...DEFAULT_SETTINGS,
			enableDrag: DEFAULT_SETTINGS.enableTextDrag || DEFAULT_SETTINGS.enableImageDrag || DEFAULT_SETTINGS.enableLinkDrag
		};

		function getGestureAction(pattern) {
			if (!SETTINGS.enableGestureCustomization) {
				return DEFAULT_GESTURES[pattern];
			}

			const config = SETTINGS.mouseGestures?.[pattern];
			return config?.action;
		}


		function getActionName(pattern) {
			const action = getGestureAction(pattern);
			if (!action || action === 'none') return '';
			if (action === 'actionChain') {
				const config = SETTINGS.mouseGestures?.[pattern];
				const chain = SETTINGS.actionChains?.[config?.chainId];
				if (chain?.name) return chain.name;
				if (!chain) return `${msg(ACTION_KEYS[action])} ${msg('chainNotFound')}`;
			}
			if (action === 'simulateKey') {
				const config = SETTINGS.mouseGestures?.[pattern] || {};
				const defaults = ACTION_DEFAULTS.simulateKey || {};
				const keyValue = config.keyValue || defaults.keyValue || 'ArrowLeft';
				const mods = [];
				if (config.modCtrl) mods.push('Ctrl');
				if (config.modShift) mods.push('Shift');
				if (config.modAlt) mods.push('Alt');
				if (config.modMeta) mods.push('Meta');
				mods.push(keyValue);
				return `${msg(ACTION_KEYS[action])} (${mods.join('+')})`;
			}
			const i18nKey = ACTION_KEYS[action];
			return i18nKey ? msg(i18nKey) : '';
		}

		function loadSettings() {
			try {
				if (!chrome.storage || !chrome.storage.sync) return;
				chrome.storage.sync.get(null, async (items) => {
					if (chrome.runtime.lastError) return; 
					if (items) {
						const { blacklist, ...otherSettings } = items;
						SETTINGS = { ...SETTINGS, ...otherSettings };
					}

					SETTINGS.wheelGestures = {
						...structuredClone(DEFAULT_SETTINGS.wheelGestures || {}),
						...(SETTINGS.wheelGestures || {}),
					};
					SETTINGS.specialGestures = {
						...structuredClone(DEFAULT_SETTINGS.specialGestures || {}),
						...(SETTINGS.specialGestures || {}),
					};

					await window.ContentI18n.loadLanguage(SETTINGS.language);

					SETTINGS.enableDrag = SETTINGS.enableTextDrag || SETTINGS.enableImageDrag || SETTINGS.enableLinkDrag;

					if (window.GestureRecognizer && recognizer && recognizer.updateConfig) {
						recognizer.updateConfig({
							distanceThreshold: SETTINGS.distanceThreshold,
							longGestureMultiplier: SETTINGS.gestureTurnTolerance
						});
					}

					if (SETTINGS.enableTrail || SETTINGS.enableHUD) {
						visualizer.updateSettings({
							hudBgColor: SETTINGS.hudBgColor,
							hudTextColor: SETTINGS.hudTextColor,
							hudBlurRadius: SETTINGS.hudBlurRadius,
							enableHudShadow: SETTINGS.enableHudShadow,
							trailColor: SETTINGS.trailColor,
							trailWidth: SETTINGS.trailWidth,
							showTrailOrigin: SETTINGS.showTrailOrigin,
							enableInputStabilization: SETTINGS.enableTrailSmooth,
							enablePathInterpolation: SETTINGS.enableTrailSmooth,
							lang: window.ContentI18n.getHtmlLang(),
							isRtl: window.ContentI18n.getDir() === 'rtl'
						});
					}

					eventManager.update();
				});
			} catch (e) {
			}
		}

		try {
			if (chrome.storage && chrome.storage.onChanged) {
				chrome.storage.onChanged.addListener((changes, namespace) => {
					if (namespace === 'sync') {
						const keys = Object.keys(changes);
						if (keys.length === 1 && keys[0] === 'blacklist') return;

						loadSettings();
					}
				});
			}
		} catch (e) {
		}

		loadSettings();


		try {
			chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
				if (request.action === 'ping') {
					sendResponse({ pong: true });
					return;
				}

				if (request.action === 'gestureStateUpdate') {
					isRemoteGestureActive = request.active;
				}

				if (request.action === 'executeLocalAction' && !isIframe) {
					if (!LOCAL_ACTIONS.has(request.stepAction)) {
						sendResponse({ success: false });
						return;
					}
					executeAction(request.stepAction, request.stepConfig)
						.then(() => sendResponse({ success: true }))
						.catch(() => sendResponse({ success: false }));
					return true; 
				}

				if (request.action === 'gestureHudUpdate' && !isIframe) {
					const d = request.data;
					switch (d.type) {
						case 'hide': visualizer.hide(); break;
						case 'updateAction': visualizer.updateAction(d.arrows, d.texts); break;
					}
				}

				if (request.action === 'gestureScrollUpdate' && !isIframe) {
					handleScroll(request.data.action, request.data.scrollConfig, true);
				}

				if (request.action === 'showDownloadError' && !isIframe) {
					visualizer.showToast(msg('downloadErrorHotlink'), 5000);
				}
			});
		} catch (e) {
		}

		let gestureState = {
			isRightButton: false,
			gestureButton: null,
			isDrag: false,
			selectedText: '',
			dragElement: null,
			dragType: null,
			parentLink: null,
			preventContextMenu: false,
			skipFirstDragOver: false  
		};

		function resetState() {
			visualizer.hide();
			if (SETTINGS.enableHUD) visualizer.updateAction('', []);
			recognizer.reset();
			gestureState.isRightButton = false;
			gestureState.gestureButton = null;
			gestureState.isDrag = false;
			gestureState.selectedText = '';
			gestureState.dragElement = null;
			gestureState.dragType = null;
			gestureState.skipFirstDragOver = false;
		}

		let isRemoteGestureActive = false;

		let edgeGestureBlurCount = 0;

		let preventContextMenuTimeoutId = null;

		let lastPointerType = 'mouse';

		class RelayGestureVisualizer extends window.GestureVisualizer {
			updateAction(arrows, texts) {
				if (isIframe) {
					safeSendMessage({ action: 'gestureHudUpdate', data: { type: 'updateAction', arrows, texts } });
				} else {
					super.updateAction(arrows, texts);
				}
			}

			hide() {
				super.hide();

				if (isIframe) {
					safeSendMessage({ action: 'gestureHudUpdate', data: { type: 'hide' } });
				}
			}
		}

		const visualizer = new RelayGestureVisualizer();

		const isGestureEnabled = () => SETTINGS.enableGesture && !isBlacklisted;
		const isWheelGestureEnabled = () => SETTINGS.enableWheelGestures && !isBlacklisted;
		const isSpecialGestureEnabled = () => SETTINGS.enableSpecialGestures && !isBlacklisted;
		const isDragEnabled = () => SETTINGS.enableDrag && !isBlacklisted;
		const eventManager = new window.EventManager();

		const isMacOrLinux = /Mac|Linux/i.test(navigator.platform);
		let lastRightClickTime = 0;
		const doubleClickDelay = 500; 

		let macLinuxHintShown = false;

		function showMacLinuxHint() {
			if (macLinuxHintShown) return;
			const hintText = msg('macLinuxDoubleClickHint');
			if (!hintText) return;
			macLinuxHintShown = true;
			window.FlowMouseUtils.showToast(hintText, {
				bgColor: SETTINGS.hudBgColor,
				textColor: SETTINGS.hudTextColor,
				onClick: () => {
					try { chrome.storage.sync.set({ macLinuxHintDismissed: true }); } catch (e) {}
					SETTINGS.macLinuxHintDismissed = true;
					safeSendMessage({ action: 'openOptionsPage', hash: '#mac-linux-notice' });
				},
			});
		}

		let wheelGestureTriggered = false;
		let rockerGestureTriggered = false;
		let rightButtonSeenOnPage = false;

		window.addEventListener('pageshow', (e) => {
			if (e.persisted) {
				rightButtonSeenOnPage = false;
				rockerGestureTriggered = false;
				wheelGestureTriggered = false;
				resetState();
			}
		});

		eventManager.add(() => !isBlacklisted, document, 'contextmenu', (e) => {
			if (wheelGestureTriggered) {
				wheelGestureTriggered = false;
				e.preventDefault();
				e.stopPropagation();
				return false;
			}

			if (rockerGestureTriggered) {
				rockerGestureTriggered = false;
				e.preventDefault();
				e.stopPropagation();
				return false;
			}

			if (!rightButtonSeenOnPage && e.button === 2) {
				rightButtonSeenOnPage = true;
				e.preventDefault();
				e.stopPropagation();
				return false;
			}

			const triggerBtns = SETTINGS.gestureTriggerButtons;
			const gestureUsesRightClick = SETTINGS.enableGesture && (triggerBtns.right !== false || triggerBtns.penRight === true);
			if (!gestureUsesRightClick && !SETTINGS.enableWheelGestures && !SETTINGS.enableSpecialGestures) return;

			if (e.composedPath().some(el => el.hasAttribute && el.hasAttribute('data-gesture-ignore'))) return;

			{
				if (gestureState.preventContextMenu || isRemoteGestureActive) {
					e.preventDefault();
					e.stopPropagation();
					return false;
				}
			}
		}, { capture: true });

		document.addEventListener('pointerdown', (e) => {
			if (e.button === 0) {
				lastPointerType = e.pointerType; 
			}
			if (e.button === 2) {
				rightButtonSeenOnPage = true;
			}
		}, true);

		function isTriggerButton(pointerType, button) {
			const btns = SETTINGS.gestureTriggerButtons;
			if (pointerType === 'pen') return button === 2 && btns.penRight === true;
			if (pointerType !== 'mouse') return false;
			switch (button) {
				case 2: return btns.right !== false;
				case 1: return btns.middle === true;
				case 3: return btns.side1 === true;
				case 4: return btns.side2 === true;
				default: return false;
			}
		}

		eventManager.add(isGestureEnabled, document, 'pointerdown', (e) => {
			if (isTriggerButton(e.pointerType, e.button)) {
				if (e.composedPath().some(el => el.hasAttribute && el.hasAttribute('data-gesture-ignore'))) return;

				gestureState.isRightButton = true;
				gestureState.gestureButton = e.button;
				gestureState.isDrag = false;
				gestureState.preventContextMenu = false;
				if (preventContextMenuTimeoutId) {
					clearTimeout(preventContextMenuTimeoutId);
					preventContextMenuTimeoutId = null;
				}
				recognizer.start(e.clientX, e.clientY, e.timeStamp);

				if (e.button === 1 || e.pointerType === 'pen' && e.button === 2) {
					e.preventDefault();
				}

			}
		}, { capture: true });

		eventManager.add(isGestureEnabled, document, 'pointermove', (e) => {
			if (!gestureState.isRightButton) return;

			const result = recognizer.move(e.clientX, e.clientY, e.timeStamp);

			if (result.totalDistance > 3 || result.activated) {
				try {
					const target = document.documentElement || document.body;
					if (!target.hasPointerCapture(e.pointerId)) {
						target.setPointerCapture(e.pointerId);
					}
				} catch (err) {
					console.warn('FlowMouse: setPointerCapture failed', err);
				}
			}

			let currentPoints = [];
			if (SETTINGS.enableTrail) {
				if (e.getCoalescedEvents) {
					const events = e.getCoalescedEvents();
					if (events.length > 0) {
						currentPoints = events.map(evt => ({ x: evt.clientX, y: evt.clientY, timestamp: evt.timeStamp }));
					}
				}
				if (currentPoints.length === 0) {
					currentPoints = [{ x: e.clientX, y: e.clientY, timestamp: e.timeStamp }];
				}
			}

			if (result.activated) {
				gestureState.preventContextMenu = true;
				safeSendMessage({ action: 'gestureStateUpdate', active: true });
				if (SETTINGS.enableTrail) {
					visualizer.updateSettings({
						minCutoff: 5.0,
						beta: 0.01,
						dcutoff: 1.0
					});
					visualizer.show();
					
					const preTrail = result.preActivationTrail || [{ x: recognizer.startX, y: recognizer.startY, timestamp: recognizer.startTimestamp }];
					const merged = [...preTrail, ...currentPoints];
					merged.sort((a, b) => a.timestamp - b.timestamp);
					visualizer.addPoints(merged);
				}
			} else if (recognizer.isActive() && SETTINGS.enableTrail) {
				visualizer.addPoints(currentPoints);
			}

			if (!recognizer.isActive()) return;

			if (result.directionChanged && SETTINGS.enableHUD) {
				const actionName = getActionName(result.pattern);
				visualizer.updateAction(result.pattern, actionName ? [actionName] : []);
			}
		}, { capture: true });

		eventManager.add(isGestureEnabled, document, 'pointerup', (e) => {
			if (gestureState.isRightButton) {
				if (recognizer.isActive()) {
					e.preventDefault();
					e.stopPropagation();
					executeGesture(recognizer.getPattern());
					lastRightClickTime = 0;
				}

				resetState();
				preventContextMenuTimeoutId = setTimeout(() => {
					gestureState.preventContextMenu = false;
					preventContextMenuTimeoutId = null;
					safeSendMessage({ action: 'gestureStateUpdate', active: false });
				}, 50);
			}
		}, { capture: true });

		let rockerLeftExecuted = false;
		eventManager.add(isSpecialGestureEnabled, document, 'mousedown', (e) => {
			if (e.button === 0 && (e.buttons & 2)) {
				if (recognizer.isActive()) return;
				const specialConfig = (SETTINGS.specialGestures || {}).leftClickHoldingRight;
				if (!specialConfig?.action || specialConfig.action === 'none') return;
				e.preventDefault();
				e.stopPropagation();
				gestureState.preventContextMenu = true;
				gestureState.isRightButton = false;
				recognizer.reset();
				rockerGestureTriggered = true;
				rockerLeftExecuted = true;
				executeAction(specialConfig.action, specialConfig, e.clientX, e.clientY);
				return;
			}

			if (e.button === 2 && (e.buttons & 1)) {
				if (recognizer.isActive()) return;
				const specialConfig = (SETTINGS.specialGestures || {}).rightClickHoldingLeft;
				if (!specialConfig?.action || specialConfig.action === 'none') return;
				e.preventDefault();
				e.stopPropagation();
				gestureState.preventContextMenu = true;
				gestureState.isRightButton = false;
				recognizer.reset();
				rockerGestureTriggered = true;
				executeAction(specialConfig.action, specialConfig, e.clientX, e.clientY);
				return;
			}
		}, { capture: true });

		eventManager.add(isSpecialGestureEnabled, document, 'click', (e) => {
			if (rockerLeftExecuted) {
				e.preventDefault();
				e.stopPropagation();
				rockerLeftExecuted = false;
			}
		}, { capture: true });

		eventManager.add(isSpecialGestureEnabled, document, 'mouseup', (e) => {
			if (e.button === 0 && rockerLeftExecuted) {
				setTimeout(() => { rockerLeftExecuted = false; }, 10);
			}
		}, { capture: true });

		eventManager.add(isDragEnabled, document, 'mousedown', (e) => {
			if (e.button !== 0) return;

			let target = e.target;
			let depth = 0;
			let hasModified = false;

			while (target && target !== document.body && depth < 5) {
				if (target.getAttribute && target.getAttribute('draggable') === 'false') {
					let shouldForce = false;

					if (target.tagName === 'IMG') {
						shouldForce = true;
					}
					else if (target.tagName === 'A' && target.href) {
						if (!target.querySelector('input, textarea, select, button')) {
							shouldForce = true;
						}
					}
					else if (window.getSelection().rangeCount > 0 && window.getSelection().containsNode(target, true)) {
						shouldForce = true;
					}

					if (shouldForce) {
						target.setAttribute('draggable', 'true');
						target.setAttribute('data-flowmouse-modified', 'true'); 
						hasModified = true;
					}
				}
				target = target.parentElement;
				depth++;
			}

			if (hasModified) {
				document.addEventListener('mouseup', restoreDraggable, true);
				document.addEventListener('dragend', restoreDraggable, true);
			}
		}, { capture: true });

		function restoreDraggable() {
			document.removeEventListener('mouseup', restoreDraggable, true);
			document.removeEventListener('dragend', restoreDraggable, true);

			const modified = document.querySelectorAll('[data-flowmouse-modified="true"]');
			modified.forEach(el => {
				el.setAttribute('draggable', 'false'); 
				el.removeAttribute('data-flowmouse-modified');
			});
		}

		eventManager.add(isDragEnabled, document, 'dragstart', (e) => {
			let dragContent = null;
			let dragElement = null;
			let dragType = null;

			const dtItems = [...e.dataTransfer.items];
			let isImage = dtItems.some(i => i.kind === 'file' && i.type.startsWith('image/'));
			{
				isImage = isImage || dtItems.some(i => i.type === 'application/x-moz-nativeimage');
			}
			const isLink = !isImage && dtItems.some(i => i.type === 'text/uri-list');
			const isText = !isImage && !isLink && dtItems.some(i => i.type === 'text/plain' || i.type === 'text/html');

			const path = e.composedPath();

			if (SETTINGS.enableImageDrag && isImage) {
				let targetImg = path.find(el => el.tagName === 'IMG');

				if (!targetImg) {
					const shadowHost = path.find(el => el.shadowRoot);
					const root = shadowHost ? shadowHost.shadowRoot : document;
					const el = root.elementFromPoint(e.clientX, e.clientY);
					if (el && el.tagName === 'IMG') {
						targetImg = el;
					}
				}

				if (targetImg) {
					dragContent = targetImg.src || targetImg.currentSrc;
					dragElement = targetImg;
					dragType = 'image';
					const parentLink = path.find(el => el.tagName === 'A' && el.href);
					if (parentLink) {
						gestureState.parentLink = parentLink.href;
					} else {
						gestureState.parentLink = null;
					}
					window.getSelection().removeAllRanges();
				}
			}

			if (!dragContent && SETTINGS.enableLinkDrag && isLink) {
				const targetLink = path.find(el => el.tagName === 'A' && el.href);
				if (targetLink) {
					let rawHref = targetLink.getAttribute('href');

					if (rawHref) {
						try {
							const absoluteUrl = new URL(rawHref, document.baseURI).href;

							if (tryParseAsUrl(absoluteUrl, true)) {
								dragContent = absoluteUrl;
								dragType = 'link';
								dragElement = targetLink;
								window.getSelection().removeAllRanges();
							}
						} catch (err) {
						}
					}
				}
			}

			if (!dragContent && SETTINGS.enableTextDrag && isText) {
				const text = window.getSelection().toString().trim();
				if (text) {
					dragContent = text;
					dragType = 'text';
				}
			}

			if (dragContent) {
				gestureState.isDrag = true;
				gestureState.isRightButton = false;
				gestureState.selectedText = dragContent;
				gestureState.dragElement = dragElement;
				gestureState.dragType = dragType;
				recognizer.start(e.clientX, e.clientY, e.timeStamp);
				if (lastPointerType === 'touch' || lastPointerType === 'pen') {
					gestureState.skipFirstDragOver = true;
				}
			}
		}, { capture: false });

		eventManager.add(isDragEnabled, document, 'dragover', (e) => {
			if (!gestureState.isDrag) return;

			if (gestureState.skipFirstDragOver) {
				gestureState.skipFirstDragOver = false;
				return;
			}

			const result = recognizer.move(e.clientX, e.clientY, e.timeStamp);

			const currentPoint = { x: e.clientX, y: e.clientY, timestamp: e.timeStamp };

			if (result.activated) {
				if (SETTINGS.enableTrail) {
					visualizer.updateSettings({
						minCutoff: 1.0,
						beta: 0.007,
						dcutoff: 1.0
					});
					visualizer.show();
					
					const preTrail = result.preActivationTrail || [{ x: recognizer.startX, y: recognizer.startY, timestamp: recognizer.startTimestamp }];
					const merged = [...preTrail, currentPoint];
					merged.sort((a, b) => a.timestamp - b.timestamp);
					visualizer.addPoints(merged);
				}
			} else if (recognizer.isActive() && SETTINGS.enableTrail) {
				visualizer.addPoints([currentPoint]);
			}

			if (!recognizer.isActive()) return;

			if (hasDragAction(gestureState.dragType, recognizer.getPattern())) {
				e.preventDefault();
			}

			if (result.directionChanged && SETTINGS.enableHUD) {
				const hints = getDragHints(gestureState.dragType, result.pattern, gestureState.selectedText);
				visualizer.updateAction(hints.length > 0 ? result.pattern : '', hints);
			}
		}, { capture: true });

		eventManager.add(isDragEnabled, document, 'dragenter', (e) => {
			if (!gestureState.isDrag) return;
			if (!recognizer.isActive()) return;
			if (hasDragAction(gestureState.dragType, recognizer.getPattern())) {
				e.preventDefault();
			}
		}, { capture: true });

		eventManager.add(isDragEnabled, document, 'dragleave', (e) => {
			if (gestureState.isDrag && e.relatedTarget === null) {
				resetState();
			}
		}, { capture: true });

		eventManager.add(isDragEnabled, document, 'dragend', (e) => {
			resetState();
		}, { capture: true });

		eventManager.add(isDragEnabled, document, 'drop', (e) => {
			try {
				if (gestureState.isDrag && recognizer.isActive()) {
					const pattern = recognizer.getPattern();
					if (hasDragAction(gestureState.dragType, pattern)) {
						e.preventDefault();
						executeDragGesture({ ...gestureState }, pattern, e.dataTransfer);
					}
				}
			} catch (error) {
			} finally {
				resetState();
			}
		}, { capture: true });

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				if (gestureState.isRightButton || gestureState.isDrag) {
					if (gestureState.isRightButton && recognizer.isActive()) {
						e.preventDefault();
						e.stopPropagation();
					}
					if (gestureState.isRightButton) {
						safeSendMessage({ action: 'gestureStateUpdate', active: false });
					}

					resetState();
				}
			}
		}, true);

		function handleWheelGesture(e) {
			if (!(e.buttons & 2)) return;
			if (recognizer.isActive()) return;
			if (e.deltaY === 0) return;

			const gestureKey = e.deltaY < 0 ? 'scrollUpHoldingRight' : 'scrollDownHoldingRight';
			const scrollConfig = (SETTINGS.wheelGestures || {})[gestureKey];
			const action = scrollConfig?.action;
			if (!action || action === 'none') return;

			e.preventDefault();
			e.stopPropagation();
			gestureState.preventContextMenu = true;
			gestureState.isRightButton = false;
			recognizer.reset();
			wheelGestureTriggered = true;

			executeAction(action, scrollConfig, e.clientX, e.clientY);
		}

		{
			eventManager.add(isWheelGestureEnabled, document, 'wheel', handleWheelGesture, { capture: true, passive: false });
		}


		window.addEventListener('blur', () => {
			if (gestureState.isRightButton) {
				if (recognizer.isActive()) {
					safeSendMessage({ action: 'gestureStateUpdate', active: false });
				}


				gestureState.preventContextMenu = false;
				resetState();
			}
		});

		async function executeAction(action, config = {}, cursorX, cursorY, useActiveTab = false) {
			if (!action || action === 'none') return false;

			if (!ACTION_KEYS[action]) return false;

			const defaults = ACTION_DEFAULTS[action] || {};
			const mergedConfig = { ...defaults, ...config };

			if (LOCAL_ACTIONS.has(action)) {
				const scrollConfig = { scrollDistance: mergedConfig.scrollDistance, scrollSmoothness: mergedConfig.scrollSmoothness, scrollAccel: mergedConfig.scrollAccel, scrollAccelWindow: mergedConfig.scrollAccelWindow };
				switch (action) {
					case 'scrollUp':
					case 'scrollDown':
					case 'scrollToTop':
					case 'scrollToBottom':
						if (isIframe && !checkScrollFeasibility(action, cursorX, cursorY)) {
							safeSendMessage({ action: 'gestureScrollUpdate', data: { action, scrollConfig } });
							break;
						}
						handleScroll(action, scrollConfig, false, cursorX, cursorY);
						break;
					case 'stopLoading': window.stop(); break;
					case 'copyUrl': copyText(mergedConfig.includeTitle ? `${document.title}\n${location.href}` : location.href); break;
					case 'copyTitle': copyText(document.title); break;
					case 'printPage': window.print(); break;
					case 'sendCustomEvent': {
						const eventType = mergedConfig.eventType;
						if (eventType) {
							let detail = {};
							try {
								const detailStr = mergedConfig.eventDetail || '{}';
								detail = JSON.parse(detailStr);
							} catch {  }
							window.dispatchEvent(new CustomEvent(eventType, { detail, bubbles: true, cancelable: true }));
						}
						break;
					}
					case 'simulateKey': {
						const keyValue = mergedConfig.keyValue;
						if (keyValue) {
							const KEY_CODE_MAP = {
								Backspace: 8, Tab: 9, Enter: 13, Shift: 16, Control: 17, Alt: 18,
								Escape: 27, ' ': 32, PageUp: 33, PageDown: 34,
								End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
								Delete: 46, Insert: 45,
								F1: 112, F2: 113, F3: 114, F4: 115, F5: 116, F6: 117,
								F7: 118, F8: 119, F9: 120, F10: 121, F11: 122, F12: 123,
							};
							let keyCode = KEY_CODE_MAP[keyValue];
							if (keyCode == null && keyValue.length === 1) {
								keyCode = keyValue.toUpperCase().charCodeAt(0);
							}
							keyCode = keyCode || 0;
							let code = keyValue;
							if (keyValue.length === 1) {
								const ch = keyValue.toUpperCase();
								if (ch >= 'A' && ch <= 'Z') code = 'Key' + ch;
								else if (ch >= '0' && ch <= '9') code = 'Digit' + ch;
							}
							const opts = {
								key: keyValue,
								code,
								keyCode,
								which: keyCode,
								bubbles: true,
								cancelable: true,
								ctrlKey: !!mergedConfig.modCtrl,
								shiftKey: !!mergedConfig.modShift,
								altKey: !!mergedConfig.modAlt,
								metaKey: !!mergedConfig.modMeta,
							};
							const target = document.activeElement || document.body;
							target.dispatchEvent(new KeyboardEvent('keydown', opts));
							target.dispatchEvent(new KeyboardEvent('keyup', opts));
						}
						break;
					}
				}
			} else {
				const msg_obj = { action };
				if (useActiveTab) msg_obj.useActiveTab = true;
				if (action === 'openCustomUrl') {
					msg_obj.customUrl = mergedConfig.customUrl || '';
					msg_obj.position = mergedConfig.position || 'last';
				} else if (action === 'closeTab') {
					msg_obj.keepWindow = !!mergedConfig.keepWindow;
					msg_obj.afterClose = mergedConfig.afterClose || 'default';
					msg_obj.skipPinned = !!mergedConfig.skipPinned;
				} else if (action === 'closeOtherTabs' || action === 'closeLeftTabs' || action === 'closeRightTabs' || action === 'closeAllTabs') {
					msg_obj.skipPinned = !!mergedConfig.skipPinned;
				} else if (action === 'switchLeftTab' || action === 'switchRightTab') {
					msg_obj.noWrap = !!mergedConfig.noWrap;
					msg_obj.moveTab = !!mergedConfig.moveTab;
				} else if (action === 'switchFirstTab' || action === 'switchLastTab') {
					msg_obj.moveTab = !!mergedConfig.moveTab;
				} else if (action === 'refresh' || action === 'refreshAllTabs') {
					msg_obj.hardReload = !!mergedConfig.hardReload;
				} else if (action === 'newTab') {
					msg_obj.position = mergedConfig.position || 'last';
				} else if (action === 'actionChain') {
					const chainId = mergedConfig.chainId;
					const chain = SETTINGS.actionChains?.[chainId];
					if (chain?.steps?.length) {
						msg_obj.steps = chain.steps
							.filter(s => s.action && s.action !== 'none' && s.action !== 'actionChain')
							.map(s => ({ ...(ACTION_DEFAULTS[s.action] || {}), ...s }));
					}
				}
				return await safeSendMessage(msg_obj);
			}
			return true;
		}

		function executeGesture(pattern) {
			const action = getGestureAction(pattern);
			if (!action || action === 'none') return;


			const config = SETTINGS.enableGestureCustomization
				? (SETTINGS.mouseGestures?.[pattern] || {})
				: {};
			executeAction(action, config, recognizer.startX, recognizer.startY);
		}

		function resolveTabTarget(config, state) {
			const { SEARCH_ENGINES, IMAGE_SEARCH_ENGINES } = window.GestureConstants;
			const { selectedText: content, dragType, parentLink } = state;
			const engine = config.engine || 'google';
			const customUrl = config.url || '';

			switch (config.action) {
				case 'search': {
					if (config.autoDetectUrl === true && dragType === 'text') {
						const url = tryParseAsUrl(content, false);
						if (url) return { url };
					}
					if (engine === 'system') return { query: content };
					if (engine === 'custom' && customUrl) return { url: customUrl.replace('%s', encodeURIComponent(content)) };
					return { url: (SEARCH_ENGINES[engine] || SEARCH_ENGINES['google']).url + encodeURIComponent(content) };
				}
				case 'openTab':
					return { url: (dragType === 'image' && config.preferLink === true && parentLink) ? parentLink : content };
				case 'imageSearch': {
					if (engine === 'custom' && customUrl) return { url: customUrl.replace('%s', encodeURIComponent(content)) };
					return { url: (IMAGE_SEARCH_ENGINES[engine] || IMAGE_SEARCH_ENGINES['google']).url + encodeURIComponent(content) };
				}
				default:
					return null;
			}
		}

		const COPY_ACTION_RESOLVERS = {
			'copy':         (state) => state.selectedText,
			'copyLink':     (state) => state.selectedText,
			'copyLinkText': (state) => state.dragElement ? (state.dragElement.innerText || state.dragElement.textContent || '') : null,
			'copyImageUrl': (state) => state.selectedText,
		};

		async function executeDragGesture(state, pattern, dataTransfer) {
			if (!pattern) return;

			const gestures = getGesturesForDragType(state.dragType);
			if (!gestures) return;

			let configs = getDragGestureConfigs(gestures, pattern);

			const copyTexts = [];
			configs = configs.filter(config => {
				const resolver = COPY_ACTION_RESOLVERS[config.action || 'none'];
				if (!resolver) return true;
				const text = resolver(state);
				if (text) copyTexts.push(text);
				return false;
			});
			if (copyTexts.length > 0) {
				copyText(copyTexts.join('\n'));
			}

			if (!isIncognito) {
				const incognitoUrls = [];
				const incognitoQueries = [];
				configs = configs.filter(config => {
					if (!config.incognito) return true;
					const target = resolveTabTarget(config, state);
					if (target?.url) incognitoUrls.push(target.url);
					else if (target?.query) incognitoQueries.push(target.query);
					return !target; 
				});
				if (incognitoUrls.length > 0 || incognitoQueries.length > 0) {
					await safeSendMessage({ action: 'openIncognitoTabs', urls: incognitoUrls, queries: incognitoQueries });
				}
			}

			for (const config of configs) {
				await executeSingleDragAction(config, state, dataTransfer);
			}
		}

		async function executeSingleDragAction(config, state, dataTransfer) {
			const { selectedText: content, dragType, parentLink, dragElement } = state;
			const action = config.action || 'none';
			if (action === 'none') return;

			const position = config.position || 'right';
			const active = config.active !== false;
			const incognito = config.incognito === true;

			switch (action) {
				case 'search':
				case 'openTab': {
					const target = resolveTabTarget(config, state);
					if (target?.query) {
						await safeSendMessage({ action: 'systemSearch', query: target.query, position, active, incognito });
					} else if (target?.url) {
						await safeSendMessage({ action: 'openTabAtPosition', url: target.url, position, active, incognito });
					}
					break;
				}

				case 'saveImage':
					if (content.startsWith('data:')) {
						safeSendMessage({ action: 'saveImage', url: content });
						break;
					}

					if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
						const file = dataTransfer.files[0];
						const reader = new FileReader();
						reader.onload = () => {
							safeSendMessage({ 
								action: 'saveImage', 
								url: reader.result,
								filename: file.name
							});
						};
						reader.readAsDataURL(file);
						break;
					}

					{
						const waitForImageLoad = (img, timeout = 60000) => {
							return new Promise((resolve, reject) => {
								if (!img || img.tagName !== 'IMG' || img.complete) {
									resolve();
									return;
								}

								let settled = false;
								const cleanup = () => {
									img.removeEventListener('load', onLoad);
									img.removeEventListener('error', onError);
								};
								const onLoad = () => {
									if (settled) return;
									settled = true;
									cleanup();
									resolve();
								};
								const onError = () => {
									if (settled) return;
									settled = true;
									cleanup();
									reject(new Error('load'));
								};

								img.addEventListener('load', onLoad);
								img.addEventListener('error', onError);

								setTimeout(() => {
									if (settled) return;
									settled = true;
									cleanup();
									reject(new Error('timeout'));
								}, timeout);
							});
						};

						waitForImageLoad(dragElement)
							.then(() => {
								safeSendMessage({ 
									action: 'saveImage', 
									url: content,
									origin: window.location.origin
								});
							})
							.catch((err) => {
								const toastMsg = err.message === 'timeout'
									? msg('saveImageTimeout')
									: msg('saveImageLoadError');
								visualizer.showToast(toastMsg, 5000);
							});
					}
					break;

				case 'imageSearch': {
					const target = resolveTabTarget(config, state);
					if (target?.url) {
						await safeSendMessage({ action: 'openTabAtPosition', url: target.url, position, active, incognito });
					}
					break;
				}
			}
		}
	}
})();