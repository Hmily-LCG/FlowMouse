import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icon } from '../icons.js'; 

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
			input {
				flex: 1;
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
							<button class="delete-btn" @click="${() => this.#removeDomain(index)}">${unsafeHTML(icon('x', { size: 14, strokeWidth: 2.5 }))}</button>
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