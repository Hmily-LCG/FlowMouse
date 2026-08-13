import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { SettingsStore } from '../settings-store.js';
import { icon, iconDataUri } from '../icons.js';

function buildPreviewItems() {
	return [
		{ label: 'FlowMouse', icon: '../icons/icon48.png',    time: Date.now() - 30_000, active: true },
		{ label: 'GitHub',    icon: iconDataUri('github'),    time: Date.now() - 5 * 60_000 },
		{ label: window.i18n.getMessage('aboutTitleShort'), icon: iconDataUri('info'), time: Date.now() - 2 * 3600_000 },
	];
}

const CUSTOM_CSS_MAX_LENGTH = 7500;

const HUD_KEYS = ['hudBgColor', 'hudTextColor', 'hudBlurRadius', 'enableHudShadow'];

const SAMPLE_CSS = `/* FlowMouse - Custom CSS example */

:host {
	font-family: Consolas, monospace !important;
}

.fm-ctx-item {
	font-weight: 500;
}

.fm-gesture-hud {
	letter-spacing: 0.5px;
}
`;

class CssEditorPage extends LitElement {
	static properties = {
		_ready:     { state: true },
		_css:       { state: true },
		_savedCss:  { state: true },
		_status:    { state: true },
		_statusKind:{ state: true },
		_sampleItems: { state: true },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
				height: 100vh;
				overflow: hidden;
			}

			.layout {
				display: flex;
				flex-direction: column;
				height: 100%;
			}

			.editor-hint {
				padding: 10px 20px;
				font-size: 12.5px;
				color: var(--text-secondary);
				border-block-start: 1px solid var(--border-color);
				line-height: 1.55;
				flex-shrink: 0;
			}

			.editor-toolbar {
				display: flex;
				align-items: center;
				justify-content: flex-end;
				gap: 8px;
				padding: 8px 12px 8px 20px;
				border-bottom: 1px solid var(--border-color);
				background: var(--bg-secondary);
				flex-shrink: 0;
			}

			.toolbar-status {
				font-size: 12.5px;
				color: var(--text-secondary);
				opacity: 0;
				transition: opacity 0.2s ease;
				white-space: nowrap;
			}
			.toolbar-status.show { opacity: 1; }
			.toolbar-status.error { color: var(--danger-color); }
			.toolbar-status.success { color: var(--success-color); }


			.main {
				flex: 1;
				display: grid;
				grid-template-columns: minmax(360px, 2fr) minmax(360px, 2fr);
				min-height: 0;
			}

			@media (max-width: 900px) {
				.main {
					grid-template-columns: 1fr;
					grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
				}
			}

			.editor {
				display: flex;
				flex-direction: column;
				min-height: 0;
				border-inline-end: 1px solid var(--border-color);
				background: var(--bg-primary);
			}

			.editor-hint code {
				font-family: var(--font-mono);
				padding: 1px 5px;
				border-radius: 4px;
				background: var(--bg-tertiary);
				font-size: 0.92em;
			}

			.editor textarea {
				flex: 1;
				width: 100%;
				min-height: 0;
				resize: none;
				border: none;
				outline: none;
				border-radius: 0;
				padding: 14px 20px;
				box-shadow: none !important;
				font-family: var(--font-mono);
				font-size: 13px;
				line-height: 1.55;
				background: var(--input-bg);
				color: var(--text-primary);
				tab-size: 2;
				white-space: pre;
				overflow: auto;
			}

			.char-counter {
				font-size: 11.5px;
				color: var(--text-muted);
				font-variant-numeric: tabular-nums;
				white-space: nowrap;
			}
			.char-counter.warn { color: var(--warning-color); }
			.char-counter.over { color: var(--danger-color); font-weight: 600; }

			.preview {
				display: grid;
				grid-template-rows: 1fr 1fr;
				min-height: 0;
				background: var(--bg-primary);
			}

			.preview-panel {
				position: relative;
				min-height: 0;
				display: flex;
				flex-direction: column;
				overflow: hidden;
			}
			.preview-panel + .preview-panel {
				border-block-start: 1px solid var(--border-color);
			}

			.preview-label {
				position: absolute;
				top: 10px;
				inset-inline-start: 14px;
				font-size: 11px;
				font-weight: 600;
				letter-spacing: 0.8px;
				text-transform: uppercase;
				color: var(--text-muted);
				background: var(--bg-secondary);
				padding: 3px 8px;
				border-radius: 6px;
				border: 1px solid var(--section-border);
				z-index: 2;
				pointer-events: none;
			}

			.preview-stage {
				flex: 1;
				position: relative;
				display: flex;
				align-items: safe center;
				justify-content: safe center;
				background-image:
					linear-gradient(45deg, var(--bg-secondary) 25%, transparent 25%),
					linear-gradient(-45deg, var(--bg-secondary) 25%, transparent 25%),
					linear-gradient(45deg, transparent 75%, var(--bg-secondary) 75%),
					linear-gradient(-45deg, transparent 75%, var(--bg-secondary) 75%);
				background-size: 18px 18px;
				background-position: 0 0, 0 9px, 9px -9px, -9px 0;
				overflow: auto;
			}

