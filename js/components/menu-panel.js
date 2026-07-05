import { LitElement, html, css, unsafeHTML } from '../lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icon } from '../icons.js';
import { SettingsStore } from '../settings-store.js';
import { tooltip } from '../tooltip.js';

export function getMenuLabel(menuId) {
	const i18n = window.i18n;
	if (!menuId) return i18n.getMessage('actionCustomMenu');
	const menu = (SettingsStore.current.customMenus || {})[menuId];
	if (!menu) return i18n.getMessage('menuNotFound');
	const count = menu.items?.filter(it => it !== 'separator').length || 0;
	const countLabel = (count === 1
		? i18n.getMessage('menuItemCountOne')
		: i18n.getMessage('menuItemCount')).replace('%count%', count);
	const displayName = menu.name || i18n.getMessage('actionCustomMenu');
	return `${displayName} (${countLabel})`;
}

class MenuPanel extends LitElement {

	static properties = {
		selectedMenuId: { type: String },
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

			.menu-select {
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

			.items-container {
				display: flex;
				flex-direction: column;
				gap: 6px;
				padding: 4px 0;
				margin: -4px 0;
			}

			.item-row {
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 5px 6px;
				border-radius: 8px;
				box-shadow: 0 0 0 0.75px var(--border-color);
				background: var(--card-bg);
				position: relative;
			}
			.item-row.drag-indicator-before::before,
			.item-row.drag-indicator-after::after {
				content: '';
				position: absolute;
				left: 6px;
				right: 6px;
				height: 2px;
				background: var(--accent-color);
				border-radius: 1px;
				pointer-events: none;
			}
			.item-row.drag-indicator-before::before {
				top: -4px;
			}
			.item-row.drag-indicator-after::after {
				bottom: -4px;
			}

			.item-grip {
				display: flex;
				align-items: center;
				align-self: stretch;
				color: var(--text-muted);
				cursor: grab;
				flex-shrink: 0;
				opacity: 0.5;
				transition: opacity 0.15s;
			}
			.item-grip:hover {
				opacity: 1;
			}
			.item-grip svg {
				width: 14px;
				height: 14px;
			}

			.item-action {
				flex: 1;
				min-width: 0;
			}

			.item-buttons {
				display: flex;
				align-items: center;
				gap: 2px;
				flex-shrink: 0;
			}

			.item-copy,
			.item-delete {
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
			.item-copy:hover {
				color: var(--accent-color);
			}
			.item-delete:hover {
				color: var(--danger-color);
			}
			.item-copy svg,
			.item-delete svg {
				width: 14px;
				height: 14px;
			}

			.empty-items {
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

			.add-buttons {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
				align-self: flex-start;
			}

			.separator-line {
				flex: 1;
				height: 1px;
				background: var(--border-color);
			}

			.patterns-field {
				display: flex;
				flex-direction: column;
				gap: 9px;
			}
			.patterns-label {
				font-size: 12px;
				font-weight: 600;
				color: var(--text-secondary);
			}
			.patterns-chips {
				display: flex;
				flex-wrap: wrap;
				gap: 6px;
			}
			.pattern-chip {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: 2px 8px 2px 10px;
				border-radius: 12px;
				background: var(--accent-color, #5b8dee);
				color: #fff;
				font-size: 12px;
				line-height: 1.6;
			}
			.pattern-chip-remove {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				background: transparent;
				border: none;
				color: rgba(255,255,255,0.8);
				cursor: pointer;
				padding: 0 2px;
				font-size: 14px;
				line-height: 1;
				border-radius: 50%;
				transition: color 0.12s;
			}
			.pattern-chip-remove:hover {
				color: #fff;
			}
			.patterns-add-row {
				display: flex;
				gap: 6px;
			}
			.patterns-add-row input {
				flex: 1;
				min-width: 0;
			}
			.patterns-hint {
				font-size: 11px;
				color: var(--text-muted);
			}
		`,
	];

	constructor() {
		super();
		this.selectedMenuId = '';
		this._dragState = null;
		this._bootstrapped = false;
		this._onCatalogChanged = () => this.requestUpdate();
		this._unsubscribeStore = null;
	}

	get customMenus() {
		return SettingsStore.current.customMenus || {};
	}

	connectedCallback() {
		super.connectedCallback();
		window.addEventListener('action-catalog-changed', this._onCatalogChanged);
		this._unsubscribeStore = SettingsStore.onChange((changed) => {
			if ('customMenus' in changed) this.requestUpdate();
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
			this.#ensureActiveMenu();
		}
	}

	render() {
		const entries = Object.entries(this.customMenus);
		const activeId = this.#resolveActiveId();
		const activeMenu = activeId ? this.customMenus[activeId] : null;

		if (!entries.length || !activeMenu) {
			return html``;
		}

		return html`
			${this.#renderSelectorRow(entries, activeId)}
			${this.#renderNameField(activeId, activeMenu)}
			${this.#renderPatternsSection(activeId, activeMenu)}
			${this.#renderItemsSection(activeId, activeMenu)}
		`;
	}

	#renderSelectorRow(entries, activeId) {
		const i18n = window.i18n;
		return html`
			<div class="selector-row">
				<select class="menu-select"
					@change=${(e) => this.#selectMenu(e.target.value)}>
					${entries.map(([id, menu]) => {
						const count = menu.items?.filter(it => it !== 'separator').length || 0;
						const countLabel = (count === 1
							? i18n.getMessage('menuItemCountOne')
							: i18n.getMessage('menuItemCount')).replace('%count%', count);
						const name = menu.name || i18n.getMessage('menuNamePlaceholder');
						return html`<option value=${id} ?selected=${id === activeId}>${name} (${countLabel})</option>`;
					})}
				</select>
				<button type="button" class="btn btn-ghost btn-icon-only selector-btn"
					.tooltip=${tooltip(i18n.getMessage('addMenu'))}
					@click=${this.#addMenu}>
					${unsafeHTML(icon('plus', { size: 14, strokeWidth: 2.5 }))}
				</button>
				<button type="button" class="btn btn-ghost btn-icon-only selector-btn"
					.tooltip=${tooltip(i18n.getMessage('duplicate'))}
					@click=${() => this.#copyMenu(activeId)}>
					${unsafeHTML(icon('copy', { size: 14, strokeWidth: 2 }))}
				</button>
				<button type="button" class="btn btn-ghost btn-icon-only selector-btn danger"
					.tooltip=${tooltip(i18n.getMessage('delete'))}
					@click=${() => this.#deleteMenu(activeId)}>
					${unsafeHTML(icon('trash2', { size: 14, strokeWidth: 2 }))}
				</button>
			</div>
		`;
	}

	#renderNameField(activeId, menu) {
		const i18n = window.i18n;
		return html`
			<div class="name-field">
				<span class="name-label">${i18n.getMessage('customHudName')}</span>
				<input class="name-input" type="text"
					.value=${menu.name || ''}
					placeholder=${i18n.getMessage('menuNamePlaceholder')}
					maxlength="80"
					@change=${(e) => this.#updateMenu(activeId, { name: e.target.value })}
				>
			</div>
		`;
	}

	#renderPatternsSection(activeId, menu) {
		const i18n = window.i18n;
		const patterns = menu.patterns || [];
		const onKeydown = (e) => {
			if (e.key === 'Enter') {
				this.#addPattern(activeId, e.target.value);
				e.target.value = '';
			}
		};
		const onAdd = (e) => {
			const input = e.target.closest('.patterns-add-row').querySelector('input');
			this.#addPattern(activeId, input.value);
			input.value = '';
		};
		return html`
			<div class="patterns-field">
				<span class="patterns-label">${i18n.getMessage('menuPatternsTitle')}</span>
				${patterns.length > 0 ? html`
					<div class="patterns-chips">
						${patterns.map(p => html`
							<span class="pattern-chip">
								${p}
								<button class="pattern-chip-remove" type="button"
									@click=${() => this.#removePattern(activeId, p)}>×</button>
							</span>
						`)}
					</div>
				` : ''}
				<div class="patterns-add-row">
					<input type="text"
						placeholder=${i18n.getMessage('menuPatternsPlaceholder')}
						@keydown=${onKeydown}
					>
					<button class="btn btn-ghost" type="button" @click=${onAdd}>
						${i18n.getMessage('menuPatternsAdd')}
					</button>
				</div>
				<span class="patterns-hint">${i18n.getMessage('menuPatternsHint')}</span>
			</div>
		`;
	}

	#renderItemsSection(activeId, menu) {
		const i18n = window.i18n;
		const items = menu.items || [];

		return html`
			<div class="items-container"
				@dragenter=${(e) => this.#onContainerDragOver(e)}
				@dragover=${(e) => this.#onContainerDragOver(e)}
				@dragleave=${(e) => this.#onContainerDragLeave(e)}
				@drop=${(e) => this.#onContainerDrop(e)}
				@dragend=${() => this.#onItemDragEnd()}
			>
				${items.length === 0 ? html`
					<div class="empty-items">${i18n.getMessage('emptyMenuItems')}</div>
				` : items.map((item, idx) => this.#renderItem(activeId, item, idx))}
			</div>
			<div class="add-buttons">
				<button class="btn btn-ghost" @click=${() => this.#addItem(activeId)}>
					${unsafeHTML(icon('plus', { size: 13, strokeWidth: 2.5 }))}
					<span>${i18n.getMessage('addMenuItem')}</span>
				</button>
				<button class="btn btn-ghost" @click=${() => this.#addSeparator(activeId)}>
					${unsafeHTML(icon('minusDashed', { size: 13, strokeWidth: 2.5 }))}
					<span>${i18n.getMessage('addMenuSeparator')}</span>
				</button>
			</div>
		`;
	}

	#renderItem(menuId, item, idx) {
		const i18n = window.i18n;

		if (item === 'separator') {
			return html`
				<div class="item-row"
					@dragover=${(e) => this.#onItemDragOver(e, menuId, idx)}
				>
					<span class="item-grip" draggable="true"
						@dragstart=${(e) => this.#onItemDragStart(e, menuId, idx)}
					>${unsafeHTML(icon('gripVertical', { size: 14, strokeWidth: 2 }))}</span>
					<span class="separator-line"></span>
					<div class="item-buttons">
						<button class="item-delete" @click=${() => this.#deleteItem(menuId, idx)}
							.tooltip=${tooltip(i18n.getMessage('delete'))}>
							${unsafeHTML(icon('x', { size: 14, strokeWidth: 2.5 }))}
						</button>
					</div>
				</div>
			`;
		}

		const label = i18n.getMessage('menuItemNumber').replace('%n%', String(idx + 1));

		return html`
			<div class="item-row"
				@dragover=${(e) => this.#onItemDragOver(e, menuId, idx)}
			>
				<span class="item-grip" draggable="true"
					@dragstart=${(e) => this.#onItemDragStart(e, menuId, idx)}
				>${unsafeHTML(icon('gripVertical', { size: 14, strokeWidth: 2 }))}</span>
				<div class="item-action">
					<action-select
						compact
						allow-custom-name
						context="menu-item"
						.value=${item.action || 'none'}
						.config=${item}
						.gestureLabel=${label}
						@action-change=${(e) => this.#onItemActionChange(menuId, idx, e.detail)}
					></action-select>
				</div>
				<div class="item-buttons">
					<button class="item-copy" @click=${() => this.#copyItem(menuId, idx)}
						.tooltip=${tooltip(i18n.getMessage('duplicate'))}>
						${unsafeHTML(icon('copy', { size: 14, strokeWidth: 2 }))}
					</button>
					<button class="item-delete" @click=${() => this.#deleteItem(menuId, idx)}
						.tooltip=${tooltip(i18n.getMessage('delete'))}>
						${unsafeHTML(icon('x', { size: 14, strokeWidth: 2.5 }))}
					</button>
				</div>
			</div>
		`;
	}


	#resolveActiveId() {
		const menus = this.customMenus;
		const ids = Object.keys(menus);
		if (!ids.length) return '';
		if (this.selectedMenuId && menus[this.selectedMenuId]) {
			return this.selectedMenuId;
		}
		return ids[0];
	}

	#ensureActiveMenu() {
		const menus = this.customMenus;
		if (this.selectedMenuId && menus[this.selectedMenuId]) return;

		const ids = Object.keys(menus);
		if (ids.length === 0) {
			this.#addMenu();
		} else {
			this.#selectMenu(ids[0]);
		}
	}


	#generateId() {
		return this.#generateIdFrom(this.customMenus);
	}

	#addMenu() {
		const id = this.#generateId();
		const menus = { ...this.customMenus };
		const existingCount = Object.keys(menus).length;
		const defaultName = `${window.i18n.getMessage('menuNamePlaceholder')} ${existingCount + 1}`;
		menus[id] = { name: defaultName, items: [], patterns: [] };
		this.#applyMenus(menus, id);
	}

	#copyMenu(id) {
		if (!id || !this.customMenus[id]) return;
		const newId = this.#generateId();
		const menus = {};
		for (const [key, val] of Object.entries(this.customMenus)) {
			menus[key] = val;
			if (key === id) menus[newId] = structuredClone(val);
		}
		this.#applyMenus(menus, newId);
	}

	#deleteMenu(id) {
		if (!id || !this.customMenus[id]) return;
		const i18n = window.i18n;
		const menu = this.customMenus[id];
		const itemCount = menu?.items?.length || 0;
		if (itemCount > 0) {
			const name = menu?.name || i18n.getMessage('menuNamePlaceholder');
			if (!confirm(i18n.getMessage('deleteMenuConfirm').replace('%name%', name))) return;
		}

		const menus = { ...this.customMenus };
		delete menus[id];

		let nextId = Object.keys(menus)[0] || '';
		if (!nextId) {
			nextId = this.#generateIdFrom(menus);
			const defaultName = `${i18n.getMessage('menuNamePlaceholder')} 1`;
			menus[nextId] = { name: defaultName, items: [], patterns: [] };
		}
		this.#applyMenus(menus, nextId);
	}

	#generateIdFrom(menus) {
		const existing = new Set(Object.keys(menus || {}));
		let id;
		do {
			const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
			id = `menu_${uuid}`;
		} while (existing.has(id));
		return id;
	}

	#updateMenu(id, patch) {
		const menus = { ...this.customMenus };
		menus[id] = { ...menus[id], ...patch };
		this.#applyMenus(menus, id);
	}

	#addPattern(menuId, raw) {
		const text = (raw || '').trim();
		if (!text) return;
		const pattern = text.includes('*') ? text : `*${text}*`;
		const cur = this.customMenus[menuId]?.patterns || [];
		if (cur.includes(pattern)) return;
		this.#updateMenu(menuId, { patterns: [...cur, pattern] });
	}

	#removePattern(menuId, pattern) {
		const cur = this.customMenus[menuId]?.patterns || [];
		this.#updateMenu(menuId, { patterns: cur.filter(p => p !== pattern) });
	}

	#selectMenu(id) {
		if (!id || !this.customMenus[id]) return;
		this.selectedMenuId = id;
		this.dispatchEvent(new CustomEvent('menu-select', {
			detail: { menuId: id },
			bubbles: true,
			composed: false,
		}));
	}


	#addItem(menuId) {
		const menus = { ...this.customMenus };
		const menu = { ...menus[menuId] };
		menu.items = [...(menu.items || []), { action: 'none' }];
		menus[menuId] = menu;
		this.#applyMenus(menus, menuId);
	}

	#addSeparator(menuId) {
		const menus = { ...this.customMenus };
		const menu = { ...menus[menuId] };
		menu.items = [...(menu.items || []), 'separator'];
		menus[menuId] = menu;
		this.#applyMenus(menus, menuId);
	}

	#deleteItem(menuId, idx) {
		const menus = { ...this.customMenus };
		const menu = { ...menus[menuId] };
		menu.items = (menu.items || []).filter((_, i) => i !== idx);
		menus[menuId] = menu;
		this.#applyMenus(menus, menuId);
	}

	#copyItem(menuId, idx) {
		const menus = { ...this.customMenus };
		const menu = { ...menus[menuId] };
		const items = [...(menu.items || [])];
		const copiedItem = structuredClone(items[idx]);
		items.splice(idx + 1, 0, copiedItem);
		menu.items = items;
		menus[menuId] = menu;
		this.#applyMenus(menus, menuId);
	}

	#onItemActionChange(menuId, idx, detail) {
		const menus = { ...this.customMenus };
		const menu = { ...menus[menuId] };
		menu.items = [...(menu.items || [])];
		menu.items[idx] = { action: detail.action, ...(detail.config || {}) };
		menus[menuId] = menu;
		this.#applyMenus(menus, menuId);
	}


	#onItemDragStart(e, menuId, idx) {
		this._dragState = { menuId, fromIdx: idx, active: true, overIdx: -1, position: null };
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', '');
		const row = e.currentTarget.closest('.item-row');
		if (row) row.style.opacity = '0.4';
	}

	#onItemDragOver(e, menuId, idx) {
		if (!this._dragState || this._dragState.menuId !== menuId) return;
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
		const { menuId, fromIdx, overIdx, position } = this._dragState;
		if (overIdx < 0 || !position) return;
		this.#clearDropIndicators();
		this.#reorderItems(menuId, fromIdx, overIdx, position);
	}

	#onItemDragEnd() {
		this._dragState = null;
		this.#clearDropIndicators();
		const rows = this.shadowRoot.querySelectorAll('.item-row');
		rows.forEach(r => r.style.opacity = '');
	}

	#reorderItems(menuId, fromIdx, overIdx, position) {
		let insertIdx = position === 'before' ? overIdx : overIdx + 1;
		if (fromIdx < insertIdx) insertIdx--;
		if (fromIdx === insertIdx) return;

		const menus = { ...this.customMenus };
		const menu = { ...menus[menuId] };
		const items = [...(menu.items || [])];
		const [moved] = items.splice(fromIdx, 1);
		items.splice(insertIdx, 0, moved);
		menu.items = items;
		menus[menuId] = menu;
		this.#applyMenus(menus, menuId);
	}

	#clearDropIndicators() {
		const rows = this.shadowRoot.querySelectorAll('.item-row');
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


	#applyMenus(menus, activeId) {
		if (activeId && activeId !== this.selectedMenuId) {
			this.selectedMenuId = activeId;
			this.dispatchEvent(new CustomEvent('menu-select', {
				detail: { menuId: activeId },
				bubbles: true,
				composed: false,
			}));
		}
		SettingsStore.save({ customMenus: menus });
		window.dispatchEvent(new Event('action-catalog-changed'));
	}

	updated() {
		const select = this.shadowRoot?.querySelector('select.menu-select');
		const activeId = this.#resolveActiveId();
		if (select && activeId && select.value !== activeId) {
			select.value = activeId;
		}
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('menu-panel', MenuPanel);
});