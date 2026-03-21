import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icons, icon } from '../icons.js'; 
import { SettingsStore } from '../settings-store.js';

const ACTION_ICONS = {
	'none': 'minus',
	'back': 'arrowLeft',
	'forward': 'arrowRight',
	'scrollUp': 'chevronUp',
	'scrollDown': 'chevronDown',
	'scrollToTop': 'chevronsUp',
	'scrollToBottom': 'chevronsDown',
	'closeTab': 'x',
	'closeWindow': 'squareX',
	'closeBrowser': 'circleX',
	'restoreTab': 'rotateCcw',
	'newTab': 'plus',
	'closeOtherTabs': 'x',
	'closeLeftTabs': 'x',
	'closeRightTabs': 'x',
	'closeAllTabs': 'x',
	'switchLeftTab': 'chevronLeft',
	'switchRightTab': 'chevronRight',
	'switchFirstTab': 'chevronsLeft',
	'switchLastTab': 'chevronsRight',
	'refresh': 'refreshCw',
	'refreshAllTabs': 'refreshCw',
	'stopLoading': 'ban',
	'newWindow': 'appWindow',
	'newIncognito': 'hatGlasses',
	'addToBookmarks': 'bookmark',
	'toggleFullscreen': 'maximize',
	'toggleMaximize': 'squarePlus',
	'minimize': 'squareMinus',
	'openCustomUrl': 'externalLink',
	'copyUrl': 'copy',
	'copyTitle': 'copy',
	'openDownloads': 'download',
	'openHistory': 'history',
	'openExtensions': 'puzzle',
	'printPage': 'printer',
	'duplicateTab': 'layers2',
	'toggleMuteTab': 'volumeX',
	'toggleMuteAllTabs': 'volumeOff',
	'togglePinTab': 'pin',
	'actionChain': 'workflow',
	'delay': 'timer',
	'sendCustomEvent': 'codeXml',
	'simulateKey': 'keyboard',
	'_addNewChain': 'plus',
};

const SCROLL_SMOOTHNESS = {
	'auto': 'smoothnessAuto',
	'smooth': 'smoothnessCustom',
	'system': 'smoothnessSystem',
	'none': 'smoothnessNone',
};

const SCROLL_ACTIONS = ['scrollUp', 'scrollDown', 'scrollToTop', 'scrollToBottom'];

const SCROLL_DISTANCE_ACTIONS = ['scrollUp', 'scrollDown'];

const ACTION_CATEGORIES = [
	{ key: 'actionCategoryChains', icon: 'workflow', actions: ['actionChain', 'delay'] },
	{ key: 'actionCategoryNavigation', icon: 'compass', actions: ['back', 'forward', 'scrollUp', 'scrollDown', 'scrollToTop', 'scrollToBottom'] },
	{ key: 'actionCategoryTabs', icon: 'panelTop', actions: ['newTab', 'closeTab', 'refresh', 'refreshAllTabs', 'switchLeftTab', 'switchRightTab', 'switchFirstTab', 'switchLastTab', 'closeOtherTabs', 'closeLeftTabs', 'closeRightTabs', 'closeAllTabs', 'restoreTab', 'duplicateTab', 'togglePinTab'] },
	{ key: 'actionCategoryWindow', icon: 'appWindow', actions: ['newWindow', 'newIncognito', 'toggleFullscreen', 'toggleMaximize', 'minimize', 'closeWindow', 'closeBrowser'] },
	{ key: 'actionCategoryUtilities', icon: 'wrench', actions: ['addToBookmarks', 'copyUrl', 'copyTitle', 'openCustomUrl', 'openDownloads', 'openHistory', 'openExtensions', 'toggleMuteTab', 'toggleMuteAllTabs', 'stopLoading', 'printPage', 'simulateKey', 'sendCustomEvent'] },
];

class ActionSelect extends LitElement {
	static properties = {
		value: { type: String, reflect: true },
		config: { type: Object },
		gestureLabel: { type: String, attribute: 'gesture-label' },
		excludeChain: { type: Boolean, attribute: 'exclude-chain' },
		_open: { state: true },
		_search: { state: true },
		_pendingValue: { state: true },
		_pendingConfig: { state: true },
		_keyRecording: { state: true },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
				width: 100%;
			}

			.trigger {
				width: 100%;
				padding-block: 7px;
				padding-inline: 10px 4px;
				font-size: 13px;
				border-radius: 6px;
				border: 0;
				box-shadow: 0 0 0 0.75px var(--border-color);
				background: var(--input-bg);
				color: var(--text-primary);
				cursor: pointer;
				text-align: start;
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 2px;
				transition: box-shadow 0.15s ease;
				line-height: 1.4;
			}
			.trigger:hover,
			.trigger:focus {
				box-shadow: 0 0 0 2px var(--input-focus-border-color);
				outline: none;
			}
			.trigger-label {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				flex: 1;
				min-width: 0;
			}
			.trigger-chevron {
				flex-shrink: 0;
				display: flex;
				align-items: center;
				opacity: 0.4;
			}

