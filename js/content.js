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
		return document.scrollingElement || document.documentElement;
	}

	function hasScrollRoom(el, action) {
		const max = el.scrollHeight - el.clientHeight;
		if (max <= 1) return false;
		const top = el.scrollTop;
		if (action === 'scrollUp' || action === 'scrollToTop') return top > 1;
		if (action === 'scrollDown' || action === 'scrollToBottom') return top < max - 1;
		return true;
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
			let el = deepElementFromPoint(cursorX, cursorY);
			while (el && el !== root && el !== document.body) {
				const s = window.getComputedStyle(el);
				if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && hasScrollRoom(el, action)) {
					return el;
				}
				el = parentAcrossShadow(el);
			}
		}
		return root;
	}

	function checkScrollFeasibility(action, cursorX, cursorY) {
		const tolerance = 1;
		const target = getScrollTarget(action, false, cursorX, cursorY);

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
		const target = getScrollTarget(action, forceTargetWindow, cursorX, cursorY);
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
	};

	#activeMenuClose = null;
	#activeMenuId = null;
	#activeItems = null;

	updateSettings(s) {
		this.#settings = { ...this.#settings, ...s };
	}

	generateStyles() {
		return `
			.fm-ctx-frame {
				transition: opacity 0.15s cubic-bezier(.4,0,.2,1);
				box-shadow: 0 2px 12px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.12);
				border-radius: 8px;
				backdrop-filter: blur(8px);
				background: rgba(255, 255, 255, 0.92);
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
		iframe.style.cssText = `
			position: fixed;
			border: 0;
			opacity: 0;
			pointer-events: none;
			overflow: hidden;
		`;

		host.shadow.appendChild(iframe);

		const url = new URL(chrome.runtime.getURL('pages/context-menu.html'));
		url.searchParams.set('id', menuId);
		url.searchParams.set('dir', this.#settings.isRtl ? 'rtl' : 'ltr');
		if (this.#settings.lang) url.searchParams.set('lang', this.#settings.lang);
		if (options?.scrollToBottom) url.searchParams.set('bottom', '1');

		try {
			iframe.contentWindow.location = url.href;
		} catch {
			iframe.src = url.href;
		}

		const onMessage = (request) => {
			if (request.menuId !== menuId) return;

			if (request.action === 'ctxMenuDimensions') {
				const { width, height } = request;
				const vw = document.documentElement.clientWidth;
				const vh = document.documentElement.clientHeight;
				const pad = 6;

				const maxW = vw - pad * 2;
				const maxH = vh - pad * 2;
				const clampedW = Math.min(width, maxW);
				const clampedH = Math.min(height, maxH);

				let left = x;
				if (left + clampedW + pad > vw) {
					left = (x - clampedW >= pad) ? x - clampedW - 1 : vw - clampedW - pad;
				} else {
					left += 1;
				}
				if (left + clampedW + pad > vw) left = vw - clampedW - pad;
				if (left < pad) left = pad;

				let top = y;
				if (top + clampedH + pad > vh) {
					top = (y - clampedH >= pad) ? y - clampedH : vh - clampedH - pad;
				}
				if (top + clampedH + pad > vh) top = vh - clampedH - pad;
				if (top < pad) top = pad;

				iframe.style.setProperty('width', Math.round(clampedW) + 'px', 'important');
				iframe.style.setProperty('height', Math.round(clampedH) + 'px', 'important');
				iframe.style.setProperty('left', Math.round(left) + 'px', 'important');
				iframe.style.setProperty('top', Math.round(top) + 'px', 'important');
				iframe.style.setProperty('opacity', '1', 'important');
				iframe.style.setProperty('pointer-events', 'auto', 'important');
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
		#operationInterval = 0;
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

		get isActive() { return this.#state !== STATES.INACTIVE; }

		enter(isIframe, warnThreshold, lang, isRtl, initialEvent, options) {
			if (this.#state !== STATES.INACTIVE) return;
			if (document.contentType === 'image/svg+xml') return;
			this.#isIframe = isIframe;
			this.#warnThreshold = warnThreshold || 15;
			this.#operationInterval = options?.operationInterval ?? 0;
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
			this.#boundScroll = () => this.#onScroll();
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
				this.#quickEntry = true;
				this.#onPointerDown(initialEvent);
			}
		}

		exit() {
			if (this.#state === STATES.INACTIVE) return;
			this.#cancelAutoScroll();
			this.#hoveredItem = null;
			this.#quickEntry = false;
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
			if (this.#isIframe) return;
			this.#frameLinks.set(frameId, links);
			this.#updateToolbarCount();
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

		#onScroll() {
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

			if (width > CLICK_THRESHOLD || height > CLICK_THRESHOLD) {
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
			const isClick = Math.abs(e.clientX - svx) < CLICK_THRESHOLD
						 && Math.abs(e.clientY - svy) < CLICK_THRESHOLD;

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
		}

		#onKeyDown(e) {
			if (!e.isTrusted) return;
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopImmediatePropagation();
				if (this.#modal && this.#modal.style.display !== 'none') {
					this.#modal.style.display = 'none';
					return;
				}
				if (this.#state === STATES.SELECTING) {
					this.#abandonCurrentRect();
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
			if (this.#state !== STATES.SELECTING) return;
			if (!e.isTrusted) return;
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
			let scrollDy = 0;
			if (y < AUTO_SCROLL_ZONE) scrollDy = -AUTO_SCROLL_SPEED;
			else if (y > vh - AUTO_SCROLL_ZONE) scrollDy = AUTO_SCROLL_SPEED;

			if (scrollDy !== 0) {
				if (!this.#autoScrollRAF) {
					const doScroll = () => {
						window.scrollBy(0, scrollDy);
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
				if (chrome.runtime?.sendMessage) {
					chrome.runtime.sendMessage({ action: 'areaSelectExit' }).catch(() => {});
				}
			} catch { }
		}

		#reportSelection() {
			if (!this.#isIframe) return;
			const links = this.#highlighter ? this.#highlighter.links : [];
			try {
				if (chrome.runtime?.sendMessage) {
					chrome.runtime.sendMessage({
						action: 'areaSelectUpdate',
						links,
					}).catch(() => {});
				}
			} catch { }
		}


		#createToolbar(shadow) {
			const toolbar = this.#host.createElement('div');
			toolbar.className = 'fm-as-toolbar';
			this.#host.setHTML(toolbar, `
				<div class="fm-as-toolbar-hint">
					<span class="fm-as-icon">${this.#icon('squareDashedMousePointer')}</span>
					<span>${this.#msg('areaSelectHint')}</span>
				</div>
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
				<div class="fm-as-divider"></div>
				<button class="fm-as-btn fm-as-btn-icon" title="${this.#msg('areaSelectCancel')}" data-ref="cancelBtn">${this.#icon('x')}</button>
			`);

			const ref = (name) => toolbar.querySelector(`[data-ref="${name}"]`);
			const openBtn = ref('openBtn');
			const copyBtn = ref('copyBtn');
			openBtn.addEventListener('click', (e) => { e.stopPropagation(); this.#onOpenAll(); });
			copyBtn.addEventListener('click', (e) => { e.stopPropagation(); this.#onCopyLinks(); });
			ref('cancelBtn').addEventListener('click', (e) => { e.stopPropagation(); this.#broadcastExit(); });

			shadow.appendChild(toolbar);
			this.#toolbar = {
				root: toolbar,
				hintLabel: toolbar.querySelector('.fm-as-toolbar-hint'),
				actionGroup: toolbar.querySelector('.fm-as-action-group'),
				openBtn,
				openLabel: ref('openLabel'),
				copyBtn,
			};

			this.#createModal(shadow);
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
			ref('cancelBtn').addEventListener('click', () => { modal.style.display = 'none'; });
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
			const msgKey = count === 1 ? 'areaSelectOpenOne' : 'areaSelectOpen';
			this.#toolbar.openLabel.textContent = this.#msg(msgKey).replaceAll('%count%', String(count));
			this.#toolbar.openBtn.disabled = count === 0;
			this.#toolbar.copyBtn.disabled = count === 0;
			if (count === 0) this.#showToolbarHint();
			else this.#showToolbarActions();
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

		#onOpenAll() {
			const urls = this.#getDeduplicatedUrls();
			if (urls.length === 0) return;

			if (urls.length > this.#warnThreshold) {
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
			try {
				if (chrome.runtime?.sendMessage) {
					chrome.runtime.sendMessage({
						action: 'areaSelectBatchOpen',
						urls,
						operationInterval: this.#operationInterval,
					}).catch(() => {});
				}
			} catch { }
			this.#broadcastExit();
		}

		#onCopyLinks() {
			const urls = this.#getDeduplicatedUrls();
			if (urls.length === 0) return;
			if (window.FlowMouseUtils?.copyText) {
				window.FlowMouseUtils.copyText(urls.join('\n'));
			}
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
					border: 2px dashed #4A90D9;
					background: rgba(74, 144, 217, 0.15);
					pointer-events: none;
					z-index: 2147483647;
					box-sizing: border-box;
				}
				.fm-as-toolbar {
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
					}
				}
			}
		}
	});

	function initGestures() {
		initGesturesCalled = true;
		const { DEFAULT_GESTURES, DEFAULT_SETTINGS, ACTION_DEFAULTS, DRAG_ACTION_DEFAULTS, ACTION_KEYS, LOCAL_ACTIONS, TEXT_DRAG_ACTIONS, LINK_DRAG_ACTIONS, IMAGE_DRAG_ACTIONS } = window.GestureConstants;
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
				return await chrome.runtime.sendMessage(message);
			} catch (e) {
			}
		}

		function getActionHintText(action, type) {
			const dragActionKeyMap = { text: TEXT_DRAG_ACTIONS, link: LINK_DRAG_ACTIONS, image: IMAGE_DRAG_ACTIONS };
			const key = dragActionKeyMap[type]?.[action];
			return key ? msg(key) : '';
		}

		function getDragHints(type, pattern, dragContent, parentLink) {
			const gestures = getGesturesForDragType(type);
			if (!gestures) return [];

			const configs = getDragGestureConfigs(gestures, pattern);
			const rawHints = [];
			for (const cfg of configs) {
				let action = cfg.action || 'none';
				if (action === 'none') continue;
				if (action === 'search' && type === 'text' && cfg.autoDetectUrl === true && dragContent && tryParseAsUrl(dragContent, false)) {
					rawHints.push(cfg.customNameAutoDetectUrl || msg('dragActionOpenTabLink'));
				} else if (action === 'openTab' && type === 'image' && cfg.preferLink === true && parentLink) {
					rawHints.push(cfg.customNamePreferLink || msg('dragActionOpenTabLink'));
				} else if (cfg.customName) {
					rawHints.push(cfg.customName);
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
			return gestures.filter(g => g.direction === dir).map(g => ({ ...DRAG_ACTION_DEFAULTS[g.action], ...g }));
		}

		function isEditableTarget(e) {
			const node = e.composedPath()[0];
			const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
			const tag = el.tagName;
			return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
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
			const customName = SETTINGS.mouseGestures?.[pattern]?.customName;
			if (customName) return customName;
			if (action === 'actionChain') {
				const config = SETTINGS.mouseGestures?.[pattern];
				const chain = SETTINGS.actionChains?.[config?.chainId];
				if (chain?.name) return chain.name;
				if (!chain) return `${msg(ACTION_KEYS[action])} ${msg('chainNotFound')}`;
			}
			if (action === 'customMenu') {
				const config = SETTINGS.mouseGestures?.[pattern];
				const menuDef = SETTINGS.customMenus?.[config?.menuId];
				if (menuDef?.name) return menuDef.name;
				if (!menuDef) return `${msg(ACTION_KEYS[action])} ${msg('menuNotFound')}`;
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

		function getSuggestedGestures(currentPattern) {
			const source = SETTINGS.enableGestureCustomization
				? (SETTINGS.mouseGestures || {})
				: DEFAULT_GESTURES;
			const suggestions = [];
			for (const pattern of Object.keys(source)) {
				if (!pattern.startsWith(currentPattern)) continue;
				if (pattern.length !== currentPattern.length + 1) continue;
				const actionName = getActionName(pattern);
				if (!actionName) continue;
				suggestions.push({ pattern, actionName });
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

				eventManager.update();
			});
		}

		chrome.storage.onChanged.addListener((changes, namespace) => {
			if (namespace === 'sync') {
				const keys = Object.keys(changes);
				if (keys.length === 1 && keys[0] === 'blacklist') return;

				loadSettings();
			}
		});

		loadSettings();

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
					case 'updateSuggestedGestures': visualizer.updateSuggestedGestures(d.suggestions, d.currentPattern); break;
				}
			}

			if (request.action === 'gestureScrollUpdate' && !isIframe) {
				handleScroll(request.data.action, request.data.scrollConfig, true);
			}

			if (request.action === 'showDownloadError' && !isIframe) {
				toaster.showToast(msg('downloadErrorHotlink'), { duration: 5000 });
			}

			if (request.action === 'areaSelectEnter') {
				if (window.FlowMouseAreaSelect && !window.FlowMouseAreaSelect.isActive) {
					const lang = window.ContentI18n.getHtmlLang();
					const isRtl = window.ContentI18n.getDir() === 'rtl';
					window.FlowMouseAreaSelect.enter(isIframe, request.warnThreshold, lang, isRtl, undefined, {
						textUrl: request.textUrl,
						operationInterval: request.operationInterval,
						customCss: SETTINGS.customCss,
					});
				}
			}

			if (request.action === 'areaSelectExit') {
				if (window.FlowMouseAreaSelect) {
					window.FlowMouseAreaSelect.exit();
				}
			}

			if (request.action === 'areaSelectUpdate' && !isIframe) {
				if (window.FlowMouseAreaSelect) {
					window.FlowMouseAreaSelect.updateFromFrame(request.frameId, request.links);
				}
			}

			if (request.action === 'pauseGesture') {
				isBlacklisted = true;
				resetState();
				eventManager.dispose();
				visualizer.cleanup();
				toaster.cleanup();
				ctxMenu.close();
				window.FlowMouseAreaSelect?.exit();
			}
		});

		let gestureState = {
			isRightButton: false,
			gestureButton: null,
			isDrag: false,
			selectedText: '',
			dragElement: null,
			dragType: null,
			parentLink: null,
			startTarget: null,
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
			gestureState.selectedText = '';
			gestureState.dragElement = null;
			gestureState.dragType = null;
			gestureState.startTarget = null;
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
					safeSendMessage({ action: 'gestureHudUpdate', data: { type: 'updateAction', arrows, texts } });
				} else {
					super.updateAction(arrows, texts);
				}
			}

			updateSuggestedGestures(suggestions, currentPattern) {
				if (isIframe) {
					safeSendMessage({ action: 'gestureHudUpdate', data: { type: 'updateSuggestedGestures', suggestions, currentPattern } });
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
		}

		const visualizer = new RelayGestureOverlay();
		const toaster = new window.ToastOverlay();
		const ctxMenu = new ContentContextMenu();

		const isGestureEnabled = () => SETTINGS.enableGesture && !isBlacklisted;
		const isWheelGestureEnabled = () => SETTINGS.enableWheelGestures && !isBlacklisted;
		const isSpecialGestureEnabled = () => SETTINGS.enableSpecialGestures && !isBlacklisted;
		const isDragEnabled = () => SETTINGS.enableDrag && !isBlacklisted;
		const eventManager = new window.EventManager();

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
				window.FlowMouseAreaSelect?.exit();
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
					window.FlowMouseAreaSelect?.exit();
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
			if (window.FlowMouseAreaSelect?.isActive) return;
			areaSelectPending = { event: e, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
		}, true);

		eventManager.add(isAreaSelectModifierEnabled, window, 'pointermove', (e) => {
			if (!areaSelectPending || e.pointerId !== areaSelectPending.pointerId) return;
			const dx = e.clientX - areaSelectPending.x;
			const dy = e.clientY - areaSelectPending.y;
			if (dx * dx + dy * dy < 9) return;
			const pending = areaSelectPending;
			areaSelectPending = null;
			if (window.FlowMouseAreaSelect?.isActive) return;
			const lang = window.ContentI18n.getHtmlLang();
			const isRtl = window.ContentI18n.getDir() === 'rtl';
			const warnThreshold = SETTINGS.areaSelectWarnThreshold || 0;
			const initialEvent = pending.event.pointerType !== 'pen' ? pending.event : null;
			window.getSelection()?.removeAllRanges();
			window.FlowMouseAreaSelect?.enter(isIframe, warnThreshold, lang, isRtl, initialEvent, {
				textUrl: SETTINGS.areaSelectTextUrl,
				operationInterval: SETTINGS.areaSelectDelay,
				customCss: SETTINGS.customCss,
			});
			safeSendMessage({
				action: 'areaSelect',
				warnThreshold,
				textUrl: SETTINGS.areaSelectTextUrl,
				operationInterval: SETTINGS.areaSelectDelay,
			});
			e.preventDefault();
			e.stopImmediatePropagation();
		}, true);

		eventManager.add(isAreaSelectModifierEnabled, window, 'pointerup', (e) => {
			if (areaSelectPending?.pointerId === e.pointerId) areaSelectPending = null;
		}, true);

		eventManager.add(isAreaSelectModifierEnabled, window, 'dragstart', (e) => {
			if (areaSelectPending || window.FlowMouseAreaSelect?.isActive) {
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

		eventManager.add(isGestureEnabled, window, 'pointerdown', (e) => {
			if (isTriggerButton(e.pointerType, e.button)) {
				if (e.composedPath().some(el => el.hasAttribute && el.hasAttribute('data-gesture-ignore'))) return;

				ctxMenu.close();
				gestureState.isRightButton = true;
				gestureState.gestureButton = e.button;
				gestureState.isDrag = false;
				gestureState.preventContextMenu = false;
				gestureState.startTarget = e.composedPath()[0];
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
				executeAction(specialConfig.action, specialConfig, { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY }, gestureState.startTarget);
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
				executeAction(specialConfig.action, specialConfig, { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY }, gestureState.startTarget);
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

		function restoreDraggable() {
			window.removeEventListener('mouseup', restoreDraggable, true);
			window.removeEventListener('dragend', restoreDraggable, true);

			const modified = document.querySelectorAll('[data-flowmouse-modified="true"]');
			modified.forEach(el => {
				el.setAttribute('draggable', 'false');
				el.removeAttribute('data-flowmouse-modified');
			});
		}

		eventManager.add(isDragEnabled, window, 'dragstart', (e) => {
			if (!isExtensionContextValid()) return;

			const path = e.composedPath();

			const dragSource = path[0];
			if (dragSource && dragSource.nodeType === Node.ELEMENT_NODE) {
				const cursor = window.getComputedStyle(dragSource).cursor;
				if ((cursor === 'grab' || cursor === 'grabbing' || cursor === 'move')
					&& !window.getSelection().toString().trim()) {
					return;
				}
			}

			let dragContent = null;
			let dragElement = null;
			let dragType = null;

			const dtItems = [...e.dataTransfer.items];
			let isImage = dtItems.some(i => i.kind === 'file' && i.type.startsWith('image/'));
			const isLink = !isImage && dtItems.some(i => i.type === 'text/uri-list');
			const isText = !isImage && !isLink && dtItems.some(i => i.type === 'text/plain' || i.type === 'text/html');

			if (SETTINGS.enableImageDrag && isImage) {
				let targetImg = path.find(el => el.tagName === 'IMG');


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
						dragContent = text;
						dragType = 'text';
					}
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

		eventManager.add(isDragEnabled, window, 'dragover', (e) => {
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
				const hints = getDragHints(gestureState.dragType, result.pattern, gestureState.selectedText, gestureState.parentLink);
				visualizer.updateAction(hints.length > 0 ? result.pattern : '', hints);
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

		let dropHandledAction = false;
		eventManager.add(isDragEnabled, window, 'dragend', (e) => {
			if (dropHandledAction) {
				dropHandledAction = false;
				e.preventDefault();
			}
			resetState();
		}, { capture: true });

		eventManager.add(isDragEnabled, window, 'drop', (e) => {
			try {
				if (gestureState.isDrag && recognizer.isActive()) {
					if (gestureState.dropOnInputSuppressed) return;
					const pattern = recognizer.getPattern();
					if (hasDragAction(gestureState.dragType, pattern)) {
						dropHandledAction = true;
						e.preventDefault();
						executeDragGesture({ ...gestureState, startX: recognizer.startX, startY: recognizer.startY }, pattern, e.dataTransfer);
					}
				}
			} catch (error) {
			} finally {
				resetState();
			}
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
				executeAction(wheelConfig.action, wheelConfig, { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY }, gestureState.startTarget);
			}
		}, { capture: true });

		function handleWheelGesture(e) {
			if (!(e.buttons & 2)) return;
			if (recognizer.isActive()) return;
			if (e.deltaY === 0) return;

			const gestureKey = e.deltaY < 0 ? 'scrollUpHoldingRight' : 'scrollDownHoldingRight';
			const scrollConfig = (SETTINGS.wheelGestures || {})[gestureKey];
			const action = scrollConfig?.action;
			if (!action || action === 'none') return;

			e.preventDefault();
			e.stopImmediatePropagation();
			gestureState.preventContextMenu = true;
			gestureState.isRightButton = false;
			recognizer.reset();
			wheelGestureTriggered = true;

			executeAction(action, scrollConfig, { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY }, gestureState.startTarget);
		}

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

		function faviconFor(url) {
			try { return `/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`; } catch { return ''; }
		}
		function resolveSearchLink(cfg) {
			const catalog = window.FlowMouseEngineCatalogApi ? window.FlowMouseEngineCatalogApi.ENGINE_CATALOG : [];
			const se = SETTINGS.searchEngines || {};
			const link = window.FlowMouseEngineRegistry.resolveMenuItemLink(catalog, se, cfg);
			if (!link) return null;
			let icon = '';
			if (cfg.engineId) {
				const b = window.FlowMouseEngineCatalogApi ? window.FlowMouseEngineCatalogApi.getEngine(cfg.engineId) : null;
				icon = (b && b.icon) ? b.icon : faviconFor(link.url);
			} else {
				icon = faviconFor(link.url);
			}
			return { ...link, icon };
		}
		function resolveContextualMenuId(menus) {
			// First menu (in object order) whose patterns match the current URL; else first with empty patterns.
			const url = location.href;
			const entries = Object.entries(menus || {});
			for (const [id, m] of entries) {
				const pats = m?.patterns || [];
				if (pats.length && window.FlowMouseSearchUrl.matchesPatterns(url, pats)) return id;
			}
			for (const [id, m] of entries) {
				if (!m?.patterns || m.patterns.length === 0) return id;
			}
			return null;
		}

		async function executeAction(action, config = {}, cursor = {}, startTarget = null, useActiveTab = false) {
			if (!action || action === 'none') return false;
			if (!isExtensionContextValid()) return false;

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
						if (isIframe && !checkScrollFeasibility(action, cursor.startX, cursor.startY)) {
							safeSendMessage({ action: 'gestureScrollUpdate', data: { action, scrollConfig } });
							break;
						}
						handleScroll(action, scrollConfig, false, cursor.startX, cursor.startY);
						break;
					case 'stopLoading': window.stop(); break;
					case 'copyUrl': copyText(location.href); break;
					case 'copyTitle': copyText(document.title); break;
					case 'copyTitleAndUrl': {
						if (mergedConfig.asMarkdown) {
							const t = document.title.replace(/([\[\]])/g, '\\$1');
							const u = location.href.replace(/([()])/g, '\\$1');
							copyText(`[${t}](${u})`);
						} else {
							copyText(`${document.title}\n${location.href}`);
						}
						break;
					}
					case 'printPage': window.print(); break;
					case 'sendCustomEvent': {
						const eventType = mergedConfig.eventType;
						if (eventType) {
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
								};
							}
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
					case 'pasteClipboard': {
						try {
							const permResult = await safeSendMessage({ action: 'requestPermission', permissions: ['clipboardRead'] });
							if (!permResult?.granted) break;
							if (startTarget) startTarget.focus();
							document.execCommand('paste');
						} catch { }
						break;
					}
					case 'pasteContent': {
						try {
							const content = mergedConfig.content || '';
							if (!content) break;
							if (startTarget) startTarget.focus();
							document.execCommand('insertText', false, content);
						} catch { }
						break;
					}
					case 'searchClipboard': {
						const permResult = await safeSendMessage({ action: 'requestPermission', permissions: ['clipboardRead'] });
						if (!permResult?.granted) break;
						const clipText = (await navigator.clipboard.readText() || '').trim();
						if (!clipText) break;
						const position = mergedConfig.position || 'right';
						const active = mergedConfig.active !== false;
						const incognito = !!mergedConfig.incognito;
						// autoDetectUrl: keep existing tryParseAsUrl logic (more thorough than buildSearchUrl's looksLikeUrl)
						if (mergedConfig.autoDetectUrl) {
							const detectedUrl = tryParseAsUrl(clipText, false);
							if (detectedUrl) {
								await safeSendMessage({ action: 'openTabAtPosition', url: detectedUrl, position, active, incognito });
								break;
							}
						}
						// delegate engine/custom/system URL construction to pure function (autoDetectUrl already handled above)
						const catalog = window.FlowMouseEngineCatalogApi ? window.FlowMouseEngineCatalogApi.ENGINE_CATALOG : [];
						const se = SETTINGS.searchEngines || {};
						const resolved = window.FlowMouseSearchUrl.resolveSearchConfig(catalog, se, { ...mergedConfig, autoDetectUrl: false });
						const url = window.FlowMouseSearchUrl.buildSearchUrl(resolved, clipText, {});
						if (url === null) {
							await safeSendMessage({ action: 'systemSearch', query: clipText, position, active, incognito });
						} else {
							await safeSendMessage({ action: 'openTabAtPosition', url, position, active, incognito });
						}
						break;
					}
					case 'searchLink': {
						const cfg = mergedConfig;
						const link = resolveSearchLink(cfg);
						if (!link) break;
						let text = (typeof cfg.__selectionText === 'string'
							? cfg.__selectionText
							: (window.getSelection()?.toString() || '')).trim();
						const position = cfg.position || 'right';
						const active = cfg.active !== false;
						const incognito = !!cfg.incognito;
						if (window.FlowMouseEngineRegistry.isClipboardLink(link)) {
							if (text) copyText(text);
							await safeSendMessage({ action: 'openTabAtPosition', url: link.url, position, active, incognito });
							break;
						}
						if (link.transformEnabled && link.transformCode) {
							let clip = '';
							if (link.transformClipboard) {
								const granted = await safeSendMessage({ action: 'requestPermission', permissions: ['clipboardRead'] });
								if (granted && granted.granted) {
									try { clip = (await navigator.clipboard.readText()) || ''; } catch (e) { clip = ''; }
								}
							}
							const res = await safeSendMessage({ action: 'runTransform', code: link.transformCode, selection: text, clipboard: clip });
							if (!res || !res.ok) {
								const emsg = (res && res.error) || 'error';
								if (typeof toaster !== 'undefined' && toaster && toaster.showToast) {
									toaster.showToast(msg('transformFailed').replace('%error%', emsg), { duration: 4000 });
								} else {
									console.warn('[FlowMouse] search-link transform failed:', emsg);
								}
								break;
							}
							text = res.result;
							if (link.transformRawResult) link.rawTerm = true;
						}
						// A catalog entry (engineId) is always a search; a custom link with %s is a search.
						// A custom link without %s is a fixed link → open directly, ignoring any selection.
						const isFixedLink = !cfg.engineId && !!cfg.url && !cfg.url.includes('%s');
						if (isFixedLink) {
							const fixedUrl = window.FlowMouseSearchUrl.buildSearchUrl({ ...link }, '', {});
							await safeSendMessage({ action: 'openTabAtPosition', url: fixedUrl, position, active, incognito });
							break;
						}
						if (!text) break;
						const searchUrl = window.FlowMouseSearchUrl.buildSearchUrl(link, text, {});
						if (searchUrl === null) {
							await safeSendMessage({ action: 'systemSearch', query: text, position, active, incognito });
						} else {
							await safeSendMessage({ action: 'openTabAtPosition', url: searchUrl, position, active, incognito });
						}
						break;
					}
					case 'menuShowTabs': {
						const fetchPromise = safeSendMessage({
							action: 'getTabList',
							sortOrder: mergedConfig.sortOrder,
							maxItems: mergedConfig.maxItems,
						});
						ctxMenu.prepare(cursor.endX, cursor.endY, { scrollToBottom: mergedConfig.scrollToBottom });
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
						} else {
							ctxMenu.close();
						}
						break;
					}
					case 'menuRecentlyClosed': {
						const fetchPromise = safeSendMessage({
							action: 'getRecentlyClosedTabs',
							maxItems: mergedConfig.maxItems,
							sortOrder: mergedConfig.sortOrder,
						});
						ctxMenu.prepare(cursor.endX, cursor.endY, { scrollToBottom: mergedConfig.scrollToBottom });
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
						} else {
							ctxMenu.close();
						}
						break;
					}
					case 'menuShowBookmarks': {
						const fetchPromise = safeSendMessage({
							action: 'getBookmarks',
							folderId: mergedConfig.folderId || '1',
							sortOrder: mergedConfig.sortOrder,
							maxItems: mergedConfig.maxItems,
						});
						ctxMenu.prepare(cursor.endX, cursor.endY, { scrollToBottom: mergedConfig.scrollToBottom });
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
						} else {
							ctxMenu.close();
						}
						break;
					}
					case 'customMenu': {
						const menuId = mergedConfig.contextual
							? resolveContextualMenuId(SETTINGS.customMenus)
							: mergedConfig.menuId;
						const menuDef = SETTINGS.customMenus?.[menuId];
						const menuItems = menuDef?.items;
						if (!menuItems) break;
						const menuSelectionText = (window.getSelection()?.toString() || '').trim();
						ctxMenu.prepare(cursor.endX, cursor.endY);
						const items = menuItems
							.filter(it => it === 'separator' || (it.action && it.action !== 'none'))
							.map(it => {
								if (it === 'separator') return 'separator';
								let label = it.customName;
								if (!label && it.action === 'actionChain') {
									const chain = SETTINGS.actionChains?.[it.chainId];
									label = chain?.name || msg(ACTION_KEYS[it.action]);
								}
								if (it.action === 'searchLink') {
									const rl = resolveSearchLink({ ...(ACTION_DEFAULTS['searchLink'] || {}), ...it });
									label = it.customName || rl?.name || msg(ACTION_KEYS['searchLink']);
									return {
										label,
										icon: rl ? rl.icon : '',
										onClick: () => {
											const itemConfig = { ...(ACTION_DEFAULTS[it.action] || {}), ...it };
											itemConfig.__selectionText = menuSelectionText;
											executeAction(it.action, itemConfig, cursor, startTarget);
										}
									};
								}
								if (!label) label = msg(ACTION_KEYS[it.action]) || it.action;
								return {
									label,
									onClick: () => {
										const itemConfig = { ...(ACTION_DEFAULTS[it.action] || {}), ...it };
										executeAction(it.action, itemConfig, cursor, startTarget);
									}
								};
							});
						ctxMenu.setItems(items);
						break;
					}
				}
			} else {
				const msg_obj = { action };
				if (useActiveTab) msg_obj.useActiveTab = true;
				if (action === 'openCustomUrl') {
					const rawUrl = mergedConfig.customUrl || '';
					msg_obj.customUrl = rawUrl;
					msg_obj.position = mergedConfig.position || 'last';
					msg_obj.active = mergedConfig.active !== false;
					msg_obj.incognito = !!mergedConfig.incognito;
				} else if (action === 'closeTab') {
					msg_obj.keepWindow = !!mergedConfig.keepWindow;
					msg_obj.afterClose = mergedConfig.afterClose || 'default';
					msg_obj.skipPinned = !!mergedConfig.skipPinned;
				} else if (action === 'closeOtherTabs' || action === 'closeLeftTabs' || action === 'closeRightTabs') {
					msg_obj.skipPinned = !!mergedConfig.skipPinned;
					msg_obj.preserveTab = !!mergedConfig.preserveTab;
				} else if (action === 'closeAllTabs') {
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
					msg_obj.active = mergedConfig.active !== false;
				} else if (action === 'newWindow') {
					msg_obj.focused = mergedConfig.focused !== false;
				} else if (action === 'viewPageSource') {
					msg_obj.position = mergedConfig.position || 'right';
					msg_obj.active = mergedConfig.active !== false;
				} else if (action === 'zoomIn' || action === 'zoomOut') {
					msg_obj.zoomMode = mergedConfig.zoomMode || 'browser';
					msg_obj.zoomDelta = Number(mergedConfig.zoomDelta) || 10;
				} else if (action === 'resetZoom') {
					msg_obj.resetZoomLevel = Number(mergedConfig.resetZoomLevel) || 0;
				} else if (action === 'addToBookmarks') {
					msg_obj.folderId = mergedConfig.folderId || '';
				} else if (action === 'actionChain') {
					const chainId = mergedConfig.chainId;
					const chain = SETTINGS.actionChains?.[chainId];
					if (chain?.steps?.length) {
						msg_obj.steps = chain.steps
							.filter(s => s.action && s.action !== 'none' && s.action !== 'actionChain')
							.map(s => ({ ...(ACTION_DEFAULTS[s.action] || {}), ...s }));
					}
				} else if (action === 'areaSelect') {
					msg_obj.warnThreshold = SETTINGS.areaSelectWarnThreshold;
					msg_obj.textUrl = SETTINGS.areaSelectTextUrl;
					msg_obj.operationInterval = SETTINGS.areaSelectDelay;
				} else if (action === 'sendExtensionMessage') {
					msg_obj.extensionId = mergedConfig.extensionId || '';
					msg_obj.message = mergedConfig.message || '{}';
				} else if (action === 'addSiteToMenu') {
					msg_obj.menuId = mergedConfig.menuId;
				}
				return await safeSendMessage(msg_obj);
			}
			return true;
		}

		function executeGesture(pattern) {
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
			executeAction(action, config, { startX: recognizer.startX, startY: recognizer.startY, endX: recognizer.currentX, endY: recognizer.currentY }, gestureState.startTarget);
		}

		function resolveTabTarget(config, state) {
			const { selectedText: content, dragType, parentLink } = state;

			switch (config.action) {
				case 'search': {
					if (config.autoDetectUrl === true && dragType === 'text') {
						const url = tryParseAsUrl(content, false);
						if (url) return { url };
					}
					const catalog = window.FlowMouseEngineCatalogApi ? window.FlowMouseEngineCatalogApi.ENGINE_CATALOG : [];
					const se = SETTINGS.searchEngines || {};
					const resolved = window.FlowMouseSearchUrl.resolveSearchConfig(catalog, se, { ...config, autoDetectUrl: false });
					const url = window.FlowMouseSearchUrl.buildSearchUrl(resolved, content, {});
					if (url === null) return { query: content };
					return { url };
				}
				case 'openTab':
					return { url: (dragType === 'image' && config.preferLink === true && parentLink) ? parentLink : content };
				default:
					return null;
			}
		}

		const COPY_ACTION_RESOLVERS = {
			'copy':         (state) => state.selectedText,
			'copyLink':     (state) => state.selectedText,
			'copyLinkText': (state) => state.dragElement ? (state.dragElement.innerText || state.dragElement.textContent || '') : null,
			'copyLinkAndText': (state, config) => {
				const text = state.dragElement ? (state.dragElement.innerText || state.dragElement.textContent || '') : '';
				const link = state.selectedText || '';
				if (!text && !link) return null;
				if (config.asMarkdown && link) {
					const t = (text || link).replace(/([\[\]])/g, '\\$1');
					const u = link.replace(/([()])/g, '\\$1');
					return `[${t}](${u})`;
				}
				return [text, link].filter(Boolean).join('\n');
			},
			'copyImageUrl': (state) => state.selectedText,
		};

		async function executeDragGesture(state, pattern, dataTransfer) {
			if (!pattern) return;
			if (!isExtensionContextValid()) return;

			const gestures = getGesturesForDragType(state.dragType);
			if (!gestures) return;

			let configs = getDragGestureConfigs(gestures, pattern);

			const copyTexts = [];
			configs = configs.filter(config => {
				const resolver = COPY_ACTION_RESOLVERS[config.action || 'none'];
				if (!resolver) return true;
				const text = resolver(state, config);
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

			const { position, active, incognito } = config;

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
								toaster.showToast(toastMsg, { duration: 5000 });
							});
					}
					break;

				case 'imageSearch': {
					const catalog = window.FlowMouseEngineCatalogApi ? window.FlowMouseEngineCatalogApi.ENGINE_CATALOG : [];
					const se = SETTINGS.searchEngines || {};
					const engineId = window.FlowMouseEngineRegistry.normalizeImageEngineId(config.engine);
					let imgUrl = content;
					let cfgForBuild;
					if (engineId === 'custom') {
						cfgForBuild = { engine: 'custom', url: config.url || '' };
					} else {
						const eng = window.FlowMouseEngineRegistry.getEngineById(catalog, se, engineId);
						if (!eng) break;
						if (eng.transformEnabled && eng.transformCode) {
							const res = await safeSendMessage({ action: 'runTransform', code: eng.transformCode, selection: imgUrl, clipboard: '' });
							if (!res || !res.ok) {
								const emsg = (res && res.error) || 'error';
								if (typeof toaster !== 'undefined' && toaster && toaster.showToast) {
									toaster.showToast(msg('transformFailed').replace('%error%', emsg), { duration: 4000 });
								} else { console.warn('[FlowMouse] image-search transform failed:', emsg); }
								break;
							}
							imgUrl = res.result;
						}
						cfgForBuild = { engine: 'custom', url: eng.url, plus: eng.plus, slug: eng.slug, suffix: eng.suffix, rawTerm: eng.rawResult };
					}
					const url = window.FlowMouseSearchUrl.buildSearchUrl(cfgForBuild, imgUrl, {});
					if (url) await safeSendMessage({ action: 'openTabAtPosition', url, position, active, incognito });
					break;
				}

				case 'sendCustomEvent': {
					const eventType = config.eventType;
					if (eventType) {
						let detail = {};
						try {
							detail = JSON.parse(config.eventDetail || '{}');
						} catch { }
						if (config.gestureInfo) {
							detail.gesture = {
								dragType,
								data: content,
								startX: state.startX,
								startY: state.startY,
							};
						}
						window.dispatchEvent(new CustomEvent(eventType, { detail, bubbles: true, cancelable: true }));
					}
					break;
				}
			}
		}
	}
})();