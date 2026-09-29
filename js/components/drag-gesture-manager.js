import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icon } from '../icons.js';
import { tooltip } from '../directives/tooltip.js';
import { fitText } from '../directives/fit-text.js';

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

			.gesture-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
				gap: 10px;
				margin-top: 2px;
				margin-bottom: 16px;
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

			.gesture-item.none {
				background: color-mix(in srgb, var(--bg-tertiary) 50%, transparent);
			}

			.gesture-item.none .direction-btn {
				opacity: .4;
			}

			.gesture-item .direction-btn {
				box-shadow: 0 0 0 0.75px transparent;
			}

			.gesture-item:hover .direction-btn:not(:hover) {
				box-shadow: 0 0 0 0.75px var(--border-color);
			}

			.direction-btn {
				color: var(--text-primary);
				align-self: center;
				min-width: 50px;
				max-width: calc(100% - 52px);
				overflow: hidden;
				text-overflow: ellipsis;
				padding-block: 3px;
			}

			.gesture-icon-wrap {
				font-size: 16.8px;
				display: flex;
				align-items: center;
				min-height: 1lh;
			}

			.item-tools {
				position: absolute;
				top: 6px;
				inset-inline-end: 6px;
				display: flex;
				align-items: center;
				gap: 2px;
				z-index: 1;
			}

			.drag-delete-btn {
				width: 18px;
				height: 18px;
				border: none;
				border-radius: 50%;
				background: transparent;
				color: var(--text-muted);
				cursor: pointer;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 0;
				opacity: 0;
				transition: color 0.2s, opacity 0.15s;
			}

			.gesture-item:hover .drag-delete-btn,
			.drag-delete-btn:focus-visible {
				opacity: 1;
			}

			.drag-delete-btn:hover {
				color: var(--danger-color);
			}

			.drag-add-group {
				display: flex;
				flex-direction: column;
				gap: 6px;
				min-height: 80px;
			}

			.drag-add-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 6px;
				min-width: 0;
				border-radius: 8px;
				font-size: 13px;
			}

			.drag-add-btn.main {
				flex: 1;
			}

			.drag-add-btn svg,
			.drag-add-btn .gesture-icon-wrap {
				flex-shrink: 0;
			}

			.drag-add-btn .gesture-icon-wrap {
				font-size: 16px;
				min-height: 0;
			}
		`,
	];

	constructor() {
		super();
		this.type = 'text';
		this.dragGestures = [];
		this.advancedMode = false;
	}

	render() {
		const dragGestures = structuredClone(this.dragGestures);
		const hasFallback = dragGestures.some(g => g.direction === '*');

		return html`
			<div class="gesture-grid">
				${dragGestures.map((cfg, index) => this.#renderItem(cfg, index))}
				<div class="drag-add-group">
					<button type="button" class="btn btn-dashed drag-add-btn main" @click=${this.#addRow}>
						${unsafeHTML(icon('plus', { size: 16, strokeWidth: 2 }))}
						<span ${fitText()}>${window.i18n.getMessage('add')}</span>
					</button>
					${hasFallback || !this.advancedMode ? '' : html`
						<button type="button" class="btn btn-dashed drag-add-btn" @click=${this.#addFallback}
							.tooltip=${tooltip(window.i18n.getMessage('fallbackGestureTip'))}>
							<span class="gesture-icon-wrap">${unsafeHTML(window.GestureConstants.arrowsToSvg('*'))}</span>
							<span ${fitText()}>${window.i18n.getMessage('gestureRecorderAny')}</span>
						</button>
					`}
				</div>
			</div>
			<gesture-recorder id="dragRecorder" data-gesture-ignore></gesture-recorder>
		`;
	}

	#renderItem(cfg, index) {
		const action = cfg.action || 'none';
		const direction = cfg.direction || '→';
		const isNone = action === 'none';
		const isFallback = direction === '*';

		return html`
			<div class="gesture-item ${isNone ? 'none' : ''}">
				<div class="item-tools">
					${this.dragGestures.length > 1 || !isNone ? html`
						<button type="button" class="drag-delete-btn"
							@click=${() => this.#deleteRow(index)}
							.tooltip=${tooltip(window.i18n.getMessage('delete'))}>${unsafeHTML(icon('x', { size: 14, strokeWidth: 2.5 }))}</button>
					` : ''}
				</div>
				<button type="button" class="btn btn-ghost direction-btn" title=${isFallback ? '' : direction}
					.tooltip=${tooltip(isFallback ? window.i18n.getMessage('fallbackGestureTip') : '')}
					@click=${() => this.#changeDirection(index)}>
					<span class="gesture-icon-wrap">${unsafeHTML(window.GestureConstants.arrowsToSvg(direction))}</span>
				</button>
				<action-select
					drag-type=${this.type}
					.value=${action}
					.config=${cfg}
					.gestureArrows=${direction}
					data-index=${index}
					@action-change=${(e) => this.#onActionChange(index, e)}
				></action-select>
			</div>
		`;
	}

	#occupiedDirections(excludeIndex = -1) {
		return this.dragGestures
			.map((g, i) => (i === excludeIndex ? null : g.direction))
			.filter(Boolean);
	}

	#onActionChange(index, e) {
		const { action, config } = e.detail;
		this.dispatchEvent(new CustomEvent('permission-check', {
			detail: { action },
			bubbles: true,
			composed: true,
		}));
		if (config?.incognito) {
			this.dispatchEvent(new CustomEvent('permission-check', {
				detail: { action: 'openInIncognito' },
				bubbles: true,
				composed: true,
			}));
		}

		const dragGestures = structuredClone(this.dragGestures);
		const prev = dragGestures[index];
		dragGestures[index] = { direction: prev.direction, action, ...config };
		this.#dispatchChange(dragGestures);
	}

	async #changeDirection(index) {
		const recorder = this.shadowRoot.getElementById('dragRecorder');
		if (!recorder) return;
		const result = await recorder.open({
			button: 'left',
			allowAny: this.advancedMode,
			bannedPatterns: this.#occupiedDirections(index),
		});
		if (result.cancelled || !result.pattern) return;
		const dragGestures = structuredClone(this.dragGestures);
		dragGestures[index].direction = result.pattern;
		this.#dispatchChange(dragGestures);
	}

	async #addRow() {
		const recorder = this.shadowRoot.getElementById('dragRecorder');
		if (!recorder) return;
		const result = await recorder.open({
			button: 'left',
			bannedPatterns: this.#occupiedDirections(),
		});
		if (result.cancelled || !result.pattern) return;
		this.#pushGesture(result.pattern);
	}

	#addFallback() {
		if (this.#occupiedDirections().includes('*')) return;
		this.#pushGesture('*');
	}

	#pushGesture(direction) {
		const dragGestures = structuredClone(this.dragGestures);
		dragGestures.push({ direction, action: 'none' });
		const index = dragGestures.length - 1;
		this.#dispatchChange(dragGestures);
		this.#openActionSelect(index);
	}

	#openActionSelect(index) {
		this.updateComplete.then(() => {
			this.shadowRoot.querySelector(`action-select[data-index="${index}"]`)?.open();
		});
	}

	#deleteRow(index) {
		const pattern = this.dragGestures[index]?.direction || '→';
		if (!confirm(window.i18n.getMessage('deleteGestureConfirm').replace('%pattern%', pattern))) {
			return;
		}

		const dragGestures = structuredClone(this.dragGestures);
		if (dragGestures.length <= 1) {
			dragGestures[index] = { direction: '→', action: 'none' };
		} else {
			dragGestures.splice(index, 1);
		}
		this.#dispatchChange(dragGestures);
	}

	#dispatchChange(dragGestures) {
		this.dragGestures = dragGestures;
		this.dispatchEvent(new CustomEvent('drag-gestures-change', {
			detail: { dragGestures },
			bubbles: true,
			composed: true,
		}));
	}
}

customElements.define('drag-gesture-manager', DragGestureManager);