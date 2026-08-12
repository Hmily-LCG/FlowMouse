import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icons, icon } from '../icons.js';

class EventConfigDialog extends LitElement {
	static properties = {
		_open: { state: true },
		_eventType: { state: true },
		_eventDetail: { state: true },
		_gestureInfo: { state: true },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: contents;
			}

			.ecd-overlay {
				position: fixed;
				inset: 0;
				z-index: 10000;
				background: rgba(0, 0, 0, 0.35);
				display: flex;
				align-items: center;
				justify-content: center;
				animation: ecd-fadeIn 0.12s ease;
			}
			@keyframes ecd-fadeIn {
				from { opacity: 0; }
				to { opacity: 1; }
			}
			@keyframes ecd-slideIn {
				from { opacity: 0; transform: scale(0.97); }
				to { opacity: 1; transform: scale(1); }
			}

			.ecd-panel {
				width: min(800px, 92vw);
				background: var(--card-bg);
				border-radius: 14px;
				box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border-color);
				display: flex;
				flex-direction: column;
				overflow: hidden;
				animation: ecd-slideIn 0.12s ease;
			}

			.ecd-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 14px 18px;
				border-bottom: 1px solid var(--border-color);
			}
			.ecd-title {
				font-size: 15px;
				font-weight: 600;
				color: var(--text-primary);
				display: flex;
				align-items: center;
				gap: 8px;
			}
			.ecd-title-icon {
				display: flex;
				align-items: center;
				color: var(--accent-color);
			}
			.ecd-title-icon svg {
				width: 18px;
				height: 18px;
			}
			.ecd-close {
				background: none;
				border: none;
				color: var(--text-secondary);
				cursor: pointer;
				padding: 0;
				border-radius: 6px;
				line-height: 1;
				transition: all 0.15s;
				display: flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				flex-shrink: 0;
			}
			.ecd-close svg {
				width: 18px;
				height: 18px;
			}
			.ecd-close:hover {
				background: var(--border-color);
				color: var(--text-primary);
			}

			.ecd-body {
				padding: 16px 18px;
				display: flex;
				flex-direction: column;
				gap: 12px;
			}
			.ecd-row {
				display: flex;
				align-items: center;
				gap: 10px;
			}
			.ecd-label {
				flex-shrink: 0;
				min-width: 100px;
				font-size: 12px;
				color: var(--text-secondary);
				font-weight: 600;
			}
			.ecd-label code {
				font-family: var(--font-mono);
				font-size: 0.9em;
				background: var(--bg-tertiary);
				padding: 1px 5px;
				border-radius: 4px;
				color: var(--text-primary);
			}
			.ecd-input {
				flex: 1;
				min-width: 0;
				font-family: var(--font-mono);
			}
			.ecd-textarea {
				flex: 1;
				min-width: 0;
				font-family: var(--font-mono);
				resize: vertical;
				min-height: 20px;
			}
			.ecd-textarea.invalid {
				box-shadow: 0 0 0 0.75px var(--warning-color);
			}
			.ecd-warning {
				font-size: 12px;
				color: var(--warning-color);
				padding: 6px 8px;
				background: rgba(230, 161, 23, 0.08);
				border-radius: 6px;
				line-height: 1.5;
			}
			.ecd-hint {
				font-size: 11px;
				color: var(--text-muted);
				line-height: 1.4;
			}
			.ecd-hint code {
				font-family: var(--font-mono);
				font-size: 0.9em;
				background: var(--bg-tertiary);
				padding: 1px 5px;
				border-radius: 4px;
				color: var(--text-primary);
			}

			.ecd-footer {
				display: flex;
				justify-content: flex-end;
				gap: 8px;
				padding: 10px 18px;
				border-top: 1px solid var(--border-color);
			}
			.ecd-btn {
				min-width: 85px;
			}
			.ecd-checkbox {
				display: flex;
				align-items: center;
				gap: 6px;
				font-size: 12px;
				color: var(--text-secondary);
				cursor: pointer;
			}
			.ecd-checkbox code {
				font-family: var(--font-mono);
				font-size: 0.9em;
				background: var(--bg-tertiary);
				padding: 1px 5px;
				border-radius: 4px;
				color: var(--text-primary);
			}
		`,
	];

	constructor() {
		super();
		this._open = false;
		this._eventType = '';
		this._eventDetail = '';
		this._gestureInfo = false;
		this._resolve = null;
	}

	open(config = {}) {
		this._eventType = config.eventType || '';
		this._eventDetail = config.eventDetail || '';
		this._gestureInfo = config.gestureInfo || false;
		this._open = true;
		document.documentElement.style.overflow = 'hidden';
		return new Promise(resolve => { this._resolve = resolve; });
	}

	#close(confirmed) {
		const result = confirmed
			? { confirmed: true, eventType: this._eventType, eventDetail: this._eventDetail, gestureInfo: this._gestureInfo }
			: { confirmed: false };
		this._open = false;
		document.documentElement.style.overflow = '';
		this._resolve?.(result);
		this._resolve = null;
	}

	#isValidJson(str) {
		if (!str || str.trim() === '') return true;
		try { JSON.parse(str); return true; } catch { return false; }
	}

	render() {
		if (!this._open) return '';

		const isValidJson = this.#isValidJson(this._eventDetail);
		const hint = (window.i18n.getMessage('customEventHint') || '')
			.replace('%code%', '<code>new CustomEvent(<b>type</b>, { detail: <b>detail</b>, bubbles: true, cancelable: true })</code>')
			.replace('%window%', '<code>window</code>');
		const gestureInfoLabel = (window.i18n.getMessage('customEventIncludeGestureInfo') || '')
			.replace('%code%', '<code><b>detail.gesture</b></code>');

		return html`
			<div class="ecd-overlay" @mousedown=${() => this.#close(false)}
				@dragstart=${e => e.stopPropagation()}
				@dragover=${e => { e.stopPropagation(); e.preventDefault(); }}>
				<div class="ecd-panel" @mousedown=${(e) => e.stopPropagation()}>
					<div class="ecd-header">
						<span class="ecd-title">
							<span class="ecd-title-icon">${unsafeHTML(icon('codeXml', { size: 18 }))}</span>
							${window.i18n.getMessage('dragActionSendCustomEvent')}
						</span>
						<button type="button" class="ecd-close" @click=${() => this.#close(false)}>${unsafeHTML(icons.x)}</button>
					</div>
					<div class="ecd-body">
						<div class="ecd-row">
							<span class="ecd-label"><code>type</code></span>
							<input type="text" class="ecd-input"
								placeholder="flowmouse:drag"
								.value=${this._eventType}
								maxlength="50"
								@input=${(e) => { this._eventType = e.target.value; this.requestUpdate(); }}>
						</div>
						<div class="ecd-row">
							<span class="ecd-label"><code>detail</code></span>
							<textarea class="ecd-textarea ${isValidJson ? '' : 'invalid'}"
								placeholder='{"key": "value"}'
								rows="3"
								.value=${this._eventDetail}
								maxlength="200"
								@input=${(e) => { this._eventDetail = e.target.value; this.requestUpdate(); }}></textarea>
						</div>
						${!isValidJson ? html`
							<div class="ecd-warning">${window.i18n.getMessage('customEventInvalidJson')}</div>
						` : ''}
						<label class="ecd-checkbox">
							<input type="checkbox"
							.checked=${this._gestureInfo}
							@change=${(e) => { this._gestureInfo = e.target.checked; this.requestUpdate(); }}>
							<span>${unsafeHTML(gestureInfoLabel)}</span>
						</label>
						<div class="ecd-hint">${unsafeHTML(hint)}</div>
					</div>
					<div class="ecd-footer">
						<button type="button" class="btn btn-lg btn-secondary ecd-btn" @click=${() => this.#close(false)}>
							${window.i18n.getMessage('buttonCancel')}
						</button>
						<button type="button" class="btn btn-lg btn-primary ecd-btn" @click=${() => this.#close(true)}>
							${window.i18n.getMessage('buttonConfirm')}
						</button>
					</div>
				</div>
			</div>
		`;
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('event-config-dialog', EventConfigDialog);
});