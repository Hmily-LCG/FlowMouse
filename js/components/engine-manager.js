import { LitElement, html, css, unsafeHTML } from '../lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icon } from '../icons.js';
import { SettingsStore } from '../settings-store.js';
import { tooltip } from '../tooltip.js';

class EngineManager extends LitElement {

	static properties = {
		_editingId: { state: true },
		_editingDraft: { state: true },
		_addingNew: { state: true },
		_newDraft: { state: true },
		_activeType: { state: true },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}

			.engine-list {
				display: flex;
				flex-direction: column;
				gap: 6px;
			}

			.engine-row {
				position: relative;
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 7px 8px;
				border-radius: 8px;
				box-shadow: 0 0 0 0.75px var(--border-color);
				background: var(--card-bg);
			}

			.engine-row.is-hidden {
				opacity: 0.5;
			}

			.engine-row.drag-indicator-before::before,
			.engine-row.drag-indicator-after::after {
				content: '';
				position: absolute;
				left: 6px;
				right: 6px;
				height: 2px;
				background: var(--accent-color);
				border-radius: 1px;
				pointer-events: none;
			}

			.engine-row.drag-indicator-before::before {
				top: -4px;
			}

			.engine-row.drag-indicator-after::after {
				bottom: -4px;
			}

			.engine-grip {
				display: flex;
				align-items: center;
				align-self: stretch;
				color: var(--text-muted);
				cursor: grab;
				flex-shrink: 0;
				opacity: 0.5;
				transition: opacity 0.15s;
			}

			.engine-grip:hover {
				opacity: 1;
			}

			.engine-grip svg {
				width: 14px;
				height: 14px;
			}

