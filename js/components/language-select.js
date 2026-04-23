import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { icons } from '../icons.js'; 
import { tooltip } from '../tooltip.js';

class LanguageSelect extends LitElement {
	static properties = {
		value: { type: String },
		_isOpen: { state: true },
	};

	static styles = css`
		:host {
			display: inline-block;
			position: relative;
			font-family: inherit;
		}

		* {
			box-sizing: border-box;
			user-select: none;
		}

		.trigger {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			padding: 5px 10px;
			line-height: 18px;
			height: 28px;
			border-radius: 8px;
			border: 0;
			box-shadow: 0 0 0 1px var(--border-color);
			background: transparent;
			color: var(--text-secondary);
			font-size: 13px;
			font-family: inherit;
			cursor: pointer;
			outline: none;
			transition: all 0.2s ease;
			white-space: nowrap;
		}

		.trigger:hover {
			background: var(--bg-tertiary);
			color: var(--text-primary);
			box-shadow: 0 0 0 2px var(--input-focus-border-color);
		}

		.trigger:focus-visible {
			box-shadow: 0 0 0 2px var(--input-focus-border-color);
		}

		.trigger-icon {
			display: inline-flex;
			align-items: center;
		}

		.trigger-icon svg {
			width: 16px;
			height: 16px;
		}

		.trigger-chevron {
			display: inline-flex;
			align-items: center;
			opacity: 0.5;
			transition: transform 0.2s ease;
		}

		.trigger-chevron svg {
			width: 14px;
			height: 14px;
		}

		:host([open]) .trigger-chevron {
			transform: rotate(180deg);
		}

		.dropdown {
			position: absolute;
			top: 100%;
			inset-inline-end: 0;
			width: max-content;
			max-width: 850px;
			min-width: 300px;
			max-height: 500px;
			overflow-y: auto;
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 12px;
			box-shadow: var(--section-shadow) 0px 1px 3px 0px;
			z-index: 1000;

			display: grid;
			grid-template-columns: repeat(5, 1fr);
			gap: 6px;
			padding: 8px;

			opacity: 0;
			visibility: hidden;
			transform: translateY(1px);
			transition: opacity 0.15s ease, visibility 0.15s ease;
		}

		@media (max-width: 900px) {
			.dropdown {
				grid-template-columns: repeat(4, 1fr);
				max-width: 600px;
			}
		}
		@media (max-width: 700px) {
			.dropdown {
				grid-template-columns: repeat(2, 1fr);
				max-width: 90vw;
			}
		}

		.dropdown.open {
			opacity: 1;
			visibility: visible;
		}

		.dropdown::-webkit-scrollbar {
			width: 6px;
		}
		.dropdown::-webkit-scrollbar-track {
			background: transparent;
		}
		.dropdown::-webkit-scrollbar-thumb {
			background: var(--border-color);
			border-radius: 3px;
		}

		.item {
			padding: 4px 6px;
			cursor: pointer;
			display: flex;
			flex-direction: column;
			border-radius: 6px;
			transition: background-color 0.1s;
			border: 1px solid transparent;
			justify-content: center;
		}

		.item.centered {
			justify-content: center;
		}

		.item.system-item .item-name {
			font-weight: bold;
		}

		.item-main {
			display: flex;
			flex-direction: column;
			gap: 1px;
		}

		.item:hover {
			background: var(--bg-tertiary);
		}

		.item.selected {
			background: rgba(66, 133, 244, 0.1);
			border-color: rgba(66, 133, 244, 0.2);
		}

		.item-name {
			font-size: 0.9em;
			font-weight: 600;
			color: var(--text-primary);
		}

		.item.selected .item-name {
			color: var(--accent-color);
		}

		.item-sub {
			font-size: 0.8em;
			color: var(--text-secondary);
			margin-top: 0px;
		}
	`;

	constructor() {
		super();
		this.value = 'auto';
		this._isOpen = false;
	}

	connectedCallback() {
		super.connectedCallback();
		document.addEventListener('mousedown', this.#onDocMouseDown);
		document.addEventListener('keydown', this.#onDocKeyDown);
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		document.removeEventListener('mousedown', this.#onDocMouseDown);
		document.removeEventListener('keydown', this.#onDocKeyDown);
	}

	#onDocMouseDown = (e) => {
		if (!e.composedPath().includes(this)) this.#closeDropdown();
	};

	#onDocKeyDown = (e) => {
		if (this._isOpen && e.key === 'Escape') this.#closeDropdown();
	};

	#getTriggerLabel() {
		if (this.value === 'auto') {
			return window.i18n.getMessage('languageAuto');
		}
		const langs = window.i18n.getSupportedLanguages();
		return langs[this.value]?.name ?? this.value;
	}

	render() {
		const langs = window.i18n.getSupportedLanguages();
		const autoLabel = window.i18n.getMessage('languageAuto');
		const autoEn = 'Follow System';
		const showAutoSub = autoLabel !== autoEn;

		return html`
			<button class="trigger"
				@click=${() => this.#toggleDropdown()}
				@keydown=${(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.#toggleDropdown(); } }}
				.tooltip=${tooltip(this._isOpen ? '' : window.i18n.getMessage('language'))}>
				<span class="trigger-icon">${unsafeHTML(icons.globe)}</span>
				${this.value !== 'auto' ? html`<span>${this.#getTriggerLabel()}</span>` : ''}
				<span class="trigger-chevron">${unsafeHTML(icons.chevronDown)}</span>
			</button>

			<div class=${`dropdown${this._isOpen ? ' open' : ''}`}>
				<div class=${`item system-item${!showAutoSub ? ' centered' : ''}${this.value === 'auto' ? ' selected' : ''}`}
					data-value="auto"
					@click=${() => this.#selectLanguage('auto')}>
					<div class="item-main">
						<span class="item-name">${autoLabel}</span>
						${showAutoSub ? html`<span class="item-sub">${autoEn}</span>` : ''}
					</div>
				</div>
				${Object.entries(langs).map(([code, info]) => {
					const langAttr = code.replace('_', '-');
					return html`
						<div class=${`item${this.value === code ? ' selected' : ''}`}
							data-value=${code}
							@click=${() => this.#selectLanguage(code)}>
							<div class="item-main">
								<span class="item-name" lang=${langAttr}>${info.name}</span>
								<span class="item-sub">${info.enName}</span>
							</div>
						</div>
					`;
				})}
			</div>
		`;
	}

	updated(changedProps) {
		if (changedProps.has('_isOpen') && this._isOpen) {
			this.#scrollToSelected();
			this.shadowRoot.querySelector('.trigger')?.focus();
		}
	}

	#toggleDropdown() {
		this._isOpen = !this._isOpen;
	}

	#closeDropdown() {
		if (this._isOpen) this._isOpen = false;
	}

	#selectLanguage(code) {
		this.value = code;
		this._isOpen = false;
		this.dispatchEvent(new CustomEvent('change', {
			bubbles: true,
			composed: true,
			detail: { value: code },
		}));
	}

	#scrollToSelected() {
		this.updateComplete.then(() => {
			this.shadowRoot.querySelector('.item.selected')?.scrollIntoView({ block: 'nearest' });
		});
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('language-select', LanguageSelect);
});