			.hud-stage,
			.ctx-stage {
				position: relative;
				width: 100%;
				height: 100%;
			}
		`,
	];

	constructor() {
		super();
		this._ready = false;
		this._css = '';
		this._savedCss = '';
		this._status = '';
		this._statusKind = 'success';
		this._sampleItems = null;
		this._visualizer = null;
		this._ctxMenuHost = null;
		this._ctxMenuEl = null;
		this._statusTimer = null;

		this.#init();
	}

	async #init() {
		await window.i18n.waitForInit();
		this._sampleItems = buildPreviewItems();

		await SettingsStore.load();
		this._css = SettingsStore.current.customCss || '';
		this._savedCss = this._css;

		SettingsStore.onChange((changed) => {
			if ('theme' in changed) {
				window.i18n.applyTheme(changed.theme);
			}
			if ('customCss' in changed) {
				const nextSaved = changed.customCss || '';
				const wasDirty = this.#isDirty();
				this._savedCss = nextSaved;
				if (!wasDirty) {
					this._css = nextSaved;
					this.#applyPreviewCss(nextSaved);
				}
			}
			if (HUD_KEYS.some(k => k in changed)) this.#updateVisualizer();
		});

		this._ready = true;
		await this.updateComplete;
		this.#mountHudPreview();
		this.#mountCtxMenuPreview();

		window.addEventListener('beforeunload', this.#onBeforeUnload);
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		window.removeEventListener('beforeunload', this.#onBeforeUnload);
		if (this._visualizer) {
			this._visualizer.cleanup();
			this._visualizer = null;
		}
		if (this._ctxMenuHost) {
			this._ctxMenuHost.cleanup();
			this._ctxMenuHost = null;
			this._ctxMenuEl = null;
		}
	}

	#onBeforeUnload = (e) => {
		if (this.#isDirty()) {
			e.preventDefault();
			e.returnValue = '';
		}
	};

	#isDirty() {
		return this._css !== this._savedCss;
	}

	#mountHudPreview() {
		const stage = this.renderRoot.getElementById('hudStage');
		if (!stage || this._visualizer) return;

		this._visualizer = new window.GestureOverlay();
		this.#updateVisualizer();
		this._visualizer.updateAction('→', [i18n.getMessage('actionForward')]);
		this._visualizer.updateSuggestedGestures([
			{ pattern: '→↑', actionName: i18n.getMessage('actionNewTab') },
			{ pattern: '→←', actionName: i18n.getMessage('actionRestoreTab') },
			{ pattern: '→↓', actionName: i18n.getMessage('actionRefresh') },
		], '→');

		const container = this._visualizer.host.container;
		if (container) {
			stage.appendChild(container);
			container.style.position = 'absolute';
			container.style.inset = '0';
			container.style.width = '100%';
			container.style.height = '100%';
			container.style.zIndex = '1';
		}

		if (this._visualizer.canvas) this._visualizer.canvas.style.display = 'none';
	}

	#mountCtxMenuPreview() {
		const stage = this.renderRoot.getElementById('ctxStage');
		if (!stage || this._ctxMenuHost) return;

		const host = new window.ShadowHost();

		const frameCss = new window.ContentContextMenu().generateStyles();
		const builtInCss = frameCss + `
			fm-context-menu[preview] {
				display: inline-block;
				vertical-align: top;
				overflow: hidden;
			}
		`;
		if (!host.init(window.i18n.getHtmlLang(), window.i18n.getDir() === 'rtl', {
			builtInCss,
			customCss: this._css,
		})) return;

		const wrapper = host.createElement('div');
		wrapper.style.cssText = `
			position: absolute;
			inset: 0;
			display: flex;
			align-items: safe center;
			justify-content: safe center;
			overflow: auto;
		`;

		const menu = host.createElement('fm-context-menu');
		menu.setAttribute('preview', '');
		menu.classList.add('fm-ctx-frame');
		menu.previewItems = this._sampleItems;
		menu.previewCss = this._css;
		wrapper.appendChild(menu);
		host.shadow.appendChild(wrapper);

		const container = host.container;
		stage.appendChild(container);
		container.style.position = 'absolute';
		container.style.inset = '0';
		container.style.width = '100%';
		container.style.height = '100%';
		container.style.pointerEvents = 'auto';

		this._ctxMenuHost = host;
		this._ctxMenuEl = menu;
	}

	#applyPreviewCss(cssText) {
		if (this._visualizer?.host) {
			this._visualizer.host.setCustomCss(cssText);
		}
		if (this._ctxMenuHost) {
			this._ctxMenuHost.setCustomCss(cssText);
		}
		if (this._ctxMenuEl) {
			this._ctxMenuEl.previewCss = cssText;
		}
	}

	#updateVisualizer() {
		if (!this._visualizer) return;
		const source = SettingsStore.current;
		const settings = {
			lang: window.i18n.getHtmlLang(),
			isRtl: window.i18n.getDir() === 'rtl',
			customCss: this._css,
		};
		for (const k of HUD_KEYS) if (k in source) settings[k] = source[k];
		this._visualizer.updateSettings(settings);
	}

	#onCssInput = (e) => {
		const next = e.target.value;
		this._css = next;
		this.#applyPreviewCss(next);
	};

	#onKeydown = (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			this.#save();
			return;
		}
		if (e.key === 'Tab' && !e.shiftKey) {
			e.preventDefault();
			const ta = e.target;
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			const next = ta.value.slice(0, start) + '\t' + ta.value.slice(end);
			const caret = start + 1;

			this._css = next;
			this.#applyPreviewCss(next);
			this.updateComplete.then(() => {
				ta.selectionStart = ta.selectionEnd = caret;
			});
		}
	};

	#insertSnippet = () => {
		const ta = this.renderRoot.getElementById('cssTextarea');
		if (!ta) return;
		const prefix = ta.value && !ta.value.endsWith('\n\n') ? (ta.value.endsWith('\n') ? '\n' : '\n\n') : '';
		const next = ta.value + prefix + SAMPLE_CSS;
		this._css = next;
		this.#applyPreviewCss(next);
		this.updateComplete.then(() => {
			ta.focus();
			ta.selectionStart = ta.selectionEnd = next.length;
		});
	};

	#reset = () => {
		if (this._css === this._savedCss) return;
		if (!confirm(window.i18n.getMessage('customCssEditorDiscardConfirm'))) return;
		this._css = this._savedCss;
		this.#applyPreviewCss(this._css);
	};

	#save = async () => {
		if (!this.#isDirty() || this._css.length > CUSTOM_CSS_MAX_LENGTH) return;
		const ok = await SettingsStore.save({ customCss: this._css });
		if (ok) {
			this._savedCss = this._css;
			this.#showStatus(window.i18n.getMessage('customCssEditorSaved'), 'success');
		} else {
			this.#showStatus('Save failed', 'error');
		}
	};

	#showStatus(message, kind = 'success') {
		this._status = message;
		this._statusKind = kind;
		clearTimeout(this._statusTimer);
		this._statusTimer = setTimeout(() => { this._status = ''; }, 2200);
	}

	render() {
		if (!this._ready) return html``;
		const i18n = window.i18n;
		const dirty = this.#isDirty();
		const len = this._css.length;
		const over = len > CUSTOM_CSS_MAX_LENGTH;
		const warn = !over && len > CUSTOM_CSS_MAX_LENGTH * 0.9;
		const counterCls = over ? 'over' : (warn ? 'warn' : '');
		const hasSnippet = this._css.includes(SAMPLE_CSS.trim());

		return html`
			<div class="layout">
				<div class="main">
					<section class="editor" aria-label="CSS editor">
						<div class="editor-toolbar">
							<span class="toolbar-status ${this._status ? 'show' : ''} ${this._statusKind}">
								${this._status}
							</span>
							<span class="char-counter ${counterCls}">${len} / ${CUSTOM_CSS_MAX_LENGTH}</span>
							<button class="btn btn-secondary" @click=${this.#insertSnippet} ?disabled=${hasSnippet}>
								${unsafeHTML(icon('plus', { size: 14, strokeWidth: 2.2 }))}
								<span>${i18n.getMessage('customCssEditorInsertSnippet')}</span>
							</button>
							<button class="btn btn-secondary" @click=${this.#reset} ?disabled=${!dirty}>
								${unsafeHTML(icon('rotateCcw', { size: 14, strokeWidth: 2.2 }))}
								<span>${i18n.getMessage('customCssEditorRevert')}</span>
							</button>
							<button class="btn btn-primary" @click=${this.#save} ?disabled=${!dirty || over}>
								${unsafeHTML(icon('check', { size: 14, strokeWidth: 2.2 }))}
								<span>${i18n.getMessage('customCssEditorSave')}</span>
							</button>
						</div>
						<textarea
							id="cssTextarea"
							dir="ltr"
							spellcheck="false"
							autocomplete="off"
							autocorrect="off"
							autocapitalize="off"
							.value=${this._css}
							@input=${this.#onCssInput}
							@keydown=${this.#onKeydown}
							placeholder=${i18n.getMessage('customCssEditorPlaceholder')}
						></textarea>
						<div class="editor-hint">
							${i18n.getMessage('customCssEditorHint')}
						</div>
					</section>

					<section class="preview" aria-label="Preview">
						<div class="preview-panel">
							<div class="preview-label">${i18n.getMessage('popupHint')}</div>
							<div class="preview-stage">
								<div class="hud-stage" id="hudStage"></div>
							</div>
						</div>
						<div class="preview-panel">
							<div class="preview-label">${i18n.getMessage('actionCategoryContextMenu')}</div>
							<div class="preview-stage">
								<div class="ctx-stage" id="ctxStage"></div>
							</div>
						</div>
					</section>
				</div>
			</div>
		`;
	}
}

customElements.define('css-editor-page', CssEditorPage);