			.engine-icon {
				width: 20px;
				height: 20px;
				flex-shrink: 0;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.engine-icon img {
				width: 16px;
				height: 16px;
				object-fit: contain;
				border-radius: 3px;
			}

			.engine-icon svg {
				width: 16px;
				height: 16px;
				color: var(--text-muted);
			}

			.engine-info {
				flex: 1;
				min-width: 0;
				display: flex;
				flex-direction: column;
				gap: 2px;
			}

			.engine-name-row {
				display: flex;
				align-items: center;
				gap: 6px;
				min-width: 0;
			}

			.engine-name {
				font-size: 13px;
				font-weight: 500;
				color: var(--text-primary);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.engine-badge {
				flex-shrink: 0;
				font-size: 10px;
				padding: 1px 5px;
				border-radius: 10px;
				background: var(--bg-tertiary);
				color: var(--text-muted);
			}

			.engine-url {
				font-size: 11px;
				color: var(--text-muted);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.engine-buttons {
				display: flex;
				align-items: center;
				gap: 2px;
				flex-shrink: 0;
			}

			.engine-btn {
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

			.engine-btn:hover {
				color: var(--accent-color);
				background: var(--bg-tertiary);
			}

			.engine-btn.danger:hover {
				color: var(--danger-color);
			}

			.engine-btn svg {
				width: 14px;
				height: 14px;
			}

			.editor-wrap {
				border-radius: 8px;
				box-shadow: 0 0 0 0.75px var(--border-color);
				background: var(--card-bg);
				padding: 10px 12px 12px;
				display: flex;
				flex-direction: column;
				gap: 10px;
			}

			.editor-title {
				font-size: 12px;
				font-weight: 600;
				color: var(--text-secondary);
				margin-bottom: 2px;
			}

			.editor-actions {
				display: flex;
				gap: 8px;
				justify-content: flex-end;
			}

			.add-row {
				align-self: flex-start;
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

			.manager-header {
				display: flex;
				align-items: center;
				gap: 8px;
			}

			.manager-header .section-advanced-toggle {
				margin-inline-start: auto;
			}

			.type-switch {
				display: flex;
				gap: 4px;
				padding: 3px;
				border-radius: 8px;
				background: var(--bg-tertiary);
			}

			.type-tab {
				border: none;
				background: transparent;
				color: var(--text-muted);
				font-size: 12px;
				font-weight: 500;
				padding: 5px 12px;
				border-radius: 6px;
				cursor: pointer;
				transition: background-color 0.15s ease, color 0.15s ease;
			}

			.type-tab:hover {
				color: var(--text-primary);
			}

			.type-tab.active {
				background: var(--card-bg);
				color: var(--accent-color);
				box-shadow: 0 0 0 0.75px var(--border-color);
			}
		`,
	];

	constructor() {
		super();
		this._editingId = null;
		this._editingDraft = null;
		this._addingNew = false;
		this._newDraft = null;
		this._activeType = 'text';
		this._onCatalogChanged = () => this.requestUpdate();
		this._unsubscribeStore = null;
	}

	get #se() {
		return SettingsStore.current.searchEngines || { overrides: {}, hidden: [], custom: [], order: [] };
	}

	get #localOnly() {
		return SettingsStore.current.engineManagerLocalOnly !== false;
	}

	get #catalog() {
		return window.FlowMouseEngineCatalogApi.ENGINE_CATALOG;
	}

	connectedCallback() {
		super.connectedCallback();
		window.addEventListener('action-catalog-changed', this._onCatalogChanged);
		this._unsubscribeStore = SettingsStore.onChange((changed) => {
			if ('searchEngines' in changed || 'engineManagerLocalOnly' in changed) this.requestUpdate();
		});
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		window.removeEventListener('action-catalog-changed', this._onCatalogChanged);
		this._unsubscribeStore?.();
		this._unsubscribeStore = null;
	}

	#generateId() {
		const existing = new Set([
			...(this.#se.custom || []).map(c => c.id),
		]);
		let id;
		do {
			const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
			id = `engine_${uuid}`;
		} while (existing.has(id));
		return id;
	}

	#save(next) {
		SettingsStore.save({ searchEngines: next });
		window.dispatchEvent(new Event('action-catalog-changed'));
	}

	#getResolvedEngines() {
		// resolveEngines excludes hidden built-ins, so we build the full list ourselves
		// (visible + hidden built-ins + custom), then sort by order.
		const se = this.#se;
		const overrides = se.overrides || {};
		const hidden = new Set(se.hidden || []);
		const custom = se.custom || [];
		const order = se.order || [];

		const list = [];
		for (const b of (this.#catalog || [])) {
			const merged = overrides[b.id] ? { ...b, ...overrides[b.id] } : { ...b };
			list.push({
				id: b.id,
				name: merged.name || '',
				url: merged.url || '',
				plus: !!merged.plus,
				slug: !!merged.slug,
				suffix: merged.suffix || '',
				clipboardMode: !!merged.clipboardMode,
				transformEnabled: !!merged.transformEnabled,
				transformCode: merged.transformCode || '',
				transformClipboard: !!merged.transformClipboard,
				transformRawResult: !!merged.transformRawResult,
				rawResult: !!merged.rawResult,
				type: b.type === 'image' ? 'image' : 'text',
				builtin: true,
				isHidden: window.FlowMouseEngineRegistry.isEngineHidden(b, se.hidden || []),
			});
		}
		for (const c of custom) {
			list.push({
				id: c.id,
				name: c.name || '',
				url: c.url || '',
				plus: !!c.plus,
				slug: !!c.slug,
				suffix: c.suffix || '',
				clipboardMode: !!c.clipboardMode,
				transformEnabled: !!c.transformEnabled,
				transformCode: c.transformCode || '',
				transformClipboard: !!c.transformClipboard,
				transformRawResult: !!c.transformRawResult,
				rawResult: !!c.rawResult,
				type: c.type === 'image' ? 'image' : 'text',
				builtin: false,
				isHidden: false,
			});
		}

		const localOnly = this.#localOnly;
		const filtered = list.filter(e => e.type === this._activeType && (!localOnly || !e.isHidden));

		const pos = id => { const i = order.indexOf(id); return i === -1 ? Infinity : i; };
		return filtered
			.map((e, i) => [e, i])
			.sort((a, b) => (pos(a[0].id) - pos(b[0].id)) || (a[1] - b[1]))
			.map(p => p[0]);
	}

	#getEngineIcon(eng) {
		if (eng.builtin) {
			const catalogEntry = window.FlowMouseEngineCatalogApi.getEngine(eng.id);
			if (catalogEntry && catalogEntry.icon) {
				return html`<img src="${catalogEntry.icon}" alt="" @error=${(e) => { e.target.style.display = 'none'; }}>`;
			}
		}
		if (eng.url) {
			const faviconUrl = `/_favicon/?pageUrl=${encodeURIComponent(eng.url)}&size=32`;
			return html`<img src="${faviconUrl}" alt="" @error=${(e) => { e.target.style.display = 'none'; }}>`;
		}
		return html`${unsafeHTML(icon('search', { size: 16, strokeWidth: 2 }))}`;
	}

	#isBuiltinModified(id) {
		const se = this.#se;
		return !!(se.overrides && se.overrides[id]);
	}

	#isHidden(id) {
		const se = this.#se;
		return (se.hidden || []).includes(id);
	}

	#getAllDisplayOrder() {
		// Order for the full list (visible + hidden)
		return this.#getResolvedEngines().map(e => e.id);
	}

	// ---- Actions ----

	#startEdit(eng) {
		this._editingId = eng.id;
		this._editingDraft = { ...eng };
		this._addingNew = false;
		this._newDraft = null;
	}

	#cancelEdit() {
		this._editingId = null;
		this._editingDraft = null;
	}

	#saveEdit(id, isBuiltin) {
		const draft = this._editingDraft;
		if (!draft) return;
		const name = (draft.name || '').trim();
		const url  = (draft.url  || '').trim();
		if (!name || !url) return;
		const se = this.#se;

		if (isBuiltin) {
			const catalogEntry = window.FlowMouseEngineCatalogApi.getEngine(id);
			if (catalogEntry) {
				// Store only the fields that differ from catalog base, but keep it simple: store the whole subset
				const overrides = { ...(se.overrides || {}) };
				overrides[id] = {
					name,
					url,
					plus: draft.plus,
					slug: draft.slug,
					suffix: draft.suffix,
					clipboardMode: draft.clipboardMode,
					transformEnabled: draft.transformEnabled,
					transformCode: draft.transformCode,
					transformClipboard: draft.transformClipboard,
					transformRawResult: draft.transformRawResult,
					rawResult: draft.rawResult,
				};
				this.#save({ ...se, overrides });
			}
		} else {
			const custom = (se.custom || []).map(c => {
				if (c.id !== id) return c;
				return { id, name, url, plus: draft.plus, slug: draft.slug, suffix: draft.suffix, clipboardMode: draft.clipboardMode, rawResult: draft.rawResult, transformEnabled: draft.transformEnabled, transformCode: draft.transformCode, transformClipboard: draft.transformClipboard, transformRawResult: draft.transformRawResult, type: c.type };
			});
			this.#save({ ...se, custom });
		}

		this._editingId = null;
		this._editingDraft = null;
	}

	#toggleHide(id) {
		const se = this.#se;
		const hidden = se.hidden || [];
		const order = se.order || [];
		const entry = (this.#catalog || []).find(b => b.id === id);
		const nextHidden = hidden.includes(id) ? hidden.filter(h => h !== id) : [...hidden, id];
		const willBeHidden = window.FlowMouseEngineRegistry.isEngineHidden(entry || { id }, nextHidden);
		// Remove from order when the toggle results in the engine being effectively hidden;
		// leave order untouched when it becomes effectively visible.
		const nextOrder = willBeHidden ? order.filter(o => o !== id) : order;
		this.#save({ ...se, hidden: nextHidden, order: nextOrder });
	}

	#deleteCustom(id) {
		const se = this.#se;
		const custom = (se.custom || []).filter(c => c.id !== id);
		const order = (se.order || []).filter(o => o !== id);
		this.#save({ ...se, custom, order });
	}

	#resetBuiltin(id) {
		const se = this.#se;
		const overrides = { ...(se.overrides || {}) };
		delete overrides[id];
		this.#save({ ...se, overrides });
	}

	#startAdd() {
		this._addingNew = true;
		this._newDraft = { name: '', url: '', plus: false, slug: false, suffix: '', clipboardMode: false, type: this._activeType };
		this._editingId = null;
		this._editingDraft = null;
	}

	#cancelAdd() {
		this._addingNew = false;
		this._newDraft = null;
	}

	#saveAdd() {
		const draft = this._newDraft;
		if (!draft) return;
		const name = (draft.name || '').trim();
		const url  = (draft.url  || '').trim();
		if (!name || !url) return;
		const se = this.#se;
		const id = this.#generateId();
		const custom = [...(se.custom || []), { id, name, url, plus: draft.plus, slug: draft.slug, suffix: draft.suffix, clipboardMode: draft.clipboardMode, rawResult: draft.rawResult, transformEnabled: draft.transformEnabled, transformCode: draft.transformCode, transformClipboard: draft.transformClipboard, transformRawResult: draft.transformRawResult, type: this._activeType }];
		this.#save({ ...se, custom });
		this._addingNew = false;
		this._newDraft = null;
	}

	// ---- Drag & drop reordering ----

	#onItemDragStart(e, idx) {
		this._dragState = { fromIdx: idx, active: true, overIdx: -1, position: null };
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', '');
		const row = e.currentTarget.closest('.engine-row');
		if (row) row.style.opacity = '0.4';
	}

	#onItemDragOver(e, idx) {
		if (!this._dragState?.active) return;
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
		const { fromIdx, overIdx, position } = this._dragState;
		if (overIdx < 0 || !position) return;
		this.#clearDropIndicators();
		this.#reorderEngines(fromIdx, overIdx, position);
	}

	#onItemDragEnd() {
		this._dragState = null;
		this.#clearDropIndicators();
		this.shadowRoot.querySelectorAll('.engine-row').forEach(r => r.style.opacity = '');
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

	#clearDropIndicators() {
		this.shadowRoot.querySelectorAll('.engine-row').forEach(r => r.classList.remove('drag-indicator-before', 'drag-indicator-after'));
	}

	#reorderEngines(fromIdx, overIdx, position) {
		let insertIdx = position === 'before' ? overIdx : overIdx + 1;
		if (fromIdx < insertIdx) insertIdx--;
		if (fromIdx === insertIdx) return;

		const se = this.#se;
		const order = se.order || [];
		// #getAllDisplayOrder() is already filtered to _activeType, so fromIdx/overIdx
		// refer to positions within the active-type slice, not the shared order array.
		const activeOrder = this.#getAllDisplayOrder();
		if (fromIdx < 0 || fromIdx >= activeOrder.length) return;
		const nextActive = [...activeOrder];
		const [moved] = nextActive.splice(fromIdx, 1);
		nextActive.splice(insertIdx, 0, moved);

		// Preserve the other type's ids (and their relative order) untouched.
		const activeIdSet = new Set(activeOrder);
		const otherIds = order.filter(id => !activeIdSet.has(id));
		const nextOrder = [...nextActive, ...otherIds];
		this.#save({ ...se, order: nextOrder });
	}

	// ---- Render ----

	render() {
		const i18n = window.i18n;
		const engines = this.#getResolvedEngines();

		return html`
			<div class="manager-header">
				<div class="type-switch">
					<button class="type-tab ${this._activeType === 'text' ? 'active' : ''}"
						@click=${() => { this._activeType = 'text'; }}>${i18n.getMessage('engineTypeText')}</button>
					<button class="type-tab ${this._activeType === 'image' ? 'active' : ''}"
						@click=${() => { this._activeType = 'image'; }}>${i18n.getMessage('engineTypeImage')}</button>
				</div>
				<label class="section-advanced-toggle ${this.#localOnly ? 'active' : ''}">
					<input type="checkbox" .checked=${this.#localOnly}
						@change=${(e) => { SettingsStore.save({ engineManagerLocalOnly: e.target.checked }); this.requestUpdate(); }}>
					<div class="section-advanced-toggle-slider"></div>
					<div class="section-advanced-toggle-label">${i18n.getMessage('engineLocalOnly')}</div>
				</label>
			</div>

			<div class="engine-list"
				@dragenter=${(e) => this.#onContainerDragOver(e)}
				@dragover=${(e) => this.#onContainerDragOver(e)}
				@dragleave=${(e) => this.#onContainerDragLeave(e)}
				@drop=${(e) => this.#onContainerDrop(e)}
				@dragend=${() => this.#onItemDragEnd()}
			>
				${engines.length === 0 ? html`
					<div class="empty-state">${i18n.getMessage('engineAddCustom')}</div>
				` : engines.map((eng, idx) => this.#renderRow(eng, idx))}
			</div>

			${this._addingNew ? this.#renderAddEditor() : html`
				<button class="btn btn-ghost add-row" @click=${this.#startAdd.bind(this)}>
					${unsafeHTML(icon('plus', { size: 13, strokeWidth: 2.5 }))}
					<span>${i18n.getMessage('engineAddCustom')}</span>
				</button>
			`}
		`;
	}

	#renderRow(eng, idx) {
		const i18n = window.i18n;
		const isEditing = this._editingId === eng.id;
		const hidden = eng.isHidden;
		const hasOverride = eng.builtin && this.#isBuiltinModified(eng.id);

		return html`
			<div class="engine-row ${hidden ? 'is-hidden' : ''}"
				@dragover=${(e) => this.#onItemDragOver(e, idx)}>
				<span class="engine-grip" draggable="true"
					.tooltip=${tooltip(i18n.getMessage('engineReorder'))}
					@dragstart=${(e) => this.#onItemDragStart(e, idx)}>
					${unsafeHTML(icon('gripVertical', { size: 14, strokeWidth: 2 }))}
				</span>

				<div class="engine-icon">
					${this.#getEngineIcon(eng)}
				</div>

				<div class="engine-info">
					<div class="engine-name-row">
						<span class="engine-name">${eng.name || eng.id}</span>
						${eng.builtin ? html`<span class="engine-badge">${i18n.getMessage('engineBuiltinBadge')}</span>` : ''}
						${hidden ? html`<span class="engine-badge">${i18n.getMessage('engineHiddenBadge')}</span>` : ''}
					</div>
					${eng.url ? html`<span class="engine-url">${eng.url}</span>` : ''}
				</div>

				<div class="engine-buttons">
					<button class="engine-btn" @click=${() => this.#startEdit(eng)}
						.tooltip=${tooltip(i18n.getMessage('engineEdit'))}>
						${unsafeHTML(icon('squarePen', { size: 14, strokeWidth: 2 }))}
					</button>

					${eng.builtin ? html`
						<button class="engine-btn" @click=${() => this.#toggleHide(eng.id)}
							.tooltip=${tooltip(i18n.getMessage(hidden ? 'engineShow' : 'engineHide'))}>
							${unsafeHTML(icon(hidden ? 'search' : 'eyeOff', { size: 14, strokeWidth: 2 }))}
						</button>
						${hasOverride ? html`
							<button class="engine-btn" @click=${() => this.#resetBuiltin(eng.id)}
								.tooltip=${tooltip(i18n.getMessage('engineReset'))}>
								${unsafeHTML(icon('rotateCcw', { size: 13, strokeWidth: 2.5 }))}
							</button>
						` : ''}
					` : html`
						<button class="engine-btn danger" @click=${() => this.#deleteCustom(eng.id)}
							.tooltip=${tooltip(i18n.getMessage('engineDelete'))}>
							${unsafeHTML(icon('trash2', { size: 14, strokeWidth: 2 }))}
						</button>
					`}
				</div>
			</div>

			${isEditing ? this.#renderEditEditor(eng) : ''}
		`;
	}

	#renderEditEditor(eng) {
		const i18n = window.i18n;
		return html`
			<div class="editor-wrap">
				<span class="editor-title">${i18n.getMessage('engineEdit')}: ${eng.name}</span>
				<engine-fields
					.value=${this._editingDraft}
					.type=${this._activeType}
					@field-change=${(e) => { this._editingDraft = { ...this._editingDraft, ...e.detail }; }}
				></engine-fields>
				<div class="editor-actions">
					<button class="btn btn-ghost" @click=${this.#cancelEdit.bind(this)}>
						${i18n.getMessage('engineCancel')}
					</button>
					<button class="btn btn-primary" @click=${() => this.#saveEdit(eng.id, eng.builtin)}>
						${i18n.getMessage('engineSave')}
					</button>
				</div>
			</div>
		`;
	}

	#renderAddEditor() {
		const i18n = window.i18n;
		return html`
			<div class="editor-wrap">
				<span class="editor-title">${i18n.getMessage('engineAddCustom')}</span>
				<engine-fields
					.value=${this._newDraft}
					.type=${this._activeType}
					@field-change=${(e) => { this._newDraft = { ...this._newDraft, ...e.detail }; }}
				></engine-fields>
				<div class="editor-actions">
					<button class="btn btn-ghost" @click=${this.#cancelAdd.bind(this)}>
						${i18n.getMessage('engineCancel')}
					</button>
					<button class="btn btn-primary" @click=${this.#saveAdd.bind(this)}>
						${i18n.getMessage('engineSave')}
					</button>
				</div>
			</div>
		`;
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('engine-manager', EngineManager);
});
