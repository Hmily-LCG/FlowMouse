import { LitElement, html, css } from './lib/lit-core.min.js';


const CUSTOM_CSS_CACHE_KEY = 'fm:customCss';

class FmContextMenu extends LitElement {
	static shadowRootOptions = { ...LitElement.shadowRootOptions, mode: 'closed' };

	static properties = {
		_items: { state: true },
		_customCss: { state: true },
		preview: { type: Boolean },
		previewItems: { attribute: false },
		previewCss: { attribute: false },
	};

	static styles = css`
		:host {
			display: block;
			user-select: none;
		}

		.fm-ctx-menu {
			font-family: 'Segoe UI', sans-serif;
			font-size: 12.5px;
			line-height: 19px;
			color: #1d1d1f;

			width: max-content;
			min-width: 160px;
			max-width: 340px;
			list-style: none;
			margin: 0;
			padding: 4px 0;
		}

		.fm-ctx-menu.loaded {
			width: auto;
			max-width: 343px; 
		}

		.fm-ctx-item {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 4px 12px;
			min-height: 16px;
			cursor: default;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.fm-ctx-item:hover,
		.fm-ctx-item:focus-visible {
			background: rgba(0, 0, 0, 0.08);
		}

		:host(.fm-ctx-menu--wheel) .fm-ctx-item:focus {
			outline: none;
		}

		:host(.fm-ctx-menu--wheel) .fm-ctx-item:hover:not(:focus) {
			background: rgba(0, 0, 0, 0);
		}

		.fm-ctx-icon {
			width: 16px;
			height: 16px;
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.fm-ctx-icon img {
			width: 16px;
			height: 16px;
			object-fit: contain;
			border-radius: 3px;
		}

		.fm-ctx-label {
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.fm-ctx-item--active .fm-ctx-label {
			font-weight: 600;
		}

		.fm-ctx-time {
			flex-shrink: 0;
			opacity: 0.45;
			font-size: 0.9em;
			padding-inline-start: 8px;
			text-autospace: normal;
		}

		.fm-ctx-sep {
			height: 1px;
			margin: 4px 10px;
			background: rgba(0, 0, 0, 0.1);
		}

		.fm-ctx-item--empty {
			margin-block: 1px;
			pointer-events: none;
			opacity: 0.35;
			justify-content: center;
		}

		@media (prefers-color-scheme: dark) {
			.fm-ctx-menu {
				color: #e5e5e7;
			}
			.fm-ctx-item:hover,
			.fm-ctx-item:focus-visible {
				background: rgba(255, 255, 255, 0.1);
			}
			:host(.fm-ctx-menu--wheel) .fm-ctx-item:hover:not(:focus) {
				background: rgba(255, 255, 255, 0);
			}
			.fm-ctx-sep {
				background: rgba(255, 255, 255, 0.1);
			}
		}
	`;

	#menuId = null;
	#rtf = null;
	#dimensionsSent = false;
	#scrollToBottom = false;
	#wheelDir = null;
	#wheelMode = false;
	#wheelThreshold = 0;
	#tabZoom = 1;
	#wheelAccum = 0;
	#wheelLastDir = 0;

	constructor() {
		super();
		this._items = null;
		this.preview = false;
		this.previewItems = null;
		this.previewCss = '';
		this._customCss = this.#readCachedCustomCss();

		const params = new URLSearchParams(location.search);
		this.#menuId = params.get('id');
		const dir = params.get('dir') || 'ltr';
		const lang = params.get('lang') || '';
		this.#scrollToBottom = params.get('bottom') === '1';
		const wheel = params.get('wheel');
		if (wheel !== null) {
			this.#wheelDir = Math.sign(Number(wheel)) || 0;
			this.#wheelMode = true;
			this.#wheelThreshold = Number(params.get('wt')) || 0;
			this.#tabZoom = Number(params.get('zoom')) || 1;
		}

		if (!this.hasAttribute('preview')) {
			document.documentElement.dir = dir;
			if (lang) document.documentElement.lang = lang;
		}

		try {
			this.#rtf = new Intl.RelativeTimeFormat(lang || undefined, { style: 'narrow', numeric: 'always' });
		} catch {
			this.#rtf = new Intl.RelativeTimeFormat(undefined, { style: 'narrow', numeric: 'always' });
		}
	}

