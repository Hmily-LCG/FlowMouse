import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icon } from '../icons.js';
import { tooltip } from '../tooltip.js';

class BlacklistManager extends LitElement {
	static properties = {
		blacklist: { type: Array },
		_inputValue: { state: true }
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
				width: 100%;
			}

			.blacklist-add {
				display: flex;
				gap: 10px;
				margin-bottom: 16px;
			}

			.blacklist-section {
				margin-top: 4px;
				margin-bottom: 4px;
			}

			.blacklist-add {
				display: flex;
				gap: 10px;
			}

			.blacklist-add input {
				flex: 1;
			}

			.blacklist-list {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				padding: 8px;
				background: var(--bg-tertiary);
				border-radius: 12px;
			}

			.blacklist-tag {
				display: flex;
				align-items: center;
				gap: 4px;
				background: var(--bg-secondary);
				padding-block: 6px;
				padding-inline: 10px 7px;
				border-radius: 10px;
				font-size: 13px;
				border: 1px solid var(--border-color);
			}

			.blacklist-tag .delete-btn {
				width: 18px;
				height: 18px;
				border: none;
				border-radius: 50%;
				background: transparent;
				color: var(--text-muted);
				cursor: pointer;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				transition: color 0.2s;
				padding: 0;
			}

			.blacklist-tag .delete-btn:hover {
				color: var(--danger-color);
			}

			.blacklist-tag .delete-btn svg {
				width: 14px;
				height: 14px;
			}

			.empty-list {
				color: var(--text-muted);
				font-size: 13px;
				padding: 7px 8px;
			}
		`
	];

	constructor() {
		super();
		this.blacklist = [];
		this._inputValue = '';
	}

	render() {
		return html`
			<div class="blacklist-add">
				<input
					type="text"
					id="blacklistInput"
					class="input-lg"
					placeholder="${window.i18n.getMessage('blacklistPlaceholder')}"
					.value="${this._inputValue}"
					@input="${this.#handleInput}"
					@keydown="${this.#handleKeydown}"
				>
				<button class="btn btn-primary btn-lg" id="addDomain" @click="${() => this.#addDomain()}">${window.i18n.getMessage('add')}</button>
			</div>

			<div class="blacklist-list" id="blacklistList">
				${this.blacklist.length === 0
					? html`<span class="empty-list">${window.i18n.getMessage('emptyBlacklist')}</span>`
					: this.blacklist.map((domain, index) => html`
						<div class="blacklist-tag">
							<span>${domain}</span>
							<button class="delete-btn" .tooltip=${tooltip(window.i18n.getMessage('delete'))} @click="${() => this.#removeDomain(index)}">${unsafeHTML(icon('x', { size: 14, strokeWidth: 2.5 }))}</button>
						</div>
					`)
				}
			</div>
		`;
	}

	#handleInput(e) {
		this._inputValue = e.target.value;
	}

	#handleKeydown(e) {
		if (e.key === 'Enter') {
			this.#addDomain();
		}
	}

	#addDomain() {
		let domain = this._inputValue.trim().toLowerCase();

		if (!domain) return;

		try {
			const urlStr = domain.includes('://') ? domain : 'https://' + domain;
			const url = new URL(urlStr);
			if (url.hostname) {
				domain = url.hostname;
			}
		} catch (e) {
		}

		if (!domain.includes('.') && domain !== 'localhost') {
			this.#dispatchError(window.i18n.getMessage('invalidDomain'));
			return;
		}

		if (this.blacklist.includes(domain)) {
			this.#dispatchError(window.i18n.getMessage('domainExists'));
			return;
		}

		this.blacklist = [...this.blacklist, domain];
		this.#dispatchChange();
		this._inputValue = '';
	}

	#removeDomain(index) {
		this.blacklist = this.blacklist.filter((_, i) => i !== index);
		this.#dispatchChange();
	}

	#dispatchChange() {
		this.dispatchEvent(new CustomEvent('change', {
			detail: { blacklist: this.blacklist },
			bubbles: true,
			composed: true
		}));
	}

	#dispatchError(message) {
		this.dispatchEvent(new CustomEvent('error', {
			detail: { message },
			bubbles: true,
			composed: true
		}));
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('blacklist-manager', BlacklistManager);
});