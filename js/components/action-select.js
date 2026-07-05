import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icons, icon } from '../icons.js';
import { getChainLabel } from './chain-panel.js';
import { getMenuLabel } from './menu-panel.js';
import { tooltip } from '../tooltip.js';
import { SettingsStore } from '../settings-store.js';
import { renderCatalogEngineOptions } from './engine-options.js';

let modalOpenCount = 0;
function lockBodyScroll() {
	if (modalOpenCount++ === 0) {
		document.documentElement.style.overflow = 'hidden';
	}
}
function unlockBodyScroll() {
	if (--modalOpenCount <= 0) {
		modalOpenCount = 0;
		document.documentElement.style.overflow = '';
	}
}

const ACTION_ICONS = {
	'none': 'minus',
	'back': 'arrowLeft',
	'forward': 'arrowRight',
	'urlLevelUp': 'arrowUp',
	'urlToRoot': 'house',
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
	'switchLastActiveTab': 'undo',
	'refresh': 'refreshCw',
	'refreshAllTabs': 'refreshCw',
	'stopLoading': 'ban',
	'stopAllLoading': 'ban',
	'newWindow': 'appWindow',
	'newIncognito': 'hatGlasses',
	'addToBookmarks': 'star',
	'toggleFullscreen': 'maximize',
	'toggleMaximize': 'squarePlus',
	'minimize': 'squareMinus',
	'openCustomUrl': 'externalLink',
	'copyUrl': 'copy',
	'copyTitle': 'copy',
	'copyTitleAndUrl': 'copy',
	'openDownloads': 'download',
	'openHistory': 'history',
	'openExtensions': 'puzzle',
	'saveAsMhtml': 'fileDown',
	'printPage': 'printer',
	'duplicateTab': 'layers2',
	'toggleMuteTab': 'volumeX',
	'toggleMuteAllTabs': 'volumeOff',
	'togglePinTab': 'pin',
	'moveTabToNewWindow': 'squareArrowOutUpRight',
	'actionChain': 'workflow',
	'delay': 'timer',
	'sendCustomEvent': 'codeXml',
	'sendExtensionMessage': 'puzzle',
	'simulateKey': 'keyboard',
	'pasteClipboard': 'clipboardPaste',
	'pasteContent': 'clipboardType',
	'searchClipboard': 'search',
	'searchLink': 'search',
	'zoomIn': 'zoomIn',
	'zoomOut': 'zoomOut',
	'resetZoom': 'searchX',
	'viewPageSource': 'fileCode',
	'pauseGesture': 'circlePause',
	'menuShowTabs': 'layoutList',
	'menuRecentlyClosed': 'history',
	'menuShowBookmarks': 'bookOpen',
	'customMenu': 'layoutGrid',
	'areaSelect': 'squareDashedMousePointer',
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
	{ key: '', actions: ['none', 'actionChain', 'delay'] },
	{ key: 'actionCategoryNavigation', icon: 'compass', actions: ['back', 'forward', 'urlLevelUp', 'urlToRoot', 'scrollUp', 'scrollDown', 'scrollToTop', 'scrollToBottom'] },
	{ key: 'actionCategoryContextMenu', icon: 'menu', actions: ['menuShowTabs', 'menuRecentlyClosed', 'menuShowBookmarks', 'customMenu', 'addSiteToMenu'] },
	{ key: 'actionCategoryTabs', icon: 'panelTop', actions: ['newTab', 'closeTab', 'refresh', 'refreshAllTabs', 'switchLeftTab', 'switchRightTab', 'switchFirstTab', 'switchLastTab', 'closeOtherTabs', 'closeLeftTabs', 'closeRightTabs', 'closeAllTabs', 'switchLastActiveTab', 'restoreTab', 'duplicateTab', 'togglePinTab', 'moveTabToNewWindow'] },
	{ key: 'actionCategoryWindow', icon: 'appWindow', actions: ['newWindow', 'newIncognito', 'toggleFullscreen', 'toggleMaximize', 'minimize', 'closeWindow', 'closeBrowser'] },
	{ key: 'actionCategoryUtilities', icon: 'wrench', actions: ['addToBookmarks', 'copyUrl', 'copyTitle', 'copyTitleAndUrl', 'openCustomUrl', 'openDownloads', 'openHistory', 'openExtensions', 'zoomIn', 'zoomOut', 'resetZoom', 'toggleMuteTab', 'toggleMuteAllTabs', 'stopLoading', 'stopAllLoading', 'printPage', 'saveAsMhtml', 'viewPageSource', 'pasteClipboard', 'pasteContent', 'searchClipboard', 'searchLink', 'pauseGesture', 'simulateKey', 'sendCustomEvent', 'sendExtensionMessage', 'areaSelect'] },
];

class ActionSelect extends LitElement {
	static properties = {
		value: { type: String },
		config: { type: Object },
		gestureLabel: { type: String, attribute: 'gesture-label' },
		context: { type: String },
		allowCustomName: { type: Boolean, attribute: 'allow-custom-name' },
		compact: { type: Boolean },
		_open: { state: true },
		_search: { state: true },
		_pendingValue: { state: true },
		_pendingConfig: { state: true },
		_keyRecording: { state: true },
		_searchLinkPanel: { state: true },
		_searchLinkDraft: { state: true },
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
				line-height: 18px;
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
			@keyframes as-pulse {
				0% { transform: scale(1); }
				40% { transform: scale(1.02); }
				100% { transform: scale(1); }
			}
			.modal-panel.shake {
				animation: as-pulse 0.3s ease;
			}

			.modal-panel {
				width: min(1280px, 94vw);
				height: min(1000px, 85vh);
				background: var(--card-bg);
				border-radius: 14px;
				box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border-color);
				display: flex;
				flex-direction: column;
				overflow: hidden;
				animation: as-slideIn 0.12s ease;
			}
			:host([compact]) .modal-panel {
				width: min(1180px, 88vw);
				height: min(900px, 78vh);
			}

			.modal-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 12px 16px;
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

			.modal-body {
				flex: 1;
				display: flex;
				min-height: 0;
				padding: 0;
			}
			.modal-left {
				flex: 1;
				min-width: 0;
				display: flex;
				flex-direction: column;
				border-inline-end: 1px solid var(--border-color);
			}
			.modal-right {
				width: 340px;
				flex-shrink: 0;
				display: flex;
				flex-direction: column;
				min-height: 0;
			}

			.search-wrapper {
				padding: 10px 14px 6px;
				flex-shrink: 0;
			}
			input.search-input {
				width: 100%;
			}