	connectedCallback() {
		super.connectedCallback();
		if (this.preview) {
			this._items = Array.isArray(this.previewItems) ? this.previewItems : [];
			return;
		}
		window.addEventListener('contextmenu', this.#preventDefault, true);
		window.addEventListener('keydown', this.#onKeyDown, true);
		if (this.#wheelMode) {
			this.classList.add('fm-ctx-menu--wheel');
			window.addEventListener('message', this.#onWheelMessage);
			window.addEventListener('wheel', this.#onWheel, { capture: true, passive: false });
			window.addEventListener('mouseup', this.#onMouseUp, true);
		}
		this.#fetchItems();
		this.#loadCustomCss();
	}

	async #loadCustomCss() {
		try {
			const { customCss } = await chrome.storage.sync.get({ customCss: '' });
			const value = customCss || '';
			if (value !== this._customCss) {
				this._customCss = value;
				this.#writeCachedCustomCss(value);
			}
		} catch (e) {
			console.error('[FlowMouse] custom CSS load failed:', e);
		}
	}

	#readCachedCustomCss() {
		if (window.credentialless) return '';
		try {
			return localStorage.getItem(CUSTOM_CSS_CACHE_KEY) || '';
		} catch {
			return '';
		}
	}

	#writeCachedCustomCss(value) {
		if (window.credentialless) return;
		try {
			if (value) {
				localStorage.setItem(CUSTOM_CSS_CACHE_KEY, value);
			} else {
				localStorage.removeItem(CUSTOM_CSS_CACHE_KEY);
			}
		} catch {
		}
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		if (this.preview) return;
		window.removeEventListener('contextmenu', this.#preventDefault, true);
		window.removeEventListener('keydown', this.#onKeyDown, true);
		if (this.#wheelDir !== null) {
			window.removeEventListener('message', this.#onWheelMessage);
			window.removeEventListener('wheel', this.#onWheel, { capture: true, passive: false });
			window.removeEventListener('mouseup', this.#onMouseUp, true);
		}
	}

	#preventDefault = (e) => e.preventDefault();

	#onWheelMessage = (e) => {
		if (!this.#wheelMode) return;
		const request = e.data;
		if (request?.type !== 'fm-ctx-wheel' || request.menuId !== this.#menuId) return;
		if (e.source !== window.parent) return;
		if (request.delta) this.#moveFocus(request.delta);
		if (request.activate) this.#activateFocused();
	};

	#onWheel = (e) => {
		if (!this.#wheelMode || !(e.buttons & 2) || !e.deltaY) return;
		e.preventDefault();
		if (this.#accumulateWheel(e)) this.#moveFocus(Math.sign(e.deltaY));
	};

	#accumulateWheel(e) {
		const dir = Math.sign(e.deltaY);
		const isNewScroll = dir !== this.#wheelLastDir && this.#wheelLastDir !== 0;
		this.#wheelLastDir = dir;
		if (isNewScroll || e.deltaMode === 2) {
			this.#wheelAccum = 0;
			return true;
		}
		this.#wheelAccum += Math.abs(e.deltaMode === 1 ? e.deltaY * 16.67 : e.deltaY * (this.#tabZoom));
		if (this.#wheelAccum < this.#wheelThreshold) return false;
		this.#wheelAccum = 0;
		return true;
	}

	#onMouseUp = (e) => {
		if (!this.#wheelMode || e.button !== 2) return;
		e.stopPropagation();
		this.#activateFocused();
	};

	#focusWheelStart() {
		const items = this.#getMenuItems();
		if (!items.length) return;
		const active = items.findIndex(li => li.classList.contains('fm-ctx-item--active'));
		const index = active === -1 ? 0 : (active + this.#wheelDir + items.length) % items.length;
		items[index].focus();
		window.addEventListener('resize', () => this.renderRoot.activeElement?.scrollIntoView({ block: 'nearest' }), { once: true });
	}

	#moveFocus(delta) {
		const items = this.#getMenuItems();
		if (!items.length) return;
		const len = items.length;
		const cur = items.indexOf(this.renderRoot.activeElement);
		const next = cur === -1 ? (delta > 0 ? 0 : len - 1) : (((cur + delta) % len) + len) % len;
		items[next].focus();
	}

	#activateFocused() {
		this.#wheelMode = false;
		const index = this.renderRoot.activeElement?.dataset.index;
		if (index != null) this.#selectItem(Number(index));
	}

	#fetchItems() {
		chrome.runtime.sendMessage({ action: 'ctxMenuFetch', menuId: this.#menuId }, (response) => {
			if (chrome.runtime.lastError || !response?.items) {
				this.#close();
				return;
			}
			this._items = response.items;
		});
	}

	updated(changedProperties) {
		if (this.preview) {
			if (changedProperties.has('previewItems')) {
				this._items = Array.isArray(this.previewItems) ? this.previewItems : [];
			}
			return;
		}
		if (changedProperties.has('_items')) {
			this.#measureAndReport();
		}
	}

	#measureAndReport() {
		if (this.#dimensionsSent || this._items === null) return;
		const list = this.renderRoot.querySelector('ul');
		if (!list) return;

		const rect = list.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		this.#dimensionsSent = true;
		list.classList.add('loaded');
		chrome.runtime.sendMessage({
			action: 'ctxMenuDimensions',
			menuId: this.#menuId,
			width: Math.ceil(rect.width) + 1,
			height: Math.ceil(rect.height),
		});
		if (this.#scrollToBottom && this.#wheelDir === null) {
			requestAnimationFrame(() => { document.documentElement.scrollTop = document.documentElement.scrollHeight; });
		}
		window.focus();
		if (this.#wheelDir !== null) this.#focusWheelStart();
		window.addEventListener('blur', this.#close);
	}

	#getMenuItems() {
		return [...this.renderRoot.querySelectorAll('li[role="menuitem"]')];
	}

	#onKeyDown = (e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			this.#close();
			return;
		}

		if (!this.#getMenuItems().length) return;

		let delta = 0;
		if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) delta = 1;
		else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) delta = -1;

		if (delta) {
			e.preventDefault();
			this.#moveFocus(delta);
			return;
		}

		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			const active = this.renderRoot.activeElement;
			const index = active?.dataset.index;
			if (index != null) this.#selectItem(Number(index));
		}
	};

	#selectItem(index) {
		if (this.preview) return;
		if (Number.isFinite(index)) {
			chrome.runtime.sendMessage({ action: 'ctxMenuSelect', menuId: this.#menuId, index });
		}
	}

	#close = () => {
		if (this.preview) return;
		chrome.runtime.sendMessage({ action: 'ctxMenuClose', menuId: this.#menuId });
	};

	#formatTime(timestamp) {
		const diffSec = Math.round((timestamp - Date.now()) / 1000);
		const abs = Math.abs(diffSec);
		if (abs < 60) return this.#rtf.format(diffSec || -1, 'second');
		if (abs < 3600) return this.#rtf.format(Math.round(diffSec / 60), 'minute');
		if (abs < 86400) return this.#rtf.format(Math.round(diffSec / 3600), 'hour');
		if (abs < 2592000) return this.#rtf.format(Math.round(diffSec / 86400), 'day');
		if (abs < 31536000) return this.#rtf.format(Math.round(diffSec / 2592000), 'month');
		return this.#rtf.format(Math.round(diffSec / 31536000), 'year');
	}

	render() {
		if (this._items === null) return '';

		const customCss = this.preview ? (this.previewCss || '') : this._customCss;

		return html`
			${customCss ? html`<style>${customCss}</style>` : ''}
			<ul class="fm-ctx-menu" role="menu">
				${!this._items.length ? html`
					<li class="fm-ctx-item fm-ctx-item--empty" aria-disabled="true">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-off-icon lucide-circle-off"><path d="m2 2 20 20"/><path d="M8.35 2.69A10 10 0 0 1 21.3 15.65"/><path d="M19.08 19.08A10 10 0 1 1 4.92 4.92"/></svg>
					</li>
				` : ''}
				${this._items.map((item, i) => {
					if (item === 'separator') {
						return html`<li class="fm-ctx-sep" role="separator"></li>`;
					}

					return html`
						<li
							class="fm-ctx-item${item.active ? ' fm-ctx-item--active' : ''}"
							role="menuitem"
							tabindex="-1"
							data-index=${i}
							@click=${() => this.#selectItem(i)}
							@mouseup=${(e) => { if (e.buttons === 0 && (e.button === 0 || e.button === 2)) this.#selectItem(i); }}
						>
							<span class="fm-ctx-icon">
								${item.icon ? html`<img src="${item.icon}" alt="" draggable="false">` : ''}
							</span>
							<span class="fm-ctx-label">${item.label || ''}</span>
							${item.time ? html`<span class="fm-ctx-time">${this.#formatTime(item.time)}</span>` : ''}
						</li>
					`;
				})}
			</ul>
		`;
	}
}

customElements.define('fm-context-menu', FmContextMenu);