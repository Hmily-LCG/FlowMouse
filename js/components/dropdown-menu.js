import { LitElement, html, css, nothing, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { icon } from '../icons.js';
import { tooltip } from '../directives/tooltip.js';


const GAP = 4;
const VIEWPORT_PAD = 6;
const SUPPORTS_POPOVER = typeof HTMLElement.prototype.showPopover === 'function';

class DropdownMenu extends LitElement {
	static properties = {
		items: { type: Array },
		label: { type: String },
		icon: { type: String },
		placement: { type: String },
		_open: { state: true },
	};

	static styles = css`
		:host {
			display: inline-flex;
		}

		.trigger {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 26px;
			height: 26px;
			padding: 0;
			border: 0;
			border-radius: 6px;
			background: transparent;
			color: var(--text-muted);
			cursor: pointer;
			flex-shrink: 0;
			transition: background-color 0.15s ease, color 0.15s ease;
		}

		.trigger:hover,
		.trigger:focus-visible,
		.trigger[aria-expanded="true"] {
			background: var(--bg-tertiary);
			color: var(--text-primary);
			outline: none;
		}

		.menu {
			position: fixed;
			inset: auto;
			margin: 0;
			min-width: 140px;
			max-width: min(280px, calc(100vw - 12px));
			padding: 4px;
			border: 1px solid var(--border-color);
			border-radius: 10px;
			background: var(--card-bg);
			color: var(--text-primary);
			box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06);
			font: inherit;
			font-size: 13px;
			overflow: visible;
			z-index: 2147483647;
		}

		.menu:popover-open {
			animation: dm-fadeIn 0.1s ease;
		}

		@keyframes dm-fadeIn {
			from { opacity: 0; transform: translateY(-2px); }
			to { opacity: 1; transform: none; }
		}

		.item {
			display: flex;
			align-items: center;
			gap: 8px;
			width: 100%;
			padding: 7px 10px;
			border: 0;
			border-radius: 6px;
			background: transparent;
			color: inherit;
			font: inherit;
			text-align: start;
			cursor: pointer;
			white-space: nowrap;
		}

		.item:hover:not([aria-disabled="true"]),
		.item:focus-visible {
			background: var(--bg-tertiary);
			outline: none;
		}

		.item[aria-disabled="true"] {
			opacity: 0.4;
			cursor: default;
		}

		.item.danger {
			color: var(--danger-color);
		}

		.item-icon {
			display: flex;
			flex-shrink: 0;
			color: var(--text-muted);
		}

		.item.danger .item-icon {
			color: inherit;
		}

		.item-label {
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.separator {
			height: 1px;
			margin: 4px 2px;
			background: var(--border-color);
		}
	`;

	constructor() {
		super();
		this.items = [];
		this.label = '';
		this.icon = 'ellipsisVertical';
		this.placement = 'bottom-end';
		this._open = false;
	}

	get #trigger() {
		return this.shadowRoot.querySelector('.trigger');
	}

	get #menu() {
		return this.shadowRoot.querySelector('.menu');
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.#removeDismissListeners();
	}

	show() {
		if (SUPPORTS_POPOVER) this.#menu?.showPopover();
		else this.#setFallbackOpen(true);
	}

	hide() {
		if (!this._open) return;
		if (SUPPORTS_POPOVER) this.#menu?.hidePopover();
		else this.#setFallbackOpen(false);
	}

	#setFallbackOpen(open) {
		const menu = this.#menu;
		if (!menu || open === this._open) return;
		const newState = open ? 'open' : 'closed';
		if (open) this.#onBeforeToggle({ newState });
		menu.hidden = !open;
		this.#onToggle({ newState });
	}

	#onTriggerClick() {
		if (!SUPPORTS_POPOVER) this._open ? this.hide() : this.show();
	}

	#visibleItems() {
		const result = [];
		for (const item of this.items || []) {
			if (item.hidden) continue;
			const isSep = item.type === 'separator';
			if (isSep && (!result.length || result.at(-1).type === 'separator')) continue;
			result.push(item);
		}
		if (result.at(-1)?.type === 'separator') result.pop();
		return result;
	}

	render() {
		return html`
			<button type="button" class="trigger" part="trigger"
				popovertarget="menu"
				aria-haspopup="menu"
				aria-expanded=${this._open ? 'true' : 'false'}
				.tooltip=${tooltip(this._open ? '' : this.label)}
				@click=${this.#onTriggerClick}>
				${unsafeHTML(icon(this.icon, { size: 16, strokeWidth: 2 }))}
			</button>
			<div id="menu" class="menu" part="menu" popover="auto" role="menu"
				?hidden=${!SUPPORTS_POPOVER && !this._open}
				aria-label=${this.label || nothing}
				@beforetoggle=${this.#onBeforeToggle}
				@toggle=${this.#onToggle}
				@keydown=${this.#onMenuKeyDown}>
				${this.#visibleItems().map(item => item.type === 'separator'
					? html`<div class="separator" role="separator"></div>`
					: html`
						<button type="button" role="menuitem" tabindex="-1"
							class="item ${item.danger ? 'danger' : ''}"
							aria-disabled=${item.disabled ? 'true' : 'false'}
							@click=${() => this.#select(item)}>
							${item.icon ? html`<span class="item-icon">${unsafeHTML(icon(item.icon, { size: 15 }))}</span>` : ''}
							<span class="item-label">${item.label}</span>
						</button>
					`)}
			</div>
		`;
	}

	#select(item) {
		if (item.disabled) return;
		this.hide();
		this.dispatchEvent(new CustomEvent('menu-select', {
			detail: { id: item.id },
			bubbles: true,
		}));
	}

	#onBeforeToggle(e) {
		if (e.newState !== 'open') return;
		const rect = this.#trigger.getBoundingClientRect();
		const vw = document.documentElement.clientWidth;
		const rtl = getComputedStyle(this).direction === 'rtl';
		const alignRight = (this.placement !== 'bottom-start') !== rtl;
		Object.assign(this.#menu.style, {
			top: `${rect.bottom + GAP}px`,
			left: alignRight ? 'auto' : `${rect.left}px`,
			right: alignRight ? `${vw - rect.right}px` : 'auto',
		});
	}

	#onToggle(e) {
		this._open = e.newState === 'open';
		if (!this._open) {
			this.#removeDismissListeners();
			return;
		}
		this.#fitToViewport();
		this.#focusableItems()[0]?.focus();
		window.addEventListener('scroll', this.#onDismiss, { capture: true, passive: true });
		window.addEventListener('resize', this.#onDismiss);
		if (!SUPPORTS_POPOVER) document.addEventListener('pointerdown', this.#onDismiss, true);
	}

	#fitToViewport() {
		const menu = this.#menu;
		const trigger = this.#trigger.getBoundingClientRect();
		const rect = menu.getBoundingClientRect();
		const vw = document.documentElement.clientWidth;
		const vh = document.documentElement.clientHeight;
		if (rect.bottom > vh - VIEWPORT_PAD && trigger.top - GAP - rect.height >= VIEWPORT_PAD) {
			menu.style.top = `${trigger.top - GAP - rect.height}px`;
		}
		if (rect.left < VIEWPORT_PAD) {
			Object.assign(menu.style, { left: `${VIEWPORT_PAD}px`, right: 'auto' });
		} else if (rect.right > vw - VIEWPORT_PAD) {
			Object.assign(menu.style, { left: 'auto', right: `${VIEWPORT_PAD}px` });
		}
	}

	#onDismiss = (e) => {
		if (e.type === 'scroll' && this.#menu?.contains(e.target)) return;
		if (e.type === 'pointerdown' && e.composedPath().includes(this)) return;
		this.hide();
	};

	#removeDismissListeners() {
		window.removeEventListener('scroll', this.#onDismiss, { capture: true });
		window.removeEventListener('resize', this.#onDismiss);
		document.removeEventListener('pointerdown', this.#onDismiss, true);
	}

	#focusableItems() {
		return [...this.shadowRoot.querySelectorAll('.item:not([aria-disabled="true"])')];
	}

	#onMenuKeyDown(e) {
		if (e.key === 'Tab') {
			this.hide();
			return;
		}
		if (e.key === 'Escape' && !SUPPORTS_POPOVER) {
			this.hide();
			this.#trigger.focus();
			return;
		}
		const items = this.#focusableItems();
		if (!items.length) return;
		const index = items.indexOf(this.shadowRoot.activeElement);
		const next = {
			ArrowDown: items[(index + 1) % items.length],
			ArrowUp: items[index <= 0 ? items.length - 1 : index - 1],
			Home: items[0],
			End: items.at(-1),
		}[e.key];
		if (!next) return;
		e.preventDefault();
		next.focus();
	}
}

customElements.define('dropdown-menu', DropdownMenu);