			.action-list {
				flex: 1;
				overflow-y: auto;
				padding: 0 14px 14px;
				overscroll-behavior: contain;
			}
			.category-label {
				padding: 6px 8px 6px;
				margin-top: 8px;
				margin-bottom: 2px;
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
			.action-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
				gap: 2px;
				margin-top: 4px;
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

			.detail-header {
				padding: 12px 12px 12px 18px;
				display: flex;
				align-items: center;
				gap: 10px;
				border-bottom: 1px solid var(--border-color);
				flex-shrink: 0;
				min-height: 52px;
			}
			.detail-header-icon {
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--text-secondary);
				flex-shrink: 0;
			}
			.detail-header-icon svg {
				width: 18px;
				height: 18px;
			}
			.detail-header-text {
				flex: 1;
				min-width: 0;
			}
			.detail-header-name {
				font-size: 14px;
				font-weight: 600;
				color: var(--text-primary);
				line-height: 1.35;
				overflow: hidden;
				text-overflow: ellipsis;
				display: -webkit-box;
				-webkit-line-clamp: 2;
				-webkit-box-orient: vertical;
				word-break: break-word;
			}
			.detail-reset-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				padding: 0;
				border: 0;
				border-radius: 6px;
				background: transparent;
				color: var(--text-muted);
				cursor: pointer;
				flex-shrink: 0;
				opacity: 0;
				pointer-events: none;
				transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
			}
			.detail-reset-btn.visible {
				opacity: 1;
				pointer-events: auto;
			}
			.detail-reset-btn:hover {
				background: var(--bg-secondary);
				color: var(--text-primary);
			}
			.detail-body {
				flex: 1;
				min-height: 0;
				overflow-y: auto;
				overscroll-behavior: contain;
				padding: 15px 16px 16px;
				display: flex;
				flex-direction: column;
				gap: 14px;
			}
			.detail-empty {
				margin: auto;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 8px;
				font-size: 13px;
				color: var(--text-muted);
				text-align: center;
				user-select: none;
			}
			.detail-empty svg {
				opacity: 0.55;
			}
			.required-badge {
				display: inline-flex;
				align-items: center;
				padding: 1px 6px;
				font-size: 10px;
				font-weight: 700;
				color: var(--warning-color);
				background: rgba(230, 161, 23, 0.14);
				border-radius: 4px;
				text-transform: uppercase;
				letter-spacing: 0.05em;
				margin-inline-start: 6px;
				vertical-align: middle;
			}

			.action-config-label {
				font-size: 12px;
				color: var(--text-secondary);
				font-weight: 600;
			}
			.action-config-input {
				width: 100%;
				padding: 8px 10px;
				font-size: 13px;
			}
			.action-config-textarea {
				width: 100%;
				padding: 8px 10px;
				font-size: 13px;
				font-family: var(--font-mono);
				resize: vertical;
				min-height: 20px;
			}
			.action-config-textarea.invalid {
				box-shadow: 0 0 0 0.75px var(--warning-color);
			}
			.action-config-hint {
				font-size: 11px;
				color: var(--text-muted);
				line-height: 1.4;
			}
			.action-config-hint code,
			.action-config-label code,
			.action-config-checkbox code {
				font-family: var(--font-mono);
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
				flex-shrink: 0;
			}
			.action-config-row {
				display: flex;
				align-items: center;
				gap: 9px 10px;
				flex-wrap: wrap;
			}
			.action-config-field {
				display: flex;
				flex-direction: column;
				gap: 6px;
			}
			.action-config-field .action-config-label {
				display: inline-flex;
				align-items: center;
			}
			.action-config-row.disabled,
			.action-config-field.disabled {
				opacity: 0.4;
				pointer-events: none;
			}
			.action-config-row > .action-config-label {
				flex-basis: 100%;
				min-width: 0;
			}
			.action-config-row select {
				flex: 1;
				min-width: 0;
			}
			.action-config-row.compact select {
				flex: 0 1 auto;
			}
			.action-config-row .slider-control {
				flex: 1;
				display: flex;
				align-items: center;
				gap: 8px;
				min-width: 0;
				padding-block: 1px;
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
			.inline-input-control {
				display: flex;
				align-items: center;
				gap: 4px;
			}
			.inline-input-control span {
				font-size: 13px;
				color: var(--text-secondary);
			}
			.action-config-warning {
				font-size: 12px;
				color: var(--warning-color);
				padding: 6px 8px;
				background: rgba(230, 161, 23, 0.08);
				border-radius: 6px;
				line-height: 1.5;
			}
			.action-config-info {
				font-size: 12px;
				color: var(--accent-color);
				padding: 6px 8px;
				background: rgba(66, 133, 244, 0.08);
				border-radius: 6px;
				line-height: 1.5;
			}
			.action-config-warning b, .action-config-info b {
				font-weight: 600;
			}

			.modal-footer {
				display: flex;
				align-items: center;
				justify-content: flex-end;
				gap: 8px;
				padding: 10px 16px;
				border-top: 1px solid var(--border-color);
				flex-shrink: 0;
			}
			.modal-footer-label {
				font-size: 12px;
				color: var(--text-secondary);
				flex-shrink: 0;
				display: inline-flex;
				align-items: center;
				gap: 4px;
			}
			input.modal-footer-name {
				width: 180px;
				margin-inline-end: auto;
			}
			.modal-footer-btn {
				min-width: 92px;
			}

			.key-record-btn.recording {
				border-color: var(--accent-color);
				background: rgba(66, 133, 244, 0.1);
				color: var(--accent-color);
				box-shadow: 0 0 0 0.75px var(--accent-color);
				animation: as-recording-pulse 1.2s ease-in-out infinite;
			}
			@keyframes as-recording-pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.6; }
			}

			@media (max-width: 780px) {
				.modal-panel {
					height: 92vh;
				}
				.modal-body {
					flex-direction: column;
				}
				.modal-left {
					border-inline-end: none;
					border-bottom: 1px solid var(--border-color);
					flex: 1 1 0;
					min-height: 0;
				}
				.modal-right {
					width: auto;
					flex: 0 1 auto;
					max-height: 50%;
					min-height: 0;
				}
				.detail-header {
					display: none;
				}
			}
			@media (max-width: 500px) {
				.action-grid {
					grid-template-columns: repeat(2, 1fr);
				}
			}
		`,
	];

	constructor() {
		super();
		this.value = 'none';
		this.config = {};
		this.gestureLabel = '';
		this.context = 'gesture';
		this.compact = false;
		this._open = false;
		this._search = '';
		this._pendingValue = 'none';
		this._pendingConfig = {};
		this._keyRecording = false;
		this._searchLinkPanel = null;
		this._searchLinkDraft = null;
		this._onActionsUpdated = () => this.requestUpdate();
	}

	connectedCallback() {
		super.connectedCallback();
		window.addEventListener('action-catalog-changed', this._onActionsUpdated);
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		window.removeEventListener('action-catalog-changed', this._onActionsUpdated);
		if (this._open) {
			this._open = false;
			unlockBodyScroll();
			this.#stopKeyRecording();
		}
	}

	#getActionLabel(val) {
		if (this.config?.customName) return this.config.customName;
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
		if (val === 'pasteContent') {
			const baseLabel = window.i18n.getMessage('actionPasteContent');
			const content = (this.config?.content || '').replace(/\s+/g, ' ').trim();
			return content
				? `${baseLabel} (${content})`
				: baseLabel;
		}
		if (val === 'actionChain') {
			return getChainLabel(this.config?.chainId);
		}
		if (val === 'customMenu') {
			if (this.config?.contextual) return window.i18n.getMessage('customMenuContextualLabel');
			return getMenuLabel(this.config?.menuId);
		}
		if (val === 'addSiteToMenu') {
			return this.config?.customName || (this.config?.menuId ? getMenuLabel(this.config.menuId) : window.i18n.getMessage('actionAddSiteToMenu'));
		}
		if (val === 'searchLink') {
			return this.config?.customName
				|| (window.FlowMouseEngineRegistry.resolveMenuItemLink(
					window.FlowMouseEngineCatalogApi.ENGINE_CATALOG,
					SettingsStore.current.searchEngines,
					this.config,
				)?.name)
				|| window.i18n.getMessage('actionSearchLink');
		}
		if (val === 'delay') {
			const delayMs = this.config?.delayMs ?? window.GestureConstants.ACTION_DEFAULTS.delay.delayMs;
			return `${window.i18n.getMessage(key)} (${delayMs}${window.i18n.getMessage('chainDelayUnit')})`;
		}
		if (val === 'simulateKey') {
			const baseLabel = window.i18n.getMessage('actionSimulateKey');
			const keyValue = this.config?.keyValue || 'ArrowLeft';
			const mods = [];
			if (this.config?.modCtrl) mods.push(window.i18n.getModifierKeyName('Ctrl'));
			if (this.config?.modShift) mods.push(window.i18n.getModifierKeyName('Shift'));
			if (this.config?.modAlt) mods.push(window.i18n.getModifierKeyName('Alt'));
			if (this.config?.modMeta) mods.push(window.i18n.getModifierKeyName('Meta'));
			mods.push(keyValue);
			return `${baseLabel} (${mods.join('+')})`;
		}
		return window.i18n.getMessage(key) || val;
	}

	#getFilteredCategories() {
		const ACTION_KEYS = window.GestureConstants.ACTION_KEYS;
		const search = this._search.toLowerCase().trim();
		const result = [];

		const ctx = this.context;
		for (const cat of ACTION_CATEGORIES) {
			const items = [];
			for (const action of cat.actions) {
				if (!ACTION_KEYS[action]) continue;
				if (action === 'actionChain' && ctx === 'chain-step') continue;
				if (action === 'customMenu' && (ctx === 'chain-step' || ctx === 'menu-item')) continue;
				if (action === 'delay' && ctx !== 'chain-step') continue;
				const label = window.i18n.getMessage(ACTION_KEYS[action]);
				if (!search || label.toLowerCase().includes(search) || action.toLowerCase().includes(search)) {
					items.push({ value: action, label });
				}
			}
			if (items.length > 0) {
				result.push({ label: cat.key ? window.i18n.getMessage(cat.key) : '', icon: cat.icon, items });
			}
		}

		return result;
	}

	render() {
		const hasConfigUI = this.#hasActionConfig(this.value);
		return html`
			<button class="trigger" @click=${this.open} type="button">
				<span class="trigger-label">${this.#getActionLabel(this.value)}</span>
				<span class="trigger-chevron">${unsafeHTML(hasConfigUI ? icon('settings', { size: 15 }) : icon('chevronDown', { size: 16 }))}</span>
			</button>
			${this._open ? this.#renderModal() : ''}
		`;
	}

	#renderModal() {
		const categories = this.#getFilteredCategories();
		const hasResults = categories.some(c => c.items.length > 0);
		const showActionConfig = this.#hasActionConfig(this._pendingValue);
		const showHudName = this._pendingValue !== 'none' && (this.allowCustomName || this._pendingConfig?.customName);

		return html`
			<div class="modal-overlay" @mousedown=${this.#onOverlayClick}
				@dragstart=${e => e.stopPropagation()}
				@dragover=${e => e.stopPropagation()}>
				<div class="modal-panel" @mousedown=${(e) => e.stopPropagation()}>
					<div class="modal-header">
						<span class="modal-title">
							${window.i18n.getMessage('action')}${this.gestureLabel ? html`<span class="modal-gesture">${unsafeHTML(window.GestureConstants.arrowsToSvg(this.gestureLabel))}</span>` : ''}
						</span>
						<button type="button" class="modal-close" @click=${this.#cancel}>${unsafeHTML(icons.x)}</button>
					</div>
					<div class="modal-body">
						<div class="modal-left">
							<div class="search-wrapper">
								<input class="search-input input-lg" type="text"
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
												@click=${() => this.#selectAction(item.value)}>
												<span class="action-icon">${unsafeHTML(icon(ACTION_ICONS[item.value]))}</span>
												<span>${item.label}</span>
											</div>
										`)}
									</div>
								`) : html`<div class="no-results">${window.i18n.getMessage('noResults')}</div>`}
							</div>
						</div>
						<div class="modal-right">
							${this.#renderDetailHeader(showActionConfig)}
							<div class="detail-body">
								${showActionConfig
									? this.#renderActionConfig()
									: html`
										<div class="detail-empty">
											${unsafeHTML(icon('circleCheck', { size: 22 }))}
											<span>${window.i18n.getMessage('actionNoOptions')}</span>
										</div>
									`}
							</div>
						</div>
					</div>
					<div class="modal-footer">
						${showHudName ? html`
							<span class="modal-footer-label">
								${window.i18n.getMessage('customHudName')}
								<span class="help-icon"
									.tooltip=${tooltip(window.i18n.getMessage('customHudNameTooltip'))}>
									${unsafeHTML(icon('circleHelp', { size: 14 }))}
								</span>
							</span>
							<input class="modal-footer-name" type="text"
								placeholder=${window.i18n.getMessage(window.GestureConstants.ACTION_KEYS[this._pendingValue]) || this._pendingValue}
								maxlength="80"
								.value=${this._pendingConfig.customName || ''}
								@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, customName: e.target.value }; }}
							>
						` : ''}
						<button type="button" class="btn btn-lg btn-secondary modal-footer-btn" @click=${this.#cancel}>
							${window.i18n.getMessage('buttonCancel')}
						</button>
						<button type="button" class="btn btn-lg btn-primary modal-footer-btn" @click=${this.#confirm}>
							${window.i18n.getMessage('buttonConfirm')}
						</button>
					</div>
				</div>
			</div>
		`;
	}

	#renderDetailHeader(showActionConfig) {
		const val = this._pendingValue;
		const ACTION_KEYS = window.GestureConstants.ACTION_KEYS;

		const key = ACTION_KEYS[val];
		const name = key ? window.i18n.getMessage(key) : val;

		const canReset = showActionConfig && val !== 'actionChain' && val !== 'customMenu' && this.#isConfigModified();
		return html`
			<div class="detail-header">
				<div class="detail-header-icon">${unsafeHTML(icon(ACTION_ICONS[val] || 'minus'))}</div>
				<div class="detail-header-text">
					<div class="detail-header-name">${name}</div>
				</div>
				${showActionConfig ? html`
					<button type="button" class="detail-reset-btn ${canReset ? 'visible' : ''}"
						.tooltip=${tooltip(window.i18n.getMessage('resetToDefault'))}
						@click=${this.#resetConfig}>
						${unsafeHTML(icon('rotateCcw', { size: 14, strokeWidth: 2.5 }))}
					</button>
				` : ''}
			</div>
		`;
	}

	#isConfigModified() {
		const defaults = window.GestureConstants.ACTION_DEFAULTS[this._pendingValue];
		if (!defaults) return false;
		return Object.keys(this._pendingConfig).some(k => k !== 'customName' && k in defaults);
	}

	#resetConfig() {
		const customName = this._pendingConfig.customName;
		this._pendingConfig = customName ? { customName } : {};
		this.#stopKeyRecording();
		this.requestUpdate();
	}

	open() {
		this._open = true;
		this._search = '';
		this._pendingValue = this.value;
		this._pendingConfig = structuredClone(this.config || {});
		this._searchLinkPanel = null;
		this._searchLinkDraft = null;
		this.__searchLinkEditMode = null;
		lockBodyScroll();
		this.updateComplete.then(() => {
			this.shadowRoot.querySelector('.search-input')?.focus();
			this.#scrollToSelected();
		});
	}

	#hasChanges() {
		if (this._pendingValue !== this.value) return true;
		const pendingCfg = this.#cleanConfig(this._pendingConfig);
		const currentCfg = this.#cleanConfig(this.config || {});
		const sorted = obj => JSON.stringify(obj, Object.keys(obj).sort());
		return sorted(pendingCfg) !== sorted(currentCfg);
	}

	#confirm() {
		const oldValue = this.value;
		const oldConfig = this.config;
		this.value = this._pendingValue;
		this.config = this.#cleanConfig(this._pendingConfig);
		const changed = this.value !== oldValue
			|| JSON.stringify(this.config) !== JSON.stringify(oldConfig);
		this._open = false;
		this.#stopKeyRecording();
		unlockBodyScroll();
		if (changed) this.#dispatchChange();
		this.updateComplete.then(() => {
			this.shadowRoot.querySelector('.trigger').focus();
		});
	}

	#cancel() {
		this._open = false;
		this.#stopKeyRecording();
		unlockBodyScroll();
		this.updateComplete.then(() => {
			this.shadowRoot.querySelector('.trigger').focus();
		});
	}

	#shakeModal() {
		const panel = this.shadowRoot.querySelector('.modal-panel');
		if (!panel) return;
		panel.classList.remove('shake');
		void panel.offsetWidth;
		panel.classList.add('shake');
	}

	#onOverlayClick(e) {
		if (e.target.classList.contains('modal-overlay')) {
			e.preventDefault();
			if (this.#hasChanges()) {
				this.#shakeModal();
			} else {
				this.#cancel();
			}
		}
	}

	#onSearchInput(e) {
		this._search = e.target.value;
	}

	#onKeydown(e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			this.#cancel();
		}
	}

	#isItemSelected(item) {
		return item.value === this._pendingValue;
	}

	#selectAction(actionValue) {
		this._pendingValue = actionValue;
		if (this.#hasActionConfig(actionValue)) {
			this.updateComplete.then(() => {
				this.#scrollToSelected();
			});
		}
	}

	#onChainSelect(e) {
		const chainId = e.detail.chainId;
		if (!chainId) return;
		this._pendingConfig = { ...this._pendingConfig, chainId };
		this.requestUpdate();
	}

	#onMenuSelect(e) {
		const menuId = e.detail.menuId;
		if (!menuId) return;
		this._pendingConfig = { ...this._pendingConfig, menuId };
		this.requestUpdate();
	}

	#scrollToSelected() {
		this.updateComplete.then(() => {
			this.shadowRoot.querySelector('.action-item.selected')?.scrollIntoView({ block: 'nearest' });
		});
	}


	#hasActionConfig(action) {
		return !!window.GestureConstants.ACTION_DEFAULTS[action];
	}

	#cleanConfig(pendingConfig) {
		const action = this._pendingValue;
		const defaults = window.GestureConstants.ACTION_DEFAULTS[action];

		const result = {};
		if (defaults) {
			for (const key of Object.keys(defaults)) {
				if (pendingConfig[key] !== undefined) {
					if (typeof defaults[key] === 'string') {
						result[key] = String(pendingConfig[key]).trim();
					} else if (typeof defaults[key] === 'number') {
						result[key] = Number(pendingConfig[key]);
					} else if (typeof defaults[key] === 'boolean') {
						result[key] = !!pendingConfig[key];
					} else if (defaults[key] !== null && typeof defaults[key] === 'object') {
						result[key] = structuredClone(pendingConfig[key]);
					} else {
						result[key] = pendingConfig[key];
					}
				}
			}
		}
		const customName = (pendingConfig.customName || '').trim();
		if (customName) result.customName = customName;
		return result;
	}

	// ---- searchLink config (engine picker + inline new/edit) ----

	get #searchEngines() {
		return SettingsStore.current.searchEngines || { overrides: {}, hidden: [], custom: [], order: [] };
	}

	#searchLinkEngines() {
		return window.FlowMouseEngineRegistry.resolveEngines(
			window.FlowMouseEngineCatalogApi.ENGINE_CATALOG,
			this.#searchEngines,
			'text',
		);
	}

	#searchLinkResolvedEngine() {
		const id = this._pendingConfig?.engineId;
		if (!id) return null;
		return window.FlowMouseEngineRegistry.getEngineById(
			window.FlowMouseEngineCatalogApi.ENGINE_CATALOG,
			this.#searchEngines,
			id,
		) || null;
	}

	#searchLinkGenerateId() {
		const existing = new Set((this.#searchEngines.custom || []).map(c => c.id));
		let id;
		do {
			const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
			id = `engine_${uuid}`;
		} while (existing.has(id));
		return id;
	}

	#searchLinkCancelPanel() {
		this._searchLinkPanel = null;
		this._searchLinkDraft = null;
		this.__searchLinkEditMode = null;
	}

	// Save a brand-new custom engine globally, then point this item at it.
	#searchLinkSaveNewEngine() {
		const draft = this._searchLinkDraft;
		if (!draft) { this.#shakeModal(); return; }
		const name = (draft.name || '').trim();
		const url  = (draft.url  || '').trim();
		if (!name || !url) { this.#shakeModal(); return; }
		const se = this.#searchEngines;
		const id = this.#searchLinkGenerateId();
		const entry = {
			id,
			name,
			url,
			plus: !!draft.plus,
			slug: !!draft.slug,
			suffix: draft.suffix || '',
			clipboardMode: !!draft.clipboardMode,
			transformEnabled: !!draft.transformEnabled,
			transformCode: draft.transformCode || '',
			transformClipboard: !!draft.transformClipboard,
			transformRawResult: !!draft.transformRawResult,
		};
		const next = { ...se, custom: [...(se.custom || []), entry] };
		SettingsStore.save({ searchEngines: next });
		window.dispatchEvent(new Event('action-catalog-changed'));
		this._pendingConfig = { ...this._pendingConfig, engineId: id, exception: {}, name: '', url: '', plus: false, slug: false, suffix: '', clipboardMode: false, transformEnabled: false, transformCode: '', transformClipboard: false, transformRawResult: false };
		this.#searchLinkCancelPanel();
		this.requestUpdate();
	}

	// Edit the selected engine globally: built-in -> overrides[id], custom -> replace entry.
	#searchLinkSaveGlobalEdit() {
		const draft = this._searchLinkDraft;
		const base = this.#searchLinkResolvedEngine();
		if (!draft || !base) { this.#searchLinkCancelPanel(); return; }
		const name = (draft.name || '').trim();
		const url  = (draft.url  || '').trim();
		if (!name || !url) { this.#shakeModal(); return; }
		const se = this.#searchEngines;
		const fields = {
			name,
			url,
			plus: !!draft.plus,
			slug: !!draft.slug,
			suffix: draft.suffix || '',
			clipboardMode: !!draft.clipboardMode,
			transformEnabled: !!draft.transformEnabled,
			transformCode: draft.transformCode || '',
			transformClipboard: !!draft.transformClipboard,
			transformRawResult: !!draft.transformRawResult,
		};
		let next;
		if (base.builtin) {
			const overrides = { ...(se.overrides || {}) };
			overrides[base.id] = fields;
			next = { ...se, overrides };
		} else {
			const custom = (se.custom || []).map(c => (c.id === base.id ? { id: base.id, ...fields } : c));
			next = { ...se, custom };
		}
		SettingsStore.save({ searchEngines: next });
		window.dispatchEvent(new Event('action-catalog-changed'));
		// Editing the engine globally means no per-item exception is needed.
		this._pendingConfig = { ...this._pendingConfig, exception: {} };
		this.#searchLinkCancelPanel();
		this.requestUpdate();
	}

	// For the exception editor: store only the fields that differ from the resolved engine.
	#searchLinkApplyExceptionDiff(fields) {
		const base = this.#searchLinkResolvedEngine();
		if (!base) return;
		const exception = {};
		for (const key of ['name', 'url', 'plus', 'slug', 'suffix', 'clipboardMode', 'transformEnabled', 'transformCode', 'transformClipboard', 'transformRawResult']) {
			const a = fields[key];
			const b = base[key];
			const changed = (typeof b === 'boolean') ? (!!a !== !!b) : ((a ?? '') !== (b ?? ''));
			if (changed) exception[key] = a;
		}
		this._pendingConfig = { ...this._pendingConfig, exception };
	}

	#renderSearchLinkConfig() {
		const i18n = window.i18n;
		const engineId = this._pendingConfig?.engineId || '';
		const isInline = !engineId;
		const engines = this.#searchLinkEngines();
		const panel = this._searchLinkPanel;

		// Inline draft seeded from the current per-item inline fields.
		const inlineDraft = {
			name: this._pendingConfig?.name || '',
			url: this._pendingConfig?.url || '',
			plus: !!this._pendingConfig?.plus,
			slug: !!this._pendingConfig?.slug,
			suffix: this._pendingConfig?.suffix || '',
			clipboardMode: !!this._pendingConfig?.clipboardMode,
			transformEnabled: !!this._pendingConfig?.transformEnabled,
			transformCode: this._pendingConfig?.transformCode || '',
			transformClipboard: !!this._pendingConfig?.transformClipboard,
			transformRawResult: !!this._pendingConfig?.transformRawResult,
		};

		const setInlineField = (detail) => {
			this._pendingConfig = {
				...this._pendingConfig,
				name: detail.name,
				url: detail.url,
				plus: detail.plus,
				slug: detail.slug,
				suffix: detail.suffix,
				clipboardMode: detail.clipboardMode,
				transformEnabled: detail.transformEnabled,
				transformCode: detail.transformCode,
				transformClipboard: detail.transformClipboard,
				transformRawResult: detail.transformRawResult,
				engineId: '',
				exception: {},
			};
		};

		const modeRow = html`
			<div class="action-config-row">
				<span class="action-config-label">${i18n.getMessage('searchLinkSource')}</span>
				<select class="action-config-select"
					.value=${isInline ? 'inline' : 'engine'}
					@change=${(e) => {
						this.#searchLinkCancelPanel();
						if (e.target.value === 'engine') {
							const firstId = engines[0]?.id || '';
							this._pendingConfig = { ...this._pendingConfig, engineId: firstId, exception: {} };
						} else {
							this._pendingConfig = { ...this._pendingConfig, engineId: '', exception: {} };
						}
						this.requestUpdate();
					}}
				>
					<option value="engine" ?selected=${!isInline}>${i18n.getMessage('searchLinkModeEngine')}</option>
					<option value="inline" ?selected=${isInline}>${i18n.getMessage('searchLinkModeInline')}</option>
				</select>
			</div>
		`;

		if (isInline) {
			return html`
				${modeRow}
				<div class="action-config-field">
					<engine-fields
						.value=${inlineDraft}
						@field-change=${(e) => { setInlineField(e.detail); this.requestUpdate(); }}
					></engine-fields>
				</div>
				${this.#renderPositionSelect(true, true, true)}
			`;
		}

		return html`
			${modeRow}
			<div class="action-config-row">
				<span class="action-config-label">${i18n.getMessage('searchLinkEngine')}</span>
				<select class="action-config-select"
					.value=${engineId}
					@change=${(e) => {
						this.#searchLinkCancelPanel();
						this._pendingConfig = { ...this._pendingConfig, engineId: e.target.value, exception: {} };
						this.requestUpdate();
					}}
				>
					${engines.map(eng => html`<option value=${eng.id} ?selected=${eng.id === engineId}>${eng.name || eng.id}</option>`)}
				</select>
			</div>
			<div class="action-config-row">
				<button class="btn btn-ghost" type="button"
					@click=${() => { this._searchLinkPanel = (panel === 'new') ? null : 'new'; this._searchLinkDraft = null; this.requestUpdate(); }}>
					${unsafeHTML(icon('plus', { size: 13, strokeWidth: 2.5 }))}
					<span>${i18n.getMessage('searchLinkNew')}</span>
				</button>
				<button class="btn btn-ghost" type="button" ?disabled=${!engineId}
					@click=${() => {
						if (!engineId) return;
						const base = this.#searchLinkResolvedEngine() || {};
						this._searchLinkPanel = (panel === 'edit') ? null : 'edit';
						this._searchLinkDraft = { name: base.name || '', url: base.url || '', plus: !!base.plus, slug: !!base.slug, suffix: base.suffix || '', clipboardMode: !!base.clipboardMode, transformEnabled: !!base.transformEnabled, transformCode: base.transformCode || '', transformClipboard: !!base.transformClipboard, transformRawResult: !!base.transformRawResult };
						this.requestUpdate();
					}}>
					${unsafeHTML(icon('squarePen', { size: 13, strokeWidth: 2 }))}
					<span>${i18n.getMessage('searchLinkEdit')}</span>
				</button>
			</div>
			${panel === 'new' ? this.#renderSearchLinkNewPanel() : ''}
			${panel === 'edit' ? this.#renderSearchLinkEditPanel() : ''}
			${this.#renderPositionSelect(true, true, true)}
		`;
	}

	#renderSearchLinkNewPanel() {
		const i18n = window.i18n;
		const draft = this._searchLinkDraft;
		const inlineDraft = {
			name: this._pendingConfig?.name || '',
			url: this._pendingConfig?.url || '',
			plus: !!this._pendingConfig?.plus,
			slug: !!this._pendingConfig?.slug,
			suffix: this._pendingConfig?.suffix || '',
			clipboardMode: !!this._pendingConfig?.clipboardMode,
			transformEnabled: !!this._pendingConfig?.transformEnabled,
			transformCode: this._pendingConfig?.transformCode || '',
			transformClipboard: !!this._pendingConfig?.transformClipboard,
			transformRawResult: !!this._pendingConfig?.transformRawResult,
		};
		// `draft === null` => the "new" choice picker; otherwise the saved-engine editor.
		if (draft === null) {
			return html`
				<div class="action-config-info">
					<div class="action-config-row">
						<button class="btn btn-ghost" type="button"
							@click=${() => {
								// Switch the whole editor to inline one-off mode (engineId falsy).
								this._pendingConfig = { ...this._pendingConfig, engineId: '', exception: {} };
								this.#searchLinkCancelPanel();
								this.requestUpdate();
							}}>
							<span>${i18n.getMessage('searchLinkNewInline')}</span>
						</button>
						<button class="btn btn-ghost" type="button"
							@click=${() => { this._searchLinkDraft = { name: '', url: '', plus: false, slug: false, suffix: '', clipboardMode: false }; this.requestUpdate(); }}>
							<span>${i18n.getMessage('searchLinkNewSaved')}</span>
						</button>
					</div>
				</div>
			`;
		}
		return html`
			<div class="action-config-field">
				<label class="action-config-label">${i18n.getMessage('searchLinkNewSaved')}</label>
				<engine-fields
					.value=${draft}
					@field-change=${(e) => { this._searchLinkDraft = { ...this._searchLinkDraft, ...e.detail }; }}
				></engine-fields>
				<div class="action-config-row" style="justify-content:flex-end;gap:8px;">
					<button class="btn btn-ghost" type="button" @click=${() => { this.#searchLinkCancelPanel(); this.requestUpdate(); }}>${i18n.getMessage('engineCancel')}</button>
					<button class="btn btn-primary" type="button" @click=${() => this.#searchLinkSaveNewEngine()}>${i18n.getMessage('engineSave')}</button>
				</div>
			</div>
		`;
	}

	#renderSearchLinkEditPanel() {
		const i18n = window.i18n;
		const base = this.#searchLinkResolvedEngine();
		if (!base) return '';
		// Two-step: choose exception vs global, then show the engine-fields editor.
		const mode = this.__searchLinkEditMode || 'choice';
		if (mode === 'choice') {
			return html`
				<div class="action-config-info">
					<div class="action-config-row">
						<button class="btn btn-ghost" type="button"
							@click=${() => {
								const ex = this._pendingConfig?.exception || {};
								this._searchLinkDraft = {
									name: ex.name ?? base.name,
									url: ex.url ?? base.url,
									plus: ex.plus ?? base.plus,
									slug: ex.slug ?? base.slug,
									suffix: ex.suffix ?? base.suffix,
									clipboardMode: ex.clipboardMode ?? base.clipboardMode,
									transformEnabled: ex.transformEnabled ?? base.transformEnabled,
									transformCode: ex.transformCode ?? base.transformCode,
									transformClipboard: ex.transformClipboard ?? base.transformClipboard,
									transformRawResult: ex.transformRawResult ?? base.transformRawResult,
								};
								this.__searchLinkEditMode = 'exception';
								this.requestUpdate();
							}}>
							<span>${i18n.getMessage('searchLinkEditException')}</span>
						</button>
						<button class="btn btn-ghost" type="button"
							@click=${() => {
								this._searchLinkDraft = { name: base.name, url: base.url, plus: base.plus, slug: base.slug, suffix: base.suffix, clipboardMode: base.clipboardMode, transformEnabled: base.transformEnabled, transformCode: base.transformCode, transformClipboard: base.transformClipboard, transformRawResult: base.transformRawResult };
								this.__searchLinkEditMode = 'global';
								this.requestUpdate();
							}}>
							<span>${i18n.getMessage('searchLinkEditGlobal')}</span>
						</button>
					</div>
				</div>
			`;
		}
		const isException = mode === 'exception';
		return html`
			<div class="action-config-field">
				<label class="action-config-label">${i18n.getMessage(isException ? 'searchLinkEditException' : 'searchLinkEditGlobal')}</label>
				<engine-fields
					.value=${this._searchLinkDraft}
					@field-change=${(e) => {
						this._searchLinkDraft = { ...this._searchLinkDraft, ...e.detail };
						if (isException) { this.#searchLinkApplyExceptionDiff(this._searchLinkDraft); this.requestUpdate(); }
					}}
				></engine-fields>
				<div class="action-config-row" style="justify-content:flex-end;gap:8px;">
					<button class="btn btn-ghost" type="button" @click=${() => { this.__searchLinkEditMode = null; this.#searchLinkCancelPanel(); this.requestUpdate(); }}>${i18n.getMessage('engineCancel')}</button>
					${isException ? html`
						<button class="btn btn-primary" type="button" @click=${() => { this.__searchLinkEditMode = null; this.#searchLinkCancelPanel(); this.requestUpdate(); }}>${i18n.getMessage('engineSave')}</button>
					` : html`
						<button class="btn btn-primary" type="button" @click=${() => { this.__searchLinkEditMode = null; this.#searchLinkSaveGlobalEdit(); }}>${i18n.getMessage('engineSave')}</button>
					`}
				</div>
			</div>
		`;
	}

	#renderPositionSelect(showCurrent, showNewWindow, showIncognito) {
		const action = this._pendingValue;
		const defaults = window.GestureConstants.ACTION_DEFAULTS[action] || {};
		const position = this._pendingConfig.position ?? defaults.position;
		const active = this._pendingConfig.active ?? defaults.active;
		const showActive = position !== 'current';
		const incognito = this._pendingConfig.incognito ?? defaults.incognito;
		const dimStyle = (showIncognito && incognito) ? 'opacity: 0.5' : '';
		return html`
			<div class="action-config-row">
				<span class="action-config-label">${window.i18n.getMessage('newTabPosition')}</span>
				<select style=${dimStyle} .value=${position}
					@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, position: e.target.value }; this.requestUpdate(); }}>
					<option value="right" ?selected=${position === 'right'}>${window.i18n.getMessage('tabPositionRight')}</option>
					<option value="left" ?selected=${position === 'left'}>${window.i18n.getMessage('tabPositionLeft')}</option>
					<option value="first" ?selected=${position === 'first'}>${window.i18n.getMessage('tabPositionFirst')}</option>
					<option value="last" ?selected=${position === 'last'}>${window.i18n.getMessage('tabPositionLast')}</option>
					${showCurrent ? html`<option value="current" ?selected=${position === 'current'}>${window.i18n.getMessage('tabPositionCurrent')}</option>` : ''}
					${showNewWindow ? html`<option value="newWindow" ?selected=${position === 'newWindow'}>${window.i18n.getMessage('tabPositionNewWindow')}</option>` : ''}
				</select>
				${showActive ? html`
					<label class="action-config-checkbox" style=${dimStyle}>
						<input type="checkbox"
							.checked=${active}
							@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, active: e.target.checked }; this.requestUpdate(); }}
						>
						<span>${window.i18n.getMessage('newTabActive')}</span>
					</label>
				` : ''}
			</div>
			${showIncognito ? html`
				<div class="action-config-row">
					<label class="action-config-checkbox">
						<input type="checkbox"
							.checked=${incognito}
							@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, incognito: e.target.checked }; this.requestUpdate(); }}
						>
						<span>${window.i18n.getMessage('openInIncognito')}</span>
					</label>
				</div>
			` : ''}
		`;
	}


	#renderMenuConfigRow() {
		const action = this._pendingValue;
		const defaults = window.GestureConstants.ACTION_DEFAULTS[action] || {};
		const sortOrder = this._pendingConfig.sortOrder ?? defaults.sortOrder;
		const maxItems = this._pendingConfig.maxItems ?? defaults.maxItems;
		const scrollToBottom = this._pendingConfig.scrollToBottom ?? defaults.scrollToBottom;
		const hardMax = action === 'menuRecentlyClosed' ? 100 : 999;
		const isFirefox = !!window.i18n.isFirefox;

		const sortOptions = [
			{ value: 'default', key: 'ctxMenuSortDefault' },
			{ value: 'default_desc', key: 'ctxMenuSortDefaultDesc' },
		];
		if (action === 'menuShowBookmarks') {
			sortOptions.push(
				{ value: 'date_asc', key: 'ctxMenuSortDateAddedAsc' },
				{ value: 'date_desc', key: 'ctxMenuSortDateAddedDesc' },
			);
		}
		if (action === 'menuShowTabs') {
			sortOptions.push(
				{ value: 'lastAccess_asc', key: 'ctxMenuSortLastAccessAsc' },
				{ value: 'lastAccess_desc', key: 'ctxMenuSortLastAccessDesc' },
			);
		}
		sortOptions.push(
			{ value: 'name_asc', key: 'ctxMenuSortNameAsc' },
			{ value: 'name_desc', key: 'ctxMenuSortNameDesc' },
		);

		return html`
			<div class="action-config-row">
				<span class="action-config-label">${window.i18n.getMessage('ctxMenuSortOrder')}</span>
				<select .value=${sortOrder}
					@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, sortOrder: e.target.value }; this.requestUpdate(); }}>
					${sortOptions.map(o => html`<option value=${o.value} ?selected=${sortOrder === o.value}>${window.i18n.getMessage(o.key)}</option>`)}
				</select>
			</div>
			<div class="action-config-row">
				<span class="action-config-label" style="min-width: auto;">${window.i18n.getMessage('ctxMenuMaxItems')}</span>
				<div class="inline-input-control">
					<input type="number" class="action-config-input" min="0" max=${hardMax} step="1"
						style="min-width: 100px"
						placeholder=${window.i18n.getMessage('ctxMenuMaxItemsUnlimited')}
						.value=${maxItems > 0 ? String(maxItems) : ''}
						@change=${(e) => {
							const raw = parseInt(e.target.value);
							const v = (!raw || raw <= 0 || raw > hardMax) ? 0 : raw;
							e.target.value = v > 0 ? v : '';
							this._pendingConfig = { ...this._pendingConfig, maxItems: v };
							this.requestUpdate();
						}}
					>
				</div>
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${scrollToBottom}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, scrollToBottom: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('ctxMenuScrollToBottom')}</span>
				</label>
			</div>
		`;
	}

	#renderTimeDisplay() {
		const action = this._pendingValue;
		const defaults = window.GestureConstants.ACTION_DEFAULTS[action] || {};
		const timeDisplay = this._pendingConfig.timeDisplay ?? defaults.timeDisplay;
		const isFirefox = !!window.i18n.isFirefox;

		const options = [{ value: 'none', key: 'ctxMenuTimeNone' }];
		if (action === 'menuShowTabs') {
			options.push({ value: 'lastAccess', key: 'ctxMenuTimeLastAccess' });
		} else if (action === 'menuRecentlyClosed') {
			options.push({ value: 'closedTime', key: 'ctxMenuTimeClosedTime' });
		} else if (action === 'menuShowBookmarks') {
			options.push({ value: 'dateAdded', key: 'ctxMenuTimeDateAdded' });
		}

		return html`
			<div class="action-config-row">
				<span class="action-config-label">${window.i18n.getMessage('ctxMenuTimeDisplay')}</span>
				<select .value=${timeDisplay}
					@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, timeDisplay: e.target.value }; this.requestUpdate(); }}>
					${options.map(o => html`<option value=${o.value} ?selected=${timeDisplay === o.value}>${window.i18n.getMessage(o.key)}</option>`)}
				</select>
			</div>
		`;
	}

	#renderActionConfig() {
		const action = this._pendingValue;
		const { ACTION_DEFAULTS } = window.GestureConstants;
		if (action === 'actionChain') {
			return html`
				<div class="action-config-info">${window.i18n.getMessage('actionChainsDesc')}</div>
				<chain-panel
					.selectedChainId=${this._pendingConfig?.chainId || ''}
					@chain-select=${this.#onChainSelect}
				></chain-panel>
			`;
		}
		if (action === 'customMenu') {
			const contextual = !!this._pendingConfig?.contextual;
			return html`
				<div class="action-config-info">${window.i18n.getMessage('customMenuDesc')}</div>
				<div class="action-config-row">
					<label class="action-config-checkbox">
						<input type="checkbox"
							.checked=${contextual}
							@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, contextual: e.target.checked }; this.requestUpdate(); }}
						>
						<span>${window.i18n.getMessage('customMenuContextual')}</span>
					</label>
				</div>
				${contextual ? html`<div class="action-config-info">${window.i18n.getMessage('customMenuContextualHint')}</div>` : ''}
				<menu-panel
					.selectedMenuId=${this._pendingConfig?.menuId || ''}
					@menu-select=${this.#onMenuSelect}
				></menu-panel>
			`;
		}
		if (action === 'addSiteToMenu') {
			return html`
				<div class="action-config-info">${window.i18n.getMessage('addSiteToMenuDesc')}</div>
				<menu-panel
					.selectedMenuId=${this._pendingConfig?.menuId || ''}
					@menu-select=${this.#onMenuSelect}
				></menu-panel>
			`;
		}
		if (action === 'searchLink') {
			return this.#renderSearchLinkConfig();
		}
		if (action === 'openCustomUrl') {
			return html`
				<div class="action-config-field">
					<label class="action-config-label">
						${window.i18n.getMessage('enterCustomUrl')}
						<span class="required-badge">${window.i18n.getMessage('actionRequiredBadge')}</span>
					</label>
					<input class="action-config-input" type="text"
						placeholder="https://web.archive.org/web/{tabUrl:raw}"
						maxlength="500"
						.value=${this._pendingConfig.customUrl || ''}
						@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, customUrl: e.target.value }; }}
					>
					<div class="action-config-hint">${unsafeHTML(window.i18n.getMessage('customUrlPlaceholderHint').replace('%placeholders%', '<code>{tabUrl}</code> <code>{tabTitle}</code> <code>{tabDomain}</code>').replace('%example%', '<code>{tabUrl:raw}</code>'))}</div>
				</div>
				${this.#renderPositionSelect(true, true, true)}
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
			const supportsPreserveTab = action !== 'closeAllTabs';
			const preserveTabChecked = this._pendingConfig.preserveTab ?? defaults.preserveTab;
			return html`
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${skipPinnedChecked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, skipPinned: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('closeTabsSkipPinned')}</span>
				</label>
				${supportsPreserveTab ? html`
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${preserveTabChecked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, preserveTab: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('closeTabsPreserveTab')}</span>
				</label>
				` : ''}
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
			return this.#renderPositionSelect(false, false, false);
		}
		if (action === 'newWindow') {
			const defaults = ACTION_DEFAULTS.newWindow || {};
			const focusedChecked = this._pendingConfig.focused ?? defaults.focused;
			return html`
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${focusedChecked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, focused: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('newWindowFocused')}</span>
				</label>
			`;
		}
		if (action === 'viewPageSource') {
			return this.#renderPositionSelect(true, true, false);
		}
		if (action === 'copyTitleAndUrl') {
			const defaults = ACTION_DEFAULTS.copyTitleAndUrl || {};
			const checked = this._pendingConfig.asMarkdown ?? defaults.asMarkdown;
			return html`
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${checked}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, asMarkdown: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${window.i18n.getMessage('copyAsMarkdown')}</span>
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
			if (modCtrl) currentMods.push(window.i18n.getModifierKeyName('Ctrl'));
			if (modShift) currentMods.push(window.i18n.getModifierKeyName('Shift'));
			if (modAlt) currentMods.push(window.i18n.getModifierKeyName('Alt'));
			if (modMeta) currentMods.push(window.i18n.getModifierKeyName('Meta'));
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
						<button type="button" class="btn btn-secondary key-record-btn ${isRecording ? 'recording' : ''}"
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
			const includeGestureInfo = this._pendingConfig.gestureInfo ?? defaults.gestureInfo;
			const isValidJson = this.#isValidJson(eventDetail);
			const hint = window.i18n.getMessage('customEventHint')
				.replace('%code%', '<code>new CustomEvent(<b>type</b>, { detail: <b>detail</b>, bubbles: true, cancelable: true })</code>')
				.replace('%window%', '<code>window</code>');
			const gestureInfoLabel = window.i18n.getMessage('customEventIncludeGestureInfo')
				.replace('%code%', '<code><b>detail.gesture</b></code>');
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
				<label class="action-config-checkbox">
					<input type="checkbox"
						.checked=${includeGestureInfo}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, gestureInfo: e.target.checked }; this.requestUpdate(); }}
					>
					<span>${unsafeHTML(gestureInfoLabel)}</span>
				</label>
				<div class="action-config-hint">${unsafeHTML(hint)}</div>
			`;
		}
		if (action === 'sendExtensionMessage') {
			const defaults = ACTION_DEFAULTS.sendExtensionMessage || {};
			const extensionId = this._pendingConfig.extensionId ?? defaults.extensionId;
			const message = this._pendingConfig.message ?? defaults.message;
			const isValidJson = this.#isValidJson(message);
			const hint = window.i18n.getMessage('sendExtensionMessageHint')
				.replace('%code%', '<code>chrome.runtime.sendMessage(<b>extensionId</b>, <b>message</b>)</code>');
			return html`
				<div class="action-config-row">
					<span class="action-config-label"><code>extensionId</code></span>
					<input type="text" class="action-config-input"
						placeholder="abcdefghijklmnopabcdefghijklmnop"
						.value=${extensionId}
						maxlength="64"
						@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, extensionId: e.target.value }; this.requestUpdate(); }}
					>
				</div>
				<div class="action-config-row">
					<span class="action-config-label"><code>message</code></span>
					<textarea class="action-config-textarea ${isValidJson ? '' : 'invalid'}"
						placeholder='{"key": "value"}'
						rows="2"
						.value=${message}
						maxlength="500"
						@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, message: e.target.value }; this.requestUpdate(); }}
					></textarea>
				</div>
				${!isValidJson ? html`
					<div class="action-config-warning">${window.i18n.getMessage('customEventInvalidJson')}</div>
				` : ''}
				<div class="action-config-hint">${unsafeHTML(hint)}</div>
			`;
		}
		if (action === 'pasteClipboard') {
			return html`
				<div class="action-config-info">${unsafeHTML(window.i18n.getMessage('pasteClipboardHint'))}</div>
			`;
		}
		if (action === 'pasteContent') {
			const content = this._pendingConfig.content ?? (ACTION_DEFAULTS.pasteContent?.content || '');
			return html`
				<div class="action-config-info">${unsafeHTML(window.i18n.getMessage('pasteContentHint'))}</div>
				<div class="action-config-field">
					<label class="action-config-label">
						${window.i18n.getMessage('pasteContentLabel')}
						<span class="required-badge">${window.i18n.getMessage('actionRequiredBadge')}</span>
					</label>
					<textarea class="action-config-textarea"
						rows="3"
						maxlength="500"
						.value=${content}
						@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, content: e.target.value }; }}
					></textarea>
					<div class="action-config-hint">${unsafeHTML(window.i18n.getMessage('pasteContentSensitiveHint'))}</div>
				</div>
			`;
		}
		if (action === 'searchClipboard') {
			const defaults = ACTION_DEFAULTS.searchClipboard || {};
			const engine = this._pendingConfig.engine ?? defaults.engine;
			const url = this._pendingConfig.url ?? defaults.url;
			const autoDetectUrl = this._pendingConfig.autoDetectUrl ?? defaults.autoDetectUrl;
			return html`
				<div class="action-config-row">
					<span class="action-config-label">${window.i18n.getMessage('searchEngine')}</span>
					<select .value=${engine}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, engine: e.target.value }; this.requestUpdate(); }}>
						${renderCatalogEngineOptions(engine, 'text')}
					</select>
				</div>
				${engine === 'custom' ? html`
					<div class="action-config-field">
						<input class="action-config-input" type="text"
							placeholder=${window.i18n.getMessage('urlPlaceholderText')}
							.value=${url}
							@input=${(e) => { this._pendingConfig = { ...this._pendingConfig, url: e.target.value }; }}
						>
					</div>
				` : ''}
				<div class="action-config-row">
					<label class="action-config-checkbox">
						<input type="checkbox"
							.checked=${autoDetectUrl}
							@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, autoDetectUrl: e.target.checked }; this.requestUpdate(); }}
						>
						<span>${window.i18n.getMessage('autoDetectUrl')}</span>
						<span class="help-icon"
							.tooltip=${tooltip(window.i18n.getMessage('autoDetectUrlTooltip'))}>
							${unsafeHTML(icon('circleHelp', { size: 14 }))}
						</span>
					</label>
				</div>
				${this.#renderPositionSelect(true, true, true)}
			`;
		}
		if (action === 'zoomIn' || action === 'zoomOut') {
			const defaults = ACTION_DEFAULTS[action] || {};
			const zoomMode = this._pendingConfig.zoomMode ?? defaults.zoomMode;
			const zoomDelta = this._pendingConfig.zoomDelta ?? defaults.zoomDelta;
			return html`
				<div class="action-config-row">
					<span class="action-config-label">${window.i18n.getMessage('zoomStepMode')}</span>
					<select class="action-config-select"
						.value=${zoomMode}
						@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, zoomMode: e.target.value }; this.requestUpdate(); }}
					>
						<option value="browser">${window.i18n.getMessage('zoomStepModeBrowser')}</option>
						<option value="fixed">${window.i18n.getMessage('zoomStepModeFixed')}</option>
					</select>
				</div>
				${zoomMode === 'fixed' ? html`
					<div class="action-config-row">
						<span class="action-config-label">${window.i18n.getMessage('zoomDelta')}</span>
						<div class="inline-input-control">
							<input type="number" class="action-config-input" min="0" max="475" .step=${'any'}
								.value=${String(zoomDelta)}
								@change=${(e) => { const v = Math.max(0, Math.min(475, parseFloat(e.target.value) || 10)); e.target.value = v; this._pendingConfig = { ...this._pendingConfig, zoomDelta: v }; this.requestUpdate(); }}
							>
							<span>%</span>
						</div>
					</div>
				` : ''}
			`;
		}
		if (action === 'resetZoom') {
			const defaults = ACTION_DEFAULTS[action] || {};
			const resetZoomLevel = this._pendingConfig.resetZoomLevel ?? defaults.resetZoomLevel;
			const isCustom = resetZoomLevel > 0;
			return html`
				<div class="action-config-row">
					<span class="action-config-label">${window.i18n.getMessage('resetZoomLevel')}</span>
					<select class="action-config-select"
						.value=${isCustom ? 'custom' : 'default'}
						@change=${(e) => { if (e.target.value === 'default') { this._pendingConfig = { ...this._pendingConfig, resetZoomLevel: 0 }; } else { this._pendingConfig = { ...this._pendingConfig, resetZoomLevel: 100 }; } this.requestUpdate(); }}
					>
						<option value="default">${window.i18n.getMessage('resetZoomDefault')}</option>
						<option value="custom">${window.i18n.getMessage('resetZoomCustom')}</option>
					</select>
				</div>
				${isCustom ? html`
					<div class="action-config-row">
						<span class="action-config-label">${window.i18n.getMessage('resetZoomCustom')}</span>
						<div class="inline-input-control">
							<input type="number" class="action-config-input" min="25" max="500" .step=${'any'}
								.value=${String(resetZoomLevel)}
								@change=${(e) => { const v = Math.max(25, Math.min(500, parseFloat(e.target.value) || 100)); e.target.value = v; this._pendingConfig = { ...this._pendingConfig, resetZoomLevel: v }; this.requestUpdate(); }}
							>
							<span>%</span>
						</div>
					</div>
				` : ''}
			`;
		}
		if (action === 'menuShowTabs') {
			return html`
				${this.#renderMenuConfigRow()}
				${this.#renderTimeDisplay()}
			`;
		}
		if (action === 'menuRecentlyClosed') {
			return html`
				${this.#renderMenuConfigRow()}
				${this.#renderTimeDisplay()}
			`;
		}
		if (action === 'menuShowBookmarks') {
			return html`
				${this.#renderBookmarkFolderSelect()}
				${this.#renderMenuConfigRow()}
				${this.#renderTimeDisplay()}
				${this.#renderPositionSelect(true, true, true)}
			`;
		}
		if (action === 'addToBookmarks') {
			return this.#renderBookmarkFolderSelect({ allowDefault: true });
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
			composed: false,
		}));
	}

	#renderBookmarkFolderSelect({ allowDefault = false } = {}) {
		const { ACTION_DEFAULTS } = window.GestureConstants;
		const defaults = ACTION_DEFAULTS[this._pendingValue] || {};
		const folderId = this._pendingConfig.folderId ?? defaults.folderId;

		if (!this._bookmarkPermission && chrome.permissions) {
			chrome.permissions.contains({ permissions: ['bookmarks'] }).then(granted => {
				if (granted !== this._bookmarkPermission) {
					this._bookmarkPermission = granted;
					if (granted) this.#loadBookmarkFolders();
					this.requestUpdate();
				}
			});
		}

		if (!this._bookmarkPermission) {
			const requestPerm = (e) => {
				e.preventDefault();
				if (!chrome.permissions) return;
				chrome.permissions.request({ permissions: ['bookmarks'] }).then(granted => {
					this._bookmarkPermission = granted;
					if (granted) this.#loadBookmarkFolders();
					this.requestUpdate();
				});
			};
			return html`
				<div class="action-config-row">
					<span class="action-config-label">${window.i18n.getMessage('bookmarkFolder')}</span>
					<select class="action-config-select"
						@mousedown=${requestPerm}
						@keydown=${requestPerm}
					>
						<option>${window.i18n.getMessage('bookmarkGrantPermission')}</option>
					</select>
				</div>
			`;
		}

		const folders = this._bookmarkFolders || [];
		return html`
			<div class="action-config-row">
				<span class="action-config-label">${window.i18n.getMessage('bookmarkFolder')}</span>
				<select class="action-config-select"
					.value=${folderId}
					@change=${(e) => { this._pendingConfig = { ...this._pendingConfig, folderId: e.target.value }; this.requestUpdate(); }}
				>
					${allowDefault ? html`<option value="" ?selected=${!folderId}>${window.i18n.getMessage('bookmarkFolderDefault')}</option>` : ''}
					${folders.map(f => html`<option value=${f.id} ?selected=${f.id === folderId}>${'\u00A0\u00A0'.repeat(f.depth)}${f.title} (${f.linkCount})</option>`)}
				</select>
			</div>
		`;
	}

	#loadBookmarkFolders() {
		chrome.bookmarks.getTree().then(tree => {
			const folders = [];
			const walk = (nodes, depth = 0) => {
				for (const node of nodes) {
					if (node.children) {
						if (node.id === '0') { walk(node.children, 0); continue; }
						const linkCount = node.children.filter(c => c.url).length;
						folders.push({ id: node.id, title: node.title, depth, linkCount });
						walk(node.children, depth + 1);
					}
				}
			};
			walk(tree);
			this._bookmarkFolders = folders;
			this.requestUpdate();
		});
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