(function () {
	'use strict';

	let i18nMessages = null;
	let currentLanguage = null;

	function msg(key, defaultText) {
		if (i18nMessages && i18nMessages[key]) {
			return i18nMessages[key].message;
		}
		if (typeof key !== 'string') {
			return defaultText
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

	class EventManager {
		constructor() {
			this._bindings = [];
			this._onUpdateCallbacks = [];
			this._onReattachCallbacks = [];
		}

		add(condition, target, event, handler, options) {
			if (condition !== null && typeof condition !== 'function') {
				throw new TypeError('EventManager.add: condition must be null or a function');
			}
			if (typeof handler !== 'function') {
				throw new TypeError('EventManager.add: handler must be a function');
			}
			const safeHandler = (e) => {
				if (!e.isTrusted) return;
				handler(e);
			};
			this._bindings.push({ target, event, handler: safeHandler, options, condition, active: false });
			return this;
		}

		onUpdate(fn) {
			this._onUpdateCallbacks.push(fn);
			return this;
		}

		onReattach(fn) {
			this._onReattachCallbacks.push(fn);
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

		reattach() {
			for (const b of this._bindings) {
				if (b.active) {
					b.target.addEventListener(b.event, b.handler, b.options);
				}
			}
			for (const fn of this._onReattachCallbacks) fn();
		}
	}

	window.EventManager = EventManager;
})();


(function () {
	'use strict';


	function getRoot() {
		return document.scrollingElement || window;
	}

	const SCROLL_ACTIONS = {
		scrollUp: { axis: 'y', dir: -1 },
		scrollDown: { axis: 'y', dir: 1 },
		scrollLeft: { axis: 'x', dir: -1 },
		scrollRight: { axis: 'x', dir: 1 },
		scrollToTop: { axis: 'y', dir: -1, toEdge: true },
		scrollToBottom: { axis: 'y', dir: 1, toEdge: true },
		scrollToLeftEdge: { axis: 'x', dir: -1, toEdge: true },
		scrollToRightEdge: { axis: 'x', dir: 1, toEdge: true },
	};

	const AXES = {
		x: { pos: 'scrollLeft', size: 'clientWidth', scrollSize: 'scrollWidth', windowPos: 'scrollX', windowSize: 'innerWidth', overflow: 'overflowX', to: 'left' },
		y: { pos: 'scrollTop', size: 'clientHeight', scrollSize: 'scrollHeight', windowPos: 'scrollY', windowSize: 'innerHeight', overflow: 'overflowY', to: 'top' },
	};

	function getScrollMetrics(target, axis) {
		const ax = AXES[axis];
		if (target !== window) {
			return {
				pos: target[ax.pos],
				size: target[ax.size],
				scrollSize: target[ax.scrollSize],
			};
		}

		return {
			pos: window[ax.windowPos],
			size: window[ax.windowSize],
			scrollSize: Math.max(
				document.documentElement?.[ax.scrollSize] ?? 0,
				document.body?.[ax.scrollSize] ?? 0,
			),
		};
	}

	function hasScrollRoom(el, action) {
		const { axis, dir } = SCROLL_ACTIONS[action];
		const { pos, size, scrollSize } = getScrollMetrics(el, axis);
		const max = Math.max(0, scrollSize - size);
		if (max <= 1) return false;
		return dir < 0 ? pos > 1 : pos < max - 1;
	}

	function deepElementFromPoint(x, y) {
		let el = document.elementFromPoint(x, y);
		while (el && el.shadowRoot) {
			const inner = el.shadowRoot.elementFromPoint(x, y);
			if (!inner || inner === el) break;
			el = inner;
		}
		return el;
	}

	function parentAcrossShadow(el) {
		if (el.parentElement) return el.parentElement;
		const r = el.getRootNode();
		return (r instanceof ShadowRoot) ? r.host : null;
	}

	function getScrollTarget(action, forceTargetWindow = false, cursorX, cursorY) {
		const root = getRoot();
		if (forceTargetWindow) return root;

		if (cursorX != null && cursorY != null) {
			const overflowProp = AXES[SCROLL_ACTIONS[action].axis].overflow;
			let el = deepElementFromPoint(cursorX, cursorY);
			while (el && el !== root && el !== document.body) {
				const o = window.getComputedStyle(el)[overflowProp];
				if ((o === 'auto' || o === 'scroll') && hasScrollRoom(el, action)) {
					return el;
				}
				el = parentAcrossShadow(el);
			}
		}
		return root;
	}

	function checkScrollFeasibility(action, cursorX, cursorY) {
		if (!SCROLL_ACTIONS[action]) throw new Error(`Not a scroll action: ${action}`);
		return hasScrollRoom(getScrollTarget(action, false, cursorX, cursorY), action);
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
		window.addEventListener('wheel', cancelEaseScroll, { capture: true, passive: true });
	}

	function stopScrollListeners() {
		window.removeEventListener('wheel', cancelEaseScroll, { capture: true });
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

	function easeScrollTo(target, axis, goal, unclampedGoal, baseDuration = 500) {
		scrollActiveTarget = target;

		const ax = AXES[axis];
		const { pos: start } = getScrollMetrics(target, axis);
		if (start === goal) {
			scrollActiveTarget = null;
			return;
		}

		const delta = goal - start;
		const startTime = performance.now();

		const realDist = Math.abs(delta);
		const unclampedDist = Math.abs(unclampedGoal - start);
		let duration = baseDuration;
		if (unclampedDist > 0 && realDist < unclampedDist) {
			duration = Math.max(16, duration * (realDist / unclampedDist));
		}

		startScrollListeners();

		function step(now) {
			const elapsed = now - startTime;
			if (elapsed >= duration) {
				target.scrollTo({ [ax.to]: goal, behavior: 'instant' });
				scrollRafId = null;
				scrollActiveTarget = null;
				scrollGoals.delete(target);
				stopScrollListeners();
				return;
			}
			const ease = 1 - Math.pow(1 - elapsed / duration, 3);
			target.scrollTo({ [ax.to]: start + delta * ease, behavior: 'instant' });
			scrollRafId = requestAnimationFrame(step);
		}

		scrollRafId = requestAnimationFrame(step);
	}

	function handleScroll(action, scrollConfig, forceTargetWindow = false, cursorX, cursorY) {
		const meta = SCROLL_ACTIONS[action];
		if (!meta) return false;
		const ax = AXES[meta.axis];
		const target = getScrollTarget(action, forceTargetWindow, cursorX, cursorY);
		const smoothness = resolveScrollSmoothness(scrollConfig.scrollSmoothness);

		const { pos: cur, size, scrollSize } = getScrollMetrics(target, meta.axis);
		const max = Math.max(0, scrollSize - size);

		let goal, unclampedGoal;
		if (meta.toEdge) {
			goal = unclampedGoal = meta.dir < 0 ? 0 : max;
		} else {
			let delta = size * (scrollConfig.scrollDistance / 100) * meta.dir;

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

			unclampedGoal = (scrollGoals.get(target)?.[meta.axis] ?? cur) + delta;
			goal = Math.max(0, Math.min(unclampedGoal, max));
		}

		cancelEaseScroll();

		if (Math.abs(cur - goal) <= 1) return false;

		scrollGoals.set(target, { [meta.axis]: goal });

		if (smoothness === 'none') {
			scrollGoals.delete(target);
			target.scrollTo({ [ax.to]: goal, behavior: 'instant' });
		} else if (smoothness === 'system') {
			target.scrollTo({ [ax.to]: goal, behavior: 'smooth' });
			const version = ++scrollVersion;
			const eventTarget = target === getRoot() ? document : target;
			eventTarget.addEventListener('scrollend', () => {
				if (scrollVersion === version) {
					scrollGoals.delete(target);
				}
			}, { once: true });
		} else {
			easeScrollTo(target, meta.axis, goal, unclampedGoal, scrollConfig.scrollDuration ?? 500);
		}
		return true;
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


	function isNavigableUrl(href) {
		try {
			const p = new URL(href).protocol;
			return p !== 'javascript:' && p !== 'data:' && p !== 'blob:';
		} catch { return false; }
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

	window.FlowMouseUtils = {
		handleScroll,
		checkScrollFeasibility,
		copyText,
		isNavigableUrl,
		tryParseAsUrl,
	};
})();


class ContentContextMenu {
	#settings = {
		lang: '',
		isRtl: false,
		customCss: '',
		wheelThreshold: 0,
	};

	#activeMenuClose = null;
	#activeMenuId = null;
	#activeItems = null;
	#wheel = null;

	updateSettings(s) {
		this.#settings = { ...this.#settings, ...s };
	}

	generateStyles() {
		return `
			.fm-ctx-frame {
				transform: scale(var(--fm-ui-scale));
				transform-origin: top left;
				transition: opacity 0.12s cubic-bezier(.4,0,.2,1);
				box-shadow: 0 2px 12px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.12);
				border-radius: 8px;
				backdrop-filter: blur(8px);
				background: rgba(255, 255, 255, 0.92);
			}

			/* Opened by a wheel gesture: show faster */
			.fm-ctx-frame--wheel {
				transition: none;
			}

			@supports (corner-shape: superellipse(1.4)) {
				.fm-ctx-frame {
					corner-shape: superellipse(1.4);
					border-radius: calc(8px * 1.4);
				}
			}

			@media (prefers-color-scheme: dark) {
				.fm-ctx-frame {
					background: rgba(30, 30, 32, 0.95);
				}
			}
		`;
	}

	prepare(x, y, options) {
		this.close();

		const menuId = Math.random().toString(36).slice(2) + Date.now().toString(36);
		this.#activeMenuId = menuId;
		this.#activeItems = null;

		try {
			chrome.runtime.sendMessage({ action: 'ctxMenuPrepare', menuId });
		} catch { return () => {}; }

		return this.#createMenuIframe(x, y, menuId, options);
	}

	setItems(items) {
		if (!this.#activeMenuId) return;
		this.#activeItems = items;

		const serializedItems = items.map(item => {
			if (item === 'separator') return 'separator';
			return { label: item.label, icon: item.icon, active: item.active, time: item.time };
		});

		try {
			chrome.runtime.sendMessage({
				action: 'ctxMenuSetItems',
				menuId: this.#activeMenuId,
				items: serializedItems,
			});
		} catch {}
	}

	#createMenuIframe(x, y, menuId, options) {
		const host = new ShadowHost({ useDialog: true });
		const topLayer = (document.fullscreenElement || document.querySelector(':modal')) ? 'modal' : 'popover';
		if (!host.init(this.#settings.lang, this.#settings.isRtl, {
			topLayer,
			builtInCss: this.generateStyles(),
			customCss: this.#settings.customCss,
		})) {
			return () => {};
		}

		const iframe = host.createElement('iframe');
		iframe.className = 'fm-ctx-frame';
		if (window.crossOriginIsolated) iframe.credentialless = true;
		iframe.style.cssText = `
			position: fixed;
			border: 0;
			opacity: 0;
			pointer-events: none;
			overflow: hidden;
		`;

		const url = new URL(chrome.runtime.getURL('pages/context-menu.html'));
		url.searchParams.set('id', menuId);
		url.searchParams.set('dir', this.#settings.isRtl ? 'rtl' : 'ltr');
		if (this.#settings.lang) url.searchParams.set('lang', this.#settings.lang);
		if (options?.scrollToBottom) url.searchParams.set('bottom', '1');
		const wheelDir = options?.wheelDir;
		if (wheelDir != null) {
			url.searchParams.set('wheel', String(Math.sign(wheelDir)));
			url.searchParams.set('wt', String(this.#settings.wheelThreshold));
			url.searchParams.set('zoom', String(window.FlowMouseZoom.tabZoom));
			iframe.classList.add('fm-ctx-frame--wheel');
		}

		iframe.src = url.href;

		host.shadow.appendChild(iframe);
		if (wheelDir != null) {
			const origin = new URL(chrome.runtime.getURL('')).origin;
			this.#wheel = { ready: false, delta: 0, activate: false, target: iframe.contentWindow, origin };
		}

		const onMessage = (request) => {
			if (request.menuId !== menuId) return;

			if (request.action === 'ctxMenuDimensions') {
				const { width, height } = request;
				const uiScale = window.FlowMouseZoom.uiScale;
				const anchorX = x / uiScale;
				const anchorY = y / uiScale;
				const vw = document.documentElement.clientWidth / uiScale;
				const vh = document.documentElement.clientHeight / uiScale;
				const pad = 6;

				const maxW = Math.max(0, vw - pad * 2);
				const maxH = Math.max(0, vh - pad * 2);
				const clampedW = Math.min(width, maxW);
				const clampedH = Math.min(height, maxH);

				let left = anchorX;
				if (left + clampedW + pad > vw) {
					left = (anchorX - clampedW >= pad) ? anchorX - clampedW - 1 : vw - clampedW - pad;
				} else {
					left += 1;
				}
				if (left + clampedW + pad > vw) left = vw - clampedW - pad;
				if (left < pad) left = pad;

				let top = anchorY;
				if (top + clampedH + pad > vh) {
					top = (anchorY - clampedH >= pad) ? anchorY - clampedH : vh - clampedH - pad;
				}
				if (top + clampedH + pad > vh) top = vh - clampedH - pad;
				if (top < pad) top = pad;

				iframe.style.setProperty('width', Math.round(clampedW) + 'px', 'important');
				iframe.style.setProperty('height', Math.round(clampedH) + 'px', 'important');
				iframe.style.setProperty('left', Math.round(left * uiScale) + 'px', 'important');
				iframe.style.setProperty('top', Math.round(top * uiScale) + 'px', 'important');
				iframe.style.setProperty('opacity', '1', 'important');
				iframe.style.setProperty('pointer-events', 'auto', 'important');
				if (this.#wheel) {
					this.#wheel.ready = true;
					this.#flushWheel();
				}
			}

			if (request.action === 'ctxMenuSelect') {
				const item = this.#activeItems?.[request.index];
				closeMenu();
				if (item && typeof item.onClick === 'function') item.onClick();
			}

			if (request.action === 'ctxMenuClose') {
				closeMenu();
			}
		};

		try { chrome.runtime.onMessage.addListener(onMessage); } catch {}

		let closed = false;
		const closeMenu = () => {
			if (closed) return;
			closed = true;
			this.#activeMenuClose = null;
			this.#activeMenuId = null;
			this.#activeItems = null;
			this.#wheel = null;
			try { chrome.runtime.onMessage.removeListener(onMessage); } catch {}
			try { chrome.runtime.sendMessage({ action: 'ctxMenuCleanup', menuId }); } catch {}
			host.cleanup();
		};

		this.#activeMenuClose = closeMenu;
		return closeMenu;
	}

	get isOpen() {
		return this.#activeMenuClose !== null;
	}

	get isWheelNav() {
		return this.#wheel !== null;
	}

	wheelNavigate(delta) {
		if (!this.#wheel) return;
		this.#wheel.delta += delta;
		this.#flushWheel();
	}

	wheelActivate() {
		if (!this.#wheel) return;
		this.#wheel.activate = true;
		this.#flushWheel();
	}

	#flushWheel() {
		const w = this.#wheel;
		if (!w?.ready || (!w.delta && !w.activate)) return;
		try {
			w.target.postMessage({ type: 'fm-ctx-wheel', menuId: this.#activeMenuId, delta: w.delta, activate: w.activate }, w.origin);
		} catch {}
		w.delta = 0;
		if (w.activate) this.#wheel = null;
	}

	close() {
		if (this.#activeMenuClose) {
			this.#activeMenuClose();
			this.#activeMenuClose = null;
		}
	}
}

window.ContentContextMenu = ContentContextMenu;

(function () {
	'use strict';

	const isFirefox = false;

	const STATES = { INACTIVE: 0, WAITING: 1, SELECTING: 2 };
	const CLICK_THRESHOLD = 2;
	const AUTO_SCROLL_ZONE = 5;
	const AUTO_SCROLL_SPEED = 8;
	const HIGHLIGHT_OUTLINE = '2px auto #FFB800EE';
	const HIGHLIGHT_BG = 'rgba(255, 184, 0, 0.15)';
	const HOVER_OUTLINE = '2px auto #FFB80044';
	const HOVER_BG = 'rgba(255, 184, 0, 0.08)';
	const HOVER_DESELECT_OUTLINE = '2px auto #FFB800FF';
	const HOVER_DESELECT_BG = 'rgba(255, 184, 0, 0.15)';
	const TEXT_LINK_SELECTED_BG = 'rgba(255, 184, 0, 0.30)';
	const TEXT_LINK_HOVER_BG = 'rgba(255, 184, 0, 0.15)';

	const TEXT_URL_RE = /https?:\/\/(?:[^\s()<>]+|\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»""''])/g;

	const EXCLUDED_TEXT_TAGS = { A: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, SVG: 1 };

	function isInExcludedTag(textNode) {
		let el = textNode.parentElement;
		while (el) {
			if (el.tagName in EXCLUDED_TEXT_TAGS) return true;
			el = el.parentElement;
		}
		return false;
	}

	const isNavigableUrl = window.FlowMouseUtils.isNavigableUrl;

	function isInFixedOrSticky(el) {
		let node = el;
		while (node && node !== document.documentElement) {
			const pos = getComputedStyle(node).position;
			if (pos === 'fixed' || pos === 'sticky') return true;
			node = node.parentElement;
		}
		return false;
	}

	class LinkStyler {
		#originals = new Map();
		#hasBgCache = new Map();

		#save(el) {
			if (!this.#originals.has(el)) {
				this.#originals.set(el, {
					outline: el.style.getPropertyValue('outline'),
					outlinePriority: el.style.getPropertyPriority('outline'),
					bg: el.style.getPropertyValue('background-color'),
					bgPriority: el.style.getPropertyPriority('background-color'),
				});
				const bg = getComputedStyle(el).backgroundColor;
				this.#hasBgCache.set(el, !!(bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)'));
			}
		}

		#hasBg(el) {
			return this.#hasBgCache.get(el) || false;
		}

		#apply(el, outline, bg) {
			el.style.setProperty('outline', outline, 'important');
			if (!this.#hasBg(el)) el.style.setProperty('background-color', bg, 'important');
		}

		#restore(el, orig) {
			if (orig.outline) el.style.setProperty('outline', orig.outline, orig.outlinePriority);
			else el.style.removeProperty('outline');
			if (orig.bg) el.style.setProperty('background-color', orig.bg, orig.bgPriority);
			else el.style.removeProperty('background-color');
		}

		highlight(el) {
			this.#save(el);
			this.#apply(el, HIGHLIGHT_OUTLINE, HIGHLIGHT_BG);
		}

		unhighlight(el) {
			const orig = this.#originals.get(el);
			if (orig) {
				this.#restore(el, orig);
			} else {
				el.style.removeProperty('outline');
				el.style.removeProperty('background-color');
			}
		}

		forget(el) {
			this.#originals.delete(el);
			this.#hasBgCache.delete(el);
		}

		hoverHighlight(el) {
			this.#save(el);
			this.#apply(el, HOVER_OUTLINE, HOVER_BG);
		}

		hoverDeselect(el) {
			this.#apply(el, HOVER_DESELECT_OUTLINE, HOVER_DESELECT_BG);
		}

		cleanup() {
			for (const [el, orig] of this.#originals) {
				this.#restore(el, orig);
			}
			this.#originals.clear();
			this.#hasBgCache.clear();
		}
	}

	class TextLinkStyler {
		#highlight = null;
		#hoverHighlight = null;
		#styleEl = null;
		#initialized = false;

		#init() {
			if (this.#initialized) return;
			if (typeof Highlight === 'undefined' || !CSS.highlights) return;
			this.#initialized = true;

			this.#styleEl = document instanceof XMLDocument
				? document.createElementNS('http://www.w3.org/1999/xhtml', 'style')
				: document.createElement('style');
			this.#styleEl.textContent =
				`::highlight(fm-as-text-selected) { background-color: ${TEXT_LINK_SELECTED_BG}; color: inherit; }\n` +
				`::highlight(fm-as-text-hover) { background-color: ${TEXT_LINK_HOVER_BG}; color: inherit; }`;
			document.documentElement.appendChild(this.#styleEl);

			this.#highlight = new Highlight();
			this.#hoverHighlight = new Highlight();
			CSS.highlights.set('fm-as-text-selected', this.#highlight);
			CSS.highlights.set('fm-as-text-hover', this.#hoverHighlight);
		}

		get supported() { return typeof Highlight !== 'undefined' && !!CSS.highlights; }

		show(item) {
			this.#init();
			this.#highlight?.add(item.range);
		}

		hide(item) {
			this.#highlight?.delete(item.range);
		}

		showHover(item) {
			this.#init();
			this.#hoverHighlight?.add(item.range);
		}

		hideHover(item) {
			this.#hoverHighlight?.delete(item.range);
		}

		cleanup() {
			if (this.#highlight) this.#highlight.clear();
			if (this.#hoverHighlight) this.#hoverHighlight.clear();
			CSS.highlights?.delete('fm-as-text-selected');
			CSS.highlights?.delete('fm-as-text-hover');
			this.#highlight = null;
			this.#hoverHighlight = null;
			if (this.#styleEl) {
				this.#styleEl.remove();
				this.#styleEl = null;
			}
			this.#initialized = false;
		}
	}

	class LinkHighlighter {
		#elementStyler = new LinkStyler();
		#textStyler = new TextLinkStyler();
		#selected = new Set();
		#preview = new Set();
		#cache = null;
		#cacheTime = 0;
		#skipFixed = false;
		#textLinks = true;
		#textItemRegistry = new WeakMap();
		#anchorMap = new Map();
		onFirstPreviewHit = null;

		set skipFixed(v) { this.#skipFixed = v; this.#cache = null; }

		set textLinks(v) { this.#textLinks = v; this.#cache = null; }

		get count() { return this.#selected.size; }

		get urls() {
			const s = new Set();
			for (const item of this.#selected) s.add(item.url);
			return Array.from(s);
		}

		get effectiveUrls() {
			if (this.#preview.size === 0) return this.urls;
			const s = new Set();
			for (const item of this.#selected) {
				if (!this.#preview.has(item)) s.add(item.url);
			}
			for (const item of this.#preview) {
				if (!this.#selected.has(item)) s.add(item.url);
			}
			return Array.from(s);
		}

		get links() {
			return Array.from(this.#selected).map(item => ({ url: item.url, text: item.text }));
		}


		itemAtPoint(x, y) {
			const pointRect = { left: x, top: y, right: x, bottom: y };
			const items = this.#getItems();
			for (let i = items.length - 1; i >= 0; i--) {
				if (this.#inRect(items[i], pointRect)) return items[i];
			}
			return null;
		}


		updatePreview(viewportRect) {
			const items = this.#getItems();
			const next = new Set();

			for (const item of items) {
				if (this.#inRect(item, viewportRect)) next.add(item);
			}

			for (const item of this.#preview) {
				if (!next.has(item)) this.#unpreview(item);
			}
			for (const item of next) {
				if (!this.#preview.has(item)) this.#previewItem(item);
			}
			if (this.#preview.size === 0 && next.size > 0 && this.onFirstPreviewHit) {
				this.onFirstPreviewHit(next.values().next().value);
			}
			this.#preview = next;
		}

		clearPreview() {
			for (const item of this.#preview) this.#unpreview(item);
			this.#preview.clear();
		}


		commitRect(viewportRect) {
			this.clearPreview();

			const items = this.#getItems();
			let changed = false;
			for (const item of items) {
				if (!this.#inRect(item, viewportRect)) continue;
				changed = true;
				if (this.#selected.has(item)) {
					this.#unhighlightItem(item);
					this.#selected.delete(item);
				} else {
					this.#selected.add(item);
					this.#highlightItem(item);
				}
			}
			return changed;
		}

		cleanup() {
			this.#preview.clear();
			this.#selected.clear();
			this.#elementStyler.cleanup();
			this.#textStyler.cleanup();
			this.#cache = null;
			this.#anchorMap.clear();
		}

		invalidateCache() { this.#cache = null; }

		isSelected(item) { return this.#selected.has(item); }

		hoverItem(item) {
			if (item.type === 'anchor') {
				if (this.#selected.has(item)) {
					this.#elementStyler.hoverDeselect(item.el);
				} else {
					this.#elementStyler.hoverHighlight(item.el);
				}
			} else if (item.type === 'textLink') {
				this.#textStyler.showHover(item);
			}
		}

		unhoverItem(item) {
			if (item.type === 'anchor') {
				if (this.#selected.has(item)) {
					this.#elementStyler.highlight(item.el);
				} else {
					this.#elementStyler.unhighlight(item.el);
					this.#elementStyler.forget(item.el);
				}
			} else if (item.type === 'textLink') {
				this.#textStyler.hideHover(item);
			}
		}


		#showItem(item) {
			if (item.type === 'anchor') this.#elementStyler.highlight(item.el);
			else if (item.type === 'textLink') this.#textStyler.show(item);
		}

		#hideItem(item) {
			if (item.type === 'anchor') this.#elementStyler.unhighlight(item.el);
			else if (item.type === 'textLink') this.#textStyler.hide(item);
		}

		#highlightItem(item) { this.#showItem(item); }

		#unhighlightItem(item) {
			this.#hideItem(item);
			if (item.type === 'anchor' && !this.#selected.has(item)) this.#elementStyler.forget(item.el);
		}

		#previewItem(item) {
			if (this.#selected.has(item)) this.#hideItem(item);
			else this.#showItem(item);
		}

		#unpreview(item) {
			if (this.#selected.has(item)) this.#showItem(item);
			else this.#hideItem(item);
		}


		#inRect(item, r) {
			const target = item.type === 'anchor' ? item.el : item.range;
			const rects = target.getClientRects();
			let hit = false;
			for (const b of rects) {
				if (b.width === 0 || b.height === 0) continue;
				if (!(b.right < r.left || b.left > r.right || b.bottom < r.top || b.top > r.bottom)) { hit = true; break; }
			}
			if (!hit) return false;
			return this.#clipAncestorsOverlap(item, r);
		}

		#clipAncestorsOverlap(item, r) {
			const el = item.type === 'anchor' ? item.el : item.range.startContainer.parentElement;
			let node = el?.parentElement;
			while (node && node !== document.documentElement && node !== document.body) {
				const style = getComputedStyle(node);
				if (this.#isClipOverflow(style.overflowX) || this.#isClipOverflow(style.overflowY)) {
					const nb = node.getBoundingClientRect();
					if (nb.right < r.left || nb.left > r.right || nb.bottom < r.top || nb.top > r.bottom) return false;
				}
				node = node.parentElement;
			}
			return true;
		}

		#isClipOverflow(v) { return v === 'hidden' || v === 'scroll' || v === 'auto' || v === 'clip'; }


		#getItems() {
			const now = performance.now();
			if (this.#cache && now - this.#cacheTime < 500) return this.#cache;

			const anchors = [];
			const textHits = [];
			this.#collect(document, anchors, textHits);

			const items = [];

			const nextAnchorMap = new Map();
			for (const el of anchors) {
				if (!el.href || !isNavigableUrl(el.href)) continue;
				if (!el.checkVisibility()) continue;
				if (this.#skipFixed && isInFixedOrSticky(el)) continue;
				let item = this.#anchorMap.get(el);
				if (!item) {
					item = {
						type: 'anchor',
						el,
						url: el.href,
						text: (el.innerText || el.textContent || '').trim().slice(0, 200),
					};
				} else {
					item.url = el.href;
				}
				items.push(item);
				nextAnchorMap.set(el, item);
			}
			this.#anchorMap = nextAnchorMap;

			if (this.#textLinks && this.#textStyler.supported) {
				for (const hit of textHits) {
					if (!hit.node.parentElement?.checkVisibility()) continue;
					if (this.#skipFixed && isInFixedOrSticky(hit.node.parentElement)) continue;
					const item = this.#ensureTextItem(hit.node, hit.offset, hit.url);
					items.push(item);
				}
			}

			this.#cache = items;
			this.#cacheTime = now;
			return items;
		}

		#ensureTextItem(node, offset, url) {
			let map = this.#textItemRegistry.get(node);
			if (!map) {
				map = new Map();
				this.#textItemRegistry.set(node, map);
			}
			let item = map.get(offset);
			if (item && item.url === url) return item;
			const range = document.createRange();
			range.setStart(node, offset);
			range.setEnd(node, offset + url.length);
			item = { type: 'textLink', range, url, text: url, node, startOffset: offset };
			map.set(offset, item);
			return item;
		}

		#collect(root, anchors, textHits) {
			for (const a of root.querySelectorAll('a[href]')) anchors.push(a);

			const walker = document.createTreeWalker(
				root,
				NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
			);
			let node;
			while ((node = walker.nextNode())) {
				if (node.nodeType === Node.TEXT_NODE) {
					const text = node.textContent;
					if (text.length < 10 || isInExcludedTag(node)) continue;
					TEXT_URL_RE.lastIndex = 0;
					let m;
					while ((m = TEXT_URL_RE.exec(text))) {
						textHits.push({ node, offset: m.index, url: m[0] });
					}
				} else if (node.shadowRoot) {
					this.#collect(node.shadowRoot, anchors, textHits);
				}
			}
		}
	}

	class AreaSelectManager {
		#state = STATES.INACTIVE;
		#host = null;
		#overlay = null;
		#rectEl = null;
		#toolbar = null;
		#modal = null;
		#startX = 0;
		#startY = 0;
		#isIframe = false;
		#warnThreshold = 15;
		#delay = 0;
		#highlighter = null;
		#frameLinks = new Map();
		#autoScrollRAF = null;
		#boundPointerDown = null;
		#boundPointerMove = null;
		#boundPointerUp = null;
		#boundPointerCancel = null;
		#boundKeyDown = null;
		#boundContextMenu = null;
		#boundScroll = null;
		#boundWheel = null;
		#hoveredItem = null;
		#currentRect = null;
		#lastX = 0;
		#lastY = 0;
		#lastPointerId = 0;
		#dragStartedInFixed = false;
		#firstHitIsFixed = false;
		#cursorStyle = null;
		#quickEntry = false;
		#autoAction = 'none';
		#autoDone = false;

		get isActive() { return this.#state !== STATES.INACTIVE; }

		enter(isIframe, warnThreshold, lang, isRtl, initialEvent, options) {
			if (this.#state !== STATES.INACTIVE) return;
			if (document.contentType === 'image/svg+xml') return;
			this.#isIframe = isIframe;
			this.#warnThreshold = warnThreshold ?? 15;
			this.#delay = options?.delay ?? 0;
			this.#autoAction = options?.autoAction ?? 'none';
			this.#autoDone = false;
			this.#quickEntry = !!initialEvent;
			this.#highlighter = new LinkHighlighter();
			if (options?.textUrl === false) this.#highlighter.textLinks = false;
			this.#highlighter.onFirstPreviewHit = (item) => {
				if (!this.#firstHitIsFixed) {
					const el = item.type === 'anchor' ? item.el : item.node?.parentElement;
					if (el) this.#firstHitIsFixed = isInFixedOrSticky(el);
				}
			};

			const needsDialog = !isIframe;
			this.#host = new ShadowHost({ useDialog: needsDialog });
			const topLayer = needsDialog && (document.fullscreenElement || document.querySelector(':modal')) ? 'modal' : 'popover';
			if (!this.#host.init(lang, isRtl, {
				topLayer,
				builtInCss: this.#css(),
				customCss: options?.customCss,
			})) return;

			const shadow = this.#host.shadow;

			if (!isIframe) {
				this.#overlay = this.#host.createElement('div');
				this.#overlay.className = 'fm-as-overlay';
				shadow.appendChild(this.#overlay);

				this.#createToolbar(shadow);
				this.#createModal(shadow);
			}

			this.#rectEl = this.#host.createElement('div');
			this.#rectEl.className = 'fm-as-rect';
			shadow.appendChild(this.#rectEl);

			this.#host.container.style.pointerEvents = 'none';

			this.#state = STATES.WAITING;

			this.#boundPointerDown = (e) => this.#onPointerDown(e);
			this.#boundPointerMove = (e) => this.#onPointerMove(e);
			this.#boundPointerUp = (e) => this.#onPointerUp(e);
			this.#boundPointerCancel = (e) => this.#onPointerCancel(e);
			this.#boundKeyDown = (e) => this.#onKeyDown(e);
			this.#boundContextMenu = (e) => this.#onContextMenu(e);
			this.#boundScroll = (e) => this.#onScroll(e);
			this.#boundWheel = (e) => this.#onWheel(e);

			window.addEventListener('pointerdown', this.#boundPointerDown, true);
			window.addEventListener('pointermove', this.#boundPointerMove, true);
			window.addEventListener('pointerup', this.#boundPointerUp, true);
			window.addEventListener('pointercancel', this.#boundPointerCancel, true);
			window.addEventListener('keydown', this.#boundKeyDown, true);
			window.addEventListener('contextmenu', this.#boundContextMenu, true);
			window.addEventListener('wheel', this.#boundWheel, { capture: true, passive: false });
			window.addEventListener('scroll', this.#boundScroll, true);

			this.#cursorStyle = document instanceof XMLDocument
				? document.createElementNS('http://www.w3.org/1999/xhtml', 'style')
				: document.createElement('style');
			this.#cursorStyle.textContent = '*, *::before, *::after { cursor: crosshair !important; touch-action: none !important; user-select: none !important; }';
			document.documentElement.appendChild(this.#cursorStyle);

			if (initialEvent) {
				this.#onPointerDown(initialEvent);
			}
		}

		exit() {
			if (this.#state === STATES.INACTIVE) return;
			this.#cancelAutoScroll();
			this.#hoveredItem = null;
			this.#quickEntry = false;
			this.#autoDone = false;
			if (this.#highlighter) {
				this.#highlighter.cleanup();
				this.#highlighter = null;
			}
			this.#frameLinks.clear();

			window.removeEventListener('pointerdown', this.#boundPointerDown, true);
			window.removeEventListener('pointermove', this.#boundPointerMove, true);
			window.removeEventListener('pointerup', this.#boundPointerUp, true);
			window.removeEventListener('pointercancel', this.#boundPointerCancel, true);
			window.removeEventListener('keydown', this.#boundKeyDown, true);
			window.removeEventListener('contextmenu', this.#boundContextMenu, true);
			window.removeEventListener('wheel', this.#boundWheel, { capture: true, passive: false });
			window.removeEventListener('scroll', this.#boundScroll, true);

			if (this.#cursorStyle) {
				this.#cursorStyle.remove();
				this.#cursorStyle = null;
			}

			if (this.#host) {
				this.#host.cleanup();
				this.#host = null;
			}
			this.#overlay = null;
			this.#rectEl = null;
			this.#toolbar = null;
			this.#modal = null;
			this.#state = STATES.INACTIVE;
		}

		updateFromFrame(frameId, links) {
			if (this.#isIframe || this.#state === STATES.INACTIVE) return;
			this.#frameLinks.set(frameId, links);
			this.#updateToolbarCount();
			if (this.#state === STATES.WAITING) this.#tryAutoAction();
		}


		#onPointerDown(e) {
			if (!e.isTrusted) return;
			if (e.button !== 0) return;
			if (this.#state !== STATES.WAITING) return;
			if (this.#isToolbarClick(e)) return;

			this.#startX = e.clientX + window.scrollX;
			this.#startY = e.clientY + window.scrollY;

			this.#lastX = e.clientX;
			this.#lastY = e.clientY;
			this.#lastPointerId = e.pointerId;
			this.#state = STATES.SELECTING;
			const startEl = document.elementFromPoint(e.clientX, e.clientY);
			this.#dragStartedInFixed = !!(startEl && isInFixedOrSticky(startEl));
			this.#firstHitIsFixed = false;
			this.#highlighter.skipFixed = false;
			this.#highlighter.invalidateCache();

			try { document.documentElement.setPointerCapture(e.pointerId); } catch { }

			e.preventDefault();
			e.stopImmediatePropagation();
		}

		#onPointerMove(e) {
			if (!e.isTrusted) return;
			if (this.#state === STATES.SELECTING) {
				if (this.#hoveredItem) {
					this.#highlighter.unhoverItem(this.#hoveredItem);
					this.#hoveredItem = null;
				}
				this.#lastX = e.clientX;
				this.#lastY = e.clientY;
				this.#updateRect();
				this.#handleAutoScroll(this.#lastX, this.#lastY);
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}

			if (this.#state === STATES.WAITING) {
				const item = this.#findItemAt(e.clientX, e.clientY);
				if (item !== this.#hoveredItem) {
					if (this.#hoveredItem) this.#highlighter.unhoverItem(this.#hoveredItem);
					this.#hoveredItem = item;
					if (item) this.#highlighter.hoverItem(item);
				}
			}
		}

		#onScroll(e) {
			if (!e.isTrusted) return;
			if (this.#state !== STATES.SELECTING) return;
			if (!this.#dragStartedInFixed && !this.#firstHitIsFixed && !this.#highlighter.skipFixed) {
				this.#highlighter.skipFixed = true;
			}
			this.#updateRect();
		}

		#updateRect() {
			const x = this.#lastX;
			const y = this.#lastY;
			const svx = this.#startX - window.scrollX;
			const svy = this.#startY - window.scrollY;

			const left = Math.min(svx, x);
			const top = Math.min(svy, y);
			const width = Math.abs(x - svx);
			const height = Math.abs(y - svy);

			const clickThreshold = CLICK_THRESHOLD / window.FlowMouseZoom.tabZoom;
			if (width > clickThreshold || height > clickThreshold) {
				if (this.#rectEl.style.display !== 'block') {
					this.#rectEl.style.display = 'block';
				}
				this.#rectEl.style.left = left + 'px';
				this.#rectEl.style.top = top + 'px';
				this.#rectEl.style.width = width + 'px';
				this.#rectEl.style.height = height + 'px';
			}

			this.#currentRect = { left, top, right: left + width, bottom: top + height };
			this.#highlighter.updatePreview(this.#currentRect);

			if (!this.#isIframe) this.#updateToolbarCount(true);
		}

		#onPointerUp(e) {
			if (!e.isTrusted) return;
			if (this.#state !== STATES.SELECTING) return;
			this.#cancelAutoScroll();

			try { document.documentElement.releasePointerCapture(e.pointerId); } catch { }
			this.#rectEl.style.display = 'none';

			const svx = this.#startX - window.scrollX;
			const svy = this.#startY - window.scrollY;
			const clickThreshold = CLICK_THRESHOLD / window.FlowMouseZoom.tabZoom;
			const isClick = Math.abs(e.clientX - svx) < clickThreshold
						 && Math.abs(e.clientY - svy) < clickThreshold;

			this.#highlighter.clearPreview();
			const rect = isClick
				? { left: e.clientX, top: e.clientY, right: e.clientX, bottom: e.clientY }
				: this.#currentRect;
			const changed = this.#highlighter.commitRect(rect);

			if (isClick && !changed) {
				this.#state = STATES.WAITING;
				this.#broadcastExit();
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}

			if (this.#quickEntry) {
				this.#quickEntry = false;
				if (this.#highlighter.count === 0) {
					this.#state = STATES.WAITING;
					this.#broadcastExit();
					e.preventDefault();
					e.stopImmediatePropagation();
					return;
				}
			}

			this.#highlighter.invalidateCache();
			if (!this.#isIframe) {
				this.#updateToolbarCount();
				this.#tryAutoAction();
			}
			this.#reportSelection();

			this.#state = STATES.WAITING;
			this.#currentRect = null;
			e.preventDefault();
			e.stopImmediatePropagation();
		}

		#onPointerCancel(e) {
			if (!e.isTrusted) return;
			if (this.#state !== STATES.SELECTING) return;
			this.#abandonCurrentRect();
			e.preventDefault();
			e.stopImmediatePropagation();
		}

		#abandonCurrentRect() {
			this.#cancelAutoScroll();
			try { document.documentElement.releasePointerCapture(this.#lastPointerId); } catch { }
			this.#rectEl.style.display = 'none';
			this.#highlighter.clearPreview();
			this.#currentRect = null;
			this.#state = STATES.WAITING;
			if (!this.#isIframe) this.#updateToolbarCount();
			this.#reportSelection();
		}

		#onKeyDown(e) {
			if (!e.isTrusted) return;
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopImmediatePropagation();
				if (this.#modal && this.#modal.style.display !== 'none') {
					this.#modal.style.display = 'none';
					if (this.#autoAction !== 'none') this.#broadcastExit();
					return;
				}
				if (this.#state === STATES.SELECTING) {
					this.#abandonCurrentRect();
					if (this.#quickEntry) this.#broadcastExit();
					return;
				}
				this.#broadcastExit();
			} else if (e.key === 'Enter' && !this.#isIframe) {
				e.preventDefault();
				e.stopImmediatePropagation();
				this.#onOpenAll();
			}
		}

		#onContextMenu(e) {
			if (!e.isTrusted) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			this.#broadcastExit();
		}

		#onWheel(e) {
			if (!e.isTrusted) return;
			if (this.#state !== STATES.SELECTING) return;
			if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) return;
			e.preventDefault();
			window.scrollBy(0, e.deltaY);
		}

		#isToolbarClick(e) {
			if (!this.#host) return false;
			return e.target === this.#host.container;
		}

		#findItemAt(x, y) {
			return this.#highlighter.itemAtPoint(x, y);
		}


		#handleAutoScroll(x, y) {
			const vh = window.innerHeight;
			const scrollZone = AUTO_SCROLL_ZONE / window.FlowMouseZoom.tabZoom;
			let scrollDy = 0;
			if (y < scrollZone) scrollDy = -AUTO_SCROLL_SPEED;
			else if (y > vh - scrollZone) scrollDy = AUTO_SCROLL_SPEED;

			if (scrollDy !== 0) {
				if (!this.#autoScrollRAF) {
					const doScroll = () => {
						window.scrollBy(0, scrollDy / window.FlowMouseZoom.tabZoom);
						this.#autoScrollRAF = requestAnimationFrame(doScroll);
					};
					this.#autoScrollRAF = requestAnimationFrame(doScroll);
				}
			} else {
				this.#cancelAutoScroll();
			}
		}

		#cancelAutoScroll() {
			if (this.#autoScrollRAF) {
				cancelAnimationFrame(this.#autoScrollRAF);
				this.#autoScrollRAF = null;
			}
		}


		#broadcastExit() {
			try {
				chrome.runtime.sendMessage({ action: 'areaSelectExit' }).catch(() => {});
			} catch { }
		}

		#reportSelection() {
			if (!this.#isIframe) return;
			const links = this.#highlighter ? this.#highlighter.links : [];
			try {
				chrome.runtime.sendMessage({
					action: 'areaSelectUpdate',
					links,
				}).catch(() => {});
			} catch { }
		}


		#createToolbar(shadow) {
			const auto = this.#autoAction !== 'none';
			const toolbar = this.#host.createElement('div');
			toolbar.className = 'fm-as-toolbar';
			toolbar.classList.toggle('hide-cancel', auto && this.#quickEntry);
			this.#host.setHTML(toolbar, `
				<div class="fm-as-toolbar-hint">
					<span class="fm-as-icon idle">${this.#icon('squareDashedMousePointer')}</span>
					${auto ? `<span class="fm-as-icon action">${this.#icon(this.#autoAction === 'open' ? 'externalLink' : 'copy')}</span>` : ''}
					<span data-ref="hintText">${this.#msg('areaSelectHint')}</span>
				</div>
				${auto ? '' : `
				<div class="fm-as-action-group" style="display:none">
					<button class="fm-as-btn fm-as-btn-primary" disabled data-ref="openBtn">
						<span class="fm-as-icon">${this.#icon('externalLink')}</span>
						<span data-ref="openLabel"></span>
					</button>
					<button class="fm-as-btn fm-as-btn-secondary" disabled data-ref="copyBtn">
						<span class="fm-as-icon">${this.#icon('copy')}</span>
						<span>${this.#msg('areaSelectCopy')}</span>
					</button>
				</div>
				`}
				<div class="fm-as-divider"></div>
				<button class="fm-as-btn fm-as-btn-icon" title="${this.#msg('areaSelectCancel')}" data-ref="cancelBtn">${this.#icon('x')}</button>
			`);

			const ref = (name) => toolbar.querySelector(`[data-ref="${name}"]`);
			this.#toolbar = {
				root: toolbar,
				hintLabel: toolbar.querySelector('.fm-as-toolbar-hint'),
				hintText: ref('hintText'),
			};
			if (!auto) {
				const openBtn = ref('openBtn');
				const copyBtn = ref('copyBtn');
				openBtn.addEventListener('click', (e) => { e.stopPropagation(); this.#onOpenAll(); });
				copyBtn.addEventListener('click', (e) => { e.stopPropagation(); this.#onCopyLinks(); });
				this.#toolbar.actionGroup = toolbar.querySelector('.fm-as-action-group');
				this.#toolbar.openBtn = openBtn;
				this.#toolbar.openLabel = ref('openLabel');
				this.#toolbar.copyBtn = copyBtn;
			}
			ref('cancelBtn').addEventListener('click', (e) => { e.stopPropagation(); this.#broadcastExit(); });

			shadow.appendChild(toolbar);
		}

		#createModal(shadow) {
			const modal = this.#host.createElement('div');
			modal.className = 'fm-as-modal-backdrop';
			modal.style.display = 'none';
			modal.style.pointerEvents = 'auto';
			this.#host.setHTML(modal, `
				<div class="fm-as-modal">
					<div class="fm-as-modal-title">
						<span class="fm-as-icon fm-as-icon-warn">${this.#icon('triangleAlert')}</span>
						<span>${this.#msg('areaSelectWarnTitle')}</span>
					</div>
					<div class="fm-as-modal-body" data-ref="body"></div>
					<div class="fm-as-modal-actions">
						<button class="fm-as-btn fm-as-btn-secondary" data-ref="cancelBtn">${this.#msg('areaSelectCancel')}</button>
						<button class="fm-as-btn fm-as-btn-primary" data-ref="confirmBtn">${this.#msg('areaSelectConfirm')}</button>
					</div>
				</div>
			`);

			const ref = (name) => modal.querySelector(`[data-ref="${name}"]`);
			ref('cancelBtn').addEventListener('click', () => {
				modal.style.display = 'none';
				if (this.#autoAction !== 'none') this.#broadcastExit();
			});
			ref('confirmBtn').addEventListener('click', () => {
				modal.style.display = 'none';
				this.#doBatchOpen();
			});

			shadow.appendChild(modal);
			this.#modal = modal;
			this.#modal._body = ref('body');
		}

		#updateToolbarCount(preview = false) {
			if (!this.#toolbar) return;
			const count = this.#getDeduplicatedUrls(preview).length;
			if (this.#autoAction !== 'none') {
				this.#toolbar.root.classList.toggle('auto-action-ready', count > 0);
				this.#toolbar.hintText.textContent = count === 0
					? this.#msg('areaSelectHint')
					: this.#countLabel(this.#autoAction, count);
				return;
			}
			this.#toolbar.openLabel.textContent = this.#countLabel('open', count);
			this.#toolbar.openBtn.disabled = count === 0;
			this.#toolbar.copyBtn.disabled = count === 0;
			if (count === 0) this.#showToolbarHint();
			else this.#showToolbarActions();
		}

		#countLabel(kind, count) {
			const key = kind === 'open'
				? (count === 1 ? 'areaSelectOpenOne' : 'areaSelectOpenCount')
				: (count === 1 ? 'areaSelectCopyOne' : 'areaSelectCopyCount');
			return this.#msg(key).replaceAll('%count%', String(count));
		}

		#showToolbarActions() {
			if (!this.#toolbar || this.#toolbar.actionGroup.style.display !== 'none') return;
			this.#toolbar.hintLabel.style.display = 'none';
			this.#toolbar.actionGroup.style.display = '';
		}

		#showToolbarHint() {
			if (!this.#toolbar) return;
			this.#toolbar.actionGroup.style.display = 'none';
			this.#toolbar.hintLabel.style.display = '';
		}

		#getDeduplicatedUrls(preview = false) {
			const urls = new Set();
			if (this.#highlighter) {
				const src = preview ? this.#highlighter.effectiveUrls : this.#highlighter.urls;
				for (const u of src) urls.add(u);
			}
			for (const links of this.#frameLinks.values()) {
				for (const link of links) urls.add(link.url);
			}
			return Array.from(urls);
		}

		#tryAutoAction() {
			if (this.#autoDone) return;
			switch (this.#autoAction) {
				case 'open': this.#onOpenAll(); return;
				case 'copy': this.#onCopyLinks(); return;
			}
		}

		#onOpenAll() {
			const urls = this.#getDeduplicatedUrls();
			if (urls.length === 0) return;

			if (this.#warnThreshold > 0 && urls.length > this.#warnThreshold) {
				if (this.#modal) {
					this.#modal._body.textContent = this.#msg('areaSelectWarnMessage').replaceAll('%count%', String(urls.length));
					this.#modal.style.display = '';
				}
				return;
			}
			this.#doBatchOpen();
		}

		#doBatchOpen() {
			const urls = this.#getDeduplicatedUrls();
			if (urls.length === 0) return;
			this.#autoDone = true;
			try {
				chrome.runtime.sendMessage({
					action: 'areaSelectBatchOpen',
					urls,
					delay: this.#delay,
				}).catch(() => {});
			} catch { }
			this.#broadcastExit();
		}

		#onCopyLinks() {
			const urls = this.#getDeduplicatedUrls();
			if (urls.length === 0) return;
			this.#autoDone = true;
			window.FlowMouseUtils.copyText(urls.join('\n'));
			this.#broadcastExit();
		}


		#msg(key) {
			return ContentI18n.msg(key);
		}

		#icon(name) {
			const paths = {
				squareDashedMousePointer: '<path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"/><path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h2"/><path d="M14 3h1"/><path d="M3 9v1"/><path d="M21 9v2"/><path d="M3 14v1"/>',
				externalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
				copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
				x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
				triangleAlert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
			};
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
		}


		#css() {
			return `
				:host {
					all: initial;
				}
				.fm-as-overlay {
					position: fixed;
					inset: 0;
					background: rgba(0, 0, 0, 0.1);
					cursor: crosshair;
					z-index: 2147483646;
					pointer-events: none;
				}
				.fm-as-rect {
					position: fixed;
					display: none;
					border: calc(2px * var(--fm-ui-scale)) dashed #4A90D9;
					background: rgba(74, 144, 217, 0.15);
					pointer-events: none;
					z-index: 2147483647;
					box-sizing: border-box;
				}
				.fm-as-toolbar {
					zoom: var(--fm-ui-scale);
					position: fixed;
					bottom: 50px;
					left: 0;
					right: 0;
					margin-inline: auto;
					width: fit-content;
					display: flex;
					align-items: center;
					gap: 1px;
					padding: 4px;
					background: rgba(255, 255, 255, 0.92);
					backdrop-filter: blur(12px);
					border-radius: 10px;
					box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.12);
					z-index: 2147483647;
					cursor: default;
					color: #1d1d1f;
					font-size: 12.5px;
					line-height: 1;
					animation: fm-as-pop-up 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2);
					pointer-events: auto;
				}
				@supports (corner-shape: superellipse(1.4)) {
					.fm-as-toolbar {
						corner-shape: superellipse(1.4);
						border-radius: calc(10px * 1.4);
					}
				}
				@keyframes fm-as-pop-up {
					from { transform: translateY(12px); opacity: 0.5; }
					to { transform: translateY(0); opacity: 1; }
				}
				.fm-as-toolbar-hint {
					display: flex;
					align-items: center;
					gap: 6px;
					padding: 7px 11px;
					font-size: 13px;
					font-weight: 500;
					white-space: nowrap;
					line-height: 16px;
					opacity: .4;
					user-select: none;
				}
				.fm-as-toolbar.auto-action-ready .fm-as-toolbar-hint {
					opacity: 0.8;
				}
				.fm-as-toolbar-hint .action { display: none; }
				.fm-as-toolbar.auto-action-ready .fm-as-toolbar-hint .idle { display: none; }
				.fm-as-toolbar.auto-action-ready .fm-as-toolbar-hint .action { display: flex; }
				.fm-as-toolbar.hide-cancel .fm-as-divider,
				.fm-as-toolbar.hide-cancel [data-ref="cancelBtn"],
				.fm-as-toolbar.auto-action-ready .fm-as-divider,
				.fm-as-toolbar.auto-action-ready [data-ref="cancelBtn"] {
					display: none;
				}
				.fm-as-action-group {
					display: flex;
					align-items: center;
					gap: 1px;
				}
				.fm-as-divider {
					width: 1px;
					height: 16px;
					background: rgba(0, 0, 0, 0.1);
					margin: 0 2px;
					flex-shrink: 0;
				}
				.fm-as-icon {
					width: 16px;
					height: 16px;
					flex-shrink: 0;
					display: flex;
					align-items: center;
					justify-content: center;
				}
				.fm-as-icon svg,
				.fm-as-btn > svg {
					width: 16px;
					height: 16px;
				}
				.fm-as-btn {
					font-family: inherit;
					display: flex;
					align-items: center;
					gap: 6px;
					border: none;
					padding: 7px 11px;
					border-radius: 7px;
					font-size: 13px;
					font-weight: 500;
					cursor: pointer;
					white-space: nowrap;
					transition: background 0.12s, color 0.12s;
					background: transparent;
					color: #1d1d1f;
					line-height: 16px;
				}
				@supports (corner-shape: superellipse(1.4)) {
					.fm-as-btn {
						corner-shape: superellipse(1.4);
						border-radius: calc(7px * 1.4);
					}
				}
				.fm-as-btn:disabled {
					opacity: 0.4;
					cursor: default;
				}
				.fm-as-btn:hover:not(:disabled) {
					background: rgba(0, 0, 0, 0.06);
				}
				.fm-as-btn:active:not(:disabled) {
					background: rgba(0, 0, 0, 0.1);
				}
				.fm-as-btn-primary {
					background: rgba(0, 122, 255, 0.1);
					color: #0a6edb;
				}
				.fm-as-btn-primary:hover:not(:disabled) {
					background: rgba(0, 122, 255, 0.18);
				}
				.fm-as-btn-primary:active:not(:disabled) {
					background: rgba(0, 122, 255, 0.25);
				}
				.fm-as-btn-secondary {
					opacity: .65;
				}
				.fm-as-btn-icon {
					padding: 7px;
					opacity: .4;
				}
				.fm-as-btn-icon:hover:not(:disabled) {
					opacity: .7;
				}
				.fm-as-modal-backdrop {
					position: fixed;
					inset: 0;
					background: rgba(0, 0, 0, 0.2);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 2147483647;
					cursor: default;
				}
				.fm-as-modal {
					zoom: var(--fm-ui-scale);
					background: rgba(255, 255, 255, 0.95);
					backdrop-filter: blur(16px);
					border-radius: 12px;
					padding: 20px 24px;
					max-width: 380px;
					width: 90%;
					box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(0, 0, 0, 0.1);
					color: #1d1d1f;
					cursor: default;
				}
				.fm-as-modal-title {
					display: flex;
					align-items: center;
					gap: 8px;
					font-size: 14px;
					font-weight: 600;
					margin-bottom: 8px;
				}
				.fm-as-icon-warn {
					color: #e67700;
				}
				.fm-as-modal-body {
					font-size: 13px;
					color: rgba(0, 0, 0, 0.5);
					line-height: 1.5;
					margin-bottom: 16px;
				}
				.fm-as-modal-actions {
					display: flex;
					justify-content: flex-end;
					gap: 6px;
				}
				@media (prefers-color-scheme: dark) {
					.fm-as-toolbar {
						background: rgba(30, 30, 32, 0.92);
						box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.08);
						color: #f0f0f3;
					}
					.fm-as-divider {
						background: rgba(255, 255, 255, 0.1);
					}
					.fm-as-btn {
						color: rgba(255, 255, 255, 0.8);
					}
					.fm-as-btn:hover:not(:disabled) {
						background: rgba(255, 255, 255, 0.08);
					}
					.fm-as-btn:active:not(:disabled) {
						background: rgba(255, 255, 255, 0.13);
					}
					.fm-as-btn-primary {
						background: rgba(56, 139, 253, 0.12);
						color: #58a6ff;
					}
					.fm-as-btn-primary:hover:not(:disabled) {
						background: rgba(56, 139, 253, 0.22);
					}
					.fm-as-btn-primary:active:not(:disabled) {
						background: rgba(56, 139, 253, 0.3);
					}
					.fm-as-btn-secondary {
						color: rgba(255, 255, 255, 0.65);
					}
					.fm-as-btn-icon {
						color: rgba(255, 255, 255, 0.4);
					}
					.fm-as-btn-icon:hover:not(:disabled) {
						color: rgba(255, 255, 255, 0.8);
					}
					.fm-as-modal {
						background: rgba(30, 30, 32, 0.95);
						box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.08);
						color: #e5e5e7;
					}
					.fm-as-icon-warn {
						color: #f0a030;
					}
					.fm-as-modal-body {
						color: rgba(255, 255, 255, 0.5);
					}
				}
			`;
		}
	}

	window.FlowMouseAreaSelect = new AreaSelectManager();
})();

(function () {
	'use strict';

	const isFirefox = false;
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
	const eventManager = new window.EventManager();

	chrome.storage.sync.get({ blacklist: [] }, (items) => {
		if (chrome.runtime.lastError) {
			console.error(chrome.runtime.lastError);
			return;
		}
		isBlacklisted = checkBlacklist(items.blacklist);
		if (!isBlacklisted) {
			initGestures();
		}
	});

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
					} else {
						eventManager.update();
					}
				}
			}
		}
	});

	function initGestures() {
		initGesturesCalled = true;
		const { DEFAULT_GESTURES, DEFAULT_SETTINGS, ACTION_DEFAULTS, ACTION_KEYS, actionLabelKey, LOCAL_ACTIONS, CLEAR_OVERLAY_ACTIONS } = window.GestureConstants;
		const { handleScroll, checkScrollFeasibility, copyText, tryParseAsUrl } = window.FlowMouseUtils;
		const { msg } = window.ContentI18n;

		const recognizer = new window.GestureRecognizer({
			distanceThreshold: DEFAULT_SETTINGS.distanceThreshold
		});

		let isIframe = false;
		try {
			isIframe = window.self !== window.top;
		} catch (e) {
			isIframe = true;
		}

		const isIncognito = chrome.extension.inIncognitoContext;

		async function safeSendMessage(message) {
			lastWarmUp = Date.now();
			try {
				return await chrome.runtime.sendMessage(message);
			} catch (e) {
			}
		}

		let lastWarmUp = Date.now();
		function warmUp() {
			if (Date.now() - lastWarmUp < 25000) return;
			safeSendMessage({ action: 'warmUp' });
		}

		function mergeDuplicateLabels(labels) {
			const counts = new Map();
			for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
			const seen = new Set();
			const merged = [];
			for (const label of labels) {
				if (seen.has(label)) continue;
				seen.add(label);
				const count = counts.get(label);
				merged.push(count > 1 ? `${label} × ${count}` : label);
			}
			return merged;
		}

		function resolveActionLabel(cfg, dragType, contentValues) {
			const action = cfg.action;
			const merged = { ...(ACTION_DEFAULTS[action] || {}), ...cfg };

			if (action === 'search' && dragType === 'text' && merged.autoDetectUrl && contentValues?.text && tryParseAsUrl(contentValues.text, false)) {
				return merged.customNameAutoDetectUrl || msg(actionLabelKey('openTab', 'link'));
			}
			if ((action === 'openTab' || action === 'openImage') && dragType === 'image' && merged.preferLink && contentValues?.linkUrl) {
				return merged.customNamePreferLink || msg(actionLabelKey('openTab', 'link'));
			}
			if (merged.customName) return merged.customName;
			return msg(actionLabelKey(action, dragType));
		}

		function getUnnamedChainLabels(chain, dragType, contentValues) {
			const hidden = new Set(['none', 'delay']);
			const labels = [];
			for (const step of chain.steps || []) {
				if (!step.action || hidden.has(step.action)) continue;
				labels.push(resolveActionLabel(step, dragType, contentValues));
			}
			return mergeDuplicateLabels(labels);
		}

		function getDragLabels(type, pattern, contentValues) {
			const gestures = getGesturesForDragType(type);
			if (!gestures) return [];

			const cfg = getDragGestureConfig(gestures, pattern);
			if (!cfg || cfg.action === 'none') return [];

			if (cfg.action === 'actionChain') {
				if (cfg.customName) return [cfg.customName];
				const chain = SETTINGS.actionChains?.[cfg.chainId];
				if (chain?.name) return [chain.name];
				if (!chain) return [`${msg(actionLabelKey(cfg.action))} ${msg('chainNotFound')}`];
				const lines = getUnnamedChainLabels(chain, type, contentValues);
				if (lines.length) return lines;
			}
			if (cfg.action === 'customMenu' && !cfg.customName) {
				const menuDef = SETTINGS.customMenus?.[cfg.menuId];
				if (menuDef?.name) return [menuDef.name];
				if (!menuDef) return [`${msg(actionLabelKey(cfg.action))} ${msg('menuNotFound')}`];
			}

			return [resolveActionLabel(cfg, type, contentValues)];
		}

		function getGesturesForDragType(dragType) {
			if (dragType === 'text') return SETTINGS.textDragGestures;
			if (dragType === 'link') return SETTINGS.linkDragGestures;
			if (dragType === 'image') return SETTINGS.imageDragGestures;
			return null;
		}

		function getDragGestureConfig(gestures, dir) {
			const g = gestures.find(item => item.direction === dir);
			if (!g || !g.action) return null;
			return { ...(ACTION_DEFAULTS[g.action] || {}), ...g };
		}

		function isEditableTarget(e) {
			const node = e.composedPath()[0];
			const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
			if (!el) return false;
			const tag = el.tagName;
			if (tag === 'INPUT') {
				return !['button', 'checkbox', 'color', 'radio', 'range', 'image', 'reset', 'submit'].includes(el.type);
			}
			return tag === 'TEXTAREA' || el.isContentEditable;
		}

		function getDragPatternWithFallback(dragType, pattern) {
			if (!pattern) return pattern;
			const gestures = getGesturesForDragType(dragType);
			if (!gestures) return pattern;
			if (getDragGestureConfig(gestures, pattern)) return pattern;
			const fallback = getDragGestureConfig(gestures, '*');
			if (fallback && fallback.action !== 'none') return '*';
			return pattern;
		}

		function hasDragAction(dragType, pattern) {
			pattern = getDragPatternWithFallback(dragType, pattern);
			if (!pattern) return false;
			const gestures = getGesturesForDragType(dragType);
			if (!gestures) return false;
			const cfg = getDragGestureConfig(gestures, pattern);
			return cfg && cfg.action !== 'none';
		}

		let SETTINGS = {
			...DEFAULT_SETTINGS,
			enableDrag: DEFAULT_SETTINGS.enableTextDrag || DEFAULT_SETTINGS.enableImageDrag || DEFAULT_SETTINGS.enableLinkDrag
		};
		let chainContexts = new Map();

		function resolveAreaSelectConfig(cfg) {
			if (cfg?.overrideGlobal) {
				return {
					warnThreshold: cfg.warnThreshold,
					textUrl: cfg.textUrl,
					delay: cfg.delay,
					autoAction: cfg.autoAction,
				};
			}
			return {
				warnThreshold: SETTINGS.areaSelectWarnThreshold,
				textUrl: SETTINGS.areaSelectTextUrl,
				delay: SETTINGS.areaSelectDelay,
				autoAction: SETTINGS.areaSelectAutoAction,
			};
		}

		function enterAreaSelect(initialEvent, cfg) {
			const lang = window.ContentI18n.getHtmlLang();
			const isRtl = window.ContentI18n.getDir() === 'rtl';
			const opts = { ...resolveAreaSelectConfig(cfg), customCss: SETTINGS.customCss };
			window.FlowMouseAreaSelect.enter(isIframe, opts.warnThreshold, lang, isRtl, initialEvent, opts);
		}

		function getGestureAction(pattern) {
			if (!SETTINGS.enableGestureCustomization) {
				return DEFAULT_GESTURES[pattern];
			}

			const config = SETTINGS.mouseGestures?.[pattern];
			return config?.action;
		}

		function getPatternWithFallback(pattern) {
			if (!SETTINGS.enableGestureCustomization) return pattern;
			const action = getGestureAction(pattern);
			if (action && action !== 'none') return pattern;
			const fallback = getGestureAction('*');
			if (fallback && fallback !== 'none') return '*';
			return pattern;
		}


		function getActionLabels(pattern) {
			const action = getGestureAction(pattern);
			if (!action || action === 'none') return [];
			if (SETTINGS.enableGestureCustomization) {
				const customName = SETTINGS.mouseGestures?.[pattern]?.customName;
				if (customName) return [customName];
			}
			if (action === 'actionChain') {
				const config = SETTINGS.mouseGestures?.[pattern];
				const chain = SETTINGS.actionChains?.[config?.chainId];
				if (chain?.name) return [chain.name];
				if (!chain) return [`${msg(actionLabelKey(action))} ${msg('chainNotFound')}`];
				const lines = getUnnamedChainLabels(chain);
				if (lines.length) return lines;
			}
			if (action === 'customMenu') {
				const config = SETTINGS.mouseGestures?.[pattern];
				const menuDef = SETTINGS.customMenus?.[config?.menuId];
				if (menuDef?.name) return [menuDef.name];
				if (!menuDef) return [`${msg(actionLabelKey(action))} ${msg('menuNotFound')}`];
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
				return [`${msg(actionLabelKey(action))} (${mods.join('+')})`];
			}
			const i18nKey = actionLabelKey(action);
			return i18nKey ? [msg(i18nKey)] : [];
		}

		function getSuggestedGestures(currentPattern) {
			const source = SETTINGS.enableGestureCustomization
				? (SETTINGS.mouseGestures || {})
				: DEFAULT_GESTURES;
			const suggestions = [];
			for (const pattern of Object.keys(source)) {
				if (pattern === '*') continue;
				if (!pattern.startsWith(currentPattern)) continue;
				if (pattern.length !== currentPattern.length + 1) continue;
				const labels = getActionLabels(pattern);
				if (!labels.length) continue;
				suggestions.push({ pattern, actionName: labels.join(' · ') });
			}

			const lastDir = currentPattern.slice(-1);
			const isHorizontal = lastDir === '←' || lastDir === '→';
			const isVertical = lastDir === '↑' || lastDir === '↓';

			const getSortKey = (pattern) => {
				const D = pattern[currentPattern.length];
				if (isHorizontal) {
					if (D === '↑') return 0;
					if (D === '←' || D === '→') return 1;
					if (D === '↓') return 2;
				} else if (isVertical) {
					if (D === '←') return 0;
					if (D === '↑' || D === '↓') return 1;
					if (D === '→') return 2;
				}
				return 3;
			};

			suggestions.sort((a, b) => getSortKey(a.pattern) - getSortKey(b.pattern));
			return suggestions;
		}

		function loadSettings() {
			chrome.storage.sync.get(null, async (items) => {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError);
					return;
				}
				if (items) {
					const { blacklist, ...otherSettings } = items;
					SETTINGS = { ...structuredClone(DEFAULT_SETTINGS), ...otherSettings };
				}

				window.FlowMouseZoom.update({ userScale: SETTINGS.enableUserScale ? SETTINGS.userScale : null });

				SETTINGS.wheelGestures = {
					...structuredClone(DEFAULT_SETTINGS.wheelGestures),
					...(SETTINGS.wheelGestures || {}),
				};
				SETTINGS.specialGestures = {
					...structuredClone(DEFAULT_SETTINGS.specialGestures),
					...(SETTINGS.specialGestures || {}),
				};

				await window.ContentI18n.loadLanguage(SETTINGS.language);

				SETTINGS.enableDrag = SETTINGS.enableTextDrag || SETTINGS.enableImageDrag || SETTINGS.enableLinkDrag;

				recognizer.updateConfig({
					distanceThreshold: SETTINGS.distanceThreshold,
					longGestureMultiplier: SETTINGS.gestureTurnTolerance
				});

				if (SETTINGS.enableTrail || SETTINGS.enableHUD) {
					const lang = window.ContentI18n.getHtmlLang();
					const isRtl = window.ContentI18n.getDir() === 'rtl';
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
						customCss: SETTINGS.customCss,
						lang,
						isRtl
					});
					toaster.updateSettings({
						hudBgColor: SETTINGS.hudBgColor,
						hudTextColor: SETTINGS.hudTextColor,
						hudBlurRadius: SETTINGS.hudBlurRadius,
						customCss: SETTINGS.customCss,
						lang,
						isRtl
					});
					ctxMenu.updateSettings({ lang, isRtl, customCss: SETTINGS.customCss });
				}
				ctxMenu.updateSettings({ wheelThreshold: SETTINGS.wheelThreshold });

				eventManager.update();
			});
		}

		chrome.storage.onChanged.addListener((changes, namespace) => {
			if (namespace === 'sync') {
				const keys = Object.keys(changes).filter(k => k !== 'blacklist' && k !== 'lastSyncTime');
				if (keys.length === 0) return;

				loadSettings();
			}
		});

		loadSettings();

		let zoomRevision = 0;

		async function refreshTabZoom() {
			const revision = ++zoomRevision;
			try {
				const response = await chrome.runtime.sendMessage({ action: 'getTabZoom' });
				if (revision === zoomRevision) {
					window.FlowMouseZoom.update({ tabZoom: response.tabZoom, defaultZoom: response.defaultZoom });
				}
			} catch {}
		}

		chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
			if (request.action === 'tabZoomChanged') {
				zoomRevision++;
				window.FlowMouseZoom.update({ tabZoom: request.tabZoom, defaultZoom: request.defaultZoom });
				return;
			}

			if (request.action === 'ping') {
				sendResponse({ pong: true });
				return;
			}

			if (request.action === 'gestureStateUpdate') {
				isRemoteGestureActive = request.active;
			}

			if (request.action === 'executeLocalAction') {
				if (!LOCAL_ACTIONS.has(request.stepAction)) {
					sendResponse({ success: false });
					return;
				}
				const ctx = chainContexts.get(request.contextId);
				executeAction(request.stepAction, request.stepConfig, ctx?.cursor || {}, ctx?.contentValues || null, ctx?.startTarget || null, false, ctx?.dragContext || null)
					.then((result) => sendResponse(result ?? { success: false }))
					.catch(() => sendResponse({ success: false }));
				return true;
			}

			if (request.action === 'gestureHudUpdate' && !isIframe) {
				const d = request.data;
				switch (d.type) {
					case 'hide': visualizer.hide(); break;
					case 'cleanup': visualizer.cleanup(); break;
					case 'updateAction': visualizer.setMode(d.mode); visualizer.updateAction(d.arrows, d.texts); break;
					case 'updateSuggestedGestures': visualizer.setMode(d.mode); visualizer.updateSuggestedGestures(d.suggestions, d.currentPattern); break;
				}
			}

			if (request.action === 'gestureScrollUpdate' && !isIframe) {
				const scrolled = handleScroll(request.data.action, request.data.scrollConfig, true);
				sendResponse({ success: !!scrolled });
				return;
			}

			if (request.action === 'showDownloadError' && !isIframe) {
				toaster.showToast(msg('downloadErrorHotlink'), { duration: 5000 });
			}

			if (request.action === 'areaSelectEnter') {
				if (!window.FlowMouseAreaSelect.isActive) {
					enterAreaSelect(undefined, request);
				}
			}

			if (request.action === 'areaSelectExit') {
				window.FlowMouseAreaSelect.exit();
			}

			if (request.action === 'areaSelectUpdate' && !isIframe) {
				window.FlowMouseAreaSelect.updateFromFrame(request.frameId, request.links);
			}

			if (request.action === 'pauseGesture') {
				isBlacklisted = true;
				resetState();
				eventManager.dispose();
				visualizer.cleanup();
				toaster.cleanup();
				ctxMenu.close();
				window.FlowMouseAreaSelect.exit();
			}
		});

		refreshTabZoom();

		let gestureState = {
			isRightButton: false,
			gestureButton: null,
			isDrag: false,
			dragElement: null,
			dragType: null,
			startTarget: null,
			contentValues: null,
			preventContextMenu: false,
			skipFirstDragOver: false,
			dropOnInputSuppressed: false
		};

		function resetState() {
			if (!isIframe || recognizer.isActive()) {
				visualizer.hide();
				if (SETTINGS.enableHUD) visualizer.updateAction('', []);
			}
			recognizer.reset();
			gestureState.isRightButton = false;
			gestureState.gestureButton = null;
			gestureState.isDrag = false;
			gestureState.dragElement = null;
			gestureState.dragType = null;
			gestureState.startTarget = null;
			gestureState.contentValues = null;
			gestureState.skipFirstDragOver = false;
			gestureState.dropOnInputSuppressed = false;
		}

		let isRemoteGestureActive = false;

		let edgeGestureBlurCount = 0;

		let preventContextMenuTimeoutId = null;

		let lastPointerType = 'mouse';

		class RelayGestureOverlay extends window.GestureOverlay {
			updateAction(arrows, texts) {
				if (isIframe) {
					safeSendMessage({ action: 'gestureHudUpdate', data: { type: 'updateAction', mode: this.mode, arrows, texts } });
				} else {
					super.updateAction(arrows, texts);
				}
			}

			updateSuggestedGestures(suggestions, currentPattern) {
				if (isIframe) {
					safeSendMessage({ action: 'gestureHudUpdate', data: { type: 'updateSuggestedGestures', mode: this.mode, suggestions, currentPattern } });
				} else {
					super.updateSuggestedGestures(suggestions, currentPattern);
				}
			}

			hide() {
				super.hide();

				if (isIframe) {
					safeSendMessage({ action: 'gestureHudUpdate', data: { type: 'hide' } });
				}
			}

			cleanup() {
				super.cleanup();
				if (isIframe) {
					return safeSendMessage({ action: 'gestureHudUpdate', data: { type: 'cleanup' } });
				}
			}
		}

		const visualizer = new RelayGestureOverlay();
		const toaster = new window.ToastOverlay();
		const ctxMenu = new ContentContextMenu();

		const isGestureEnabled = () => SETTINGS.enableGesture && !isBlacklisted;
		const isWheelGestureEnabled = () => SETTINGS.enableWheelGestures && !isBlacklisted;
		const isSpecialGestureEnabled = () => SETTINGS.enableSpecialGestures && !isBlacklisted;
		const isDragEnabled = () => SETTINGS.enableDrag && !isBlacklisted;

		let _docEl = document.documentElement;
		new MutationObserver(() => {
			if (document.documentElement !== _docEl) {
				_docEl = document.documentElement;
				eventManager.reattach();
			}
		}).observe(document, { childList: true });

		{
			const extensionId = chrome.runtime.id;
			function onDispose(event) {
				if (event.detail?.extensionId !== extensionId) return;
				isBlacklisted = true;
				eventManager.dispose();
				visualizer.cleanup();
				toaster.cleanup();
				ctxMenu.close();
				window.FlowMouseAreaSelect.exit();
			}
			window.addEventListener('flowmouse:dispose', onDispose, { once: true });
			eventManager.onReattach(() => {
				window.addEventListener('flowmouse:dispose', onDispose, { once: true });
			});
		}

		function isExtensionContextValid() {
			{
				if (!chrome.runtime?.id) {
					isBlacklisted = true;
					eventManager.dispose();
					visualizer.cleanup();
					toaster.cleanup();
					ctxMenu.close();
					window.FlowMouseAreaSelect.exit();
					return false;
				}
			}
			return true;
		}

		const isMacOrLinux = /Mac|Linux/i.test(navigator.platform);
		let lastRightClickTime = 0;
		const doubleClickDelay = 500;

		let macLinuxHintShown = false;

		function showMacLinuxHint() {
			if (macLinuxHintShown) return;
			const hintText = msg('macLinuxDoubleClickHint');
			if (!hintText) return;
			macLinuxHintShown = true;
			toaster.showToast(hintText, {
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

		eventManager.add(null, window, 'pageshow', (e) => {
			if (e.persisted) {
				rightButtonSeenOnPage = false;
				rockerGestureTriggered = false;
				wheelGestureTriggered = false;
				resetState();
			}
		});

		eventManager.add(null, document, 'visibilitychange', () => {
			rightButtonSeenOnPage = false;
			rockerGestureTriggered = false;
			wheelGestureTriggered = false;
			resetState();
		});

		eventManager.add(null, window, 'pagehide', () => {
			if (recognizer.isActive()) {
				safeSendMessage({ action: 'gestureStateUpdate', active: false });
				resetState();
			}
		});

		eventManager.add(() => !isBlacklisted, window, 'contextmenu', (e) => {
			if (!isExtensionContextValid()) return;

			if (wheelGestureTriggered) {
				wheelGestureTriggered = false;
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}

			if (rockerGestureTriggered) {
				rockerGestureTriggered = false;
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}

			if (!rightButtonSeenOnPage && e.button === 2) {
				rightButtonSeenOnPage = true;
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}

			if ((isFirefox || !isMacOrLinux) && ctxMenu.isOpen) {
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}

			const triggerBtns = SETTINGS.gestureTriggerButtons;
			const gestureUsesRightClick = SETTINGS.enableGesture && (triggerBtns.right !== false || triggerBtns.penRight === true);
			if (!gestureUsesRightClick && !SETTINGS.enableWheelGestures && !SETTINGS.enableSpecialGestures) return;

			if (e.composedPath().some(el => el.hasAttribute && el.hasAttribute('data-gesture-ignore'))) return;

			if (isMacOrLinux) {
				if (e.ctrlKey || e.button !== 2) return;

				const now = Date.now();
				if (recognizer.isActive()) {
					e.preventDefault();
					e.stopImmediatePropagation();
					return;
				}
				if (now - lastRightClickTime < doubleClickDelay) {
					lastRightClickTime = 0;
					gestureState.isRightButton = false;
					recognizer.reset();
					if (!SETTINGS.macLinuxHintDismissed) {
						SETTINGS.macLinuxHintDismissed = true;
						try { chrome.storage.sync.set({ macLinuxHintDismissed: true }); } catch (e) {}
					}
					return;
				} else {
					lastRightClickTime = now;
					e.preventDefault();

					if (!SETTINGS.macLinuxHintDismissed && !isIframe) {
						showMacLinuxHint();
					}

					return;
				}
			} else {
				if (gestureState.preventContextMenu || isRemoteGestureActive) {
					e.preventDefault();
					e.stopImmediatePropagation();
					if (isRemoteGestureActive) {
						safeSendMessage({ action: 'gestureStateUpdate', active: false });
					}
					return;
				}
			}
		}, { capture: true });

		eventManager.add(null, window, 'pointerdown', (e) => {
			if (e.button === 0) {
				lastPointerType = e.pointerType;
			}
			if (e.button === 2) {
				rightButtonSeenOnPage = true;
			}
			if (
				(e.button === 2 && isWheelGestureEnabled()) ||
				((e.button === 0 || e.button === 2) && isSpecialGestureEnabled())
			) {
				warmUp();
			}
		}, true);

		const isAreaSelectModifierEnabled = () => SETTINGS.areaSelectModifierKey && SETTINGS.areaSelectModifierKey !== 'disabled';

		let areaSelectPending = null;
		eventManager.add(isAreaSelectModifierEnabled, window, 'pointerdown', (e) => {
			if (e.button !== 0 || (e.pointerType !== 'mouse' && e.pointerType !== 'pen')) return;
			const mod = SETTINGS.areaSelectModifierKey;
			const modPressed = mod === 'Ctrl' ? e.ctrlKey : mod === 'Shift' ? e.shiftKey : mod === 'Alt' ? e.altKey : mod === 'Meta' ? e.metaKey : false;
			if (!modPressed) return;
			const otherMods = (e.ctrlKey ? 1 : 0) + (e.shiftKey ? 1 : 0) + (e.altKey ? 1 : 0) + (e.metaKey ? 1 : 0);
			if (otherMods > 1) return;
			if (window.FlowMouseAreaSelect.isActive) return;
			areaSelectPending = { event: e, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
		}, true);

		eventManager.add(isAreaSelectModifierEnabled, window, 'pointermove', (e) => {
			if (!areaSelectPending || e.pointerId !== areaSelectPending.pointerId) return;
			const dx = (e.clientX - areaSelectPending.x) * window.FlowMouseZoom.tabZoom;
			const dy = (e.clientY - areaSelectPending.y) * window.FlowMouseZoom.tabZoom;
			if (dx * dx + dy * dy < 9) return;
			const pending = areaSelectPending;
			areaSelectPending = null;
			if (window.FlowMouseAreaSelect.isActive) return;
			const initialEvent = pending.event.pointerType !== 'pen' ? pending.event : null;
			window.getSelection()?.removeAllRanges();
			enterAreaSelect(initialEvent);
			safeSendMessage({ action: 'areaSelect' });
			e.preventDefault();
			e.stopImmediatePropagation();
		}, true);

		eventManager.add(isAreaSelectModifierEnabled, window, 'pointerup', (e) => {
			if (areaSelectPending?.pointerId === e.pointerId) areaSelectPending = null;
		}, true);

		eventManager.add(isAreaSelectModifierEnabled, window, 'dragstart', (e) => {
			if (areaSelectPending || window.FlowMouseAreaSelect.isActive) {
				e.preventDefault();
				e.stopImmediatePropagation();
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

		function getGestureContentValues(path) {
			const link = path.find(el => el.tagName === 'A' && el.href);
			const image = path.find(el => el.tagName === 'IMG');
			return {
				text: null,
				linkUrl: link?.href || null,
				linkText: link ? (link.innerText || link.textContent || '').trim() || null : null,
				imageUrl: image?.src || image?.currentSrc || null,
			};
		}

		eventManager.add(isGestureEnabled, window, 'pointerdown', (e) => {
			if (isTriggerButton(e.pointerType, e.button)) {
				if (e.composedPath().some(el => el.hasAttribute && el.hasAttribute('data-gesture-ignore'))) return;

				ctxMenu.close();
				gestureState.isRightButton = true;
				gestureState.gestureButton = e.button;
				gestureState.isDrag = false;
				gestureState.preventContextMenu = false;
				const path = e.composedPath();
				gestureState.startTarget = path[0];
				gestureState.contentValues = getGestureContentValues(path);
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

		eventManager.add(isGestureEnabled, window, 'pointermove', (e) => {
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
				if (!isExtensionContextValid()) return;
				gestureState.preventContextMenu = true;
				safeSendMessage({ action: 'gestureStateUpdate', active: true });
				visualizer.setMode('gesture');
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
				const pattern = getPatternWithFallback(result.pattern);
				visualizer.updateAction(pattern, getActionLabels(pattern));
				if (SETTINGS.enableSuggestedGestures) {
					const suggestions = getSuggestedGestures(result.pattern);
					visualizer.updateSuggestedGestures(suggestions, result.pattern);
				}
			}
		}, { capture: true });

		eventManager.add(isGestureEnabled, window, 'pointerup', (e) => {
			if (gestureState.isRightButton) {
				if (recognizer.isActive()) {
					e.preventDefault();
					e.stopPropagation();
					executeGesture(recognizer.getPattern());
					lastRightClickTime = 0;
				}

				resetState();
			}
			if (gestureState.preventContextMenu) {
				preventContextMenuTimeoutId = setTimeout(() => {
					gestureState.preventContextMenu = false;
					preventContextMenuTimeoutId = null;
					safeSendMessage({ action: 'gestureStateUpdate', active: false });
				}, 50);
			}
		}, { capture: true });

		eventManager.add(isGestureEnabled, window, 'mousedown', (e) => {
			if (e.button === 0 && gestureState.isRightButton && recognizer.isActive()) {
				e.preventDefault();
				e.stopImmediatePropagation();
				resetState();
			}
		}, { capture: true });

		let rockerLeftExecuted = false;
		eventManager.add(isSpecialGestureEnabled, window, 'mousedown', (e) => {
			if (e.button === 0 && (e.buttons & 2)) {
				if (recognizer.isActive()) return;
				const specialConfig = (SETTINGS.specialGestures || {}).leftClickHoldingRight;
				if (!specialConfig?.action || specialConfig.action === 'none') return;
				e.preventDefault();
				e.stopImmediatePropagation();
				gestureState.preventContextMenu = true;
				gestureState.isRightButton = false;
				recognizer.reset();
				rockerGestureTriggered = true;
				rockerLeftExecuted = true;
				const path = e.composedPath();
				executeAction(specialConfig.action, specialConfig, { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY }, getGestureContentValues(path), path[0]);
				return;
			}

			if (e.button === 2 && (e.buttons & 1)) {
				if (recognizer.isActive()) return;
				const specialConfig = (SETTINGS.specialGestures || {}).rightClickHoldingLeft;
				if (!specialConfig?.action || specialConfig.action === 'none') return;
				e.preventDefault();
				e.stopImmediatePropagation();
				gestureState.preventContextMenu = true;
				gestureState.isRightButton = false;
				recognizer.reset();
				rockerGestureTriggered = true;
				const path = e.composedPath();
				executeAction(specialConfig.action, specialConfig, { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY }, getGestureContentValues(path), path[0]);
				return;
			}
		}, { capture: true });

		eventManager.add(isSpecialGestureEnabled, window, 'click', (e) => {
			if (rockerLeftExecuted) {
				e.preventDefault();
				e.stopImmediatePropagation();
				rockerLeftExecuted = false;
			}
		}, { capture: true });

		eventManager.add(isSpecialGestureEnabled, window, 'mouseup', (e) => {
			if (e.button === 0 && rockerLeftExecuted) {
				setTimeout(() => { rockerLeftExecuted = false; }, 10);
			}
		}, { capture: true });

		eventManager.add(isDragEnabled, window, 'mousedown', (e) => {
			if (e.button !== 0) return;

			let target = e.target;
			let depth = 0;
			let hasModified = false;

			while (target && target !== document.body && depth < 5) {
				if (target.getAttribute && target.getAttribute('draggable') === 'false') {
					let shouldForce = false;


					if (target.tagName === 'A' && target.href) {
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
				window.addEventListener('mouseup', restoreDraggable, true);
				window.addEventListener('dragend', restoreDraggable, true);
			}
		}, { capture: true });

		function restoreDraggable(e) {
			if (!e.isTrusted) return;
			window.removeEventListener('mouseup', restoreDraggable, true);
			window.removeEventListener('dragend', restoreDraggable, true);

			const modified = document.querySelectorAll('[data-flowmouse-modified="true"]');
			modified.forEach(el => {
				el.setAttribute('draggable', 'false');
				el.removeAttribute('data-flowmouse-modified');
			});
		}

		let dropHandledAction = false;

		eventManager.add(isDragEnabled, window, 'dragstart', (e) => {
			if (!isExtensionContextValid()) return;
			warmUp();

			dropHandledAction = false;

			const path = e.composedPath();

			const dragSource = path[0];
			if (dragSource && dragSource.nodeType === Node.ELEMENT_NODE) {
				const cursor = window.getComputedStyle(dragSource).cursor;
				if ((cursor === 'grab' || cursor === 'grabbing' || cursor === 'move')
					&& !window.getSelection().toString().trim()) {
					return;
				}
			}

			let dragElement = null;
			let dragType = null;
			let contentValues = null;

			const dtItems = [...e.dataTransfer.items];
			let isImage = dtItems.some(i => i.kind === 'file' && i.type.startsWith('image/'));
			const isLink = !isImage && dtItems.some(i => i.type === 'text/uri-list');
			const isText = !isImage && !isLink && dtItems.some(i => i.type === 'text/plain' || i.type === 'text/html');

			if (SETTINGS.enableImageDrag && isImage) {
				let targetImg = path.find(el => el.tagName === 'IMG');


				if (targetImg) {
					const imageUrl = targetImg.src || targetImg.currentSrc;
					if (imageUrl) {
						dragType = 'image';
						dragElement = targetImg;
						const parentLink = path.find(el => el.tagName === 'A' && el.href);
						contentValues = {
							text: null,
							linkUrl: parentLink?.href || null,
							linkText: null,
							imageUrl,
						};
						window.getSelection().removeAllRanges();
					}
				}
			}

			if (!dragType && SETTINGS.enableLinkDrag && isLink) {
				const targetLink = path.find(el => el.tagName === 'A' && el.href);
				if (targetLink) {
					let rawHref = targetLink.getAttribute('href');

					if (rawHref) {
						try {
							const absoluteUrl = new URL(rawHref, document.baseURI).href;

							if (tryParseAsUrl(absoluteUrl, true)) {
								dragType = 'link';
								dragElement = targetLink;
								contentValues = {
									text: null,
									linkUrl: absoluteUrl,
									linkText: (targetLink.innerText || targetLink.textContent || '').trim() || null,
									imageUrl: null,
								};
								window.getSelection().removeAllRanges();
							}
						} catch (err) {
						}
					}
				}
			}

			if (!dragType && SETTINGS.enableTextDrag && isText) {
				let skipDrag = false;
				if (SETTINGS.textDragIgnoreInput) {
					skipDrag = isEditableTarget(e);
				}
				if (!skipDrag) {
					for (const el of path) {
						if (el === document || el === window) break;
						if (el.getAttribute && el.getAttribute('draggable') === 'true'
							&& !el.hasAttribute('data-flowmouse-modified')
							&& el.tagName !== 'IMG'
							&& !(el.tagName === 'A' && el.href)) {
							skipDrag = true;
							break;
						}
					}
				}
				if (!skipDrag) {
					const text = e.dataTransfer.getData('text/plain')?.trim() || window.getSelection().toString().trim();
					if (text) {
						dragType = 'text';
						contentValues = { text, linkUrl: null, linkText: null, imageUrl: null };
					}
				}
			}

			if (dragType) {
				gestureState.isDrag = true;
				gestureState.isRightButton = false;
				gestureState.dragElement = dragElement;
				gestureState.dragType = dragType;
				gestureState.contentValues = contentValues;
				recognizer.start(e.clientX, e.clientY, e.timeStamp);
				if (lastPointerType === 'touch' || lastPointerType === 'pen' || isMacOrLinux) {
					gestureState.skipFirstDragOver = true;
				}
			}
		}, { capture: false });

		eventManager.add(isDragEnabled, window, 'dragover', (e) => {
			if (!gestureState.isDrag) return;

			if (gestureState.skipFirstDragOver) {
				gestureState.skipFirstDragOver = false;
				return;
			}

			const result = recognizer.move(e.clientX, e.clientY, e.timeStamp);

			const currentPoint = { x: e.clientX, y: e.clientY, timestamp: e.timeStamp };

			if (result.activated) {
				visualizer.setMode('drag');
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

			const shouldIgnoreGestureOnInputDrop = (gestureState.dragType === 'text' && SETTINGS.textDropIgnoreInput)
				|| (gestureState.dragType === 'link' && SETTINGS.linkDropIgnoreInput);
			if (shouldIgnoreGestureOnInputDrop && isEditableTarget(e)) {
				if (!gestureState.dropOnInputSuppressed) {
					gestureState.dropOnInputSuppressed = true;
					visualizer.updateAction('', []);
				}
				return;
			}
			if (gestureState.dropOnInputSuppressed) {
				gestureState.dropOnInputSuppressed = false;
				result.directionChanged = true;
			}

			if (hasDragAction(gestureState.dragType, recognizer.getPattern())) {
				e.preventDefault();
				e.stopImmediatePropagation();
			}

			if (result.directionChanged && SETTINGS.enableHUD) {
				const pattern = getDragPatternWithFallback(gestureState.dragType, result.pattern);
				const hints = getDragLabels(gestureState.dragType, pattern, gestureState.contentValues);
				visualizer.updateAction(hints.length > 0 ? pattern : '', hints);
			}
		}, { capture: true });

		eventManager.add(isDragEnabled, window, 'dragenter', (e) => {
			if (!gestureState.isDrag) return;
			if (!recognizer.isActive()) return;
			if (gestureState.dropOnInputSuppressed) return;
			if (hasDragAction(gestureState.dragType, recognizer.getPattern())) {
				e.preventDefault();
				e.stopImmediatePropagation();
			}
		}, { capture: true });

		eventManager.add(isDragEnabled, window, 'dragleave', (e) => {
			if (gestureState.isDrag && e.relatedTarget === null) {
				resetState();
			}
		}, { capture: true });

		eventManager.add(isDragEnabled, window, 'drop', (e) => {
			try {
				if (gestureState.isDrag && recognizer.isActive()) {
					if (gestureState.dropOnInputSuppressed) return;
					const pattern = recognizer.getPattern();
					if (hasDragAction(gestureState.dragType, pattern)) {
						dropHandledAction = true;
						e.preventDefault();
						e.stopImmediatePropagation();
						executeDragGesture({ ...gestureState }, pattern, e.dataTransfer);
					}
				}
			} finally {
				resetState();
			}
		}, { capture: true });

		eventManager.add(isDragEnabled, window, 'dragend', (e) => {
			if (dropHandledAction) {
				dropHandledAction = false;
				e.preventDefault();
				e.dataTransfer.dropEffect = 'none';
			}
			resetState();
		}, { capture: true });

		eventManager.add(null, window, 'keydown', (e) => {
			if (e.key === 'Escape') {
				if (gestureState.isRightButton || gestureState.isDrag) {
					if (gestureState.isRightButton && recognizer.isActive()) {
						e.preventDefault();
						e.stopImmediatePropagation();
					}
					if (gestureState.isRightButton) {
						safeSendMessage({ action: 'gestureStateUpdate', active: false });
					}

					resetState();
				}
			}
		}, true);

		eventManager.add(isWheelGestureEnabled, window, 'mousedown', (e) => {
			if (e.button === 1 && (e.buttons & 2)) {
				if (recognizer.isActive()) return;
				const wheelConfig = (SETTINGS.wheelGestures || {}).wheelClickHoldingRight;
				if (!wheelConfig?.action || wheelConfig.action === 'none') return;
				e.preventDefault();
				e.stopImmediatePropagation();
				gestureState.preventContextMenu = true;
				gestureState.isRightButton = false;
				recognizer.reset();
				wheelGestureTriggered = true;
				const path = e.composedPath();
				executeAction(wheelConfig.action, wheelConfig, { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY, wheelDir: 0 }, getGestureContentValues(path), path[0]);
			}
		}, { capture: true });

		let wheelAccum = 0;
		let wheelLastTime = -Infinity;
		let wheelLastDir = 0;
		function accumulateWheel(e) {
			const dir = Math.sign(e.deltaY);
			const isNewScroll = e.timeStamp - wheelLastTime > 1000 || (wheelLastDir !== 0 && dir !== wheelLastDir);
			wheelLastTime = e.timeStamp;
			wheelLastDir = dir;
			if (isNewScroll || e.deltaMode === 2) {
				wheelAccum = 0;
				return true;
			}
			wheelAccum += Math.abs(e.deltaMode === 1 ? e.deltaY * 16.67 : e.deltaY * (window.FlowMouseZoom.tabZoom));
			if (wheelAccum < SETTINGS.wheelThreshold) return false;
			wheelAccum = 0;
			return true;
		}

		function handleWheelGesture(e) {
			if (!(e.buttons & 2)) return;


			if (ctxMenu.isWheelNav) {
				e.preventDefault();
				e.stopImmediatePropagation();
				if (e.deltaY && accumulateWheel(e)) ctxMenu.wheelNavigate(Math.sign(e.deltaY));
				return;
			}
			if (recognizer.isActive()) return;
			if (e.deltaY === 0) return;

			const gestureKey = e.deltaY < 0 ? 'scrollUpHoldingRight' : 'scrollDownHoldingRight';
			const scrollConfig = (SETTINGS.wheelGestures || {})[gestureKey];
			const action = scrollConfig?.action;
			if (!action || action === 'none') return;

			e.preventDefault();
			e.stopImmediatePropagation();
			if (!accumulateWheel(e)) return;
			gestureState.preventContextMenu = true;
			gestureState.isRightButton = false;
			recognizer.reset();
			wheelGestureTriggered = true;

			const path = e.composedPath();
			executeAction(action, scrollConfig, { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY, wheelDir: e.deltaY < 0 ? -1 : 1 }, getGestureContentValues(path), path[0]);
		}

		eventManager.add(isWheelGestureEnabled, window, 'mouseup', (e) => {
			if (e.button !== 2) return;
			wheelLastTime = -Infinity;
			if (ctxMenu.isWheelNav) ctxMenu.wheelActivate();
		}, { capture: true });

		eventManager.add(isWheelGestureEnabled, document, 'visibilitychange', (e) => {
			wheelAccum = 0;
			wheelLastTime = e.timeStamp;
			wheelLastDir = 0;
		});

		eventManager.add(isWheelGestureEnabled, window, 'auxclick', (e) => {
			if (e.button === 1 && wheelGestureTriggered) {
				e.preventDefault();
				e.stopImmediatePropagation();
			}
		}, { capture: true });

		{
			let wheelListenerActive = false;
			const wheelOptions = { capture: true, passive: false };

			function addWheelListener() {
				if (wheelListenerActive || !isWheelGestureEnabled()) return;
				window.addEventListener('wheel', onChromeWheel, wheelOptions);
				wheelListenerActive = true;
			}

			function removeWheelListener() {
				if (!wheelListenerActive) return;
				window.removeEventListener('wheel', onChromeWheel, wheelOptions);
				wheelListenerActive = false;
			}

			function onChromeWheel(e) {
				if (!e.isTrusted) return;
				if (!isWheelGestureEnabled() || !(e.buttons & 2)) {
					removeWheelListener();
					return;
				}
				handleWheelGesture(e);
			}

			eventManager.add(isWheelGestureEnabled, window, 'mousedown', (e) => {
				if (e.button === 2) addWheelListener();
			}, { capture: true });

			eventManager.add(isWheelGestureEnabled, document, 'visibilitychange', () => {
				addWheelListener();
			});

			eventManager.onUpdate(() => addWheelListener());

			eventManager.onReattach(() => { wheelListenerActive = false; });
		}


		eventManager.add(null, window, 'blur', () => {
			if (gestureState.isRightButton) {
				if (recognizer.isActive()) {
					safeSendMessage({ action: 'gestureStateUpdate', active: false });
				}

				if (isEdgeDesktop && !isIframe) {
					edgeGestureBlurCount++;
					if (edgeGestureBlurCount >= 2 && !SETTINGS.edgeGestureConflict) {
						SETTINGS.edgeGestureConflict = true;
						try { chrome.storage.sync.set({ edgeGestureConflict: true }); } catch (e) { }
					}
				}

				gestureState.preventContextMenu = false;
				resetState();
			}
		});

		async function openSearchedText(text, config, allowAutoDetect) {
			const { SEARCH_ENGINES } = window.GestureConstants;
			const engine = config.engine || 'system';
			const customUrl = config.url || '';
			const position = config.position || 'right';
			const active = config.active !== false;
			const incognito = !!config.incognito;
			if (allowAutoDetect && config.autoDetectUrl) {
				const detectedUrl = tryParseAsUrl(text, false);
				if (detectedUrl) {
					return await safeSendMessage({ action: 'openTabAtPosition', url: detectedUrl, position, active, incognito }) ?? { success: false };
				}
			}
			if (engine === 'system') {
				return await safeSendMessage({ action: 'systemSearch', query: text, position, active, incognito }) ?? { success: false };
			}
			if (engine === 'custom' && customUrl) {
				return await safeSendMessage({ action: 'openTabAtPosition', url: customUrl.replace('%s', encodeURIComponent(text)), position, active, incognito }) ?? { success: false };
			}
			const searchUrl = (SEARCH_ENGINES[engine] || SEARCH_ENGINES['google']).url + encodeURIComponent(text);
			return await safeSendMessage({ action: 'openTabAtPosition', url: searchUrl, position, active, incognito }) ?? { success: false };
		}

		async function executeAction(action, config = {}, cursor = {}, contentValues = null, startTarget = null, useActiveTab = false, dragContext = null) {
			if (!action || action === 'none') return { success: false };
			if (!isExtensionContextValid()) return { success: false };

			if (!ACTION_KEYS[action]) return { success: false };

			const defaults = ACTION_DEFAULTS[action] || {};
			const mergedConfig = { ...defaults, ...config };

			if (CLEAR_OVERLAY_ACTIONS.has(action) || (action === 'actionChain' && SETTINGS.actionChains?.[mergedConfig.chainId]?.steps?.some(step => CLEAR_OVERLAY_ACTIONS.has(step.action)))) {
				await visualizer.cleanup();
				recognizer.reset();
			}

			if (LOCAL_ACTIONS.has(action)) {
				const scrollConfig = { scrollDistance: mergedConfig.scrollDistance, scrollSmoothness: mergedConfig.scrollSmoothness, scrollDuration: mergedConfig.scrollDuration, scrollAccel: mergedConfig.scrollAccel, scrollAccelWindow: mergedConfig.scrollAccelWindow };
				switch (action) {
					case 'scrollUp':
					case 'scrollDown':
					case 'scrollLeft':
					case 'scrollRight':
					case 'scrollToTop':
					case 'scrollToBottom':
					case 'scrollToLeftEdge':
					case 'scrollToRightEdge':
						if (isIframe && !checkScrollFeasibility(action, cursor.startX, cursor.startY)) {
							return await safeSendMessage({ action: 'gestureScrollUpdate', data: { action, scrollConfig } }) ?? { success: false };
						}
						return { success: !!handleScroll(action, scrollConfig, false, cursor.startX, cursor.startY) };
					case 'stopLoading':
						window.stop();
						return { success: true };
					case 'reloadFrame':
						location.reload();
						return { success: true };
					case 'copyUrl': {
						const { url } = await safeSendMessage({ action: 'getTabInfo' });
						copyText(url);
						return { success: true };
					}
					case 'copyTitle': {
						const { title } = await safeSendMessage({ action: 'getTabInfo' });
						copyText(title);
						return { success: true };
					}
					case 'copyTitleAndUrl': {
						const { title, url } = await safeSendMessage({ action: 'getTabInfo' });
						if (mergedConfig.asMarkdown) {
							const t = title.replace(/([\[\]])/g, '\\$1');
							const u = url.replace(/([()])/g, '\\$1');
							copyText(`[${t}](${u})`);
						} else {
							copyText(`${title}\n${url}`);
						}
						return { success: true };
					}
					case 'sendCustomEvent': {
						const eventType = mergedConfig.eventType;
						if (!eventType) return { success: false };
						let detail = {};
						try {
							const detailStr = mergedConfig.eventDetail || '{}';
							detail = JSON.parse(detailStr);
						} catch { }
						if (mergedConfig.gestureInfo) {
							detail.gesture = {
								startX: cursor.startX,
								startY: cursor.startY,
								endX: cursor.endX,
								endY: cursor.endY,
								text: null,
								linkUrl: null,
								linkText: null,
								imageUrl: null,
								...contentValues,
							};
							if (dragContext) {
								detail.gesture.dragType = dragContext.dragType;
							}
						}
						window.dispatchEvent(new CustomEvent(eventType, { detail, bubbles: true, cancelable: true }));
						return { success: true };
					}
					case 'simulateKey': {
						const keyValue = mergedConfig.keyValue;
						if (!keyValue) return { success: false };
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
						return { success: true };
					}
					case 'pasteClipboard': {
						try {
							const permResult = await safeSendMessage({ action: 'requestPermission', permissions: ['clipboardRead'] });
							if (!permResult?.granted) return { success: false };
							if (startTarget) startTarget.focus();
							document.execCommand('paste');
							return { success: true };
						} catch {
							return { success: false };
						}
					}
					case 'pasteContent': {
						try {
							const content = mergedConfig.content || '';
							if (!content) return { success: false };
							if (startTarget) startTarget.focus();
							document.execCommand('insertText', false, content);
							return { success: true };
						} catch {
							return { success: false };
						}
					}
					case 'searchClipboard': {
						const permResult = await safeSendMessage({ action: 'requestPermission', permissions: ['clipboardRead'] });
						if (!permResult?.granted) return { success: false };
						const clipText = (await navigator.clipboard.readText() || '').trim();
						if (!clipText) return { success: false };
						return await openSearchedText(clipText, mergedConfig, true);
					}
					case 'menuShowTabs': {
						const fetchPromise = safeSendMessage({
							action: 'getTabList',
							sortOrder: mergedConfig.sortOrder,
							maxItems: mergedConfig.maxItems,
						});
						ctxMenu.prepare(cursor.endX, cursor.endY, { scrollToBottom: mergedConfig.scrollToBottom, wheelDir: mergedConfig.wheelNav ? cursor.wheelDir : undefined });
						const result = await fetchPromise;
						if (result?.success) {
							const getIcon = (tab) => `/_favicon/?pageUrl=${encodeURIComponent(tab.url)}&size=32`;
							const td = mergedConfig.timeDisplay || 'lastAccess';
							const items = result.tabs.map(tab => ({
								label: tab.title ?? tab.url,
								icon: tab.url ? getIcon(tab) : '',
								active: tab.active,
								time: td !== 'none' ? tab.lastAccess : undefined,
								onClick: () => {
									if (!tab.active) {
										safeSendMessage({ action: 'switchToTab', tabId: tab.id });
									}
								}
							}));
							ctxMenu.setItems(items);
							return { success: true };
						} else {
							ctxMenu.close();
							return { success: false };
						}
					}
					case 'menuRecentlyClosed': {
						const fetchPromise = safeSendMessage({
							action: 'getRecentlyClosedTabs',
							maxItems: mergedConfig.maxItems,
							sortOrder: mergedConfig.sortOrder,
						});
						ctxMenu.prepare(cursor.endX, cursor.endY, { scrollToBottom: mergedConfig.scrollToBottom, wheelDir: mergedConfig.wheelNav ? cursor.wheelDir : undefined });
						const result = await fetchPromise;
						if (result?.success) {
							const getIcon = (tab) => `/_favicon/?pageUrl=${encodeURIComponent(tab.url)}&size=32`;
							const td = mergedConfig.timeDisplay || 'closedTime';
							const items = result.tabs.map(tab => ({
								label: tab.title ?? tab.url,
								icon: tab.url ? getIcon(tab) : '',
								time: td !== 'none' && tab.lastModified ? (tab.lastModified * 1000) : undefined,
								onClick: () => {
									safeSendMessage({ action: 'restoreSession', sessionId: tab.sessionId });
								}
							}));
							ctxMenu.setItems(items);
							return { success: true };
						} else {
							ctxMenu.close();
							return { success: false };
						}
					}
					case 'menuShowBookmarks': {
						const fetchPromise = safeSendMessage({
							action: 'getBookmarks',
							folderId: mergedConfig.folderId || '1',
							sortOrder: mergedConfig.sortOrder,
							maxItems: mergedConfig.maxItems,
						});
						ctxMenu.prepare(cursor.endX, cursor.endY, { scrollToBottom: mergedConfig.scrollToBottom, wheelDir: mergedConfig.wheelNav ? cursor.wheelDir : undefined });
						const result = await fetchPromise;
						if (result?.success) {
							const getIcon = (bm) => `/_favicon/?pageUrl=${encodeURIComponent(bm.url)}&size=32`;
							const position = mergedConfig.position || 'right';
							const active = mergedConfig.active !== false;
							const incognito = !!mergedConfig.incognito;
							const td = mergedConfig.timeDisplay || 'dateAdded';
							const items = result.bookmarks.map(bm => ({
								label: bm.title ?? bm.url,
								icon: bm.url ? getIcon(bm) : '',
								time: td === 'none' ? undefined : bm.date,
								onClick: () => {
									safeSendMessage({ action: 'openTabAtPosition', url: bm.url, position, active, incognito });
								}
							}));
							ctxMenu.setItems(items);
							return { success: true };
						} else {
							ctxMenu.close();
							return { success: false };
						}
					}
					case 'customMenu': {
						const menuId = mergedConfig.menuId;
						const menuDef = SETTINGS.customMenus?.[menuId];
						const menuItems = menuDef?.items;
						if (!menuItems) return { success: false };
						ctxMenu.prepare(cursor.endX, cursor.endY, { wheelDir: mergedConfig.wheelNav ? cursor.wheelDir : undefined });
						const items = menuItems
							.filter(it => it === 'separator' || (it.action && it.action !== 'none'))
							.map(it => {
								if (it === 'separator') return 'separator';
								let label = it.customName;
								if (!label && it.action === 'actionChain') {
									const chain = SETTINGS.actionChains?.[it.chainId];
									label = chain?.name || msg(actionLabelKey(it.action));
								}
								if (!label) label = resolveActionLabel(it, dragContext?.dragType, contentValues) || it.action;
								return {
									label,
									onClick: () => {
										const itemConfig = { ...(ACTION_DEFAULTS[it.action] || {}), ...it };
										executeAction(it.action, itemConfig, { ...cursor, wheelDir: undefined }, contentValues, startTarget, false, dragContext);
									}
								};
							});
						ctxMenu.setItems(items);
						return { success: true };
					}

					case 'copy': {
						if (!dragContext || !contentValues?.text) return { success: false };
						copyText(contentValues.text);
						return { success: true };
					}
					case 'copyLink': {
						if (!dragContext || !contentValues?.linkUrl) return { success: false };
						copyText(contentValues.linkUrl);
						return { success: true };
					}
					case 'copyImageUrl': {
						if (!dragContext || !contentValues?.imageUrl) return { success: false };
						copyText(contentValues.imageUrl);
						return { success: true };
					}
					case 'copyLinkText': {
						if (!dragContext) return { success: false };
						const el = dragContext.element;
						const text = el ? (el.innerText || el.textContent || '') : '';
						if (!text) return { success: false };
						copyText(text);
						return { success: true };
					}
					case 'copyLinkAndText': {
						if (!dragContext) return { success: false };
						const el = dragContext.element;
						const text = el ? (el.innerText || el.textContent || '') : '';
						const link = contentValues?.linkUrl || '';
						if (!text && !link) return { success: false };
						if (mergedConfig.asMarkdown && link) {
							const t = (text || link).replace(/([\[\]])/g, '\\$1');
							const u = link.replace(/([()])/g, '\\$1');
							copyText(`[${t}](${u})`);
						} else {
							copyText([text, link].filter(Boolean).join('\n'));
						}
						return { success: true };
					}
					case 'search': {
						if (!dragContext || !contentValues) return { success: false };
						let text;
						switch (dragContext.dragType) {
							case 'image': text = contentValues.imageUrl; break;
							case 'link': text = contentValues.linkUrl; break;
							case 'text': text = contentValues.text; break;
							default: return { success: false };
						}
						if (!text) return { success: false };
						return await openSearchedText(text, mergedConfig, dragContext.dragType === 'text');
					}
					case 'openTab':
					case 'openLink':
					case 'openImage': {
						if (!dragContext || !contentValues) return { success: false };
						let url;
						switch (dragContext.dragType) {
							case 'image':
								if (action === 'openLink') {
									url = contentValues.linkUrl;
								} else {
									url = mergedConfig.preferLink === true && contentValues.linkUrl
										? contentValues.linkUrl : contentValues.imageUrl;
								}
								break;
							case 'link': url = contentValues.linkUrl; break;
							case 'text': return { success: false };
							default: return { success: false };
						}
						if (!url) return { success: false };
						const { position, active, incognito } = mergedConfig;
						return await safeSendMessage({ action: 'openTabAtPosition', url, position, active, incognito }) ?? { success: false };
					}
					case 'bookmarkLink': {
						if (!dragContext || !contentValues?.linkUrl) return { success: false };
						const title = contentValues.linkText || contentValues.linkUrl;
						return await safeSendMessage({
							action: 'bookmarkLink',
							url: contentValues.linkUrl,
							title,
							folderId: mergedConfig.folderId,
						}) ?? { success: false };
					}
					case 'imageSearch': {
						if (!dragContext || !contentValues?.imageUrl) return { success: false };
						const { IMAGE_SEARCH_ENGINES } = window.GestureConstants;
						const content = contentValues.imageUrl;
						const engine = mergedConfig.engine;
						const customUrl = mergedConfig.url;
						const url = (engine === 'custom' && customUrl)
							? customUrl.replace('%s', encodeURIComponent(content))
							: (IMAGE_SEARCH_ENGINES[engine] || IMAGE_SEARCH_ENGINES['google']).url + encodeURIComponent(content);
						if (!url) return { success: false };
						const { position, active, incognito } = mergedConfig;
						return await safeSendMessage({ action: 'openTabAtPosition', url, position, active, incognito }) ?? { success: false };
					}
					case 'saveImage': {
						if (!dragContext || !contentValues) return { success: false };
						const content = contentValues.imageUrl || '';
						const dataTransfer = dragContext.dataTransfer;
						const subdir = mergedConfig.subdir || '';
						if (content.startsWith('data:')) {
							safeSendMessage({ action: 'saveImage', url: content, subdir });
							return { success: true };
						}
						if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
							const file = dataTransfer.files[0];
							const reader = new FileReader();
							reader.onload = () => {
								safeSendMessage({
									action: 'saveImage',
									url: reader.result,
									filename: file.name,
									subdir,
								});
							};
							reader.readAsDataURL(file);
							return { success: true };
						}
						const dragElement = dragContext.element;
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
									origin: window.location.origin,
									subdir,
								});
							})
							.catch((err) => {
								const toastMsg = err.message === 'timeout'
									? msg('saveImageTimeout')
									: msg('saveImageLoadError');
								toaster.showToast(toastMsg, { duration: 5000 });
							});
						return { success: true };
					}
					default:
						return { success: false };
				}
			} else {
				const msg_obj = { ...mergedConfig, action };
				if (useActiveTab) msg_obj.useActiveTab = true;
				if (contentValues) msg_obj.contentValues = contentValues;
				if (dragContext) msg_obj.dragType = dragContext.dragType;
				let contextId;
				if (action === 'actionChain') {
					const chain = SETTINGS.actionChains?.[mergedConfig.chainId];
					if (chain?.steps?.length) {
						msg_obj.steps = chain.steps
							.filter(s => s.action && s.action !== 'none' && s.action !== 'actionChain')
							.map(s => ({ ...(ACTION_DEFAULTS[s.action] || {}), ...s }));
						if (chain.stopOnSuccess) msg_obj.stopOnSuccess = true;
						contextId = crypto.randomUUID();
						chainContexts.set(contextId, { cursor, startTarget, dragContext, contentValues });
						msg_obj.contextId = contextId;
					}
				}
				try {
					return await safeSendMessage(msg_obj) ?? { success: false };
				} finally {
					if (contextId) chainContexts.delete(contextId);
				}
			}
		}

		function executeGesture(pattern) {
			pattern = getPatternWithFallback(pattern);
			const action = getGestureAction(pattern);
			if (!action || action === 'none') return;

			if (isEdgeDesktop && SETTINGS.edgeGestureConflict) {
				SETTINGS.edgeGestureConflict = false;
				edgeGestureBlurCount = 0;
				try { chrome.storage.sync.set({ edgeGestureConflict: false }); } catch (e) { }
			}

			const config = SETTINGS.enableGestureCustomization
				? (SETTINGS.mouseGestures?.[pattern] || {})
				: {};
			executeAction(action, config, { startX: recognizer.startX, startY: recognizer.startY, endX: recognizer.currentX, endY: recognizer.currentY }, gestureState.contentValues, gestureState.startTarget);
		}

		async function executeDragGesture(state, pattern, dataTransfer) {
			pattern = getDragPatternWithFallback(state.dragType, pattern);
			if (!pattern) return;
			if (!isExtensionContextValid()) return;

			const gestures = getGesturesForDragType(state.dragType);
			if (!gestures) return;

			const config = getDragGestureConfig(gestures, pattern);
			if (!config) return;

			const cursor = {
				startX: recognizer.startX,
				startY: recognizer.startY,
				endX: recognizer.currentX,
				endY: recognizer.currentY,
			};
			const dragContext = {
				dragType: state.dragType,
				element: state.dragElement,
				dataTransfer,
			};

			await executeAction(config.action, config, cursor, state.contentValues, state.dragElement, false, dragContext);
		}
	}
})();