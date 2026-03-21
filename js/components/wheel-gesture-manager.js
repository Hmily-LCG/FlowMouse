import { LitElement, html, css, unsafeHTML } from '../lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icons, icon } from '../icons.js'; 

const WHEEL_GESTURE_KEYS = {
	'scrollUpHoldingRight': 'wheelGesture_scrollUpHoldingRight',
	'scrollDownHoldingRight': 'wheelGesture_scrollDownHoldingRight',
};

const WHEEL_GESTURE_ICONS = {
	'scrollUpHoldingRight': 'chevronUp',
	'scrollDownHoldingRight': 'chevronDown',
};

class WheelGestureManager extends LitElement {

	static properties = {
		wheelGestures: { type: Object },
		enableWheelGestures: { type: Boolean },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
			}
			.wheel-gesture-rows-container {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.wheel-gesture-row {
				display: flex;
				align-items: center;
				gap: 10px;
				padding: 8px;
				border-radius: 10px;
				border: 1px solid var(--border-color);
				background: var(--bg-secondary);
			}
			.wheel-gesture-icon {
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
			.wheel-gesture-icon svg {
				width: 18px;
				height: 18px;
			}
			.wheel-gesture-label {
				flex: 1;
				min-width: 0;
				font-size: 13px;
				font-weight: 600;
				color: var(--text-primary);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.wheel-gesture-action {
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
		this.wheelGestures = {};
		this.enableWheelGestures = false;
	}

	render() {
		const entries = Object.entries(this.wheelGestures || {})
			.filter(([key]) => key in WHEEL_GESTURE_KEYS);

		return html`
			<div class="wheel-gesture-rows-container">
				${entries.map(([key, config]) => this.#renderRow(key, config))}
			</div>
		`;
	}

	#renderRow(key, config) {
		const i18n = window.i18n;
		const iconName = WHEEL_GESTURE_ICONS[key];
		const label = i18n.getMessage(WHEEL_GESTURE_KEYS[key] || key);
		const { DEFAULT_SETTINGS } = window.GestureConstants;
		const defaultConfig = DEFAULT_SETTINGS.wheelGestures?.[key] || { action: 'none' };
		const isModified = this.#isModified(config, defaultConfig);

		return html`
			<div class="wheel-gesture-row">
				${iconName && icons[iconName] ? html`
					<span class="wheel-gesture-icon">${unsafeHTML(icons[iconName])}</span>
				` : ''}
				<span class="wheel-gesture-label">${label}</span>
				<button class="reset-btn" @click=${() => this.#handleReset(key)}
					title=${i18n.getMessage('resetToDefault')}
					style="display: ${isModified ? 'inline-flex' : 'none'}">${unsafeHTML(icon('rotateCcw', { size: 13, strokeWidth: 2.5 }))}</button>
				<div class="wheel-gesture-action">
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
		const wheelGestures = { ...(this.wheelGestures || {}) };
		wheelGestures[key] = { ...wheelGestures[key], action: detail.action, ...detail.config };
		this.dispatchEvent(new CustomEvent('wheel-gestures-change', {
			detail: { wheelGestures },
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
		const defaultConfig = DEFAULT_SETTINGS.wheelGestures?.[key] || { action: 'none' };
		const wheelGestures = { ...(this.wheelGestures || {}) };
		wheelGestures[key] = { ...defaultConfig };
		this.dispatchEvent(new CustomEvent('wheel-gestures-change', {
			detail: { wheelGestures },
			bubbles: true,
			composed: true,
		}));
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('wheel-gesture-manager', WheelGestureManager);
});