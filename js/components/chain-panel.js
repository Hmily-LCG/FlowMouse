import { LitElement, html, css, unsafeHTML } from '../lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icon } from '../icons.js';
import { SettingsStore } from '../settings-store.js';
import { tooltip } from '../tooltip.js';

export function getChainLabel(chainId) {
	const i18n = window.i18n;
	if (!chainId) return i18n.getMessage('actionActionChain');
	const chain = (SettingsStore.current.actionChains || {})[chainId];
	if (!chain) return i18n.getMessage('chainNotFound');
	const steps = chain.steps?.length || 0;
	const stepsLabel = (steps === 1
		? i18n.getMessage('chainStepCountOne')
		: i18n.getMessage('chainStepCount')).replace('%count%', steps);
	const displayName = chain.name || i18n.getMessage('actionActionChain');
	return `${displayName} (${stepsLabel})`;
}

class ChainPanel extends LitElement {

	static properties = {
		selectedChainId: { type: String },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: 14px;
			}

			.empty-state {
				display: flex;
				align-items: center;
				justify-content: center;
				min-height: 57px;
				color: var(--text-muted);
				font-size: 13px;
				border: 1px dashed var(--border-color);
				border-radius: 8px;
				padding: 10px;
				text-align: center;
			}

			.selector-row {
				display: flex;
				align-items: center;
				gap: 6px;
			}

			.chain-select {
				flex: 1;
				min-width: 0;
			}

			.name-field {
				display: flex;
				flex-direction: column;
				gap: 9px;
			}
			.name-label {
				font-size: 12px;
				font-weight: 600;
				color: var(--text-secondary);
			}
			input.name-input {
				width: 100%;
			}

			.steps-container {
				display: flex;
				flex-direction: column;
				gap: 6px;
				padding: 4px 0;
				margin: -4px 0;
			}

			.step-row {
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 5px 6px;
				border-radius: 8px;
				box-shadow: 0 0 0 0.75px var(--border-color);
				background: var(--card-bg);
				position: relative;
			}
			.step-row.drag-indicator-before::before,
			.step-row.drag-indicator-after::after {
				content: '';
				position: absolute;
				left: 6px;
				right: 6px;
				height: 2px;
				background: var(--accent-color);
				border-radius: 1px;
				pointer-events: none;
			}
			.step-row.drag-indicator-before::before {
				top: -4px;
			}
			.step-row.drag-indicator-after::after {
				bottom: -4px;
			}

			.step-grip {
				display: flex;
				align-items: center;
				align-self: stretch;
				color: var(--text-muted);
				cursor: grab;
				flex-shrink: 0;
				opacity: 0.5;
				transition: opacity 0.15s;
			}
			.step-grip:hover {
				opacity: 1;
			}
			.step-grip svg {
				width: 14px;
				height: 14px;
			}

			.step-number {
				font-size: 11px;
				font-weight: 700;
				color: var(--text-muted);
				min-width: 16px;
				text-align: center;
				flex-shrink: 0;
				user-select: none;
			}

			.step-action {
				flex: 1;
				min-width: 0;
			}

			.step-buttons {
				display: flex;
				align-items: center;
				gap: 2px;
				flex-shrink: 0;
			}

			.step-copy,
			.step-delete {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				border: none;
				background: transparent;
				color: var(--text-muted);
				cursor: pointer;
				padding: 4px;
				border-radius: 4px;
				transition: background-color 0.15s ease, color 0.15s ease;
				flex-shrink: 0;
			}
			.step-copy:hover {
				color: var(--accent-color);
			}
			.step-delete:hover {
				color: var(--danger-color);
			}
			.step-copy svg,
			.step-delete svg {
				width: 14px;
				height: 14px;
			}

			.empty-steps {
				display: flex;
				align-items: center;
				justify-content: center;
				min-height: 42px;
				color: var(--text-muted);
				font-size: 12px;
				box-shadow: 0 0 0 0.75px var(--border-color);
				border-radius: 8px;
				padding: 8px;
				text-align: center;
			}

