import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icon } from '../icons.js';
import { tooltip } from '../tooltip.js';

class GestureGrid extends LitElement {
	static properties = {
		mouseGestures: { type: Object },
		advancedMode: { type: Boolean, attribute: 'advanced-mode' },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
			}

			.gesture-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
				gap: 10px;
				margin-top: 2px;
				margin-bottom: 18px;
			}

			.gesture-item {
				position: relative;
				background: var(--bg-tertiary);
				border-radius: 8px;
				padding: 8px;
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.gesture-item .gesture-pattern {
				font-size: 1.2em;
				margin-block: 2px;
				text-align: center;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				max-width: 100%;
			}

			.gesture-desc {
				font-size: 0.8em;
				vertical-align: 0.05em;
				color: var(--text-secondary);
				font-weight: normal;
				margin-inline-start: 4px;
			}

			.gesture-item .reset-btn,
			.gesture-item .delete-gesture-btn {
				position: absolute;
				top: 6px;
				inset-inline-end: 6px;
				width: 18px;
				height: 18px;
				border: none;
				border-radius: 50%;
				cursor: pointer;
				font-size: 12px;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				transition: color 0.2s;
				z-index: 1;
			}

			.gesture-item .reset-btn {
				background: transparent;
				color: var(--text-muted);
			}

			.gesture-item .reset-btn:hover {
				color: var(--accent-color);
			}

			.gesture-item .delete-gesture-btn {
				background: transparent;
				color: var(--text-muted);
				font-size: 14px;
			}

			.gesture-item .delete-gesture-btn:hover {
				color: var(--danger-color);
			}

			.gesture-item.modified {
			}

			.gesture-item.none {
				background: color-mix(in srgb, var(--bg-tertiary) 50%, transparent);
			}

			.gesture-item.none .gesture-pattern {
				opacity: .4;
			}

			.gesture-item.custom {
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
		'→←': 'gestureDesc_RL'
	};

	constructor() {
		super();
		this.mouseGestures = {};
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
			</div>
		`;
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
				${isCustom ? html`
					<button class="delete-gesture-btn" @click=${() => this.#handleDelete(pattern)}
						.tooltip=${tooltip(window.i18n.getMessage('deleteGesture'))}
						style="display: inline-flex">${unsafeHTML(icon('x', { size: 14, strokeWidth: 2.5 }))}</button>
				` : html`
					<button class="reset-btn" @click=${() => this.#handleReset(pattern)}
						.tooltip=${tooltip(window.i18n.getMessage('resetToDefault'))}
						style="display: ${isModified ? 'inline-flex' : 'none'}">${unsafeHTML(icon('rotateCcw', { size: 13, strokeWidth: 2.5 }))}</button>
					<button class="delete-gesture-btn" @click=${() => this.#handleClear(pattern)}
						.tooltip=${tooltip(window.i18n.getMessage('deleteGesture'))}
						style="display: ${(!isModified && currentAction !== 'none') ? 'inline-flex' : 'none'}">${unsafeHTML(icon('x', { size: 14, strokeWidth: 2.5 }))}</button>
				`}
				<div class="gesture-pattern" title="${pattern} ${desc}">
					${unsafeHTML(patternSvg)} <span class="gesture-desc">${desc}</span>
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

		const newMouseGestures = { ...this.mouseGestures };
		newMouseGestures[pattern] = { action, ...config };

		this.mouseGestures = newMouseGestures;

		this.dispatchEvent(new CustomEvent('gestures-change', {
			detail: { mouseGestures: newMouseGestures },
			bubbles: true,
			composed: true,
		}));
	}

	#handleReset(pattern) {
		const { DEFAULT_GESTURES } = window.GestureConstants;
		const defaultAction = DEFAULT_GESTURES[pattern] || 'none';

		const newMouseGestures = { ...this.mouseGestures };
		newMouseGestures[pattern] = { action: defaultAction };

		this.mouseGestures = newMouseGestures;

		this.dispatchEvent(new CustomEvent('gestures-change', {
			detail: { mouseGestures: newMouseGestures },
			bubbles: true,
			composed: true,
		}));
	}

	#handleClear(pattern) {
		const newMouseGestures = { ...this.mouseGestures };
		newMouseGestures[pattern] = { action: 'none' };

		this.mouseGestures = newMouseGestures;

		this.dispatchEvent(new CustomEvent('gestures-change', {
			detail: { mouseGestures: newMouseGestures },
			bubbles: true,
			composed: true,
		}));
	}

	openActionSelect(pattern) {
		this.updateComplete.then(() => {
			const el = this.shadowRoot.querySelector(`action-select[data-pattern="${pattern}"]`);
			if (el) el.open();
		});
	}

	#handleDelete(pattern) {
		if (!confirm(window.i18n.getMessage('deleteGestureConfirm').replace('%pattern%', pattern))) {
			return;
		}

		this.dispatchEvent(new CustomEvent('gesture-delete', {
			detail: { pattern },
			bubbles: true,
			composed: true,
		}));
	}
}

customElements.define('gesture-grid', GestureGrid);