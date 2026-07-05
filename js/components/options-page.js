import { LitElement, html, css, unsafeHTML, unsafeCSS, live } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { SettingsStore } from '../settings-store.js';
import { icons, icon, iconUrl } from '../icons.js';
import { tooltip } from '../tooltip.js';

class OptionsPage extends LitElement {
	static properties = {
		_settings: { state: true },
		_statusMessage: { state: true },
		_statusType: { state: true },
		_statusVisible: { state: true },
		_ready: { state: true },
		_activeSection: { state: true },
		_navProximityShow: { state: true },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
				padding: 20px;
				font-size: 14px;
			}

			.section-nav {
				position: fixed;
				top: 50%;
				inset-inline-start: 16px;
				transform: translateY(-50%);
				display: flex;
				flex-direction: column;
				gap: 2px;
				z-index: 100;
			}

			.section-nav-item {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 6px 8px;
				border: none;
				background: transparent;
				cursor: pointer;
				border-radius: 8px;
				transition: background-color 0.2s ease;
				width: fit-content;
			}

			.section-nav-item:hover {
				background: var(--bg-tertiary);
				backdrop-filter: blur(10px);
			}

			.section-nav-icon {
				display: inline-flex;
				align-items: center;
				flex-shrink: 0;
				color: var(--text-muted);
				transition: color 0.25s ease;
			}

			.section-nav-icon svg {
				width: 18px;
				height: 18px;
			}

			.section-nav-item.active .section-nav-icon {
				color: var(--accent-color);
			}

			.section-nav-item:hover .section-nav-icon {
				color: var(--text-primary);
			}

			.section-nav-item.active:hover .section-nav-icon {
				color: var(--accent-color);
			}

			.section-nav-label {
				font-size: 12px;
				color: var(--text-muted);
				white-space: nowrap;
				max-width: 0;
				overflow: hidden;
				opacity: 0;
				transition: max-width 0.3s ease, opacity 0.2s ease, color 0.2s ease;
				font-family: inherit;
			}

			.section-nav:not(.collapsed) .section-nav-items:hover .section-nav-label {
				max-width: 200px;
				opacity: 1;
			}

			.section-nav.collapsed .section-nav-item:hover .section-nav-label {
				max-width: 200px;
				opacity: 1;
			}

			.section-nav-item.active .section-nav-label {
				color: var(--accent-color);
				font-weight: 600;
			}

			.section-nav-item:hover .section-nav-label {
				color: var(--text-primary);
			}

			.section-nav-item.active:hover .section-nav-label {
				color: var(--accent-color);
			}

			.section-nav-items {
				display: flex;
				flex-direction: column;
				gap: 2px;
				transition: transform 0.3s ease, opacity 0.25s ease;
			}

			.section-nav-toggle {
				align-self: flex-start;
			}

			.section-nav-toggle svg {
				transform: translateX(-1px);
			}

			:host-context([dir="rtl"]) .section-nav-toggle svg {
				transform: translateY(-1px) scaleX(-1);
			}

			.section-nav.collapsed .section-nav-items {
				transform: translateX(calc(-100% - 16px));
				opacity: 0;
				pointer-events: none;
			}

			:host-context([dir="rtl"]) .section-nav.collapsed .section-nav-items {
				transform: translateX(calc(100% + 16px));
			}

			.section-nav.collapsed.proximity-show .section-nav-items,
			:host-context([dir="rtl"]) .section-nav.collapsed.proximity-show .section-nav-items {
				transform: translateX(0);
				opacity: 1;
				pointer-events: auto;
			}

			.setting-warning, .setting-notice {
				border-radius: 8px;
				padding: 12px 16px;
				margin: 0 0 16px 0;
				font-size: 13px;
				color: var(--text-secondary);
				line-height: 1.4;
				display: flex;
				align-items: flex-start;
				gap: 12px;
			}

			.setting-warning {
				background: rgba(255, 193, 7, 0.1);
				border: 1px solid rgba(255, 193, 7, 0.3);
			}

			.setting-notice {
				background: rgba(53, 138, 255, 0.1);
				border: 1px solid rgba(53, 138, 255, 0.3);
			}

			.setting-warning::before, .setting-notice::before {
				content: '';
				flex-shrink: 0;
				width: 16px;
				height: 16px;
				margin-top: 2px;
				mask-size: contain;
				mask-repeat: no-repeat;
				mask-position: center;
				-webkit-mask-size: contain;
				-webkit-mask-repeat: no-repeat;
				-webkit-mask-position: center;
			}

			.setting-warning::before {
				background-color: var(--warning-color);
				mask-image: ${unsafeCSS(iconUrl('triangleAlert'))};
				-webkit-mask-image: ${unsafeCSS(iconUrl('triangleAlert'))};
			}

			.setting-notice::before {
				background-color: var(--notice-color);
				mask-image: ${unsafeCSS(iconUrl('info'))};
				-webkit-mask-image: ${unsafeCSS(iconUrl('info'))};
			}

			.setting-warning a, .setting-notice a {
				color: var(--accent-color);
				text-decoration: none;
				cursor: pointer;
			}

			.setting-warning a:hover, .setting-notice a:hover {
				text-decoration: underline;
			}

