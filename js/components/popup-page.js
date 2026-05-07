import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles } from './shared-styles.js';
import { SettingsStore } from '../settings-store.js';
import { icons } from '../icons.js'; 

let fileSchemeAllowed = false;
chrome.extension.isAllowedFileSchemeAccess().then(v => { fileSchemeAllowed = v; });

class PopupPage extends LitElement {
	static properties = {
		_enableTrail: { state: true },
		_enableHUD: { state: true },
		_gestureEnabled: { state: true },
		_currentDomain: { state: true },
		_displayDomain: { state: true },
		_blacklist: { state: true },
		_isRestrictedPage: { state: true },
		_needRefresh: { state: true },
		_ready: { state: true },
		_gesturesCollapsed: { state: true },
	};

	static styles = [
		commonStyles,
		css`
			:host {
				display: block;
			}

			.header {
				display: flex;
				align-items: center;
				gap: 0px;
				padding-bottom: 12px;
				border-bottom: 1px solid var(--border-color);
			}

			.header h1 {
				font-size: 16px;
				font-weight: 600;
				margin-inline-start: 7px;
			}

			.logo-small {
				width: 18px;
				height: 18px;
				border-radius: 4px;
			}

			.header .version {
				font-size: 11px;
				font-weight: 600;
				color: var(--badge-text);
				background: var(--badge-bg);
				margin-top: 1px;
				padding: 1px 6px 2px;
				border-radius: 5px;
				margin-inline-start: 7px;
			}

			.header-settings {
				margin-inline-start: auto;
				display: inline-flex;
				align-items: center;
				background: none;
				border: none;
				padding: 4px 2px;
				cursor: pointer;
				color: var(--text-secondary);
				opacity: 0.8;
				transition: opacity 0.15s;
				border-radius: 4px;
				transform: translateY(1px);
			}

			.header-settings:hover {
				opacity: 1;
			}

			.header-settings svg {
				width: 16px;
				height: 16px;
			}

			.site-bar {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 10px 0;
				border-bottom: 1px solid var(--border-color);
				min-height: 46px;
			}

			.site-info {
				display: flex;
				align-items: center;
				gap: 6px;
				min-width: 0;
				flex: 1;
			}

			.site-icon {
				display: flex;
				align-items: center;
				flex-shrink: 0;
				color: var(--text-secondary);
				transform: translateY(1px);
			}

			.site-icon svg {
				width: 14px;
				height: 14px;
			}

			.site-domain {
				font-size: 13px;
				font-weight: 600;
				color: var(--text-primary);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				padding-right: 4px;
				margin-right: -4px;
			}

			.site-domain.blacklisted {
				opacity: 0.6;
			}

			.site-domain.restricted {
				color: var(--text-secondary);
				font-style: italic;
				font-weight: normal;
			}

			.status-row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 10px 0;
				border-bottom: 1px solid var(--border-color);
			}

			.status-label {
				font-size: 13px;
			}

			.toggle {
				margin-left: 5px;
			}

			.gestures-info {
				padding-top: 12px;
				font-size: 12px;
			}

			.gestures-info-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: 10px;
				cursor: pointer;
				user-select: none;
			}

			.gestures-info-header.collapsed {
				margin-bottom: 0;
			}

			.gestures-info-header h3 {
				font-size: 13px;
				font-weight: normal;
				color: var(--text-secondary);
			}

			.gestures-info-header .chevron {
				display: inline-flex;
				align-items: center;
				color: var(--text-secondary);
				opacity: 0.5;
				transition: transform 0.15s;
				transform: translateY(1px);
			}

			.gestures-info-header .chevron svg {
				width: 14px;
				height: 14px;
			}

			.gestures-info-header.collapsed .chevron {
				transform: translateY(1px) rotate(-90deg);
			}

			.gesture-settings-btn {
				display: inline-flex;
				align-items: center;
				background: none;
				border: none;
				padding: 0;
				cursor: pointer;
				color: var(--text-secondary);
				opacity: 0.6;
				transition: opacity 0.15s;
			}

			.gesture-settings-btn:hover {
				opacity: 1;
			}

			.gesture-settings-btn svg {
				width: 14px;
				height: 14px;
			}

			.gesture-list {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: 5px;
				margin: 0 -2px;
			}

			.gesture-pill {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 5px;
				padding: 10px 3px;
				background: var(--bg-secondary);
				border-radius: 10px;
				font-size: 12px;
				line-height: 1.2;
				min-width: 0;
				overflow: hidden;
			}

			.gesture-pill .pattern {
				font-weight: 600;
				color: var(--text-primary);
				flex-shrink: 0;
			}

			.gesture-pill .action {
				color: var(--text-secondary);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.notice-box {
				display: none;
				background: var(--bg-secondary);
				border-radius: 8px;
				padding: 15px;
				margin: 15px 0 0;
				text-align: center;
			}

			.notice-box.show {
				display: block;
			}

			.notice-box .notice-icon {
				margin-bottom: 8px;
				display: flex;
				justify-content: center;
			}

			.notice-box .notice-icon svg {
				width: 28px;
				height: 28px;
			}

			.notice-box .notice-title {
				font-size: 14px;
				font-weight: 600;
				margin-bottom: 6px;
			}

			.notice-box .notice-desc {
				font-size: 12px;
				color: var(--text-secondary);
				margin-bottom: 12px;
				line-height: 1.5;
			}

			.notice-box .btn {
				width: 100%;
			}

			.notice-box.warning .notice-icon {
				color: #f4b400;
			}

			.notice-box.error .notice-icon {
				color: #ea4335;
			}

			.disabled-row {
				opacity: 0.5;
				pointer-events: none;
			}
		`,
	];

