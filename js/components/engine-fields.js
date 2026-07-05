import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icon } from '../icons.js';
import { tooltip } from '../tooltip.js';

const i18n = window.i18n;

class EngineFields extends LitElement {
	static properties = {
		value: { type: Object },
		type: { type: String },
		_transformSample: { state: true },
		_transformResult: { state: true },
	};

	constructor() {
		super();
		this.type = 'text';
		this._transformSample = 'Hello World';
		this._transformResult = '';
	}

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
			}

			.ef-row {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-bottom: 8px;
			}

			.ef-row label {
				min-width: 0;
				flex-shrink: 0;
				color: var(--text-secondary);
				font-size: 13px;
			}

			.ef-row input[type="text"] {
				flex: 1;
				min-width: 0;
			}

			.ef-checkbox-row {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-bottom: 8px;
			}

			.ef-checkbox-row label {
				font-size: 13px;
				color: var(--text-primary);
				cursor: pointer;
				user-select: none;
			}

			.ef-query-group {
				transition: opacity 0.2s;
			}

			.ef-query-group.dimmed {
				opacity: 0.4;
			}

			.ef-checkbox-row.dimmed {
				opacity: 0.4;
			}

			.ef-transform-block {
				display: flex;
				flex-direction: column;
				gap: 8px;
				margin: 0 0 8px 4px;
				padding-inline-start: 8px;
				border-inline-start: 2px solid var(--border-color);
			}

			.ef-transform-block textarea {
				width: 100%;
				min-height: 72px;
				box-sizing: border-box;
				font-family: var(--font-mono);
				font-size: 12px;
				resize: vertical;
			}

			.ef-transform-hint,
			.ef-transform-note {
				font-size: 11px;
				color: var(--text-muted);
				line-height: 1.4;
			}

			.ef-help {
				display: inline-flex;
				align-items: center;
				margin-left: 5px;
				color: var(--text-muted);
				cursor: help;
			}

			.ef-help:hover {
				color: var(--accent-color);
			}

			.ef-transform-hint code {
				font-family: var(--font-mono);
				font-size: 0.9em;
				background: var(--bg-tertiary);
				padding: 1px 5px;
				border-radius: 4px;
				color: var(--text-primary);
			}

			.ef-transform-test {
				display: flex;
				align-items: center;
				gap: 8px;
				flex-wrap: wrap;
			}

			.ef-transform-test input[type="text"] {
				flex: 1;
				min-width: 120px;
			}

			.ef-transform-result {
				font-family: var(--font-mono);
				font-size: 12px;
				color: var(--text-primary);
				word-break: break-word;
			}
		`,
	];

	_get(field, fallback) {
		const v = this.value;
		if (!v) return fallback;
		const val = v[field];
		return val === undefined || val === null ? fallback : val;
	}

	_emit(patch) {
		const current = this.value || {};
		const detail = {
			name: current.name ?? '',
			url: current.url ?? '',
			plus: current.plus ?? false,
			slug: current.slug ?? false,
			suffix: current.suffix ?? '',
			clipboardMode: current.clipboardMode ?? false,
			rawResult: current.rawResult ?? false,
			transformEnabled: current.transformEnabled ?? false,
			transformCode: current.transformCode ?? '',
			transformClipboard: current.transformClipboard ?? false,
			transformRawResult: current.transformRawResult ?? false,
			...patch,
		};
		this.dispatchEvent(new CustomEvent('field-change', {
			detail,
			bubbles: true,
			composed: true,
		}));
	}

	_onText(field, e) {
		this._emit({ [field]: e.target.value });
	}

	_onCheck(field, e) {
		this._emit({ [field]: e.target.checked });
	}

	async _runTransformTest() {
		const code = this.value?.transformCode || '';
		if (!(chrome?.runtime?.sendMessage)) {
			this._transformResult = '⚠ ' + (i18n.getMessage('transformFailed') || 'error');
			return;
		}
		try {
			const res = await chrome.runtime.sendMessage({ action: 'runTransform', code, selection: this._transformSample || '', clipboard: '' });
			this._transformResult = res && res.ok ? res.result : ('⚠ ' + ((res && res.error) || 'error'));
		} catch (e) {
			this._transformResult = '⚠ ' + (e.message || e);
		}
	}

	render() {
		const name          = this._get('name', '');
		const url           = this._get('url', '');
		const plus          = this._get('plus', false);
		const slug          = this._get('slug', false);
		const suffix        = this._get('suffix', '');
		const clipboardMode = this._get('clipboardMode', false);
		const rawResult     = this._get('rawResult', false);
		const transformEnabled   = this._get('transformEnabled', false);
		const transformCode      = this._get('transformCode', '');
		const transformClipboard = this._get('transformClipboard', false);
		const transformRawResult = this._get('transformRawResult', false);
		const raw = transformRawResult;

		return html`
			<div class="ef-row">
				<label for="ef-name">${i18n.getMessage('engineFieldName')}</label>
				<input
					id="ef-name"
					type="text"
					.value=${name}
					@input=${e => this._onText('name', e)}
				>
			</div>

			<div class="ef-query-group ${clipboardMode ? 'dimmed' : ''}">
				<div class="ef-row">
					<label for="ef-url">${i18n.getMessage('engineFieldUrl')}</label>
					<input
						id="ef-url"
						type="text"
						placeholder="https://example.com/search?q=%s"
						.value=${url}
						@input=${e => this._onText('url', e)}
					>
				</div>

				${this.type !== 'image' ? html`
					<div class="ef-checkbox-row ${raw ? 'dimmed' : ''}">
						<input
							id="ef-plus"
							type="checkbox"
							.checked=${plus}
							?disabled=${raw}
							@change=${e => this._onCheck('plus', e)}
						>
						<label for="ef-plus">${i18n.getMessage('engineFieldPlus')}</label>
					</div>

					<div class="ef-checkbox-row ${raw ? 'dimmed' : ''}">
						<input
							id="ef-slug"
							type="checkbox"
							.checked=${slug}
							?disabled=${raw}
							@change=${e => this._onCheck('slug', e)}
						>
						<label for="ef-slug">${i18n.getMessage('engineFieldSlug')}</label>
					</div>
				` : ''}

				<div class="ef-row">
					<label for="ef-suffix">${i18n.getMessage('engineFieldSuffix')}</label>
					<input
						id="ef-suffix"
						type="text"
						.value=${suffix}
						@input=${e => this._onText('suffix', e)}
					>
				</div>
			</div>

			${this.type === 'image' ? html`
				<div class="ef-checkbox-row">
					<input
						id="ef-raw-result"
						type="checkbox"
						.checked=${rawResult}
						@change=${e => this._onCheck('rawResult', e)}
					>
					<label for="ef-raw-result">${i18n.getMessage('engineImageRawUrl')}</label>
				</div>
			` : ''}

			${this.type !== 'image' ? html`
				<div class="ef-checkbox-row">
					<input
						id="ef-clipboard"
						type="checkbox"
						.checked=${clipboardMode}
						@change=${e => this._onCheck('clipboardMode', e)}
					>
					<label for="ef-clipboard">${i18n.getMessage('engineFieldClipboard')}</label>
				</div>
			` : ''}

			<div class="ef-checkbox-row">
				<input
					id="ef-transform-enabled"
					type="checkbox"
					.checked=${transformEnabled}
					@change=${e => this._onCheck('transformEnabled', e)}
				>
				<label for="ef-transform-enabled">${i18n.getMessage('transformToggle')}</label>
				<span class="ef-help" .tooltip=${tooltip(i18n.getMessage('transformHelp'))}>${unsafeHTML(icon('circleHelp', { size: 14 }))}</span>
			</div>

			${transformEnabled ? html`
				<div class="ef-transform-block">
					<textarea
						.value=${transformCode}
						@input=${e => this._onText('transformCode', e)}
					></textarea>
					<div class="ef-transform-hint">${i18n.getMessage('transformCodeHint')}</div>

					${this.type !== 'image' ? html`
						<div class="ef-checkbox-row">
							<input
								id="ef-transform-clipboard"
								type="checkbox"
								.checked=${transformClipboard}
								@change=${e => this._onCheck('transformClipboard', e)}
							>
							<label for="ef-transform-clipboard">${i18n.getMessage('transformClipboardOptIn')}</label>
						</div>

						<div class="ef-checkbox-row">
							<input
								id="ef-transform-raw"
								type="checkbox"
								.checked=${transformRawResult}
								@change=${e => this._onCheck('transformRawResult', e)}
							>
							<label for="ef-transform-raw">${i18n.getMessage('transformRawResult')}</label>
						</div>
						${raw ? html`<div class="ef-transform-note">${i18n.getMessage('transformRawResultNote')}</div>` : ''}
					` : ''}

					<div class="ef-transform-test">
						<label for="ef-transform-sample">${i18n.getMessage('transformSampleLabel')}</label>
						<input
							id="ef-transform-sample"
							type="text"
							.value=${this._transformSample}
							@input=${e => { this._transformSample = e.target.value; }}
						>
						<button class="btn btn-ghost" type="button" @click=${() => this._runTransformTest()}>
							${i18n.getMessage('transformTestBtn')}
						</button>
					</div>
					${this._transformResult ? html`<div class="ef-transform-result">${this._transformResult}</div>` : ''}

					<div class="ef-transform-note">${i18n.getMessage('transformIsolationNote')}</div>
				</div>
			` : ''}
		`;
	}
}

customElements.define('engine-fields', EngineFields);
