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
				<div class="gesture-add-group">
					<button type="button" class="btn btn-dashed gesture-add-btn" @click=${this.#addRow}>
						${unsafeHTML(icon('plus', { size: 16, strokeWidth: 2 }))}
						<span ${fitText()}>${window.i18n.getMessage('add')}</span>
					</button>
					${hasFallback || !this.advancedMode ? '' : html`
						<button type="button" class="btn btn-dashed gesture-add-btn secondary" @click=${this.#addFallback}
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
				<div class="gesture-item-header">
					<button type="button" class="gesture-pattern"
						.tooltip=${tooltip(window.i18n.getMessage(isFallback ? 'fallbackGestureTip' : 'redrawGesture'))}
						@click=${() => this.#changeDirection(index)}>
						<span class="gesture-pattern-arrows">${unsafeHTML(window.GestureConstants.arrowsToSvg(direction))}</span>
						<span class="gesture-pattern-edit">${unsafeHTML(icon('pencil', { size: 11, strokeWidth: 2.2 }))}</span>
					</button>
					<dropdown-menu
						label=${window.i18n.getMessage('moreOptions')}
						.items=${this.#getMenuItems(isNone)}
						@menu-select=${(e) => this.#onMenuSelect(index, e)}
					></dropdown-menu>
				</div>
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

	#getMenuItems(isNone) {
		const t = key => window.i18n.getMessage(key);
		return [
			{ id: 'redrawGesture', label: t('redrawGesture'), icon: 'pencil' },
			{ id: 'editAction', label: t('editAction'), icon: 'settings' },
			{ type: 'separator' },
			{ id: 'delete', label: t('delete'), icon: 'trash2', danger: true, disabled: this.dragGestures.length <= 1 && isNone },
		];
	}

	#onMenuSelect(index, e) {
		switch (e.detail.id) {
			case 'redrawGesture': return this.#changeDirection(index);
			case 'editAction': return this.#openActionSelect(index);
			case 'delete': return this.#deleteRow(index);
		}
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