	constructor() {
		super();
		this._enableTrail = true;
		this._enableHUD = true;
		this._gestureEnabled = true;
		this._currentDomain = '';
		this._displayDomain = '';
		this._blacklist = [];
		this._isRestrictedPage = false;
		this._needRefresh = false;
		this._ready = false;
		this._gesturesCollapsed = false;
		this._currentTabId = null;
		this._store = SettingsStore;
	}

	connectedCallback() {
		super.connectedCallback();
		this.#init();
	}

	async #init() {
		await this._store.load();
		await this.#loadAll();
		this._ready = true;

		this._store.onChange((changed) => {
			if ('theme' in changed) {
				window.i18n.applyTheme(changed.theme);
			}
			this.#loadAll();
		});
	}

	async #loadAll() {
		const settings = this._store.current;

		this._gestureEnabled = settings.enableGesture !== false;
		this._enableTrail = settings.enableTrail !== false;
		this._enableHUD = settings.enableHUD !== false;

		if (!this._ready) {
			const stored = localStorage.getItem('popupGesturesCollapsed');
			this._gesturesCollapsed = stored !== null
				? stored === 'true'
				: !!(settings.sectionAdvanced && settings.sectionAdvanced.basic);
		}
		this._blacklist = Array.isArray(settings.blacklist) ? settings.blacklist : [];

		let theme = settings.theme || 'auto';
		if (theme === 'auto') {
			theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		document.body.setAttribute('data-theme', theme);

		await this.#loadCurrentSite();
	}


	render() {
		if (!this._ready) return html``;
		const i18n = window.i18n;

		const isBlacklisted = this._blacklist.includes(this._currentDomain);
		const showGestures = !this._isRestrictedPage && !this._needRefresh;
		const canToggleBlacklist = !this._isRestrictedPage && this._currentDomain && !this._needRefresh;

		return html`
			<div class="header">
				<img src="../icons/icon48.png" class="logo-small" alt="Logo">
				<h1><span>${i18n.getMessage('extNameShort')}</span></h1>
				<span class="version">${this.#getVersion()}</span>
				<button class="header-settings" @click=${this.#openOptions} title="${i18n.getMessage('moreSettings')}">
					${unsafeHTML(icons.settings)}
				</button>
			</div>

			<div class="site-bar">
				<div class="site-info">
					<span class="site-icon">${unsafeHTML(isBlacklisted || this._isRestrictedPage ? icons.mouseOff : icons.mouse)}</span>
					${this._isRestrictedPage
						? html`<span class="site-domain restricted">${i18n.getMessage('popupRestricted')}</span>`
						: html`<span class="site-domain ${isBlacklisted ? 'blacklisted' : ''}">${this._displayDomain || '-'}</span>`
					}
				</div>
				${canToggleBlacklist
					? html`
						<label class="toggle" title="${isBlacklisted ? i18n.getMessage('popupRemoveBlacklist') : i18n.getMessage('popupAddBlacklist')}">
							<input type="checkbox" .checked=${!isBlacklisted} @change=${this.#toggleBlacklist}>
							<span class="slider"></span>
						</label>
					`
					: ''
				}
			</div>

			<div class="status-row">
				<span class="status-label">${i18n.getMessage('popupTrail')}</span>
				<label class="toggle">
					<input type="checkbox" .checked=${this._enableTrail} @change=${this.#onTrailChange}>
					<span class="slider"></span>
				</label>
			</div>

			<div class="status-row">
				<span class="status-label">${i18n.getMessage('popupHint')}</span>
				<label class="toggle">
					<input type="checkbox" .checked=${this._enableHUD} @change=${this.#onHUDChange}>
					<span class="slider"></span>
				</label>
			</div>

			${(showGestures && !isBlacklisted) ? html`
				<div class="status-row">
					<span class="status-label">${i18n.getMessage('areaSelectTitle')}</span>
					<button class="btn btn-secondary btn-sm" @click=${this.#enterAreaSelect} title="${i18n.getMessage('actionAreaSelect')}">
						${unsafeHTML(icons.squareDashedMousePointer)}
						${i18n.getMessage('start')}
					</button>
				</div>
			` : ''}

			<div class="gestures-info" style="display:${showGestures ? 'block' : 'none'};opacity:${this._gestureEnabled ? '1' : '0.5'}">
				<div class="gestures-info-header ${this._gesturesCollapsed ? 'collapsed' : ''}" @click=${this.#toggleGesturesCollapsed}>
					<div style="display:flex;align-items:center;gap:6px">
						<span class="chevron">${unsafeHTML(icons.chevronDown)}</span>
						<h3>${i18n.getMessage('popupCommonGestures')}</h3>
					</div>
					<button class="gesture-settings-btn" @click=${(e) => { e.stopPropagation(); this.#openGestureSettings(); }}>
						${unsafeHTML(icons.squarePen)}
					</button>
				</div>
				<div class="gesture-list" style="display:${this._gesturesCollapsed ? 'none' : 'grid'}">
					${this.#getActiveGestures().map(([pattern, actionName]) => html`
						<span class="gesture-pill" title=${actionName}>
							<span class="pattern">${unsafeHTML(this.#arrowSvg(pattern))}</span>
							<span class="action">${actionName}</span>
						</span>
					`)}
				</div>
			</div>

			<div class="notice-box warning ${this._needRefresh ? 'show' : ''}">
				<div class="notice-icon">${unsafeHTML(icons.triangleAlert)}</div>
				<div class="notice-title">${i18n.getMessage('popupNeedRefresh')}</div>
				<div class="notice-desc">${i18n.getMessage('popupNeedRefreshDesc')}</div>
				<button class="btn btn-primary btn-lg" @click=${this.#refreshPage}>${unsafeHTML(icons.refreshCw)} ${i18n.getMessage('popupRefreshBtn')}</button>
			</div>

			<div class="notice-box error ${this._isRestrictedPage ? 'show' : ''}">
				<div class="notice-icon">${unsafeHTML(icons.ban)}</div>
				<div class="notice-title">${i18n.getMessage('popupRestrictedTitle')}</div>
				<div class="notice-desc">${i18n.getMessage('popupRestrictedDesc')}</div>
				<button class="btn btn-secondary btn-lg" @click=${this.#learnMore}>${unsafeHTML(icons.info)} ${i18n.getMessage('popupLearnMore')}</button>
			</div>


		`;
	}


	#getVersion() {
		return 'v' + window.i18n.version;
	}

	#getActiveGestures() {
		const i18n = window.i18n;
		const { DEFAULT_GESTURES, ACTION_KEYS, ACTION_SHORT_KEYS } = window.GestureConstants;
		const settings = this._store.current;

		let actionMap;
		if (settings.enableGestureCustomization) {
			actionMap = {};
			for (const [pattern, config] of Object.entries(settings.mouseGestures || {})) {
				actionMap[pattern] = config.action;
			}
		} else {
			actionMap = { ...DEFAULT_GESTURES };
		}

		const sorted = Object.entries(actionMap).sort((a, b) => a[0].length - b[0].length);

		const entries = [];
		for (const [pattern, action] of sorted) {
			if (!action || action === 'none') continue;
			let label;
			if (action === 'actionChain') {
				const config = (settings.mouseGestures || {})[pattern];
				const chain = (settings.actionChains || {})[config?.chainId];
				if (chain?.name) label = chain.name;
			}
			if (!label) {
				const i18nKey = ACTION_SHORT_KEYS[action] || ACTION_KEYS[action];
				if (!i18nKey) continue; 
				label = i18n.getMessage(i18nKey);
			}
			entries.push([pattern, label]);
		}

		return entries.slice(0, 6);
	}

	#arrowSvg(text) {
		if (window.GestureConstants && window.GestureConstants.arrowsToSvg) {
			return window.GestureConstants.arrowsToSvg(text);
		}
		return text;
	}

	#isRestrictedUrl(url) {
		if (!url) return true;

		if (url.startsWith(chrome.runtime.getURL(''))) {
			return false;
		}

		if (url.startsWith('file:')) {
			return !fileSchemeAllowed;
		}

		const restrictedProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'about:', 'edge:', 'view-source:', 'devtools:'];
		for (const protocol of restrictedProtocols) {
			if (url.startsWith(protocol)) return true;
		}

		{
			if (url.startsWith('https://addons.mozilla.org')) {
				return true;
			}
		}

		return false;
	}

	async #isContentScriptLoaded(tabId) {
		try {
			const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
			return response && response.pong === true;
		} catch (e) {
			return false;
		}
	}

	async #loadCurrentSite() {
		const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
		if (!tabs[0] || !tabs[0].url) return;

		this._currentTabId = tabs[0].id;
		const url = tabs[0].url;

		if (this.#isRestrictedUrl(url)) {
			this._isRestrictedPage = true;
			return;
		}

		let hostname = '';
		try {
			const urlObj = new URL(url);
			hostname = urlObj.hostname;
			if (url.startsWith(chrome.runtime.getURL(''))) {
				this._displayDomain = window.i18n.getMessage('extNameShort');
			} else {
				this._displayDomain = hostname;
			}
		} catch (e) {
			this._displayDomain = '-';
			return;
		}
		this._currentDomain = hostname;

		if (this._blacklist.includes(this._currentDomain)) {
			return;
		}

		const loaded = await this.#isContentScriptLoaded(this._currentTabId);
		if (!loaded) {
			this._needRefresh = true;
		}
	}


	#onTrailChange(e) {
		this._enableTrail = e.target.checked;
		this.#saveQuickSettings();
	}

	#onHUDChange(e) {
		this._enableHUD = e.target.checked;
		this.#saveQuickSettings();
	}

	async #saveQuickSettings() {
		await this._store.save({
			enableTrail: this._enableTrail,
			enableHUD: this._enableHUD
		});
	}

	async #toggleBlacklist() {
		if (!this._currentDomain || this._isRestrictedPage) return;

		const isBlacklisted = this._blacklist.includes(this._currentDomain);
		if (isBlacklisted) {
			this._blacklist = this._blacklist.filter(d => d !== this._currentDomain);
		} else {
			this._blacklist = [...this._blacklist, this._currentDomain];
		}

		const ok = await this._store.save({ blacklist: this._blacklist });
		if (!ok) {
			if (isBlacklisted) {
				this._blacklist = [...this._blacklist, this._currentDomain];
			} else {
				this._blacklist = this._blacklist.filter(d => d !== this._currentDomain);
			}
		}
	}

	#refreshPage() {
		if (this._currentTabId) {
			chrome.tabs.reload(this._currentTabId);
			window.close();
		}
	}

	async #learnMore() {
		const optionsUrl = chrome.runtime.getURL('pages/options.html');
		const targetUrl = optionsUrl + '#restricted-notice';

		const tabs = await chrome.tabs.query({});
		const existingTab = tabs.find(t => t.url && t.url.startsWith(optionsUrl));

		if (existingTab) {
			await chrome.tabs.update(existingTab.id, { url: targetUrl, active: true });
			await chrome.windows.update(existingTab.windowId, { focused: true });
		} else {
			chrome.tabs.create({ url: targetUrl });
		}
		window.close();
	}

	#openOptions() {
		chrome.runtime.openOptionsPage();
		window.close();
	}

	async #openGestureSettings() {
		if (!this._store.current.enableGestureCustomization) {
			await this._store.save({ enableGestureCustomization: true });
		}
		chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html') + '#gestureGrid' });
		window.close();
	}

	#toggleGesturesCollapsed() {
		this._gesturesCollapsed = !this._gesturesCollapsed;
		localStorage.setItem('popupGesturesCollapsed', this._gesturesCollapsed);
	}

	async #enterAreaSelect() {
		if (!this._currentTabId) return;
		const settings = this._store.current;
		await chrome.tabs.sendMessage(this._currentTabId, {
			action: 'areaSelectEnter',
			warnThreshold: settings.areaSelectWarnThreshold,
			textUrl: settings.areaSelectTextUrl,
			operationInterval: settings.areaSelectDelay,
		});
		window.close();
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('popup-page', PopupPage);
});