			.add-step-btn {
				align-self: flex-start;
			}
		`,
	];

	constructor() {
		super();
		this.selectedChainId = '';
		this._dragState = null;
		this._bootstrapped = false;
		this._onCatalogChanged = () => this.requestUpdate();
		this._unsubscribeStore = null;
	}

	get actionChains() {
		return SettingsStore.current.actionChains || {};
	}

	connectedCallback() {
		super.connectedCallback();
		window.addEventListener('action-catalog-changed', this._onCatalogChanged);
		this._unsubscribeStore = SettingsStore.onChange((changed) => {
			if ('actionChains' in changed) this.requestUpdate();
		});
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		window.removeEventListener('action-catalog-changed', this._onCatalogChanged);
		this._unsubscribeStore?.();
		this._unsubscribeStore = null;
	}

	willUpdate(changedProperties) {
		if (!this._bootstrapped) {
			this._bootstrapped = true;
			this.#ensureActiveChain();
		}
	}

	render() {
		const i18n = window.i18n;
		const entries = Object.entries(this.actionChains);
		const activeId = this.#resolveActiveId();
		const activeChain = activeId ? this.actionChains[activeId] : null;

		if (!entries.length || !activeChain) {
			return html``;
		}

		return html`
			${this.#renderSelectorRow(entries, activeId)}
			${this.#renderNameField(activeId, activeChain)}
			${this.#renderStepsSection(activeId, activeChain)}
		`;
	}

	#renderSelectorRow(entries, activeId) {
		const i18n = window.i18n;
		return html`
			<div class="selector-row">
				<select class="chain-select"
					@change=${(e) => this.#selectChain(e.target.value)}>
					${entries.map(([id, chain]) => {
						const steps = chain.steps?.length || 0;
						const stepsLabel = (steps === 1
							? i18n.getMessage('chainStepCountOne')
							: i18n.getMessage('chainStepCount')).replace('%count%', steps);
						const name = chain.name || i18n.getMessage('chainNamePlaceholder');
						return html`<option value=${id} ?selected=${id === activeId}>${name} (${stepsLabel})</option>`;
					})}
				</select>
				<button type="button" class="btn btn-ghost btn-icon-only selector-btn"
					.tooltip=${tooltip(i18n.getMessage('addChain'))}
					@click=${this.#addChain}>
					${unsafeHTML(icon('plus', { size: 14, strokeWidth: 2.5 }))}
				</button>
				<button type="button" class="btn btn-ghost btn-icon-only selector-btn"
					.tooltip=${tooltip(i18n.getMessage('duplicate'))}
					@click=${() => this.#copyChain(activeId)}>
					${unsafeHTML(icon('copy', { size: 14, strokeWidth: 2 }))}
				</button>
				<button type="button" class="btn btn-ghost btn-icon-only selector-btn danger"
					.tooltip=${tooltip(i18n.getMessage('delete'))}
					@click=${() => this.#deleteChain(activeId)}>
					${unsafeHTML(icon('trash2', { size: 14, strokeWidth: 2 }))}
				</button>
			</div>
		`;
	}

	#renderNameField(activeId, chain) {
		const i18n = window.i18n;
		return html`
			<div class="name-field">
				<span class="name-label">${i18n.getMessage('customHudName')}</span>
				<input class="name-input" type="text"
					.value=${chain.name || ''}
					placeholder=${i18n.getMessage('chainNamePlaceholder')}
					maxlength="80"
					@change=${(e) => this.#updateChain(activeId, { name: e.target.value })}
				>
			</div>
		`;
	}

	#renderStepsSection(activeId, chain) {
		const i18n = window.i18n;
		const steps = chain.steps || [];

		return html`
			<div class="steps-container"
				@dragenter=${(e) => this.#onContainerDragOver(e)}
				@dragover=${(e) => this.#onContainerDragOver(e)}
				@dragleave=${(e) => this.#onContainerDragLeave(e)}
				@drop=${(e) => this.#onContainerDrop(e)}
				@dragend=${() => this.#onStepDragEnd()}
			>
				${steps.length === 0 ? html`
					<div class="empty-steps">${i18n.getMessage('emptyChainSteps')}</div>
				` : steps.map((step, idx) => this.#renderStep(activeId, step, idx))}
			</div>
			<button class="btn btn-ghost add-step-btn" @click=${() => this.#addStep(activeId)}>
				${unsafeHTML(icon('plus', { size: 13, strokeWidth: 2.5 }))}
				<span>${i18n.getMessage('addStep')}</span>
			</button>
		`;
	}

	#renderStep(chainId, step, idx) {
		const i18n = window.i18n;
		const label = i18n.getMessage('stepNumber').replace('%n%', String(idx + 1));

		return html`
			<div class="step-row"
				@dragover=${(e) => this.#onStepDragOver(e, chainId, idx)}
			>
				<span class="step-grip" draggable="true"
					@dragstart=${(e) => this.#onStepDragStart(e, chainId, idx)}
				>${unsafeHTML(icon('gripVertical', { size: 14, strokeWidth: 2 }))}</span>
				<span class="step-number">${idx + 1}</span>
				<div class="step-action">
					<action-select
						compact
						context="chain-step"
						.value=${step.action || 'none'}
						.config=${step}
						.gestureLabel=${label}
						@action-change=${(e) => this.#onStepActionChange(chainId, idx, e.detail)}
					></action-select>
				</div>
				<div class="step-buttons">
					<button class="step-copy" @click=${() => this.#copyStep(chainId, idx)}
						.tooltip=${tooltip(i18n.getMessage('duplicate'))}>
						${unsafeHTML(icon('copy', { size: 14, strokeWidth: 2 }))}
					</button>
					<button class="step-delete" @click=${() => this.#deleteStep(chainId, idx)}
						.tooltip=${tooltip(i18n.getMessage('delete'))}>
						${unsafeHTML(icon('x', { size: 14, strokeWidth: 2.5 }))}
					</button>
				</div>
			</div>
		`;
	}


	#resolveActiveId() {
		const chains = this.actionChains;
		const ids = Object.keys(chains);
		if (!ids.length) return '';
		if (this.selectedChainId && chains[this.selectedChainId]) {
			return this.selectedChainId;
		}
		return ids[0];
	}

	#ensureActiveChain() {
		const chains = this.actionChains;
		if (this.selectedChainId && chains[this.selectedChainId]) return;

		const ids = Object.keys(chains);
		if (ids.length === 0) {
			this.#addChain();
		} else {
			this.#selectChain(ids[0]);
		}
	}


	#generateId() {
		return this.#generateIdFrom(this.actionChains);
	}

	#addChain() {
		const id = this.#generateId();
		const chains = { ...this.actionChains };
		const existingCount = Object.keys(chains).length;
		const defaultName = `${window.i18n.getMessage('chainNamePlaceholder')} ${existingCount + 1}`;
		chains[id] = { name: defaultName, steps: [] };
		this.#applyChains(chains, id);
	}

	#copyChain(id) {
		if (!id || !this.actionChains[id]) return;
		const newId = this.#generateId();
		const chains = {};
		for (const [key, val] of Object.entries(this.actionChains)) {
			chains[key] = val;
			if (key === id) chains[newId] = structuredClone(val);
		}
		this.#applyChains(chains, newId);
	}

	#deleteChain(id) {
		if (!id || !this.actionChains[id]) return;
		const i18n = window.i18n;
		const chain = this.actionChains[id];
		const stepCount = chain?.steps?.length || 0;
		if (stepCount > 0) {
			const name = chain?.name || i18n.getMessage('chainNamePlaceholder');
			if (!confirm(i18n.getMessage('deleteChainConfirm').replace('%name%', name))) return;
		}

		const chains = { ...this.actionChains };
		delete chains[id];

		let nextId = Object.keys(chains)[0] || '';
		if (!nextId) {
			nextId = this.#generateIdFrom(chains);
			const defaultName = `${i18n.getMessage('chainNamePlaceholder')} 1`;
			chains[nextId] = { name: defaultName, steps: [] };
		}
		this.#applyChains(chains, nextId);
	}

	#generateIdFrom(chains) {
		const existing = new Set(Object.keys(chains || {}));
		let id;
		do {
			const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
			id = `chain_${uuid}`;
		} while (existing.has(id));
		return id;
	}

	#updateChain(id, patch) {
		const chains = { ...this.actionChains };
		chains[id] = { ...chains[id], ...patch };
		this.#applyChains(chains, id);
	}

	#selectChain(id) {
		if (!id || !this.actionChains[id]) return;
		this.selectedChainId = id;
		this.dispatchEvent(new CustomEvent('chain-select', {
			detail: { chainId: id },
			bubbles: true,
			composed: false,
		}));
	}


	#addStep(chainId) {
		const chains = { ...this.actionChains };
		const chain = { ...chains[chainId] };
		chain.steps = [...(chain.steps || []), { action: 'none' }];
		chains[chainId] = chain;
		this.#applyChains(chains, chainId);
	}

	#deleteStep(chainId, idx) {
		const chains = { ...this.actionChains };
		const chain = { ...chains[chainId] };
		chain.steps = (chain.steps || []).filter((_, i) => i !== idx);
		chains[chainId] = chain;
		this.#applyChains(chains, chainId);
	}

	#copyStep(chainId, idx) {
		const chains = { ...this.actionChains };
		const chain = { ...chains[chainId] };
		const steps = [...(chain.steps || [])];
		const copiedStep = structuredClone(steps[idx]);
		steps.splice(idx + 1, 0, copiedStep);
		chain.steps = steps;
		chains[chainId] = chain;
		this.#applyChains(chains, chainId);
	}

	#onStepActionChange(chainId, idx, detail) {
		const chains = { ...this.actionChains };
		const chain = { ...chains[chainId] };
		chain.steps = [...(chain.steps || [])];
		chain.steps[idx] = { action: detail.action, ...(detail.config || {}) };
		chains[chainId] = chain;
		this.#applyChains(chains, chainId);
	}


	#onStepDragStart(e, chainId, idx) {
		this._dragState = { chainId, fromIdx: idx, active: true, overIdx: -1, position: null };
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', '');
		const row = e.currentTarget.closest('.step-row');
		if (row) row.style.opacity = '0.4';
	}

	#onStepDragOver(e, chainId, idx) {
		if (!this._dragState || this._dragState.chainId !== chainId) return;
		if (!this._dragState.active) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';

		const row = e.currentTarget;
		const rect = row.getBoundingClientRect();
		const position = (e.clientY - rect.top < rect.height / 2) ? 'before' : 'after';

		if (idx === this._dragState.fromIdx || (idx === this._dragState.overIdx && position === this._dragState.position)) return;

		this.#clearDropIndicators();
		this._dragState.overIdx = idx;
		this._dragState.position = position;
		row.classList.add(position === 'before' ? 'drag-indicator-before' : 'drag-indicator-after');
	}

	#onContainerDragOver(e) {
		if (!this._dragState?.active) return;
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer.dropEffect = 'move';
	}

	#onContainerDrop(e) {
		e.preventDefault();
		if (!this._dragState) return;
		const { chainId, fromIdx, overIdx, position } = this._dragState;
		if (overIdx < 0 || !position) return;
		this.#clearDropIndicators();
		this.#reorderSteps(chainId, fromIdx, overIdx, position);
	}

	#onStepDragEnd() {
		this._dragState = null;
		this.#clearDropIndicators();
		const rows = this.shadowRoot.querySelectorAll('.step-row');
		rows.forEach(r => r.style.opacity = '');
	}

	#reorderSteps(chainId, fromIdx, overIdx, position) {
		let insertIdx = position === 'before' ? overIdx : overIdx + 1;
		if (fromIdx < insertIdx) insertIdx--;
		if (fromIdx === insertIdx) return;

		const chains = { ...this.actionChains };
		const chain = { ...chains[chainId] };
		const steps = [...(chain.steps || [])];
		const [moved] = steps.splice(fromIdx, 1);
		steps.splice(insertIdx, 0, moved);
		chain.steps = steps;
		chains[chainId] = chain;
		this.#applyChains(chains, chainId);
	}

	#clearDropIndicators() {
		const rows = this.shadowRoot.querySelectorAll('.step-row');
		rows.forEach(r => r.classList.remove('drag-indicator-before', 'drag-indicator-after'));
	}

	#onContainerDragLeave(e) {
		if (!this._dragState) return;
		const container = e.currentTarget;
		if (!e.relatedTarget || !container.contains(e.relatedTarget)) {
			this.#clearDropIndicators();
			this._dragState.overIdx = -1;
			this._dragState.position = null;
		}
	}


	#applyChains(chains, activeId) {
		if (activeId && activeId !== this.selectedChainId) {
			this.selectedChainId = activeId;
			this.dispatchEvent(new CustomEvent('chain-select', {
				detail: { chainId: activeId },
				bubbles: true,
				composed: false,
			}));
		}
		SettingsStore.save({ actionChains: chains });
		window.dispatchEvent(new Event('action-catalog-changed'));
	}

	updated() {
		const select = this.shadowRoot?.querySelector('select.chain-select');
		const activeId = this.#resolveActiveId();
		if (select && activeId && select.value !== activeId) {
			select.value = activeId;
		}
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('chain-panel', ChainPanel);
});