			@media (max-width: 1200px) {
				.section-nav {
					display: none;
				}
			}
		`,
	];

	constructor() {
		super();
		this._settings = structuredClone(window.GestureConstants.DEFAULT_SETTINGS)
		this._statusMessage = '';
		this._statusType = 'success';
		this._statusVisible = false;
		this._ready = false;
		this._activeSection = null;
		this._mouseX = 0;
		this._mouseY = 0;
		this._navProximityShow = false;
		this._navClickLock = false;
		this._sectionHoverTimer = null;
		this._debounceTimer = null;
		this._pendingPatch = null;
		this._statusTimer = null;
		this._store = SettingsStore;
	}

	connectedCallback() {
		super.connectedCallback();
		this._boundBeforeUnload = () => this.#flushPendingPatch();
		this._boundMouseMove = (e) => this.#onDocumentMouseMove(e);
		this._boundScroll = () => this.#updateHoveredSection();
		this._boundNavigateSection = (e) => this.#onNavigateSection(e);
		window.addEventListener('beforeunload', this._boundBeforeUnload);
		window.addEventListener('mousemove', this._boundMouseMove, { passive: true });
		window.addEventListener('scroll', this._boundScroll, { passive: true });
		this.addEventListener('navigate-section', this._boundNavigateSection);
		this.#init();
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		window.removeEventListener('beforeunload', this._boundBeforeUnload);
		window.removeEventListener('mousemove', this._boundMouseMove);
		window.removeEventListener('scroll', this._boundScroll);
		this.removeEventListener('navigate-section', this._boundNavigateSection);
	}

	#flushPendingPatch() {
		if (this._debounceTimer) {
			clearTimeout(this._debounceTimer);
			this._debounceTimer = null;
		}
		if (!this._pendingPatch) return;
		const patch = this._pendingPatch;
		this._pendingPatch = null;
		this._store.save(patch).then((ok) => {
			if (!ok) {
				this.#showStatus(window.i18n.getMessage('saveFailure'), 'error');
				return;
			}
			this._settings = { ...this._store.current, ...(this._pendingPatch || {}) };
		});
	}

	async #init() {
		await this._store.load();
		this._settings = { ...this._store.current };
		this._ready = true;

		this._store.onChange((changed) => {
			if ('language' in changed) {
				location.reload();
				return;
			}
			if ('theme' in changed) {
				window.i18n.applyTheme(changed.theme);
			}
			this._settings = { ...this._store.current, ...(this._pendingPatch || {}) };
		});

		this.updateComplete.then(() => {
			this.#handleHashNavigation();
			window.addEventListener('hashchange', () => this.#handleHashNavigation());
		});
	}


	render() {
		if (!this._ready) return html``;
		const i18n = window.i18n;

		const triggerBtns = this._settings.gestureTriggerButtons || {};
		const gestureUsesRightClick = this._settings.enableGesture && (triggerBtns.right !== false || triggerBtns.penRight === true);
		const showMacLinuxNotice = !window.i18n.isFirefox && ['mac', 'linux', 'cros', 'android'].includes(window.i18n.platform) && (gestureUsesRightClick || this._settings.enableWheelGestures || this._settings.enableSpecialGestures);
		const showEdgeGestureNotice = window.i18n.isEdgeDesktop && this._settings.edgeGestureConflict && this._settings.enableGesture;
		const showMacTextDragNotice = window.i18n.platform === 'mac';

		const gestureEnabled = this._settings.enableGesture;
		const dragEnabled = this._settings.enableTextDrag || this._settings.enableImageDrag || this._settings.enableLinkDrag;
		const defaults = window.GestureConstants.DEFAULT_SETTINGS;

		const distanceThresholdOutOfRange = this._settings.distanceThreshold < 10 || this._settings.distanceThreshold > 35;

		return html`
			<div class="container">
				<header>
					<div class="header-left">
						<img src="../icons/icon128.png" class="logo-img" alt="Logo">
						<h1>
							<span>${i18n.getMessage('extNameShort')}</span>
							<span class="version">${this.#getVersion()}</span>
						</h1>
					</div>
					<div class="header-controls">
						<button class="theme-toggle" @click=${this.#rotateTheme} .tooltip=${tooltip(this.#getThemeLabel(i18n))}>
							<span class="theme-toggle-icon">${unsafeHTML(this.#getThemeIcon())}</span>
						</button>
						<language-select id="language" .value=${this._settings.language || 'auto'} @change=${this.#onLanguageChange}></language-select>
					</div>
				</header>

				<div class="section ${this._activeSection === 'style' ? 'active' : ''} ${(this._settings.sectionAdvanced?.style) ? 'advanced-expanded' : ''}" data-nav="style">
					<h2><span class="section-icon">${unsafeHTML(icon('palette', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('styleSettings')}</span>${this.#renderAdvancedToggle('style')}</h2>
					<div class="section-body">
						<div class="setting-row first-row">
							<div class="setting-label">
								<span class="setting-title">${i18n.getMessage('showTrail')}${this.#renderInlineReset(['enableTrail', 'trailColor', 'trailWidth', 'showTrailOrigin', 'enableTrailSmooth'], { confirm: true })}</span>
								<span>${i18n.getMessage('showTrailDesc')}</span>
							</div>
							<label class="toggle">
								<input type="checkbox" id="enableTrail" .checked=${this._settings.enableTrail} @change=${e => this.#updateSetting('enableTrail', e.target.checked)}>
								<span class="slider"></span>
							</label>
						</div>
						<div class="sub-settings ${this._settings.enableTrail ? 'show' : ''}" style="padding-block: 12px;">
							<div class="inline-settings">
								<div class="inline-setting-item">
									<span>${i18n.getMessage('color')}</span>
									<color-picker id="trailColor" .value=${this._settings.trailColor} alpha .defaultValue=${defaults.trailColor} @change=${e => this.#updateSetting('trailColor', e.detail.value)} @input=${e => this.#debounceSetting('trailColor', e.detail.value)}></color-picker>
								</div>
								<div class="inline-setting-item">
									<span>${i18n.getMessage('width')}</span>
									<input type="number" id="trailWidth" .value=${String(this._settings.trailWidth)} min="1" max="20" @change=${e => this.#updateSetting('trailWidth', e.target.value)} @input=${e => this.#debounceSetting('trailWidth', e.target.value)}>
								</div>
								<div class="inline-setting-item advanced-setting">
									<label>
										<input type="checkbox" id="showTrailOrigin" .checked=${this._settings.showTrailOrigin} @change=${e => this.#updateSetting('showTrailOrigin', e.target.checked)}>
										<span>${i18n.getMessage('showTrailOrigin')}</span>
									</label>
								</div>
								<div class="inline-setting-item advanced-setting">
									<label>
										<input type="checkbox" id="enableTrailSmooth" .checked=${this._settings.enableTrailSmooth} @change=${e => this.#updateSetting('enableTrailSmooth', e.target.checked)}>
										<span>${i18n.getMessage('enableTrailSmooth')}</span>
									</label>
								</div>
							</div>
						</div>

						<div class="setting-row">
							<div class="setting-label">
								<span class="setting-title">${i18n.getMessage('showHint')}${this.#renderInlineReset(['enableHUD', 'hudBgColor', 'hudTextColor', 'hudBlurRadius', 'enableHudShadow', 'enableSuggestedGestures'], { confirm: true })}</span>
								<span>${i18n.getMessage('showHintDesc')}</span>
							</div>
							<label class="toggle">
								<input type="checkbox" id="enableHUD" .checked=${this._settings.enableHUD} @change=${e => this.#updateSetting('enableHUD', e.target.checked)}>
								<span class="slider"></span>
							</label>
						</div>
						<div class="sub-settings ${this._settings.enableHUD ? 'show' : ''}" style="padding-block: 12px;">
							<div class="inline-settings">
								<div class="inline-setting-item">
									<span>${i18n.getMessage('background')}</span>
									<color-picker
										id="hudBgColor"
										.value=${this._settings.hudBgColor}
										alpha
										.blurRadius=${this._settings.hudBlurRadius}
										.defaultValue=${defaults.hudBgColor}
										.defaultBlurRadius=${defaults.hudBlurRadius}
										@change=${e => {
											this.#updateSetting('hudBgColor', e.detail.value);
											this.#updateSetting('hudBlurRadius', e.detail.blurRadius);
										}}
										@input=${e => {
											this.#debounceSetting('hudBgColor', e.detail.value);
											this.#debounceSetting('hudBlurRadius', e.detail.blurRadius);
										}}
									></color-picker>
								</div>
								<div class="inline-setting-item">
									<span>${i18n.getMessage('text')}</span>
									<color-picker
										id="hudTextColor"
										.value=${this._settings.hudTextColor}
										alpha
										.defaultValue=${defaults.hudTextColor}
										@change=${e => this.#updateSetting('hudTextColor', e.detail.value)}
										@input=${e => this.#debounceSetting('hudTextColor', e.detail.value)}
									></color-picker>
								</div>
								<div class="inline-setting-item">
									<label>
										<input type="checkbox" id="enableHudShadow" .checked=${this._settings.enableHudShadow} @change=${e => this.#updateSetting('enableHudShadow', e.target.checked)}>
										<span>${i18n.getMessage('hudShadow')}</span>
									</label>
								</div>
								<div class="inline-setting-item">
									<label>
										<input type="checkbox" id="enableSuggestedGestures" .checked=${this._settings.enableSuggestedGestures !== false} @change=${e => this.#updateSetting('enableSuggestedGestures', e.target.checked)}>
										<span>${i18n.getMessage('showSuggestedGestures')}</span>
									</label>
								</div>
							</div>
						</div>

						<div class="setting-row ${this._settings.customCss ? '' : 'advanced-setting'}">
							<div class="setting-label">
								<span class="setting-title">${i18n.getMessage('customCss')}${this.#renderInlineReset('customCss', { confirm: true })}</span>
								<span>${i18n.getMessage('customCssDesc')}</span>
							</div>
							<a class="btn btn-ghost" id="customCssConfigBtn"
								href="css-editor.html" target="_blank" rel="noopener">
								${unsafeHTML(icon('codeXml', { size: 15, strokeWidth: 2.2 }))}
								<span>${this._settings.customCss ? i18n.getMessage('customCssEdit') : i18n.getMessage('customCssConfigure')}</span>
							</a>
						</div>
					</div>
				</div>

				<div class="section ${this._activeSection === 'basic' ? 'active' : ''} ${(this._settings.sectionAdvanced?.basic) ? 'advanced-expanded' : ''}" data-nav="basic">
					<h2><span class="section-icon">${unsafeHTML(icon('mouseRight', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('basicSettings')}</span>${this.#renderAdvancedToggle('basic')}</h2>
					<div class="section-body">
						<div class="setting-row first-row">
							<div class="setting-label">
								<span>${i18n.getMessage('enableGesture')}</span>
								<span>${i18n.getMessage('enableGestureDesc')}</span>
							</div>
							<label class="toggle">
								<input type="checkbox" id="enableGesture" .checked=${this._settings.enableGesture} @change=${e => this.#updateSetting('enableGesture', e.target.checked)}>
								<span class="slider"></span>
							</label>
						</div>
						${showMacLinuxNotice ? html`
							<div class="setting-warning" id="mac-linux-notice"><span>${i18n.getMessage('macLinuxContextMenuNotice')}</span></div>
						` : ''}
						${showEdgeGestureNotice ? html`
							<div class="setting-warning" @click=${this.#handleEdgeGestureLink}><span>${unsafeHTML(i18n.getMessage('edgeGestureConflictNotice'))}</span></div>
						` : ''}

						<div class="setting-group" style="display:${gestureEnabled ? 'block' : 'none'}">
							<div class="setting-row advanced-setting">
								<div class="setting-label">
									<span class="setting-title">${i18n.getMessage('gestureTriggerButtons')}${this.#renderInlineReset('gestureTriggerButtons')}</span>
									<span>${i18n.getMessage('gestureTriggerButtonsDesc')}</span>
								</div>
							</div>
							<div class="sub-settings show advanced-setting" style="padding-block: 15px;">
								<div class="inline-settings">
									<div class="inline-setting-item">
										<label>
											<input type="checkbox" .checked=${live(this._settings.gestureTriggerButtons?.right !== false)} @change=${e => this.#updateTriggerButton('right', e.target.checked)}>
											<span>${i18n.getMessage('btnRightMouse')}</span>
										</label>
									</div>
									<div class="inline-setting-item">
										<label>
											<input type="checkbox" .checked=${live(this._settings.gestureTriggerButtons?.middle === true)} @change=${e => this.#updateTriggerButton('middle', e.target.checked)}>
											<span>${i18n.getMessage('btnMiddleMouse')}</span>
										</label>
									</div>
									${html`
									<div class="inline-setting-item">
										<label>
											<input type="checkbox" .checked=${live(this._settings.gestureTriggerButtons?.side1 === true)} @change=${e => this.#updateTriggerButton('side1', e.target.checked)}>
											<span>${i18n.getMessage('btnSide1Mouse')}</span>
										</label>
									</div>
									<div class="inline-setting-item">
										<label>
											<input type="checkbox" .checked=${live(this._settings.gestureTriggerButtons?.side2 === true)} @change=${e => this.#updateTriggerButton('side2', e.target.checked)}>
											<span>${i18n.getMessage('btnSide2Mouse')}</span>
										</label>
									</div>
									`}
									<div class="inline-setting-item">
										<label>
											<input type="checkbox" .checked=${live(this._settings.gestureTriggerButtons?.penRight === true)} @change=${e => this.#updateTriggerButton('penRight', e.target.checked)}>
											<span>${i18n.getMessage('btnPenRight')}</span>
										</label>
									</div>
								</div>
							</div>
							${(this._settings.gestureTriggerButtons?.side1 || this._settings.gestureTriggerButtons?.side2) ? html`
								<div class="setting-notice"><span>${i18n.getMessage('triggerButtonDriverWarning')}</span></div>
							` : ''}
						</div>

						<div class="setting-group" style="display:${(gestureEnabled || dragEnabled) ? 'block' : 'none'}">
							<div class="setting-row advanced-setting">
								<div class="setting-label">
									<span class="setting-title">${i18n.getMessage('distanceThreshold')}${this.#renderInlineReset('distanceThreshold')}</span>
									<span>${i18n.getMessage('distanceThresholdDesc')}</span>
								</div>
								<div class="slider-control">
									<input type="range" id="distanceThreshold" min="5" max="100" step="1" .value=${String(this._settings.distanceThreshold)} @change=${e => this.#updateSetting('distanceThreshold', e.target.value)} @input=${e => this.#debounceSetting('distanceThreshold', e.target.value)}>
									<span>${this._settings.distanceThreshold}</span>
								</div>
							</div>
							${distanceThresholdOutOfRange ? html`
								<div class="setting-notice advanced-setting">${i18n.getMessage('distanceThresholdNotice')}</div>
							` : ''}

							<div class="setting-row advanced-setting">
								<div class="setting-label">
									<span class="setting-title">${i18n.getMessage('gestureTurnTolerance')}${this.#renderInlineReset('gestureTurnTolerance')}</span>
									<span>${i18n.getMessage('gestureTurnToleranceDesc')}</span>
								</div>
								<div class="slider-control">
									<input type="range" id="gestureTurnTolerance" min="0" max="50" step="1" .value=${String(Math.round((this._settings.gestureTurnTolerance) * 100))} @change=${e => this.#updateSetting('gestureTurnTolerance', e.target.value / 100)} @input=${e => this.#debounceSetting('gestureTurnTolerance', e.target.value / 100)}>
									<span>${Math.round((this._settings.gestureTurnTolerance) * 100)}%</span>
								</div>
							</div>
						</div>

						<div class="setting-group" style="display:${gestureEnabled ? 'block' : 'none'}">
							<div id="gesture-customization-row">
								<div class="setting-row">
									<div class="setting-label">
										<span>${i18n.getMessage('enableCustomGestures')}</span>
										<span>${i18n.getMessage('enableCustomGesturesDesc')}</span>
									</div>
									<label class="toggle">
										<input type="checkbox" id="enableGestureCustomization" .checked=${this._settings.enableGestureCustomization} @change=${e => this.#updateSetting('enableGestureCustomization', e.target.checked)}>
										<span class="slider"></span>
									</label>
								</div>
								<div style="display:${this._settings.enableGestureCustomization ? 'block' : 'none'}">
									<gesture-grid id="gestureGrid"
										.mouseGestures=${{ ...(this._settings.mouseGestures || {}) }}
										?advanced-mode=${this._settings.sectionAdvanced?.basic}
										@gestures-change=${this.#onGesturesChange}
										@gesture-delete=${this.#onGestureDelete}
										@permission-check=${this.#onPermissionCheck}
									></gesture-grid>

									<div style="margin-bottom: 18px;">
										<button class="btn btn-dashed btn-lg add-gesture-btn" id="openGestureDrawer" @click=${this.#openGestureModal}>
										${unsafeHTML(icons.plus)} <span>${i18n.getMessage('addCustomGesture')}</span>
									</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="section ${this._activeSection === 'drag' ? 'active' : ''} ${(this._settings.sectionAdvanced?.drag) ? 'advanced-expanded' : ''}" data-nav="drag">
					<h2><span class="section-icon">${unsafeHTML(icon('mouseLeft', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('dragFeatures')}</span>${this.#renderAdvancedToggle('drag')}</h2>
					<div class="section-body">
						<div class="setting-group">
							<div class="setting-row first-row">
								<div class="setting-label">
									<span>${i18n.getMessage('textDragSearch')}</span>
									<span>${i18n.getMessage('textDragSearchDesc')}</span>
								</div>
								<label class="toggle">
									<input type="checkbox" id="enableTextDrag" .checked=${this._settings.enableTextDrag} @change=${e => this.#updateSetting('enableTextDrag', e.target.checked)}>
									<span class="slider"></span>
								</label>
							</div>
							${showMacTextDragNotice ? html`
								<div class="setting-warning"><span>${i18n.getMessage('macTextDragNotice')}</span></div>
							` : ''}
							${this._settings.enableTextDrag && this._settings.sectionAdvanced?.drag ? html`
							<div class="sub-settings show" style="padding-block: 15px; margin-bottom: 10px;">
								<div class="inline-settings">
									<div class="inline-setting-item">
										<label>
											<input type="checkbox" id="textDragIgnoreInput" .checked=${this._settings.textDragIgnoreInput} @change=${e => this.#updateSetting('textDragIgnoreInput', e.target.checked)}>
											<span>${i18n.getMessage('textDragIgnoreInput')}</span>
											<span class="help-icon" .tooltip=${tooltip(i18n.getMessage('textDragIgnoreInputDesc'))}>${unsafeHTML(icon('circleHelp', { size: 14 }))}</span>
										</label>
									</div>
									<div class="inline-setting-item">
										<label>
											<input type="checkbox" id="textDropIgnoreInput" .checked=${this._settings.textDropIgnoreInput} @change=${e => this.#updateSetting('textDropIgnoreInput', e.target.checked)}>
											<span>${i18n.getMessage('dragDropOnInput')}</span>
											<span class="help-icon" .tooltip=${tooltip(i18n.getMessage('dragDropOnInputDesc'))}>${unsafeHTML(icon('circleHelp', { size: 14 }))}</span>
										</label>
									</div>
								</div>
							</div>
							` : ''}
							<div class="sub-settings ${this._settings.enableTextDrag ? 'show' : ''}">
								<div class="drag-settings-section">
									<drag-gesture-manager type="text" id="textDragManager"
										.dragGestures=${this._settings.textDragGestures || []}
										?advanced-mode=${(this._settings.sectionAdvanced?.drag)}
										@drag-gestures-change=${e => this.#onDragGesturesChange('textDragGestures', e)}
										@permission-check=${this.#onPermissionCheck}
									></drag-gesture-manager>
								</div>
							</div>
						</div>

						<div class="setting-group">
							<div class="setting-row">
								<div class="setting-label">
									<span>${i18n.getMessage('imageDrag')}</span>
									<span>${i18n.getMessage('imageDragDesc')}</span>
								</div>
								<label class="toggle">
									<input type="checkbox" id="enableImageDrag" .checked=${this._settings.enableImageDrag} @change=${e => this.#updateSetting('enableImageDrag', e.target.checked)}>
									<span class="slider"></span>
								</label>
							</div>
							<div class="sub-settings ${this._settings.enableImageDrag ? 'show' : ''}">
								<div class="drag-settings-section">
									<drag-gesture-manager type="image" id="imageDragManager"
										.dragGestures=${this._settings.imageDragGestures || []}
										?advanced-mode=${(this._settings.sectionAdvanced?.drag)}
										@drag-gestures-change=${e => this.#onDragGesturesChange('imageDragGestures', e)}
										@permission-check=${this.#onPermissionCheck}
									></drag-gesture-manager>
								</div>
							</div>
						</div>

						<div class="setting-group">
							<div class="setting-row">
								<div class="setting-label">
									<span>${i18n.getMessage('linkDrag')}</span>
									<span>${i18n.getMessage('linkDragDesc')}</span>
								</div>
								<label class="toggle">
									<input type="checkbox" id="enableLinkDrag" .checked=${this._settings.enableLinkDrag} @change=${e => this.#updateSetting('enableLinkDrag', e.target.checked)}>
									<span class="slider"></span>
								</label>
							</div>
							${this._settings.enableLinkDrag && this._settings.sectionAdvanced?.drag ? html`
							<div class="sub-settings show" style="padding-block: 15px; margin-bottom: 10px;">
								<div class="inline-settings">
									<div class="inline-setting-item">
										<label>
											<input type="checkbox" id="linkDropIgnoreInput" .checked=${this._settings.linkDropIgnoreInput} @change=${e => this.#updateSetting('linkDropIgnoreInput', e.target.checked)}>
											<span>${i18n.getMessage('dragDropOnInput')}</span>
											<span class="help-icon" .tooltip=${tooltip(i18n.getMessage('dragDropOnInputDesc'))}>${unsafeHTML(icon('circleHelp', { size: 14 }))}</span>
										</label>
									</div>
								</div>
							</div>
							` : ''}
							<div class="sub-settings ${this._settings.enableLinkDrag ? 'show' : ''}">
								<div class="drag-settings-section">
									<drag-gesture-manager type="link" id="linkDragManager"
										.dragGestures=${this._settings.linkDragGestures || []}
										?advanced-mode=${(this._settings.sectionAdvanced?.drag)}
										@drag-gestures-change=${e => this.#onDragGesturesChange('linkDragGestures', e)}
										@permission-check=${this.#onPermissionCheck}
									></drag-gesture-manager>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="section ${this._activeSection === 'areaSelect' ? 'active' : ''}" data-nav="areaSelect">
					<h2><span class="section-icon">${unsafeHTML(icon('squareDashedMousePointer', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('areaSelectTitle')}</span></h2>
					<div class="section-body">
						<div class="setting-row first-row">
							<div class="setting-label">
								<span class="setting-title">${i18n.getMessage('areaSelectModifierKey')}${this.#renderInlineReset('areaSelectModifierKey')}</span>
								<span>${i18n.getMessage('areaSelectModifierKeyDesc')}</span>
							</div>
							<div style="display:flex;align-items:center;gap:8px;">
								<select class="input-lg"
									@change=${e => this.#updateSetting('areaSelectModifierKey', e.target.value)}>
									${(() => {
										const current = this._settings.areaSelectModifierKey;
										const isMac = i18n.platform === 'mac';
										const isWin = i18n.platform === 'win';
										const keys = ['disabled', 'Shift', 'Ctrl', 'Alt', 'Meta'].filter(k => {
											if (k === current) return true;
											if (isMac && k === 'Ctrl') return false;
											if (isWin && k === 'Meta') return false;
											return true;
										});
										return keys.map(k => html`<option value=${k} ?selected=${k === current}>${k === 'disabled' ? i18n.getMessage('areaSelectDisabled') : i18n.getModifierKeyName(k)}</option>`);
									})()}
								</select>
								${this._settings.areaSelectModifierKey !== 'disabled' ? html`<span> + </span><span>${i18n.getMessage('areaSelectMouseDrag')}</span>` : ''}
							</div>
						</div>
						<div class="setting-row">
							<div class="setting-label">
								<span class="setting-title">${i18n.getMessage('areaSelectTextUrl')}${this.#renderInlineReset('areaSelectTextUrl')}</span>
								<span>${i18n.getMessage('areaSelectTextUrlDesc')}</span>
							</div>
							<label class="toggle">
								<input type="checkbox" id="areaSelectTextUrl"
									.checked=${this._settings.areaSelectTextUrl}
									@change=${e => this.#updateSetting('areaSelectTextUrl', e.target.checked)}>
								<span class="slider"></span>
							</label>
						</div>
						<div class="setting-row">
							<div class="setting-label">
								<span class="setting-title">${i18n.getMessage('areaSelectWarnThreshold')}${this.#renderInlineReset('areaSelectWarnThreshold')}</span>
								<span>${i18n.getMessage('areaSelectWarnThresholdDesc')}</span>
							</div>
							<input type="number" class="input-lg" id="areaSelectWarnThreshold" min="0" max="999" step="1" style="width:70px;"
								.value=${String(this._settings.areaSelectWarnThreshold)}
								@change=${e => { const v = Math.max(0, Math.min(999, parseInt(e.target.value) || 0)); e.target.value = v; this.#updateSetting('areaSelectWarnThreshold', v); }}>
						</div>
						<div class="setting-row">
							<div class="setting-label">
								<span class="setting-title">${i18n.getMessage('areaSelectDelay')}${this.#renderInlineReset('areaSelectDelay')}</span>
								<span>${i18n.getMessage('areaSelectDelayDesc')}</span>
							</div>
							<input type="number" class="input-lg" id="areaSelectDelay" min="0" max="60" step="0.1" style="width:70px;"
								.value=${String(this._settings.areaSelectDelay)}
								@change=${e => { const v = Math.max(0, Math.min(60, Math.round(parseFloat(e.target.value) * 100) / 100 || 0)); e.target.value = v; this.#updateSetting('areaSelectDelay', v); }}>
						</div>
					</div>
				</div>

				<div class="section ${this._activeSection === 'wheel' ? 'active' : ''}" data-nav="wheel">
					<h2><span class="section-icon">${unsafeHTML(icon('mouse', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('wheelGestures')}</span></h2>
					<div class="section-body">
						<div class="setting-row first-row">
							<div class="setting-label">
								<span>${i18n.getMessage('enableWheelGestures')}</span>
								<span>${i18n.getMessage('enableWheelGesturesDesc')}</span>
							</div>
							<label class="toggle">
								<input type="checkbox" id="enableWheelGestures" .checked=${this._settings.enableWheelGestures} @change=${e => this.#updateSetting('enableWheelGestures', e.target.checked)}>
								<span class="slider"></span>
							</label>
						</div>
						<div class="sub-settings ${this._settings.enableWheelGestures ? 'show' : ''}">
							<wheel-gesture-manager
								.wheelGestures=${{ ...(this._settings.wheelGestures || {}) }}
								?enableWheelGestures=${this._settings.enableWheelGestures}
								@wheel-gestures-change=${this.#onWheelGesturesChange}
								@permission-check=${this.#onPermissionCheck}
							></wheel-gesture-manager>
						</div>
					</div>
				</div>

				<div class="section ${this._activeSection === 'special' ? 'active' : ''}" data-nav="special">
					<h2><span class="section-icon">${unsafeHTML(icon('mousePointerClick', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('specialGestures')}</span></h2>
					<div class="section-body">
						<div class="setting-row first-row">
							<div class="setting-label">
								<span>${i18n.getMessage('enableSpecialGestures')}</span>
								<span>${i18n.getMessage('enableSpecialGesturesDesc')}</span>
							</div>
							<label class="toggle">
								<input type="checkbox" id="enableSpecialGestures" .checked=${this._settings.enableSpecialGestures} @change=${e => this.#updateSetting('enableSpecialGestures', e.target.checked)}>
								<span class="slider"></span>
							</label>
						</div>
						<div class="sub-settings ${this._settings.enableSpecialGestures ? 'show' : ''}">
							<special-gesture-manager
								.specialGestures=${{ ...(this._settings.specialGestures || {}) }}
								?enableSpecialGestures=${this._settings.enableSpecialGestures}
								@special-gestures-change=${this.#onSpecialGesturesChange}
								@permission-check=${this.#onPermissionCheck}
							></special-gesture-manager>
						</div>
					</div>
				</div>

				<div class="section ${this._activeSection === 'searchEngines' ? 'active' : ''}" data-nav="searchEngines">
					<h2><span class="section-icon">${unsafeHTML(icon('search', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('sectionSearchEngines')}</span></h2>
					<div class="section-body">
						<div class="setting-row first-row">
							<engine-manager style="width:100%" @permission-check=${this.#onPermissionCheck}></engine-manager>
						</div>
					</div>
				</div>

				<div class="section ${this._activeSection === 'blacklist' ? 'active' : ''}" data-nav="blacklist">
					<h2><span class="section-icon">${unsafeHTML(icon('mouseOff', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('blacklist')}</span></h2>
					<div class="section-body">
						<div class="setting-row first-row blacklist-section">
							<blacklist-manager id="blacklistManager"
								.blacklist=${this._settings.blacklist || []}
								@change=${this.#onBlacklistChange}
								@error=${this.#onBlacklistError}
							></blacklist-manager>
						</div>
						<div class="setting-row">
							<div class="setting-label">
								<span>${i18n.getMessage('enableBlacklistContextMenu')}</span>
								<span>${i18n.getMessage('enableBlacklistContextMenuDesc')}</span>
							</div>
							<label class="toggle">
								<input type="checkbox" id="enableBlacklistContextMenu" .checked=${this._settings.enableBlacklistContextMenu} @change=${e => this.#updateSetting('enableBlacklistContextMenu', e.target.checked)}>
								<span class="slider"></span>
							</label>
						</div>
					</div>
				</div>

				<div class="section ${this._activeSection === 'other' ? 'active' : ''}" data-nav="other">
					<h2><span class="section-icon">${unsafeHTML(icon('slidersHorizontal', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('otherSettings')}</span></h2>
					<div class="section-body">
						<div id="restricted-notice" class="setting-row first-row">
							<div class="setting-label">
								<span>${i18n.getMessage('showRestrictedNotice')}</span>
								<span>${i18n.getMessage('showRestrictedNoticeDesc')}</span>
							</div>
							<label class="toggle">
								<input type="checkbox" id="showRestrictedNotice" .checked=${this._settings.showRestrictedNotice} @change=${e => this.#updateSetting('showRestrictedNotice', e.target.checked)}>
								<span class="slider"></span>
							</label>
						</div>
						<details class="collapsible-details" id="restricted-details">
							<summary>
								<span class="restricted-title">
									<span class="restricted-title-icon">${unsafeHTML(icons.triangleAlert)}</span><span>${i18n.getMessage('restrictedPagesDetailsTitle')}</span>
									<span class="show-more-hint">${i18n.getMessage('showMoreHint')}</span>
								</span>
							</summary>
							<div class="details-content">
								<h4>${i18n.getMessage('restrictedNewTab')}</h4>
								<p>${i18n.getMessage('restrictedNewTabDesc')}</p>

								<h4>${i18n.getMessage('restrictedStore')}</h4>
								<p>${this.#getRestrictedStoreDesc()}</p>

								<h4>${this.#getRestrictedInternalTitle()}</h4>
								<p>${i18n.getMessage('restrictedInternalDesc')}</p>

								<h4>${i18n.getMessage('restrictedFile')}</h4>
								<p>${i18n.getMessage('restrictedFileDesc')}</p>

								<h4>${i18n.getMessage('restrictedViewSource')}</h4>
								<p>${i18n.getMessage('restrictedViewSourceDesc')}</p>

								<p style="margin-top: 12px; font-style: italic;">${i18n.getMessage('restrictedOther')}</p>
							</div>
						</details>
					</div>
				</div>

				<div class="section ${this._activeSection === 'data' ? 'active' : ''}" data-nav="data">
					<h2><span class="section-icon">${unsafeHTML(icon('hardDrive', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('dataManagement')}</span></h2>
					<div class="section-body">
						<div class="setting-row first-row">
							<div class="setting-label">
								<span>${i18n.getMessage('syncStatus')}</span>
								<span>${i18n.getMessage('syncStatusDesc')}</span>
							</div>
							<div class="sync-status">
								<span>${i18n.getMessage('saved')}</span>
								${this._settings.lastSyncTime ? html`<span>${this.#formatSyncTime(this._settings.lastSyncTime)}</span>` : ''}
							</div>
						</div>
						<div class="setting-row actions">
							<button class="btn btn-secondary btn-lg" @click=${this.#exportSettings}>${i18n.getMessage('export')}</button>
							<button class="btn btn-secondary btn-lg" @click=${this.#triggerImport}>${i18n.getMessage('import')}</button>
							<button class="btn btn-danger btn-lg" @click=${this.#resetSettings}>${i18n.getMessage('reset')}</button>
						</div>
					</div>

				</div>

				<div class="section ${this._activeSection === 'support' ? 'active' : ''}" data-nav="support">
					<h2><span class="section-icon">${unsafeHTML(icon('messageCircleMore', { strokeWidth: 2.3 }))}</span> <span>${i18n.getMessage('supportAndFeedback')}</span></h2>
					<div class="section-body">
						<div class="setting-row first-row">
							<div class="setting-left">
								<span class="setting-icon icon-feedback">
									${unsafeHTML(icons.mdFeedback)}
								</span>
								<div class="setting-label">
									<span>${i18n.getMessage('feedbackTitle')}</span>
									<span>${unsafeHTML(i18n.getMessage(!i18n.isFirefox && !i18n.isEdge ? 'feedbackTextChrome' : 'feedbackText'))}</span>
								</div>
							</div>
						</div>
						<div class="setting-row">
							<div class="setting-left">
								<span class="setting-icon icon-heart">
									${unsafeHTML(icons.mdHeart)}
								</span>
								<div class="setting-label">
									<span>${i18n.getMessage('supportUsTitle')}</span>
									<span>${unsafeHTML(this.#getSupportUsText())}</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<footer class="footer">
					<div class="footer-top">
						<div class="footer-brand">
							<span class="footer-name">${i18n.getMessage('extName')} ${this.#getVersion()}</span>
						</div>
						<div class="footer-links">
							<a href="tutorial.html" class="footer-link">
								<span class="footer-link-icon">${unsafeHTML(icon('bookOpen', { size: 14, strokeWidth: 2 }))}</span>
								${i18n.getMessage('tutorial')}
							</a>
							<a href="https://github.com/Hmily-LCG/FlowMouse" target="_blank" class="footer-link">
								<span class="footer-link-icon">${unsafeHTML(icon('github', { size: 14, strokeWidth: 2 }))}</span>
								${i18n.getMessage('aboutOpenSource')}
							</a>
							<a href="about.html" class="footer-link">
								<span class="footer-link-icon">${unsafeHTML(icon('info', { size: 14, strokeWidth: 2 }))}</span>
								${i18n.getMessage('aboutTitleShort')}
							</a>
						</div>
					</div>
					<div class="footer-bottom">
						<div class="footer-privacy">
							<span class="footer-privacy-icon">${unsafeHTML(icon('lock', { size: 12, strokeWidth: 2 }))}</span>
							${i18n.getMessage('privacyNote')}
						</div>
						<div class="footer-author">
							Made with <span class="footer-heart-icon">${unsafeHTML(icon('heart'))}</span> by Hmily[LCG] & Coxxs
						</div>
					</div>
				</footer>
			</div>

			<nav class="section-nav ${this._settings.navCollapsed ? 'collapsed' : ''} ${this._navProximityShow ? 'proximity-show' : ''}">
				<div class="section-nav-items">
					${this.#getSections(i18n).map(s => html`
						<button class="section-nav-item ${this._activeSection === s.id ? 'active' : ''}"
							@click=${() => this.#scrollToSection(s.id)}
							title=${s.label}>
							<span class="section-nav-icon">${unsafeHTML(s.icon)}</span>
							<span class="section-nav-label">${s.label}</span>
						</button>
					`)}
					<button class="section-nav-item section-nav-toggle"
						@click=${this.#toggleNavCollapsed}
						title=${this._settings.navCollapsed ? i18n.getMessage('show') : i18n.getMessage('hide')}>
						<span class="section-nav-icon">${unsafeHTML(this._settings.navCollapsed ? icons.chevronRight : icons.chevronLeft)}</span>
					</button>
				</div>
			</nav>

			<div class="status ${this._statusVisible ? 'show' : ''}" style="background:${this._statusType === 'error' ? '#ea4335' : '#34a853'}">${this._statusMessage}</div>

			<input type="file" id="importFile" accept=".json" style="display:none" @change=${this.#importSettings}>

			<gesture-recorder id="gestureRecorder" data-gesture-ignore></gesture-recorder>
		`;
	}


	#getSections(i18n) {
		const sections = [
			{ id: 'style', label: i18n.getMessage('styleSettings'), icon: icons.palette },
			{ id: 'basic', label: i18n.getMessage('basicSettings'), icon: icons.mouseRight },
			{ id: 'drag', label: i18n.getMessage('dragFeatures'), icon: icons.mouseLeft },
			{ id: 'areaSelect', label: i18n.getMessage('areaSelectTitle'), icon: icons.squareDashedMousePointer },
			{ id: 'wheel', label: i18n.getMessage('wheelGestures'), icon: icons.mouse },
			{ id: 'special', label: i18n.getMessage('specialGestures'), icon: icons.mousePointerClick },
			{ id: 'searchEngines', label: i18n.getMessage('sectionSearchEngines'), icon: icons.search },
			{ id: 'blacklist', label: i18n.getMessage('blacklist'), icon: icons.mouseOff },
			{ id: 'other', label: i18n.getMessage('otherSettings'), icon: icons.slidersHorizontal },
			{ id: 'data', label: i18n.getMessage('dataManagement'), icon: icons.hardDrive },
			{ id: 'support', label: i18n.getMessage('supportAndFeedback'), icon: icons.messageCircleMore },
		];
		return sections;
	}

	#updateHoveredSection() {
		const sections = this.shadowRoot.querySelectorAll('[data-nav]');
		if (!sections.length) return;

		let hovered = null;
		for (const section of sections) {
			const rect = section.getBoundingClientRect();
			if (this._mouseY >= rect.top && this._mouseY <= rect.bottom &&
				this._mouseX >= rect.left && this._mouseX <= rect.right) {
				hovered = section.dataset.nav;
			}
		}

		if (this._navClickLock) {
			if (hovered) {
				this._navClickLock = false;
				this._activeSection = hovered;
			}
			return;
		}

		clearTimeout(this._sectionHoverTimer);
		if (hovered) {
			this._activeSection = hovered;
		} else if (this._activeSection !== null) {
			this._sectionHoverTimer = setTimeout(() => {
				this._activeSection = null;
			}, 1000);
		}
	}

	async #onNavigateSection(e) {
		const { section } = e.detail;
		this.#scrollToSection(section);
	}

	#scrollToSection(id) {
		const section = this.shadowRoot.querySelector(`[data-nav="${id}"]`);
		if (!section) return;

		clearTimeout(this._sectionHoverTimer);
		this._activeSection = id;
		this._navClickLock = true;
		section.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	#toggleNavCollapsed() {
		const collapsed = !this._settings.navCollapsed;
		this.#updateSetting('navCollapsed', collapsed);
		if (collapsed) {
			this._navProximityArmed = false;
		} else {
			this._navProximityShow = false;
		}
	}

	#onDocumentMouseMove(e) {
		this._mouseX = e.clientX;
		this._mouseY = e.clientY;

		this.#updateHoveredSection();

		if (this._settings.navCollapsed) {
			const threshold = 48;
			const isRTL = getComputedStyle(document.documentElement).direction === 'rtl';
			const near = isRTL ? e.clientX >= window.innerWidth - threshold : e.clientX <= threshold;
			if (!near) {
				this._navProximityArmed = true;
			}
			const show = near && this._navProximityArmed;
			if (show !== this._navProximityShow) {
				this._navProximityShow = show;
			}
		}
	}


	#handleEdgeGestureLink(e) {
		if (window.i18n.isEdgeDesktop) {
			const link = e.target.closest('.edge-gesture-link');
			if (link) {
				e.preventDefault();
				chrome.tabs.create({ url: 'edge://settings/appearance/browserBehavior/mouseGestures' });
			}
		}
	}

	#getVersion() {
		return 'v' + window.i18n.version;
	}

	#formatSyncTime(timeStr) {
		if (!timeStr) return '';
		try {
			return new Date(timeStr).toLocaleTimeString();
		} catch { return ''; }
	}

	#showStatus(message, type = 'success') {
		this._statusMessage = message;
		this._statusType = type;
		this._statusVisible = true;
		if (this._statusTimer) clearTimeout(this._statusTimer);
		this._statusTimer = setTimeout(() => {
			this._statusVisible = false;
		}, 1500);
	}

	#toggleSectionAdvanced(section) {
		const current = this._settings.sectionAdvanced || {};
		this.#updateSetting('sectionAdvanced', {
			...current,
			[section]: !current[section]
		});
	}

	#renderAdvancedToggle(sectionId) {
		const active = this._settings.sectionAdvanced?.[sectionId];
		return html`
			<label class="section-advanced-toggle ${active ? 'active' : ''}">
				<input type="checkbox" .checked=${!!active}
					@change=${() => this.#toggleSectionAdvanced(sectionId)}>
				<div class="section-advanced-toggle-slider"></div>
				<div class="section-advanced-toggle-label">${window.i18n.getMessage('advanced')}</div>
			</label>
		`;
	}


	#coerce(key, value) {
		const def = window.GestureConstants.DEFAULT_SETTINGS[key];
		if (typeof def === 'number') return Number(value);
		if (typeof def === 'boolean') return Boolean(value);
		return value;
	}

	async #updateSetting(key, value) {
		await this.#savePatch({ [key]: this.#coerce(key, value) });
	}

	async #updateTriggerButton(buttonKey, checked) {
		const current = { ...this._settings.gestureTriggerButtons };
		current[buttonKey] = checked;
		if (!current.right && !current.middle && !current.side1 && !current.side2 && !current.penRight) {
			current.right = true;
		}
		await this.#savePatch({ gestureTriggerButtons: current });
	}

	#debounceSetting(key, value) {
		this.#debouncePatch({ [key]: this.#coerce(key, value) });
	}


	async #rotateTheme() {
		const order = ['auto', 'dark', 'light'];
		const idx = order.indexOf(this._settings.theme);
		const next = order[(idx + 1) % order.length];
		window.i18n.applyTheme(next);
		await this.#updateSetting('theme', next);
	}

	#getThemeIcon() {
		switch (this._settings.theme) {
			case 'dark': return icons.moon;
			case 'light': return icons.sun;
			default: return icons.sunMoon;
		}
	}

	#getThemeLabel(i18n) {
		const mode = (() => {
			switch (this._settings.theme) {
				case 'dark': return i18n.getMessage('themeDark');
				case 'light': return i18n.getMessage('themeLight');
				default: return i18n.getMessage('themeAuto');
			}
		})();
		return `${i18n.getMessage('theme')}: ${mode}`;
	}

	async #onLanguageChange(e) {
		await this.#updateSetting('language', e.detail.value);
		location.reload();
	}

	async #onBlacklistChange(e) {
		await this.#savePatch({ blacklist: e.detail.blacklist });
	}

	#onBlacklistError(e) {
		this.#showStatus(e.detail.message, 'error');
	}

	async #onGesturesChange(e) {
		await this.#savePatch({ mouseGestures: e.detail.mouseGestures });
	}

	async #onGestureDelete(e) {
		const mouseGestures = { ...(this._settings.mouseGestures || {}) };
		delete mouseGestures[e.detail.pattern];
		await this.#savePatch({ mouseGestures });
		this.#showStatus(window.i18n.getMessage('gestureDeleted'));
	}

	#onPermissionCheck(e) {
		this.#checkAndRequestPermission(e.detail.action);
	}

	#onDragGesturesChange(settingsKey, e) {
		this.#debouncePatch({ [settingsKey]: e.detail.dragGestures });
	}

	async #onWheelGesturesChange(e) {
		await this.#savePatch({ wheelGestures: e.detail.wheelGestures });
	}

	async #onSpecialGesturesChange(e) {
		await this.#savePatch({ specialGestures: e.detail.specialGestures });
	}

	async #openGestureModal() {
		const recorder = this.shadowRoot.getElementById('gestureRecorder');
		if (!recorder) return;

		const { DEFAULT_GESTURES } = window.GestureConstants;
		const mouseGestures = this._settings.mouseGestures || {};
		const existingPatterns = Array.from(new Set([
			...Object.keys(DEFAULT_GESTURES),
			...Object.keys(mouseGestures),
		]));
		const result = await recorder.open({ button: 'right', bannedPatterns: existingPatterns });
		if (result.cancelled || !result.pattern) return;

		const pattern = result.pattern;

		const newMouseGestures = { ...mouseGestures };
		newMouseGestures[pattern] = { action: 'none' };

		await this.#savePatch({ mouseGestures: newMouseGestures });
		this.#showStatus(window.i18n.getMessage('gestureAdded'));

		const gestureGrid = this.shadowRoot.getElementById('gestureGrid');
		if (gestureGrid) gestureGrid.openActionSelect(pattern);
	}


	async #savePatch(patch) {
		this._settings = { ...this._settings, ...patch };
		const ok = await this._store.save(patch);
		if (!ok) {
			this.#showStatus(window.i18n.getMessage('saveFailure'), 'error');
			return false;
		}
		this._settings = { ...this._store.current, ...(this._pendingPatch || {}) };
		return true;
	}

	#debouncePatch(patch) {
		this._settings = { ...this._settings, ...patch };
		this._pendingPatch = { ...(this._pendingPatch || {}), ...patch };
		if (this._debounceTimer) clearTimeout(this._debounceTimer);
		this._debounceTimer = setTimeout(() => this.#flushPendingPatch(), 500);
	}

	#exportSettings() {
		const data = { ...this._store.current };
		data._version = window.i18n.version;
		const dataStr = JSON.stringify(data, null, 2);
		const blob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'FlowMouse-settings.json';
		a.click();
		URL.revokeObjectURL(url);
		this.#showStatus(window.i18n.getMessage('exportDone'));
	}

	#triggerImport() {
		this.shadowRoot.getElementById('importFile').click();
	}

	async #importSettings(e) {
		const file = e.target.files[0];
		if (!file) return;

		if (!confirm(window.i18n.getMessage('importConfirm'))) {
			e.target.value = '';
			return;
		}

		const reader = new FileReader();
		reader.onload = async (event) => {
			try {
				const imported = JSON.parse(event.target.result);
				delete imported._version;
				if (typeof imported.enableGesture === 'undefined') {
					throw new Error('Invalid configuration file');
				}
				const DEFAULT_SETTINGS = structuredClone(window.GestureConstants.DEFAULT_SETTINGS);
				if ((imported.customGestures || imported.gestures) && !imported.mouseGestures) {
					const { DEFAULT_GESTURES } = window.GestureConstants;
					const baseGestures = imported.gestures || DEFAULT_GESTURES;
					const customGestures = imported.customGestures || {};
					const customGestureUrls = imported.customGestureUrls || {};
					const merged = { ...baseGestures, ...customGestures };
					const mouseGestures = {};
					for (const [pattern, action] of Object.entries(merged)) {
						if (action === null) continue;
						const entry = { action };
						if (customGestureUrls[pattern]) entry.customUrl = customGestureUrls[pattern];
						mouseGestures[pattern] = entry;
					}
					imported.mouseGestures = mouseGestures;
					delete imported.gestures;
					delete imported.customGestures;
					delete imported.customGestureUrls;
				}
				const merged = { ...DEFAULT_SETTINGS, ...imported };
				const ok = await this._store.save(merged);
				if (ok) {
					this._settings = { ...this._store.current };
					this.#showStatus(window.i18n.getMessage('importDone'));
				} else {
					this.#showStatus(window.i18n.getMessage('importFailedSyncError'), 'error');
				}
			} catch (err) {
				console.error('Import failed:', err);
				this.#showStatus(window.i18n.getMessage('importFailed'), 'error');
			}
		};
		reader.readAsText(file);
		e.target.value = '';
	}

	async #resetSettings() {
		if (confirm(window.i18n.getMessage('resetConfirm'))) {
			await this._store.reset();
			this._settings = { ...this._store.current };
			this.#showStatus(window.i18n.getMessage('resetDone'));
		}
	}

	#renderInlineReset(keys, { confirm = false } = {}) {
		const keyArray = Array.isArray(keys) ? keys : [keys];
		const defaults = window.GestureConstants.DEFAULT_SETTINGS;
		const isModified = keyArray.some(key => {
			const cur = this._settings[key], def = defaults[key];
			if (typeof def === 'object' && def !== null && typeof cur === 'object' && cur !== null) {
				const allKeys = new Set([...Object.keys(def), ...Object.keys(cur)]);
				return [...allKeys].some(k => cur[k] !== def[k]);
			}
			return cur !== def;
		});

		const handleClick = () => {
			if (confirm && !window.confirm(window.i18n.getMessage('resetToDefaultConfirm'))) return;
			this.#resetSettingKeys(keyArray);
		};

		return html`<button
			class="inline-reset-btn ${isModified ? 'visible' : ''}"
			@click=${handleClick}
			.tooltip=${tooltip(window.i18n.getMessage('resetToDefault'))}
		>${unsafeHTML(icon('rotateCcw', { size: 13, strokeWidth: 2.5 }))}</button>`;
	}

	#resetSettingKeys(keys) {
		if (!Array.isArray(keys) || keys.length === 0) return;
		const defaults = window.GestureConstants.DEFAULT_SETTINGS;
		for (const key of keys) {
			if (typeof key !== 'string' || !(key in defaults)) continue;
			this.#updateSetting(key, defaults[key]);
		}
	}


	async #checkAndRequestPermission(action) {
		const openPopup = async (perms) => {
			const url = chrome.runtime.getURL(`pages/permission.html?permissions=${perms}`);
			const width = 340, height = 380;
			const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
			const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
			try {
				const popupWindow = await chrome.windows.create({
					url, type: 'popup', width, height, left, top, focused: true,
				});
				if (!popupWindow) await chrome.tabs.create({ url, active: true });
			} catch (e) {
				await chrome.tabs.create({ url, active: true });
			}
		};

		if ((action === 'newIncognito' && window.i18n.isFirefox) || action === 'openInIncognito') {
			const isAllowed = await chrome.extension.isAllowedIncognitoAccess();
			if (!isAllowed) {
				await openPopup('incognito');
			}
			return;
		}

		if (!chrome.permissions) return;

		let permissions = null;
		if (action === 'addToBookmarks' || action === 'menuShowBookmarks') {
			permissions = ['bookmarks'];
		} else if (action === 'saveImage') {
			permissions = ['downloads', 'pageCapture'];
		} else if (action === 'saveAsMhtml') {
			permissions = ['downloads', 'pageCapture'];
		} else if (action === 'pasteClipboard' || action === 'searchClipboard') {
			permissions = ['clipboardRead'];
		}

		if (!permissions) return;

		const result = await chrome.permissions.contains({ permissions });
		if (!result) {
			await openPopup(permissions.join(','));
		}
	}


	#handleHashNavigation() {
		if (!window.location.hash) return;
		setTimeout(() => {
			const target = this.shadowRoot.querySelector(window.location.hash);
			if (!target) return;

			if (window.location.hash === '#restricted-notice') {
				const details = this.shadowRoot.getElementById('restricted-details');
				if (details) details.open = true;
				this.#scrollAndHighlight(target, details || target, '#ffc107');
				return;
			}
			this.#scrollAndHighlight(target, target);
		}, 300);
	}

	#scrollAndHighlight(scrollTarget, highlightTarget, color = '#4285f4') {
		scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
		highlightTarget.style.transition = 'box-shadow 0.5s ease-in-out, border-radius 0.5s ease-in-out';
		highlightTarget.style.boxShadow = `0 0 0 3px ${color}, 0 0 20px ${color}40`;
		highlightTarget.style.borderRadius = '15px';
		setTimeout(() => {
			highlightTarget.style.boxShadow = '';
			highlightTarget.style.borderRadius = '';
		}, 5000);
	}


	#getSupportUsText() {
		const browserInfo = window.i18n.getBrowserInfo();
		let storeInfo = browserInfo.storeName;
		if (browserInfo.flowmouseStoreLink) {
			storeInfo = `<a href="${browserInfo.flowmouseStoreLink}" target="_blank">${storeInfo}</a>`;
		}
		const template = window.i18n.getMessage('supportUsText');
		return template.replace('%appStoreInfo%', storeInfo);
	}

	#getRestrictedStoreDesc() {
		const browserInfo = window.i18n.getBrowserInfo();
		return window.i18n.getMessage('restrictedStoreDesc')
			.replace('%storeInfo%', `${browserInfo.storeName} (${browserInfo.storeLink})`);
	}

	#getRestrictedInternalTitle() {
		const browserInfo = window.i18n.getBrowserInfo();
		return window.i18n.getMessage('restrictedInternal')
			.replace('%browserProtocol%', browserInfo.protocol);
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('options-page', OptionsPage);
});