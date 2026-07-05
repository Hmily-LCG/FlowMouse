import { html } from '../lib/lit-all.min.js';
import { SettingsStore } from '../settings-store.js';

export function renderCatalogEngineOptions(currentValue, type = 'text') {
	const i18n = window.i18n;
	const se = SettingsStore.current.searchEngines || { overrides:{}, hidden:[], custom:[], order:[] };
	const catalog = window.FlowMouseEngineCatalogApi ? window.FlowMouseEngineCatalogApi.ENGINE_CATALOG : [];
	const engines = window.FlowMouseEngineRegistry.resolveEngines(catalog, se, type);
	const ids = new Set(engines.map(e => e.id));
	const cur = (type === 'image') ? window.FlowMouseEngineRegistry.normalizeImageEngineId(currentValue) : currentValue;
	const extra = (cur && cur !== 'system' && cur !== 'custom' && !ids.has(cur))
		? window.FlowMouseEngineRegistry.getEngineById(catalog, se, cur)
		: null;
	const showSystem = type !== 'image';
	return html`
		${showSystem ? html`<option value="system" ?selected=${cur === 'system'}>${i18n.getMessage('searchEngine_system')}</option>` : ''}
		${engines.map(e => html`<option value=${e.id} ?selected=${cur === e.id}>${e.name || e.id}</option>`)}
		${extra ? html`<option value=${extra.id} selected>${extra.name || extra.id}</option>` : ''}
		<option value="custom" ?selected=${cur === 'custom'}>${i18n.getMessage('custom')}</option>
	`;
}
