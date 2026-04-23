import './lib/lit-config.js';
import { LitElement, html, css } from './lib/lit-all.min.js';

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
			.fm-ctx-sep {
				background: rgba(255, 255, 255, 0.1);
			}
		}
	`;

	#menuId = null;
	#rtf = null;
	#dimensionsSent = false;
	#scrollToBottom = false;

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
		try {
			return localStorage.getItem(CUSTOM_CSS_CACHE_KEY) || '';
		} catch {
			return '';
		}
	}

	#writeCachedCustomCss(value) {
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
	}

	#preventDefault = (e) => e.preventDefault();

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

		const sendDimensions = (width, height) => {
			if (this.#dimensionsSent) return;
			this.#dimensionsSent = true;
			list.classList.add('loaded');
			chrome.runtime.sendMessage({
				action: 'ctxMenuDimensions',
				menuId: this.#menuId,
				width,
				height,
			});
			if (this.#scrollToBottom) {
				requestAnimationFrame(() => { document.documentElement.scrollTop = document.documentElement.scrollHeight; });
			}
			window.focus();
			window.addEventListener('blur', this.#close);
		};

		const resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[entries.length - 1];
			const size = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
			resizeObserver.disconnect();
			sendDimensions(Math.ceil(size.inlineSize) + 1, Math.ceil(size.blockSize));
		});

		resizeObserver.observe(list, { box: 'border-box' });

		const rect = list.getBoundingClientRect();
		if (!this.#dimensionsSent && rect.width > 0 && rect.height > 0) {
			resizeObserver.disconnect();
			sendDimensions(Math.ceil(rect.width) + 1, Math.ceil(rect.height));
		}
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

		const items = this.#getMenuItems();
		if (!items.length) return;

		let delta = 0;
		if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) delta = 1;
		else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) delta = -1;

		if (delta) {
			e.preventDefault();
			const active = this.renderRoot.activeElement;
			const cur = items.indexOf(active);
			const next = cur === -1 ? (delta > 0 ? 0 : items.length - 1) : (cur + delta + items.length) % items.length;
			items[next].focus();
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