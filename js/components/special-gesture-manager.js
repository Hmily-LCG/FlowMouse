import { LitElement, html, css, unsafeHTML } from '../lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icons, icon } from '../icons.js'; 

const SPECIAL_GESTURE_KEYS = {
	'leftClickHoldingRight': 'specialGesture_leftClickHoldingRight',
	'rightClickHoldingLeft': 'specialGesture_rightClickHoldingLeft',
};

const SPECIAL_GESTURE_ICONS = {
	'leftClickHoldingRight': 'mouseLeft',
	'rightClickHoldingLeft': 'mouseRight',
};

class SpecialGestureManager extends LitElement {

	static properties = {
		specialGestures: { type: Object },
		enableSpecialGestures: { type: Boolean },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
			}
			.special-gesture-rows-container {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.special-gesture-row {
				display: flex;
				align-items: center;
				gap: 10px;
				padding: 8px;
				border-radius: 10px;
				border: 1px solid var(--border-color);
				background: var(--bg-secondary);
			}
			.special-gesture-icon {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 34px;
				height: 34px;
				border-radius: 8px;
				border: 1px solid var(--border-color);
				background: var(--card-bg);
				color: var(--text-color);
				flex-shrink: 0;
			}
			.special-gesture-icon svg {
				width: 18px;
				height: 18px;
			}
			.special-gesture-label {
				flex: 1;
				min-width: 0;
				font-size: 13px;
				font-weight: 600;
				color: var(--text-primary);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.special-gesture-action {
				flex-shrink: 0;
				min-width: 160px;
				max-width: 300px;
			}
			.reset-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				border: none;
				background: transparent;
				color: var(--text-muted);
				cursor: pointer;
				border-radius: 4px;
				transition: background 0.15s ease, color 0.15s ease;
				flex-shrink: 0;
			}
			.reset-btn:hover {
				background: var(--hover-bg);
				color: var(--accent-color);
			}
		`,
	];

	constructor() {
		super();
		this.specialGestures = {};
		this.enableSpecialGestures = false;
	}

	render() {
		const entries = Object.entries(this.specialGestures || {})
			.filter(([key]) => key in SPECIAL_GESTURE_KEYS);

		return html`
			<div class="special-gesture-rows-container">
				${entries.map(([key, config]) => this.#renderRow(key, config))}
			</div>
		`;
	}

	#renderRow(key, config) {
		const i18n = window.i18n;
		const iconName = SPECIAL_GESTURE_ICONS[key];
		const label = i18n.getMessage(SPECIAL_GESTURE_KEYS[key] || key);
		const { DEFAULT_SETTINGS } = window.GestureConstants;
		const defaultConfig = DEFAULT_SETTINGS.specialGestures?.[key] || { action: 'none' };
		const isModified = this.#isModified(config, defaultConfig);

		return html`
			<div class="special-gesture-row">
				${iconName && icons[iconName] ? html`
					<span class="special-gesture-icon">${unsafeHTML(icons[iconName])}</span>
				` : ''}
				<span class="special-gesture-label">${label}</span>
				<button class="reset-btn" @click=${() => this.#handleReset(key)}
					title=${i18n.getMessage('resetToDefault')}
					style="display: ${isModified ? 'inline-flex' : 'none'}">${unsafeHTML(icon('rotateCcw', { size: 13, strokeWidth: 2.5 }))}</button>
				<div class="special-gesture-action">
					<action-select
						.value=${config.action || 'none'}
						.config=${config}
						.gestureLabel=${label}
						@action-change=${e => this.#onActionChange(key, e.detail)}
						@permission-check=${this.#onPermissionCheck}
					></action-select>
				</div>
			</div>
		`;
	}

	#onActionChange(key, detail) {
		const specialGestures = { ...(this.specialGestures || {}) };
		specialGestures[key] = { ...specialGestures[key], action: detail.action, ...detail.config };
		this.dispatchEvent(new CustomEvent('special-gestures-change', {
			detail: { specialGestures },
			bubbles: true,
			composed: true,
		}));
	}

	#onPermissionCheck(e) {
		this.dispatchEvent(new CustomEvent('permission-check', {
			detail: e.detail,
			bubbles: true,
			composed: true,
		}));
	}

	#isModified(config, defaultConfig) {
		if (config.action !== defaultConfig.action) return true;
		const configKeys = Object.keys(config).filter(k => k !== 'action');
		return configKeys.length > 0;
	}

	#handleReset(key) {
		const { DEFAULT_SETTINGS } = window.GestureConstants;
		const defaultConfig = DEFAULT_SETTINGS.specialGestures?.[key] || { action: 'none' };
		const specialGestures = { ...(this.specialGestures || {}) };
		specialGestures[key] = { ...defaultConfig };
		this.dispatchEvent(new CustomEvent('special-gestures-change', {
			detail: { specialGestures },
			bubbles: true,
			composed: true,
		}));
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('special-gesture-manager', SpecialGestureManager);
});