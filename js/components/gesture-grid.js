import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icon } from '../icons.js';
import { tooltip } from '../directives/tooltip.js';
import { fitText } from '../directives/fit-text.js';

class GestureGrid extends LitElement {
	static properties = {
		mouseGestures: { type: Object },
		advancedMode: { type: Boolean, attribute: 'advanced-mode' },
		allowFallback: { type: Boolean, attribute: 'allow-fallback' },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
			}
		`,
	];

	static GESTURE_DESC_KEYS = {
		'←': 'gestureDesc_L',
		'→': 'gestureDesc_R',
		'↑': 'gestureDesc_U',
		'↓': 'gestureDesc_D',
		'↓→': 'gestureDesc_DR',
		'←↑': 'gestureDesc_LU',
		'→↑': 'gestureDesc_RU',
		'→↓': 'gestureDesc_RD',
		'↑←': 'gestureDesc_UL',
		'↑→': 'gestureDesc_UR',
		'↓←': 'gestureDesc_DL',
		'←↓': 'gestureDesc_LD',
		'↑↓': 'gestureDesc_UD',
		'↓↑': 'gestureDesc_DU',
		'←→': 'gestureDesc_LR',
		'→←': 'gestureDesc_RL',
		'*': 'gestureDesc_Any',
	};

	constructor() {
		super();
		this.mouseGestures = {};
		this.advancedMode = false;
		this.allowFallback = false;
	}

	#getFullGestures() {
		const result = {};
		for (const [pattern, config] of Object.entries(this.mouseGestures)) {
			result[pattern] = config.action;
		}
		return result;
	}

	render() {
		const gestures = this.#getFullGestures();
		const patterns = Object.keys(this.mouseGestures);

		return html`
			<div class="gesture-grid">
				${patterns.map(pattern => this.#renderItem(pattern, gestures))}
				<div class="gesture-add-group">
					<button type="button" class="btn btn-dashed gesture-add-btn" @click=${this.#handleAdd}>
						${unsafeHTML(icon('plus', { size: 16, strokeWidth: 2 }))}
						<span ${fitText()}>${window.i18n.getMessage('addCustomGesture')}</span>
					</button>
					${this.#canUseFallback() && !patterns.includes('*') ? html`
						<button type="button" class="btn btn-dashed gesture-add-btn secondary" @click=${this.#handleAddFallback}
							.tooltip=${tooltip(window.i18n.getMessage('fallbackGestureTip'))}>
							<span class="gesture-icon-wrap">${unsafeHTML(window.GestureConstants.arrowsToSvg('*'))}</span>
							<span ${fitText()}>${window.i18n.getMessage('gestureRecorderAny')}</span>
						</button>
					` : ''}
				</div>
			</div>
			<gesture-recorder id="gestureRecorder" data-gesture-ignore></gesture-recorder>
		`;
	}

	async #recordPattern(excludePattern) {
		const recorder = this.shadowRoot.getElementById('gestureRecorder');
		if (!recorder) return null;

		const { DEFAULT_GESTURES } = window.GestureConstants;
		const bannedPatterns = Array.from(new Set([
			...Object.keys(DEFAULT_GESTURES),
			...Object.keys(this.mouseGestures),
		])).filter(p => p !== excludePattern);
		const result = await recorder.open({ button: 'right', bannedPatterns, allowAny: this.#canUseFallback() });
		return result.cancelled ? null : result.pattern || null;
	}

	#canUseFallback() {
		return this.allowFallback && this.advancedMode;
	}

	async #handleAdd() {
		this.#pushGesture(await this.#recordPattern());
	}

	#handleAddFallback() {
		if (!('*' in this.mouseGestures)) this.#pushGesture('*');
	}

	#pushGesture(pattern) {
		if (!pattern) return;
		this.#dispatchChange({ ...this.mouseGestures, [pattern]: { action: 'none' } });
		this.#openActionSelect(pattern);
	}

	async #handleEditPattern(pattern) {
		const newPattern = await this.#recordPattern(pattern);
		if (!newPattern || newPattern === pattern) return;
		this.#dispatchChange(Object.fromEntries(
			Object.entries(this.mouseGestures).map(([p, cfg]) => [p === pattern ? newPattern : p, cfg])
		));
	}

	#getMenuItems({ isCustom, isModified, isNone }) {
		const t = key => window.i18n.getMessage(key);
		return [
			{ id: 'redrawGesture', label: t('redrawGesture'), icon: 'pencil', hidden: !isCustom },
			{ id: 'editAction', label: t('editAction'), icon: 'settings' },
			{ type: 'separator' },
			{ id: 'resetToDefault', label: t('resetToDefault'), icon: 'rotateCcw', danger: true, hidden: isCustom, disabled: !isModified },
			{ id: 'delete', label: t('delete'), icon: 'trash2', danger: true, disabled: !isCustom && isNone },
		];
	}

	#handleMenuSelect(pattern, isCustom, e) {
		switch (e.detail.id) {
			case 'redrawGesture': return this.#handleEditPattern(pattern);
			case 'editAction': return this.#openActionSelect(pattern);
			case 'resetToDefault': return this.#handleReset(pattern);
			case 'delete': return isCustom ? this.#handleDelete(pattern) : this.#handleClear(pattern);
		}
	}

	#dispatchChange(mouseGestures) {
		this.mouseGestures = mouseGestures;
		this.dispatchEvent(new CustomEvent('gestures-change', {
			detail: { mouseGestures },
			bubbles: true,
			composed: true,
		}));
	}

	#renderItem(pattern, gestures) {
		const { DEFAULT_GESTURES } = window.GestureConstants;
		const currentAction = gestures[pattern] || DEFAULT_GESTURES[pattern] || 'none';
		const defaultAction = DEFAULT_GESTURES[pattern] || 'none';
		const isCustom = !DEFAULT_GESTURES[pattern];
		const entryConfig = this.mouseGestures[pattern] || {};
		const hasCustomConfig = Object.keys(entryConfig).some(k => k !== 'action');
		const isNone = currentAction === 'none';
		const isModified = !isCustom && (currentAction !== defaultAction || hasCustomConfig);
		const descKey = GestureGrid.GESTURE_DESC_KEYS[pattern];
		const desc = descKey
			? window.i18n.getMessage(descKey)
			: (isCustom ? window.i18n.getMessage('customGesture') : '');
		const patternSvg = window.GestureConstants.arrowsToSvg(pattern);

		return html`
			<div class="gesture-item ${isModified && !isNone ? 'modified' : ''} ${isCustom ? 'custom' : ''} ${isNone ? 'none' : ''}">
				<div class="gesture-item-header">
					<button type="button" class="gesture-pattern" aria-disabled=${isCustom ? 'false' : 'true'}
						.tooltip=${tooltip(pattern === '*' ? window.i18n.getMessage('fallbackGestureTip') : isCustom ? window.i18n.getMessage('redrawGesture') : desc)}
						@click=${() => isCustom && this.#handleEditPattern(pattern)}>
						<span class="gesture-pattern-arrows">${unsafeHTML(patternSvg)}</span>
						${isCustom ? html`<span class="gesture-pattern-edit">${unsafeHTML(icon('pencil', { size: 11, strokeWidth: 2.2 }))}</span>` : ''}
					</button>
					<dropdown-menu
						label=${window.i18n.getMessage('moreOptions')}
						.items=${this.#getMenuItems({ isCustom, isModified, isNone })}
						@menu-select=${(e) => this.#handleMenuSelect(pattern, isCustom, e)}
					></dropdown-menu>
				</div>
				<action-select
					.value=${currentAction}
					.config=${entryConfig}
					.gestureArrows=${pattern}
					.gestureLabel=${desc}
					allow-custom-name
					data-pattern=${pattern}
					@action-change=${(e) => this.#handleActionChange(pattern, e)}
				></action-select>
			</div>
		`;
	}

	#handleActionChange(pattern, e) {
		const { action, config } = e.detail;

		this.dispatchEvent(new CustomEvent('permission-check', {
			detail: { action },
			bubbles: true,
			composed: true,
		}));

		this.#dispatchChange({ ...this.mouseGestures, [pattern]: { action, ...config } });
	}

	#handleReset(pattern) {
		const { DEFAULT_GESTURES } = window.GestureConstants;
		const defaultAction = DEFAULT_GESTURES[pattern] || 'none';
		this.#dispatchChange({ ...this.mouseGestures, [pattern]: { action: defaultAction } });
	}

	#handleClear(pattern) {
		this.#dispatchChange({ ...this.mouseGestures, [pattern]: { action: 'none' } });
	}

	#openActionSelect(pattern) {
		this.updateComplete.then(() => {
			this.shadowRoot.querySelector(`action-select[data-pattern="${pattern}"]`)?.open();
		});
	}

	#handleDelete(pattern) {

		this.dispatchEvent(new CustomEvent('gesture-delete', {
			detail: { pattern },
			bubbles: true,
			composed: true,
		}));
	}
}

customElements.define('gesture-grid', GestureGrid);