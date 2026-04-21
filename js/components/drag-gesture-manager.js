import { LitElement, html, css, unsafeCSS, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icons, icon, iconUrl } from '../icons.js'; 
import { tooltip } from '../tooltip.js';

class DragGestureManager extends LitElement {

	static properties = {
		type: { type: String },       
		dragGestures: { type: Array },    
		advancedMode: { type: Boolean, attribute: 'advanced-mode' }, 
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
			}
			.drag-rows-container {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.drag-row {
				display: flex;
				align-items: stretch;
				gap: 0;
				border-radius: 8px;
				overflow: hidden;
			}
			.drag-row-wrapper {
				display: block;
				flex: 1;
				min-width: 0;
			}
			.drag-row-content {
				display: flex;
				flex-direction: column;
				border-radius: 8px;
				overflow: hidden;
				border: 1px solid var(--border-color);
				background: var(--bg-secondary);
			}
			.direction-btn {
				min-width: 50px;
				flex-wrap: wrap;
			}
			.position-select {
				min-width: 60px;
			}
			.action-select {
				min-width: 100px;
			}
			.engine-select {
				min-width: 80px;
			}
			input[type="text"].url-input {
				flex: 1;
				min-width: 150px;
			}
			input[type="text"].custom-name-input {
				flex: 0 1 auto;
				min-width: 80px;
				width: 130px;
			}
			.custom-name-label {
				font-size: 12px;
				color: var(--text-secondary);
				flex-shrink: 0;
			}
			.auto-detect-label .help-icon svg {
				transform: translateY(1px);
			}
			.drag-row-primary {
				display: flex;
				align-items: center;
				gap: 0;
				padding: 0;
			}
			.drag-row-primary-content {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
				padding: 8px 10px;
				flex: 1;
				min-width: 0;
			}
			.drag-row-toggle {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				align-self: stretch;
				flex-shrink: 0;
				background: transparent;
				border: none;
				border-left: 1px solid var(--border-color-light, color-mix(in srgb, var(--border-color) 70%, transparent));
				padding: 0;
				cursor: pointer;
				color: var(--text-muted);
				transition: color 0.15s;
			}
			.drag-row-toggle:hover {
				color: var(--accent-color);
				background: color-mix(in srgb, var(--accent-color) 6%, transparent);
			}
			.drag-row-toggle svg {
				width: 18px;
				height: 18px;
				transition: transform 0.2s;
			}
			.drag-row-toggle.expanded svg {
				transform: rotate(180deg);
			}
			.drag-row-secondary {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
				padding: 8px 10px;
				background: color-mix(in srgb, var(--bg-tertiary) 50%, var(--bg-secondary) 50%);
				border-top: 1px solid var(--border-color-light, color-mix(in srgb, var(--border-color) 50%, transparent));
			}
			.drag-delete-btn,
			.drag-copy-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				align-self: center;
				width: 20px;
				height: 20px;
				flex-shrink: 0;
				background: transparent;
				border: none;
				padding: 0;
				cursor: pointer;
				color: var(--text-muted);
				transition: color 0.15s;
			}
			.drag-delete-btn {
				margin-inline-start: 4px;
			}
			.drag-copy-btn {
				margin-inline-start: 10px;
			}
			.drag-delete-btn:hover {
				color: var(--danger-color);
			}
			.drag-copy-btn:hover {
				color: var(--accent-color);
			}
			.drag-delete-btn::before,
			.drag-copy-btn::before {
				content: '';
				width: 14px;
				height: 14px;
				background-color: currentColor;
				mask-size: contain;
				mask-repeat: no-repeat;
				mask-position: center;
				-webkit-mask-size: contain;
				-webkit-mask-repeat: no-repeat;
				-webkit-mask-position: center;
			}
			.drag-delete-btn::before {
				mask-image: ${unsafeCSS(iconUrl('trash2'))};
				-webkit-mask-image: ${unsafeCSS(iconUrl('trash2'))};
			}
			.drag-copy-btn::before {
				mask-image: ${unsafeCSS(iconUrl('copy'))};
				-webkit-mask-image: ${unsafeCSS(iconUrl('copy'))};
			}
			.drag-add-btn {
				display: flex;
				margin-top: 8px;
				margin-inline: auto;
			}
			.configure-btn svg {
				transform: translateY(1px);
			}
			.gesture-icon-wrap {
				transform: scale(1.2);
			}
		`,
	];

	constructor() {
		super();
		this.type = 'text';
		this.dragGestures = [];
		this.advancedMode = false;
	}

	get _actions() {
		const { TEXT_DRAG_ACTIONS, LINK_DRAG_ACTIONS, IMAGE_DRAG_ACTIONS } = window.GestureConstants;
		switch (this.type) {
			case 'text': return TEXT_DRAG_ACTIONS;
			case 'link': return LINK_DRAG_ACTIONS;
			case 'image': return IMAGE_DRAG_ACTIONS;
			default: return {};
		}
	}

	static ADVANCED_ACTIONS = new Set(['sendCustomEvent']);

	#visibleActions(currentAction) {
		return Object.entries(this._actions)
			.filter(([v]) => !DragGestureManager.ADVANCED_ACTIONS.has(v) || this.advancedMode || v === currentAction);
	}

	render() {
		const dragGestures = structuredClone(this.dragGestures);

		return html`
			<div class="drag-rows-container">
				${dragGestures.map((cfg, index) => this.#renderRow(cfg, index, dragGestures.length))}
			</div>
			<button type="button" class="btn btn-dashed drag-add-btn btn-lg" @click=${this.#addRow}>${unsafeHTML(icon('plus', { strokeWidth: 2 }))}</button>
			<gesture-recorder id="dragRecorder" data-gesture-ignore></gesture-recorder>
			<event-config-dialog id="eventConfigDialog"></event-config-dialog>
		`;
	}

	#renderRow(cfg, index, totalRows) {
		const { TAB_POSITIONS, DRAG_ACTION_DEFAULTS } = window.GestureConstants;

		const action = cfg.action || 'none';
		const defaults = DRAG_ACTION_DEFAULTS[action] || {};
		const direction = cfg.direction || '→';
		const position = cfg.position ?? defaults.position;
		const active = cfg.active ?? defaults.active;
		const engine = cfg.engine ?? defaults.engine;
		const url = cfg.url ?? defaults.url;
		const autoDetectUrl = cfg.autoDetectUrl ?? defaults.autoDetectUrl;
		const preferLink = cfg.preferLink ?? defaults.preferLink;
		const incognito = cfg.incognito ?? defaults.incognito;

		const showPos = ['openTab', 'search', 'imageSearch'].includes(action);
		const showActive = showPos && position !== 'current';
		const showIncognito = this.advancedMode && ['openTab', 'search', 'imageSearch'].includes(action);
		const showEngine = (this.type === 'text' && action === 'search') || (this.type === 'image' && action === 'imageSearch');
		const showUrl = (this.type === 'text' && action === 'search' && engine === 'custom') ||
			(this.type === 'image' && action === 'imageSearch' && engine === 'custom');
		const showPreferLink = this.type === 'image' && action === 'openTab';
		const showCustomEvent = action === 'sendCustomEvent';

		const showSecondary = showPos || this.advancedMode;

		const isExpanded = cfg.simple !== true;

		return html`
			<div class="drag-row">
				<div class="drag-row-wrapper">
					<div class="drag-row-content">
						<div class="drag-row-primary">
							<div class="drag-row-primary-content">
								<button type="button" class="btn btn-secondary direction-btn"
									@click=${() => this.#changeDirection(index)}>
									<span class="gesture-icon-wrap">${unsafeHTML(window.GestureConstants.arrowsToSvg(direction))}</span>
								</button>

								<select class="action-select" .value=${action}
									@change=${(e) => this.#handleActionChange(index, e.target.value)}>
									${this.#visibleActions(action).map(([v, k]) => html`
										<option value=${v} ?selected=${action === v}>${window.i18n.getMessage(k)}</option>
									`)}
								</select>

								${(this.type === 'text' || this.type === 'image') ? html`
									<select class="engine-select" style=${showEngine ? '' : 'display:none'}
										.value=${engine}
										@change=${(e) => this.#handleEngineChange(index, e.target.value)}>
										${this.#renderEngineOptions(engine)}
									</select>
								` : ''}

								<input type="text" class="url-input"
									placeholder=${this.type === 'text' ? window.i18n.getMessage('urlPlaceholderText') : window.i18n.getMessage('urlPlaceholderImage')}
									.value=${url}
									style=${showUrl ? '' : 'display:none'}
									@input=${(e) => this.#updateRow(index, 'url', e.target.value)}>

								${this.type === 'text' ? html`
									<label class="inline-checkbox auto-detect-label" style=${showEngine ? '' : 'display:none'}>
										<input type="checkbox" .checked=${autoDetectUrl}
											@change=${(e) => this.#updateRow(index, 'autoDetectUrl', e.target.checked)}>
										<span>${window.i18n.getMessage('autoDetectUrl')}</span>
										<span class="help-icon"
											.tooltip=${tooltip(window.i18n.getMessage('autoDetectUrlTooltip'))}>
											${unsafeHTML(icon('circleHelp', { size: 14 }))}
										</span>
									</label>
								` : ''}

								${this.type === 'image' ? html`
									<label class="inline-checkbox prefer-link-label" style=${showPreferLink ? '' : 'display:none'}>
										<input type="checkbox" .checked=${preferLink}
											@change=${(e) => this.#updateRow(index, 'preferLink', e.target.checked)}>
										<span>${window.i18n.getMessage('preferLink')}</span>
									</label>
								` : ''}

								${this.type === 'link' && action === 'copyLinkAndText' ? html`
									<label class="inline-checkbox">
										<input type="checkbox" .checked=${cfg.asMarkdown ?? (defaults.asMarkdown || false)}
											@change=${(e) => this.#updateRow(index, 'asMarkdown', e.target.checked)}>
										<span>${window.i18n.getMessage('copyAsMarkdown')}</span>
									</label>
								` : ''}

								${showCustomEvent ? html`
									<button type="button" class="btn btn-ghost configure-btn"
										@click=${() => this.#openEventConfig(index)}>
										${unsafeHTML(icon('settings', { size: 13 }))}
										${window.i18n.getMessage('customEventConfigureBtn')}
									</button>
								` : ''}
							</div>

							${showSecondary ? html`
								<button type="button" class="drag-row-toggle ${isExpanded ? 'expanded' : ''}"
									@click=${() => this.#toggleSecondary(index)}>
									${unsafeHTML(icons.chevronDown)}
								</button>
							` : ''}
						</div>

						<div class="drag-row-secondary" style=${showSecondary && isExpanded ? '' : 'display:none'}>
							<select class="position-select input" style=${showPos ? (incognito ? 'opacity: 0.5' : '') : 'display:none'}
								.value=${position}
								@change=${(e) => this.#updateRow(index, 'position', e.target.value)}>
								${Object.entries(TAB_POSITIONS).map(([value, key]) => html`
									<option value=${value} ?selected=${position === value}>${window.i18n.getMessage(key)}</option>
								`)}
							</select>

							<label class="inline-checkbox active-label" style=${showActive ? (incognito ? 'opacity: 0.5' : '') : 'display:none'}>
								<input type="checkbox" .checked=${active}
									@change=${(e) => this.#updateRow(index, 'active', e.target.checked)}>
								${window.i18n.getMessage('newTabActive')}
							</label>

							<label class="inline-checkbox incognito-label" style=${showIncognito ? '' : 'display:none'}>
								<input type="checkbox" .checked=${incognito}
									@change=${(e) => this.#handleIncognitoChange(index, e.target.checked)}>
								${window.i18n.getMessage('openInIncognito', 'Open in Incognito')}
							</label>

							<span class="custom-name-label" style=${this.advancedMode ? '' : 'display:none'}>
								${window.i18n.getMessage('customHudName')}
								<span class="help-icon"
									.tooltip=${tooltip(window.i18n.getMessage('customHudNameTooltip'))}>
									${unsafeHTML(icon('circleHelp', { size: 14 }))}
								</span>
							</span>
							<input type="text" class="custom-name-input input"
								style=${this.advancedMode ? '' : 'display:none'}
								placeholder=${window.i18n.getMessage(this._actions[action]) || action}
								.value=${cfg.customName || ''}
								maxlength="80"
								@input=${(e) => this.#updateRow(index, 'customName', e.target.value)}>
							${showPreferLink && preferLink ? html`
							<input type="text" class="custom-name-input input"
								style=${this.advancedMode ? '' : 'display:none'}
								placeholder=${window.i18n.getMessage('dragActionOpenTabLink')}
								.value=${cfg.customNamePreferLink || ''}
								maxlength="80"
								@input=${(e) => this.#updateRow(index, 'customNamePreferLink', e.target.value)}>
							` : ''}
							${showEngine && autoDetectUrl && this.type === 'text' ? html`
							<input type="text" class="custom-name-input input"
								style=${this.advancedMode ? '' : 'display:none'}
								placeholder=${window.i18n.getMessage('dragActionOpenTabLink')}
								.value=${cfg.customNameAutoDetectUrl || ''}
								maxlength="80"
								@input=${(e) => this.#updateRow(index, 'customNameAutoDetectUrl', e.target.value)}>
							` : ''}
						</div>
					</div>
				</div>

				<button type="button" class="drag-copy-btn"
					@click=${() => this.#copyRow(index)}
					.tooltip=${tooltip(window.i18n.getMessage('duplicate'))}></button>
				<button type="button" class="drag-delete-btn"
					@click=${() => this.#deleteRow(index)}
					.tooltip=${tooltip(window.i18n.getMessage('delete'))}></button>
			</div>
		`;
	}

	async #openEventConfig(index) {
		const dialog = this.shadowRoot.getElementById('eventConfigDialog');
		if (!dialog) return;
		const cfg = this.dragGestures[index] || {};
		const { DRAG_ACTION_DEFAULTS } = window.GestureConstants;
		const defaults = DRAG_ACTION_DEFAULTS.sendCustomEvent || {};
		const result = await dialog.open({
			eventType: cfg.eventType ?? defaults.eventType,
			eventDetail: cfg.eventDetail ?? defaults.eventDetail,
			gestureInfo: cfg.gestureInfo ?? defaults.gestureInfo,
		});
		if (!result.confirmed) return;
		const dragGestures = structuredClone(this.dragGestures);
		dragGestures[index].eventType = result.eventType;
		dragGestures[index].eventDetail = result.eventDetail;
		dragGestures[index].gestureInfo = result.gestureInfo;
		this.#dispatchChange(dragGestures);
	}

	#renderEngineOptions(current) {
		if (this.type === 'text') {
			return this.#renderSearchEngineOptions(current);
		} else if (this.type === 'image') {
			return this.#renderImageSearchEngineOptions(current);
		}
		return '';
	}

	#renderSearchEngineOptions(current) {
		const { SEARCH_ENGINES, SEARCH_ENGINE_ORDER } = window.GestureConstants;
		const lang = window.i18n.getCurrentLanguage();
		const order = SEARCH_ENGINE_ORDER[lang] || SEARCH_ENGINE_ORDER['default'];
		const displayKeys = [...order];

		if (current && current !== 'custom' && !displayKeys.includes(current) && SEARCH_ENGINES[current]) {
			displayKeys.push(current);
		}

		return html`
			${displayKeys.map(key => {
			const engine = SEARCH_ENGINES[key];
			if (!engine) return '';
			const label = engine.i18nKey ? window.i18n.getMessage(engine.i18nKey) : engine.name;
			return html`<option value=${key} ?selected=${current === key}>${label}</option>`;
		})}
			<option value="custom" ?selected=${current === 'custom'}>${window.i18n.getMessage('custom')}</option>
		`;
	}

	#renderImageSearchEngineOptions(current) {
		const { IMAGE_SEARCH_ENGINES, IMAGE_SEARCH_ENGINE_ORDER } = window.GestureConstants;
		const lang = window.i18n.getCurrentLanguage();
		const order = IMAGE_SEARCH_ENGINE_ORDER[lang] || IMAGE_SEARCH_ENGINE_ORDER['default'];
		const displayKeys = [...order];

		if (current && current !== 'custom' && !displayKeys.includes(current) && IMAGE_SEARCH_ENGINES[current]) {
			displayKeys.push(current);
		}

		return html`
			${displayKeys.map(key => {
			const engine = IMAGE_SEARCH_ENGINES[key];
			if (!engine) return '';
			const label = engine.i18nKey ? window.i18n.getMessage(engine.i18nKey) : engine.name;
			return html`<option value=${key} ?selected=${current === key}>${label}</option>`;
		})}
			<option value="custom" ?selected=${current === 'custom'}>${window.i18n.getMessage('custom')}</option>
		`;
	}

	static #CUSTOM_NAME_FIELDS = ['customName', 'customNamePreferLink', 'customNameAutoDetectUrl'];

	#cleanConfig(cfg) {
		const { DRAG_ACTION_DEFAULTS } = window.GestureConstants;
		const defaults = DRAG_ACTION_DEFAULTS[cfg.action];

		const result = { direction: cfg.direction, action: cfg.action || 'none' };

		if (cfg.simple !== undefined) result.simple = !!cfg.simple;

		if (defaults) {
			for (const key of Object.keys(defaults)) {
				if (cfg[key] !== undefined) {
					if (typeof defaults[key] === 'string') {
						result[key] = String(cfg[key]);
					} else if (typeof defaults[key] === 'boolean') {
						result[key] = !!cfg[key];
					}
				}
			}
		}

		for (const field of DragGestureManager.#CUSTOM_NAME_FIELDS) {
			const val = (cfg[field] || '').trim();
			if (val) result[field] = val;
		}

		return result;
	}

	#updateRow(index, field, value) {
		const dragGestures = structuredClone(this.dragGestures);
		if (DragGestureManager.#CUSTOM_NAME_FIELDS.includes(field) && typeof value === 'string' && value.trim() === '') {
			delete dragGestures[index][field];
		} else {
			dragGestures[index][field] = value;
		}
		this.#dispatchChange(dragGestures);
	}

	#handleActionChange(index, value) {
		this.dispatchEvent(new CustomEvent('permission-check', {
			detail: { action: value },
			bubbles: true,
			composed: true,
		}));
		this.#updateRow(index, 'action', value);
	}

	#handleIncognitoChange(index, value) {
		if (value) {
			this.dispatchEvent(new CustomEvent('permission-check', {
				detail: { action: 'openInIncognito' },
				bubbles: true,
				composed: true,
			}));
		}
		this.#updateRow(index, 'incognito', value);
	}

	#handleEngineChange(index, value) {
		this.#updateRow(index, 'engine', value);
	}

	async #changeDirection(index) {
		const recorder = this.shadowRoot.getElementById('dragRecorder');
		if (!recorder) return;
		const result = await recorder.open({ button: 'left' });
		if (result.cancelled || !result.pattern) return;
		this.#updateRow(index, 'direction', result.pattern);
	}

	async #addRow() {
		const usedDirs = this.dragGestures.map(g => g.direction);
		const basicDirs = ['→', '↓', '←', '↑'];
		const freeBasic = basicDirs.find(d => !usedDirs.includes(d));

		let direction;
		if (freeBasic) {
			direction = freeBasic;
		} else {
			const recorder = this.shadowRoot.getElementById('dragRecorder');
			if (!recorder) return;
			const result = await recorder.open({ button: 'left' });
			if (result.cancelled || !result.pattern) return;
			direction = result.pattern;
		}

		const action = this.type === 'text' ? 'search' : 'openTab';
		const dragGestures = structuredClone(this.dragGestures);
		dragGestures.push({ direction, action, simple: true });
		this.#dispatchChange(dragGestures);
	}

	#toggleSecondary(index) {
		const dragGestures = structuredClone(this.dragGestures);
		dragGestures[index].simple = !dragGestures[index].simple;
		this.#dispatchChange(dragGestures);
	}

	#copyRow(index) {
		const dragGestures = structuredClone(this.dragGestures);
		const copy = structuredClone(dragGestures[index]);
		dragGestures.splice(index + 1, 0, copy);
		this.#dispatchChange(dragGestures);
	}

	#deleteRow(index) {
		const dragGestures = structuredClone(this.dragGestures);
		if (dragGestures.length <= 1) {
			dragGestures[index].direction = '→';
			dragGestures[index].action = 'none';
		} else {
			dragGestures.splice(index, 1);
		}
		this.#dispatchChange(dragGestures);
	}

	#dispatchChange(dragGestures) {
		const cleaned = dragGestures.map(cfg => this.#cleanConfig(cfg));
		this.dragGestures = cleaned;
		this.dispatchEvent(new CustomEvent('drag-gestures-change', {
			detail: { dragGestures: cleaned },
			bubbles: true,
			composed: true,
		}));
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('drag-gesture-manager', DragGestureManager);
});