			.modal-overlay {
				position: fixed;
				inset: 0;
				z-index: 10000;
				background: rgba(0, 0, 0, 0.35);
				display: flex;
				align-items: center;
				justify-content: center;
				animation: as-fadeIn 0.12s ease;
			}
			@keyframes as-fadeIn {
				from { opacity: 0; }
				to { opacity: 1; }
			}
			@keyframes as-slideIn {
				from { opacity: 0; transform: scale(0.97); }
				to { opacity: 1; transform: scale(1); }
			}

			.modal-panel {
				width: min(900px, 92vw);
				max-height: 80vh;
				background: var(--card-bg);
				border-radius: 14px;
				box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border-color);
				display: flex;
				flex-direction: column;
				overflow-y: auto;
				animation: as-slideIn 0.12s ease;
			}

			.modal-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 14px 18px;
				border-bottom: 1px solid var(--border-color);
				flex-shrink: 0;
			}
			.modal-title {
				font-size: 15px;
				font-weight: 600;
				color: var(--text-primary);
				display: flex;
				align-items: center;
				gap: 4px;
				min-width: 0;
			}
			.modal-gesture {
				font-size: 15px;
				color: var(--accent-color);
				font-weight: 600;
				margin-inline-start: 6px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.modal-close {
				background: none;
				border: none;
				color: var(--text-secondary);
				cursor: pointer;
				padding: 0;
				border-radius: 6px;
				line-height: 1;
				transition: all 0.15s;
				display: flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				flex-shrink: 0;
			}
			.modal-close svg {
				width: 18px;
				height: 18px;
			}
			.modal-close:hover {
				background: var(--border-color);
				color: var(--text-primary);
			}

			.search-wrapper {
				padding: 10px 14px 6px;
				flex-shrink: 0;
			}
			input.search-input {
				width: 100%;
				padding: 8px 10px;
				border-radius: 8px;
				border: 1px solid var(--border-color);
				background: var(--bg-secondary);
				color: var(--text-primary);
				font-size: 13px;
				outline: none;
				transition: border-color 0.15s;
			}
			input.search-input:focus {
				border-color: var(--accent-color);
			}
			input.search-input::placeholder {
				color: var(--text-muted);
			}

			.action-list {
				flex: 1;
				overflow-y: auto;
				padding: 6px 14px 14px;
				overscroll-behavior: contain;
			}
			.category-label {
				padding: 12px 8px 6px;
				margin-top: 8px;
				font-size: 11px;
				font-weight: 700;
				color: var(--text-muted);
				text-transform: uppercase;
				letter-spacing: 0.06em;
				user-select: none;
				border-bottom: 1px solid var(--border-color);
				display: flex;
				align-items: center;
				gap: 8px;
			}
			.category-icon {
				display: flex;
				align-items: center;
				flex-shrink: 0;
			}
			.category-icon svg {
				width: 13px;
				height: 13px;
			}
			.category-label:first-child {
				padding-top: 4px;
				margin-top: 0;
			}
			.action-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
				gap: 2px;
				padding-top: 6px;
			}
			@media (max-width: 500px) {
				.action-grid {
					grid-template-columns: repeat(2, 1fr);
				}
			}
			.action-item {
				padding: 5px 6px;
				border-radius: 6px;
				border: 1px solid transparent;
				cursor: pointer;
				font-size: 13px;
				color: var(--text-primary);
				transition: all 0.15s ease;
				user-select: none;
				word-break: break-word;
				position: relative;
				display: flex;
				align-items: center;
				gap: 7px;
			}
			.action-icon {
				display: flex;
				align-items: center;
				flex-shrink: 0;
				color: var(--text-muted);
			}
			.action-icon svg {
				width: 15px;
				height: 15px;
			}
			.action-item.selected .action-icon {
				color: var(--accent-color);
			}
			.action-item:hover {
				background: var(--bg-tertiary);
				border-color: var(--border-color);
			}
			.action-item.selected {
				background: rgba(66, 133, 244, 0.1);
				border-color: rgba(66, 133, 244, 0.3);
				color: var(--accent-color);
				font-weight: 600;
			}
			.no-results {
				padding: 20px 12px;
				text-align: center;
				color: var(--text-muted);
				font-size: 13px;
			}

			.action-config {
				padding: 12px;
				border-top: 1px solid var(--border-color);
				display: flex;
				flex-direction: column;
				gap: 10px;
				flex-shrink: 0;
			}
			.action-config-label {
				font-size: 12px;
				color: var(--text-secondary);
				font-weight: 600;
			}
			.action-config-input {
				width: 100%;
				padding: 8px 10px;
				border-radius: 6px;
				border: 1px solid var(--border-color);
				background: var(--bg-secondary);
				color: var(--text-primary);
				font-size: 13px;
				outline: none;
			}
			.action-config-input:focus {
				border-color: var(--accent-color);
			}
			.action-config-input::placeholder {
				color: var(--text-muted);
			}
			.action-config-textarea {
				width: 100%;
				padding: 8px 10px;
				border-radius: 6px;
				border: 1px solid var(--border-color);
				background: var(--bg-secondary);
				color: var(--text-primary);
				font-size: 13px;
				font-family: monospace;
				outline: none;
				resize: vertical;
				min-height: 20px;
			}
			.action-config-textarea:focus {
				border-color: var(--accent-color);
			}
			.action-config-textarea::placeholder {
				color: var(--text-muted);
			}
			.action-config-textarea.invalid {
				border-color: var(--warning-color);
			}
			.action-config-hint {
				font-size: 11px;
				color: var(--text-muted);
				line-height: 1.4;
			}
			.action-config-hint code,
			.action-config-label code {
				font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
				font-size: 0.9em;
				background: var(--bg-tertiary);
				padding: 1px 5px;
				border-radius: 4px;
				color: var(--text-primary);
			}
			.action-config-checkbox {
				display: flex;
				align-items: center;
				gap: 6px;
				font-size: 13px;
				color: var(--text-primary);
				cursor: pointer;
				user-select: none;
			}
			.action-config-checkbox input[type="checkbox"] {
				margin: 0;
			}
			.action-config-row {
				display: flex;
				align-items: center;
				gap: 10px;
			}
			.action-config-row.disabled {
				opacity: 0.4;
				pointer-events: none;
			}
			.action-config-row .action-config-label {
				flex-shrink: 0;
				min-width: 100px;
			}
			.action-config-row select {
				flex: 1;
				min-width: 0;
				padding: 6px 8px;
				border-radius: 6px;
				border: 1px solid var(--border-color);
				background: var(--bg-secondary);
				color: var(--text-primary);
				font-size: 13px;
			}
			.action-config-row .slider-control {
				flex: 1;
				display: flex;
				align-items: center;
				gap: 8px;
				min-width: 0;
				padding-block: 5px;
			}
			.action-config-row .slider-control input[type="range"] {
				flex: 1;
				min-width: 0;
			}
			.action-config-row .slider-control span {
				font-size: 12px;
				color: var(--text-secondary);
				flex-shrink: 0;
				min-width: 36px;
				text-align: end;
				line-height: 16px;
			}
			.action-config-warning {
				font-size: 12px;
				color: var(--warning-color);
				padding: 6px 8px;
				background: rgba(230, 161, 23, 0.08);
				border-radius: 6px;
				line-height: 1.5;
			}

			.action-config-footer {
				display: flex;
				justify-content: flex-end;
				padding: 10px 14px;
				border-top: 1px solid var(--border-color);
				flex-shrink: 0;
			}
			.action-config-confirm-btn {
				padding: 7px 24px;
				border-radius: 6px;
				border: 1px solid var(--accent-color);
				background: var(--accent-color);
				color: #fff;
				font-size: 13px;
				cursor: pointer;
				transition: all 0.15s;
			}
			.action-config-confirm-btn:hover {
				opacity: 0.9;
			}

			.key-record-btn {
				padding: 7px 14px;
				border-radius: 6px;
				border: 1px solid var(--border-color);
				background: var(--bg-secondary);
				color: var(--text-primary);
				font-size: 13px;
				cursor: pointer;
				transition: all 0.15s;
				white-space: nowrap;
			}
			.key-record-btn:hover {
				border-color: var(--accent-color);
			}
			.key-record-btn.recording {
				border-color: var(--accent-color);
				background: rgba(66, 133, 244, 0.1);
				color: var(--accent-color);
				animation: as-pulse 1.2s ease-in-out infinite;
			}
			@keyframes as-pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.6; }
			}
		`,
	];

	constructor() {
		super();
		this.value = 'none';
		this.config = {};
		this.gestureLabel = '';
		this.excludeChain = false;
		this._open = false;
		this._search = '';
		this._pendingValue = 'none';
		this._pendingConfig = {};
		this._keyRecording = false;
		this._onActionsUpdated = () => this.requestUpdate();
	}

	connectedCallback() {
		super.connectedCallback();
		window.addEventListener('action-catalog-changed', this._onActionsUpdated);
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		window.removeEventListener('action-catalog-changed', this._onActionsUpdated);
	}

	#getActionLabel(val) {
		const ACTION_KEYS = window.GestureConstants.ACTION_KEYS;
		const key = ACTION_KEYS[val];
		if (!key) return val;
		if (val === 'openCustomUrl') {
			const baseLabel = window.i18n.getMessage('actionOpenCustomUrl');
			const url = this.config?.customUrl || '';
			return url
				? `${baseLabel} (${url})`
				: baseLabel;
		}
		if (val === 'actionChain') {
			const chainId = this.config?.chainId;
			if (chainId) {
				const chains = SettingsStore.current.actionChains || {};
				const chain = chains[chainId];
				if (!chain) return window.i18n.getMessage('chainNotFound');
				const steps = chain.steps?.length || 0;
				const stepsLabel = (steps === 1 ? window.i18n.getMessage('chainStepCountOne') : window.i18n.getMessage('chainStepCount')).replace('%count%', steps);
				const displayName = chain.name || window.i18n.getMessage('actionActionChain');
				return `${displayName} (${stepsLabel})`;
			}
			return window.i18n.getMessage('actionActionChain');
		}
		if (val === 'delay') {
			const delayMs = this.config?.delayMs ?? window.GestureConstants.ACTION_DEFAULTS.delay.delayMs;
			return `${window.i18n.getMessage(key)} (${delayMs}${window.i18n.getMessage('chainDelayUnit')})`;
		}
		if (val === 'simulateKey') {
			const baseLabel = window.i18n.getMessage('actionSimulateKey');
			const keyValue = this.config?.keyValue || 'ArrowLeft';
			const mods = [];
			if (this.config?.modCtrl) mods.push('Ctrl');
			if (this.config?.modShift) mods.push('Shift');
			if (this.config?.modAlt) mods.push('Alt');
			if (this.config?.modMeta) mods.push('Meta');
			mods.push(keyValue);
			return `${baseLabel} (${mods.join('+')})`;
		}
		return window.i18n.getMessage(key) || val;
	}

	#getFilteredCategories() {
		const ACTION_KEYS = window.GestureConstants.ACTION_KEYS;
		const search = this._search.toLowerCase().trim();
		const result = [];

		const noneLabel = window.i18n.getMessage(ACTION_KEYS['none']);
		if (!search || noneLabel.toLowerCase().includes(search) || 'none'.includes(search)) {
			result.push({ label: '', items: [{ value: 'none', label: noneLabel }] });
		}

		for (const cat of ACTION_CATEGORIES) {
			const items = [];
			for (const action of cat.actions) {
				if (!ACTION_KEYS[action]) continue;
				if (action === 'actionChain' && this.excludeChain) continue;
				if (action === 'delay' && !this.excludeChain) continue;
				if (action === 'actionChain') {
					const chains = SettingsStore.current.actionChains || {};
					for (const [id, c] of Object.entries(chains)) {
						const steps = c.steps?.length || 0;
						const stepsLabel = (steps === 1 ? window.i18n.getMessage('chainStepCountOne') : window.i18n.getMessage('chainStepCount')).replace('%count%', steps);
						const name = c.name
							? `${c.name} (${stepsLabel})`
							: `${window.i18n.getMessage('actionActionChain')} (${stepsLabel})`;
						if (!search || name.toLowerCase().includes(search) || 'chain'.includes(search)) {
							items.push({ value: 'actionChain', label: name, chainId: id });
						}
					}
					const addLabel = window.i18n.getMessage('addNewChain');
					if (!search || addLabel.toLowerCase().includes(search) || 'chain'.includes(search)) {
						items.push({ value: '_addNewChain', label: addLabel });
					}
					continue;
				}
				const label = window.i18n.getMessage(ACTION_KEYS[action]);
				if (!search || label.toLowerCase().includes(search) || action.toLowerCase().includes(search)) {
					items.push({ value: action, label });
				}
			}
			if (items.length > 0) {
				result.push({ label: window.i18n.getMessage(cat.key), icon: cat.icon, items });
			}
		}

		return result;
	}

	render() {
		const hasConfig = this.#hasActionConfig(this.value);
		return html`
			<button class="trigger" @click=${this.open} type="button">
				<span class="trigger-label">${this.#getActionLabel(this.value)}</span>
				<span class="trigger-chevron">${unsafeHTML(hasConfig ? icon('settings', { size: 15 }) : icon('chevronDown', { size: 16 }))}</span>
			</button>
			${this._open ? this.#renderModal() : ''}
		`;
	}

	#renderModal() {
		const categories = this.#getFilteredCategories();
		const hasResults = categories.some(c => c.items.length > 0);
		const showActionConfig = this.#hasActionConfig(this._pendingValue);

		return html`
			<div class="modal-overlay" @mousedown=${this.#onOverlayClick}
				@dragstart=${e => e.stopPropagation()}
				@dragover=${e => { e.stopPropagation(); e.preventDefault(); }}>
				<div class="modal-panel" @mousedown=${(e) => e.stopPropagation()}>
					<div class="modal-header">
						<span class="modal-title">
							${window.i18n.getMessage('action')}${this.gestureLabel ? html`<span class="modal-gesture">${unsafeHTML(window.GestureConstants.arrowsToSvg(this.gestureLabel))}</span>` : ''}
						</span>
						<button type="button" class="modal-close" @click=${this.#close}>${unsafeHTML(icons.x)}</button>
					</div>
					<div class="search-wrapper">
						<input class="search-input" type="text"
							placeholder=${window.i18n.getMessage('searchActions')}
							.value=${this._search}
							@input=${this.#onSearchInput}
							@keydown=${this.#onKeydown}
						>
					</div>
					<div class="action-list">
						${hasResults ? categories.map(cat => html`
							${cat.label ? html`<div class="category-label"><span class="category-icon">${unsafeHTML(icon(cat.icon))}</span>${cat.label}</div>` : ''}
							<div class="action-grid">
								${cat.items.map(item => html`
								<div class="action-item ${this.#isItemSelected(item) ? 'selected' : ''}"
									@click=${() => this.#selectAction(item.value, item.chainId)}>
									<span class="action-icon">${unsafeHTML(icon(ACTION_ICONS[item.value]))}</span>
									<span>${item.label}</span>
								</div>
							`)}
							</div>
						`) : html`<div class="no-results">${window.i18n.getMessage('noResults')}</div>`}
					</div>
					${showActionConfig ? html`
						<div class="action-config">
							${this.#renderActionConfig()}
						</div>
						<div class="action-config-footer">
							<button type="button" class="action-config-confirm-btn" @click=${this.#close}>
								${window.i18n.getMessage('buttonOkay')}
							</button>
						</div>
					` : ''}
				</div>
			</div>
		`;
	}

	open() {
		this._open = true;
		this._search = '';
		this._pendingValue = this.value;
		this._pendingConfig = { ...(this.config || {}) };
		document.documentElement.style.overflow = 'hidden';
		this.updateComplete.then(() => {
			this.shadowRoot.querySelector('.search-input')?.focus();
			this.#scrollToSelected();
		});
	}

	#close() {
		const oldValue = this.value;
		const oldConfig = this.config;
		this.value = this._pendingValue;
		if (this._pendingValue === 'actionChain') {
			this.config = this._pendingConfig.chainId ? { chainId: this._pendingConfig.chainId } : {};
		} else {
			this.config = this.#hasActionConfig(this._pendingValue)
				? this.#cleanConfig(this._pendingConfig)
				: {};
		}
		const changed = this.value !== oldValue
			|| JSON.stringify(this.config) !== JSON.stringify(oldConfig);
		this._open = false;
		this.#stopKeyRecording();
		document.documentElement.style.overflow = '';
		if (changed) this.#dispatchChange();
		this.updateComplete.then(() => {
			this.shadowRoot.querySelector('.trigger').focus();
		});
	}

	#onOverlayClick(e) {
		if (e.target.classList.contains('modal-overlay')) {
			e.preventDefault();
			this.#close();
		}
	}

	#onSearchInput(e) {
		this._search = e.target.value;
	}

	#onKeydown(e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			this.#close();
		}
	}

	#isItemSelected(item) {
		if (item.value !== this._pendingValue) return false;
		if (item.chainId) return item.chainId === this._pendingConfig.chainId;
		return true;
	}

	#selectAction(actionValue, chainId) {
		if (actionValue === '_addNewChain') {
			this._pendingValue = this.value;
			this.#close();
			this.dispatchEvent(new CustomEvent('navigate-section', {
				detail: { section: 'chains', enableChainSection: true },
				bubbles: true,
				composed: true,
			}));
			return;
		}
		this._pendingValue = actionValue;
		if (chainId) {
			this._pendingConfig = { chainId };
			this.#close();
			return;
		}
		if (this.#hasActionConfig(actionValue)) {
			this.updateComplete.then(() => {
				this.#scrollToSelected();
				this.shadowRoot.querySelector('.action-config-input')?.focus();
			});
			return;
		}
		this.#close();
	}

	#scrollToSelected() {
		this.updateComplete.then(() => {
			this.shadowRoot.querySelector('.action-item.selected')?.scrollIntoView({ block: 'nearest' });
		});
	}


	#hasActionConfig(action) {
		if (action === 'actionChain') return false;
		return !!window.GestureConstants.ACTION_DEFAULTS[action];
	}

	#cleanConfig(pendingConfig) {
		const action = this._pendingValue;
		const defaults = window.GestureConstants.ACTION_DEFAULTS[action];
		if (!defaults) return {};

		const result = {};
		for (const key of Object.keys(defaults)) {
			if (pendingConfig[key] !== undefined) {
				if (typeof defaults[key] === 'string') {
					result[key] = String(pendingConfig[key]).trim();
				} else if (typeof defaults[key] === 'number') {
					result[key] = Number(pendingConfig[key]);
				} else if (typeof defaults[key] === 'boolean') {
					result[key] = !!pendingConfig[key];
				} else {
					result[key] = pendingConfig[key];
				}
			}
		}
		return result;
	}

	#renderPositionSelect() {
		const action = this._pendingValue;
		const defaults = window.GestureConstants.ACTION_DEFAULTS[action] || {};
		const position = this._pendingConfig.position ?? defaults.position;
		return html`
			<div class="action-config-row">
				<span class="action-config-label">${window.i18n.getMessage('newTabPosition')}</span>
				<select .value=${position}
					@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, position: e.target.value }; this.requestUpdate(); }}>
					<option value="right" ?selected=${position === 'right'}>${window.i18n.getMessage('tabPositionRight')}</option>
					<option value="left" ?selected=${position === 'left'}>${window.i18n.getMessage('tabPositionLeft')}</option>
					<option value="first" ?selected=${position === 'first'}>${window.i18n.getMessage('tabPositionFirst')}</option>
					<option value="last" ?selected=${position === 'last'}>${window.i18n.getMessage('tabPositionLast')}</option>
				</select>
			</div>
		`;
	}

	#renderActionConfig() {
		const action = this._pendingValue;
		const { ACTION_DEFAULTS } = window.GestureConstants;
		if (action === 'openCustomUrl') {
			return html`
				<div class="action-config-label">${window.i18n.getMessage('enterCustomUrl')}</div>
				<input class="action-config-input" type="text"
					placeholder="https://..."
					maxlength="512"
					.value=${this._pendingConfig.customUrl || ''}
					@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, customUrl: e.target.value }; }}
					@keydown=${(e) => { if (e.key === 'Enter') this.#close(); }}
				>
				${this.#renderPositionSelect()}
			`;
		}
		if (action === 'closeTab') {
			const defaults = ACTION_DEFAULTS.closeTab || {};
			const keepWindowChecked = this._pendingConfig.keepWindow ?? defaults.keepWindow;
			const afterClose = this._pendingConfig.afterClose ?? defaults.afterClose;
			const skipPinnedChecked = this._pendingConfig.skipPinned ?? defaults.skipPinned;
			return html`
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${keepWindowChecked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, keepWindow: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('closeTabKeepWindow')}</span>
				</label>
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${skipPinnedChecked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, skipPinned: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('closeTabsSkipPinned')}</span>
				</label>
				<div class="action-config-row">
					<span class="action-config-label">${window.i18n.getMessage('closeTabAfterClose')}</span>
					<select class="action-config-select"
						.value=${afterClose}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, afterClose: e.target.value }; this.requestUpdate(); }}
					>
						<option value="default">${window.i18n.getMessage('closeTabAfterCloseDefault')}</option>
						<option value="left">${window.i18n.getMessage('closeTabAfterCloseLeft')}</option>
						<option value="right">${window.i18n.getMessage('closeTabAfterCloseRight')}</option>
					</select>
				</div>
			`;
		}
		if (action === 'closeOtherTabs' || action === 'closeLeftTabs' || action === 'closeRightTabs' || action === 'closeAllTabs') {
			const defaults = ACTION_DEFAULTS[action] || {};
			const skipPinnedChecked = this._pendingConfig.skipPinned ?? defaults.skipPinned;
			return html`
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${skipPinnedChecked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, skipPinned: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('closeTabsSkipPinned')}</span>
				</label>
			`;
		}
		if (action === 'switchLeftTab' || action === 'switchRightTab') {
			const defaults = ACTION_DEFAULTS[action] || {};
			const noWrapChecked = this._pendingConfig.noWrap ?? defaults.noWrap;
			const moveTabChecked = this._pendingConfig.moveTab ?? defaults.moveTab;
			return html`
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${noWrapChecked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, noWrap: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('switchTabNoWrap')}</span>
				</label>
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${moveTabChecked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, moveTab: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('switchTabMoveTab')}</span>
				</label>
			`;
		}
		if (action === 'switchFirstTab' || action === 'switchLastTab') {
			const defaults = ACTION_DEFAULTS[action] || {};
			const moveTabChecked = this._pendingConfig.moveTab ?? defaults.moveTab;
			return html`
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${moveTabChecked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, moveTab: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('switchTabMoveTab')}</span>
				</label>
			`;
		}
		if (action === 'refresh' || action === 'refreshAllTabs') {
			const defaults = ACTION_DEFAULTS[action] || {};
			const hardReloadChecked = this._pendingConfig.hardReload ?? defaults.hardReload;
			return html`
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${hardReloadChecked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, hardReload: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('refreshHardReload')}</span>
				</label>
			`;
		}
		if (action === 'newTab') {
			return this.#renderPositionSelect();
		}
		if (action === 'copyUrl') {
			const defaults = ACTION_DEFAULTS.copyUrl || {};
			const checked = this._pendingConfig.includeTitle ?? defaults.includeTitle;
			return html`
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${checked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, includeTitle: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('copyUrlIncludeTitle')}</span>
				</label>
			`;
		}
		if (action === 'delay') {
			const defaults = ACTION_DEFAULTS.delay || {};
			const currentMs = this._pendingConfig.delayMs ?? defaults.delayMs;
			return html`
				<div class="action-config-row">
					<span class="action-config-label">${window.i18n.getMessage('delayDuration')}</span>
					<div class="slider-control">
						<input type="range" min="50" max="5000" step="50"
							.value=${String(currentMs)}
							@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, delayMs: Number(e.target.value) }; this.requestUpdate(); }}
						>
						<span>${currentMs}${window.i18n.getMessage('chainDelayUnit')}</span>
					</div>
				</div>
			`;
		}
		if (action === 'simulateKey') {
			const defaults = ACTION_DEFAULTS.simulateKey || {};
			const keyValue = this._pendingConfig.keyValue ?? defaults.keyValue;
			const modCtrl = this._pendingConfig.modCtrl ?? defaults.modCtrl;
			const modShift = this._pendingConfig.modShift ?? defaults.modShift;
			const modAlt = this._pendingConfig.modAlt ?? defaults.modAlt;
			const modMeta = this._pendingConfig.modMeta ?? defaults.modMeta;
			const isPreset = keyValue === 'ArrowLeft' || keyValue === 'ArrowRight';
			const presetValue = isPreset ? keyValue : '_custom';
			const isRecording = !!this._keyRecording;

			const currentMods = [];
			if (modCtrl) currentMods.push('Ctrl');
			if (modShift) currentMods.push('Shift');
			if (modAlt) currentMods.push('Alt');
			if (modMeta) currentMods.push('Meta');
			if (keyValue && keyValue !== 'ArrowLeft' && keyValue !== 'ArrowRight') {
				currentMods.push(keyValue);
			} else if (keyValue === 'ArrowLeft' || keyValue === 'ArrowRight') {
				currentMods.push(keyValue); 
			}
			const displayKey = currentMods.length > 0 ? currentMods.join('+') : '—';

			return html`
				<div class="action-config-row">
					<span class="action-config-label">${window.i18n.getMessage('simulateKeyPreset')}</span>
					<select .value=${presetValue}
						@change=${(e) => {
							const v = e.target.value;
							if (v === '_custom') {
								this._pendingConfig = { ...this._pendingConfig, keyValue: '', modCtrl: false, modShift: false, modAlt: false, modMeta: false };
							} else {
								this._pendingConfig = { ...this._pendingConfig, keyValue: v, modCtrl: false, modShift: false, modAlt: false, modMeta: false };
							}
							this.requestUpdate();
						}}>
						<option value="ArrowLeft" ?selected=${presetValue === 'ArrowLeft'}>${window.i18n.getMessage('simulateKeyPresetLeft')}</option>
						<option value="ArrowRight" ?selected=${presetValue === 'ArrowRight'}>${window.i18n.getMessage('simulateKeyPresetRight')}</option>
						<option value="_custom" ?selected=${presetValue === '_custom'}>${window.i18n.getMessage('simulateKeyPresetCustom')}</option>
					</select>
				</div>
				${presetValue === '_custom' ? html`
					<div class="action-config-row">
						<span class="action-config-label">${window.i18n.getMessage('simulateKeyManualInput')}</span>
						<span style="flex:1;font-size:13px;font-weight:600;color:var(--text-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${displayKey}</span>
						<button type="button" class="key-record-btn ${isRecording ? 'recording' : ''}"
							@click=${this.#toggleKeyRecording}>
							${isRecording ? window.i18n.getMessage('simulateKeyRecording') : window.i18n.getMessage('simulateKeyRecordBtn')}
						</button>
					</div>
				` : ''}
				<div class="action-config-hint">${window.i18n.getMessage('simulateKeyHint')}</div>
			`;
		}
		if (action === 'sendCustomEvent') {
			const defaults = ACTION_DEFAULTS.sendCustomEvent || {};
			const eventType = this._pendingConfig.eventType ?? defaults.eventType;
			const eventDetail = this._pendingConfig.eventDetail ?? defaults.eventDetail;
			const isValidJson = this.#isValidJson(eventDetail);
			const hint = window.i18n.getMessage('customEventHint')
				.replace('%code%', '<code>new CustomEvent(<b>type</b>, { detail: <b>detail</b>, bubbles: true, cancelable: true })</code>')
				.replace('%window%', '<code>window</code>');
			return html`
				<div class="action-config-row">
					<span class="action-config-label"><code>type</code></span>
					<input type="text" class="action-config-input"
						placeholder="flowmouse:gesture"
						.value=${eventType}
						maxlength="50"
						@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, eventType: e.target.value }; this.requestUpdate(); }}
					>
				</div>
				<div class="action-config-row">
					<span class="action-config-label"><code>detail</code></span>
					<textarea class="action-config-textarea ${isValidJson ? '' : 'invalid'}"
						placeholder='{"key": "value"}'
						rows="2"
						.value=${eventDetail}
						maxlength="200"
						@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, eventDetail: e.target.value }; this.requestUpdate(); }}
					></textarea>
				</div>
				${!isValidJson ? html`
					<div class="action-config-warning">${window.i18n.getMessage('customEventInvalidJson')}</div>
				` : ''}
				<div class="action-config-hint">${unsafeHTML(hint)}</div>
			`;
		}
		if (SCROLL_ACTIONS.includes(action)) {
			const defaults = ACTION_DEFAULTS[action] || {};
			const showDistance = SCROLL_DISTANCE_ACTIONS.includes(action);
			const smoothnessDefault = defaults.scrollSmoothness;
			const distanceDefault = defaults.scrollDistance;
			const accelerationDefault = defaults.scrollAccel ?? 1;
			const accelWindowDefault = defaults.scrollAccelWindow ?? 400;
			const currentSmoothness = this._pendingConfig.scrollSmoothness || smoothnessDefault;
			const currentAcceleration = this._pendingConfig.scrollAccel ?? accelerationDefault;
			const currentAccelWindow = this._pendingConfig.scrollAccelWindow ?? accelWindowDefault;
			const showWarning = currentSmoothness === 'system'
				&& window.matchMedia('(prefers-reduced-motion: reduce)').matches;

			return html`
				${showDistance ? html`
					<div class="action-config-row">
						<span class="action-config-label">${window.i18n.getMessage('scrollAmount')}</span>
						<div class="slider-control">
							<input type="range" min="25" max="200" step="5"
								.value=${String(this._pendingConfig.scrollDistance ?? distanceDefault)}
								@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, scrollDistance: Number(e.target.value) }; this.requestUpdate(); }}
							>
							<span>${this._pendingConfig.scrollDistance ?? distanceDefault}%</span>
						</div>
					</div>
					<div class="action-config-row">
						<span class="action-config-label">${window.i18n.getMessage('scrollAccel')}</span>
						<div class="slider-control">
							<input type="range" min="0.1" max="10" step="0.1"
								.value=${String(currentAcceleration)}
								@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, scrollAccel: Number(e.target.value) }; this.requestUpdate(); }}
							>
							<span>${currentAcceleration == 1 ? window.i18n.getMessage('scrollAccelOff') : currentAcceleration + 'x'}</span>
						</div>
					</div>
					<div class="action-config-row ${currentAcceleration == 1 ? 'disabled' : ''}">
						<span class="action-config-label">${window.i18n.getMessage('scrollAccelWindow')}</span>
						<div class="slider-control">
							<input type="range" min="100" max="1000" step="50"
								.value=${String(currentAccelWindow)}
								@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, scrollAccelWindow: Number(e.target.value) }; this.requestUpdate(); }}
							>
							<span>${currentAccelWindow}ms</span>
						</div>
					</div>
				` : ''}
				<div class="action-config-row">
					<span class="action-config-label">${window.i18n.getMessage('scrollSmoothness')}</span>
					<select .value=${currentSmoothness}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, scrollSmoothness: e.target.value }; this.requestUpdate(); }}>
						${Object.entries(SCROLL_SMOOTHNESS).map(([value, i18nKey]) => html`
							<option value=${value} ?selected=${value === currentSmoothness}>${window.i18n.getMessage(i18nKey)}</option>
						`)}
					</select>
				</div>
				${showWarning ? html`
					<div class="action-config-warning">
						${window.i18n.getMessage('reducedMotionWarning').replace(/%OS%/g, window.i18n.platformName)}
					</div>
				` : ''}
			`;
		}
		return '';
	}

	#dispatchChange() {
		this.dispatchEvent(new CustomEvent('action-change', {
			detail: {
				action: this.value,
				config: this.config,
			},
			bubbles: true,
			composed: true,
		}));
	}

	#isValidJson(str) {
		if (!str || str.trim() === '') return true; 
		try {
			const parsed = JSON.parse(str);
			return typeof parsed === 'object' && parsed !== null;
		} catch {
			return false;
		}
	}


	#toggleKeyRecording() {
		if (this._keyRecording) {
			this.#stopKeyRecording();
		} else {
			this.#startKeyRecording();
		}
	}

	#startKeyRecording() {
		this._keyRecording = true;
		this._keyRecordHandler = (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
			this._pendingConfig = {
				...this._pendingConfig,
				keyValue: e.key,
				modCtrl: e.ctrlKey,
				modShift: e.shiftKey,
				modAlt: e.altKey,
				modMeta: e.metaKey,
			};
			this.#stopKeyRecording();
			this.requestUpdate();
		};
		window.addEventListener('keydown', this._keyRecordHandler, true);
		this.requestUpdate();
	}

	#stopKeyRecording() {
		this._keyRecording = false;
		if (this._keyRecordHandler) {
			window.removeEventListener('keydown', this._keyRecordHandler, true);
			this._keyRecordHandler = null;
		}
		this.requestUpdate();
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('action-select', ActionSelect);
});