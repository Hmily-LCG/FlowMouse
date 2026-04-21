import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles } from './shared-styles.js';

class GestureRecorder extends LitElement {
	static properties = {
		_state: { state: true },       
		_patternSvg: { state: true },
		_pattern: { state: true },
		_toast: { state: true },
	};

	static styles = [
		commonStyles,
		css`
			:host {
				display: contents;
			}


			.overlay {
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				z-index: 999999;
				background: rgba(10, 10, 20, 0.8);
				display: grid;
				grid-template-rows: 1fr auto 1fr;
				grid-template-columns: 1fr;
				align-items: center;
				justify-items: center;
				user-select: none;
				color: #fff;
				padding: 28px 0;
				box-sizing: border-box;
				animation: gr-overlay-in 0.2s ease-out;
			}

			.overlay-top {
				grid-row: 1;
				display: flex;
				align-items: flex-start;
				justify-content: center;
				align-self: start;
				width: 100%;
				padding-top: 4px;
			}

			.overlay-center {
				grid-row: 2;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.overlay-bottom {
				grid-row: 3;
				display: flex;
				align-items: flex-end;
				justify-content: center;
				align-self: end;
				width: 100%;
			}

			.overlay.state-ready {
				cursor: crosshair;
			}

			@keyframes gr-overlay-in {
				from { opacity: 0; }
				to   { opacity: 1; }
			}


			@keyframes gr-content-in {
				from { opacity: 0; transform: translateY(10px) scale(0.97); }
				to   { opacity: 1; transform: translateY(0) scale(1); }
			}


			.instruction {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 14px;
				animation: gr-content-in 0.3s ease-out;
				text-align: center;
				pointer-events: none;
			}

			.mouse-icon {
				width: 44px;
				height: 66px;
				border: 2px solid rgba(255, 255, 255, 0.45);
				border-radius: 22px;
				position: relative;
				display: flex;
				direction: ltr;
				margin-bottom: 4px;
			}

			.mouse-btn {
				flex: 1;
				height: 26px;
				position: relative;
			}

			.mouse-btn-left {
				border-radius: 22px 0 0 0;
				border-right: 1px solid rgba(255, 255, 255, 0.18);
				border-bottom: 1px solid rgba(255, 255, 255, 0.25);
			}

			.mouse-btn-right {
				border-radius: 0 22px 0 0;
				border-bottom: 1px solid rgba(255, 255, 255, 0.25);
			}

			.mouse-btn.active {
				background: rgba(66, 133, 244, 0.45);
				animation: gr-btn-glow 2s ease-in-out infinite;
			}

			@keyframes gr-btn-glow {
				0%, 100% { background: rgba(66, 133, 244, 0.35); }
				50%      { background: rgba(66, 133, 244, 0.55); }
			}

			.mouse-wheel {
				position: absolute;
				top: 9px;
				left: 50%;
				transform: translateX(-50%);
				width: 4px;
				height: 9px;
				border-radius: 2px;
				border: 1.5px solid rgba(255, 255, 255, 0.35);
			}

			.instruction-title {
				font-size: 26px;
				font-weight: 700;
				letter-spacing: -0.01em;
				margin: 0;
			}

			@keyframes gr-highlight-pulse {
				0%, 100% { transform: scale(1); }
				50% { transform: scale(1.06); color: #fff; }
			}

			.highlight-pulse {
				animation: gr-highlight-pulse 0.4s ease-in-out;
			}

			.instruction-desc {
				font-size: 15px;
				color: rgba(255, 255, 255, 0.65);
				line-height: 1.5;
				margin: 0;
			}

			.instruction-desc strong {
				color: var(--accent-color);
				font-weight: 600;
			}

			.direction-hints {
				display: flex;
				gap: 8px;
				margin-top: 6px;
				font-size: 20px;
				color: rgba(255, 255, 255, 0.38);
			}

			kbd {
				display: inline-block;
				padding: 1px 6px;
				font-weight: 600;
				font-size: 11px;
				font-family: inherit;
				background: rgba(255, 255, 255, 0.08);
				border: 1px solid rgba(255, 255, 255, 0.16);
				border-radius: 5px;
				box-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
				color: rgba(255, 255, 255, 0.45);
				line-height: 1.6;
			}


			.drawing-indicator {
				display: flex;
				align-items: center;
				gap: 9px;
				font-size: 14px;
				font-weight: 600;
				color: rgba(255, 255, 255, 0.65);
				background: rgba(0, 0, 0, 0.45);
				padding: 8px 18px;
				border-radius: 20px;
				pointer-events: none;
			}

			.pulse-dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: #ea4335;
				animation: gr-pulse 1.2s ease-in-out infinite;
			}

			@keyframes gr-pulse {
				0%, 100% { opacity: 1; transform: scale(1); }
				50%      { opacity: 0.4; transform: scale(0.7); }
			}


			.result {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 24px;
				animation: gr-content-in 0.3s ease-out;
			}

			.result-label {
				font-size: 14px;
				font-weight: 600;
				color: rgba(255, 255, 255, 0.4);
				text-transform: uppercase;
				letter-spacing: 0.08em;
			}

			.result-pattern {
				font-size: 52px;
				line-height: 1;
				color: #fff;
				display: flex;
				align-items: center;
				flex-wrap: wrap;
				justify-content: center;
				max-width: 80vw;
			}

			.result-actions {
				display: flex;
				gap: 10px;
				margin-top: 4px;
			}

			.result-actions .btn {
				min-width: 110px;
				font-weight: 600;
				pointer-events: auto;
			}

			.btn-redraw {
				background: rgba(255, 255, 255, 0.08);
				color: rgba(255, 255, 255, 0.85);
				box-shadow: 0 0 0 0.75px rgba(255, 255, 255, 0.18);
			}

			.btn-redraw:hover {
				background: rgba(255, 255, 255, 0.14);
				box-shadow: 0 0 0 0.75px rgba(255, 255, 255, 0.28);
			}


			.btn-cancel {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				background: transparent;
				color: rgba(255, 255, 255, 0.45);
				border: 1px solid rgba(255, 255, 255, 0.13);
				padding: 9px 15px;
				font-size: 13px;
				font-family: inherit;
				border-radius: 8px;
				cursor: pointer;
				transition: all 0.15s ease;
			}

			.btn-cancel:hover {
				color: rgba(255, 255, 255, 0.85);
				border-color: rgba(255, 255, 255, 0.28);
				background: rgba(255, 255, 255, 0.06);
			}


			.toast {
				position: fixed;
				top: 32px;
				left: 50%;
				transform: translateX(-50%);
				background: rgba(234, 67, 53, 0.9);
				color: #fff;
				padding: 8px 20px;
				border-radius: 20px;
				font-size: 14px;
				font-weight: 600;
				pointer-events: none;
				animation: gr-toast-in 0.25s ease-out;
				z-index: 1;
			}

			@keyframes gr-toast-in {
				from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
				to   { opacity: 1; transform: translateX(-50%) translateY(0); }
			}
		`,
	];

	#recognizer = null;
	#visualizer = null;
	#resolvePromise = null;
	#button = 2;
	#bannedPatterns = new Set();
	#toastTimer = null;

	constructor() {
		super();
		this._state = 'idle';
		this._pattern = '';
		this._patternSvg = '';
		this._toast = '';

		this._onMouseDown = this.#onMouseDown.bind(this);
		this._onMouseMove = this.#onMouseMove.bind(this);
		this._onMouseUp = this.#onMouseUp.bind(this);
		this._onContextMenu = this.#onContextMenu.bind(this);
		this._onKeyDown = this.#onKeyDown.bind(this);
	}

	async open({ button = 'right', bannedPatterns = [] } = {}) {
		this.#button = button === 'left' ? 0 : 2;
		this.#bannedPatterns = new Set(bannedPatterns);
		this._state = 'ready';
		this._pattern = '';
		this._patternSvg = '';
		this._toast = '';
		document.documentElement.style.overflow = 'hidden';

		this.#recognizer = new window.GestureRecognizer({ distanceThreshold: 20 });

		if (!this.#visualizer) {
			this.#visualizer = new window.GestureOverlay();
		}
		this.#visualizer.updateSettings({
			lang: window.i18n.getHtmlLang(),
			isRtl: window.i18n.getDir() === 'rtl',
		});

		this.#addListeners();

		return new Promise((resolve) => {
			this.#resolvePromise = resolve;
		});
	}


	disconnectedCallback() {
		super.disconnectedCallback();
		this.#removeListeners();
		this.#visualizer?.hide();
	}

	render() {
		if (this._state === 'idle') return html``;

		const i18n = window.i18n;
		const isRight = this.#button === 2;
		const buttonName = isRight
			? (i18n.getMessage('rightButton'))
			: (i18n.getMessage('leftButton'));

		return html`
			<div class="overlay ${this._state === 'ready' ? 'state-ready' : ''}"
				@contextmenu=${e => e.preventDefault()}>

				<div class="overlay-top">
					${this._state === 'drawing' ? html`
						<div class="drawing-indicator">
							<div class="pulse-dot"></div>
							${i18n.getMessage('gestureRecorderRecording')}
						</div>
					` : ''}
					${this._toast ? html`<div class="toast">${unsafeHTML(this._toast)}</div>` : ''}
				</div>

				<div class="overlay-center">
					${this._state === 'ready' ? html`
						<div class="instruction">
							<div class="mouse-icon">
								<div class="mouse-btn mouse-btn-left ${!isRight ? 'active' : ''}"></div>
								<div class="mouse-btn mouse-btn-right ${isRight ? 'active' : ''}"></div>
								<div class="mouse-wheel"></div>
							</div>
							<h2 class="instruction-title">
								${i18n.getMessage('gestureRecorderTitle')}
							</h2>
							<p class="instruction-desc">
								${unsafeHTML(i18n.getMessage('gestureRecorderDesc').replace('%button%', `<strong>${buttonName}</strong>`))}
							</p>
							<div class="direction-hints">
								${unsafeHTML(window.GestureConstants.arrowsToSvg('↑ ↓ ← →'))}
							</div>
						</div>
					` : ''}
					${this._state === 'result' ? html`
						<div class="result">
							<span class="result-label">
								${i18n.getMessage('gestureRecorderResult')}
							</span>
							<div class="result-pattern">
								${unsafeHTML(this._patternSvg)}
							</div>
							<div class="result-actions">
								<button class="btn btn-primary btn-lg"
									@mousedown=${e => e.stopPropagation()}
									@click=${() => this.#confirm()}>
									${i18n.getMessage('gestureRecorderConfirm')}
								</button>
								<button class="btn btn-lg btn-redraw"
									@mousedown=${e => e.stopPropagation()}
									@click=${() => this.#redraw()}>
									${i18n.getMessage('gestureRecorderRedraw')}
								</button>
							</div>
						</div>
					` : ''}
				</div>

				<div class="overlay-bottom">
					<button class="btn-cancel"
						@mousedown=${e => e.stopPropagation()}
						@click=${() => this.#cancel()}>
						<kbd>Esc</kbd> ${i18n.getMessage('gestureRecorderEsc')}
					</button>
				</div>
			</div>
		`;
	}


	#addListeners() {
		document.addEventListener('mousedown', this._onMouseDown, true);
		document.addEventListener('mousemove', this._onMouseMove, true);
		document.addEventListener('mouseup', this._onMouseUp, true);
		document.addEventListener('contextmenu', this._onContextMenu, true);
		document.addEventListener('keydown', this._onKeyDown, true);
	}

	#removeListeners() {
		document.removeEventListener('mousedown', this._onMouseDown, true);
		document.removeEventListener('mousemove', this._onMouseMove, true);
		document.removeEventListener('mouseup', this._onMouseUp, true);
		document.removeEventListener('contextmenu', this._onContextMenu, true);
		document.removeEventListener('keydown', this._onKeyDown, true);
	}

	#onContextMenu(e) {
		if (this._state === 'idle') return;
		e.preventDefault();
		e.stopPropagation();
	}

	#onKeyDown(e) {
		if (this._state === 'idle') return;
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			if (this._state === 'drawing') {
				this.#visualizer?.hide();
				this.#recognizer?.reset();
				this._state = 'ready';
			} else {
				this.#cancel();
			}
		}
	}

	#onMouseDown(e) {
		if (this._state !== 'ready') return;

		if (e.button !== this.#button) {
			const desc = this.shadowRoot?.querySelector('.instruction-desc');
			if (desc) {
				desc.classList.remove('highlight-pulse');
				void desc.offsetWidth;
				desc.classList.add('highlight-pulse');
				desc.addEventListener('animationend', () => desc.classList.remove('highlight-pulse'), { once: true });
			}
			return;
		}

		const path = e.composedPath();
		for (const el of path) {
			if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) return;
		}

		e.preventDefault();
		e.stopPropagation();

		this._state = 'drawing';
		this.#recognizer.start(e.clientX, e.clientY, e.timeStamp);
		this.#visualizer.show();
		this.#visualizer.addPoint(e.clientX, e.clientY, e.timeStamp);
	}

	#onMouseMove(e) {
		if (this._state !== 'drawing') return;

		const result = this.#recognizer.move(e.clientX, e.clientY, e.timeStamp);

		if (result.activated && result.preActivationTrail?.length) {
			this.#visualizer.addPoints(result.preActivationTrail);
		}

		if (this.#recognizer.isActive()) {
			this.#visualizer.addPoint(e.clientX, e.clientY, e.timeStamp);
		}

		if (result.directionChanged) {
			this.#visualizer.updateAction(result.pattern, []);
		}
	}

	#onMouseUp(e) {
		if (e.button !== this.#button) return;
		if (this._state !== 'drawing') return;

		e.preventDefault();
		e.stopPropagation();

		this.#visualizer.hide();

		const pattern = this.#recognizer.getPattern();
		if (pattern) {
			if (this.#bannedPatterns.has(pattern)) {
				this.#showToast(
					(window.i18n.getMessage('gestureRecorderBanned') || 'Gesture %pattern% already exists')
						.replace('%pattern%', window.GestureConstants.arrowsToSvg(pattern))
				);
				this.#recognizer?.reset();
				this._state = 'ready';
			} else {
				this._pattern = pattern;
				this._patternSvg = window.GestureConstants.arrowsToSvg(pattern);
				this._state = 'result';
			}
		} else {
			this._state = 'ready';
		}
	}


	#confirm() {
		const pattern = this._pattern;
		this.#close();
		if (this.#resolvePromise) {
			this.#resolvePromise({ pattern, cancelled: false });
			this.#resolvePromise = null;
		}
	}

	#redraw() {
		this._state = 'ready';
		this._pattern = '';
		this._patternSvg = '';
		this.#recognizer?.reset();
	}

	#cancel() {
		this.#close();
		if (this.#resolvePromise) {
			this.#resolvePromise({ pattern: null, cancelled: true });
			this.#resolvePromise = null;
		}
	}

	#showToast(message, duration = 2500) {
		clearTimeout(this.#toastTimer);
		this._toast = message;
		this.#toastTimer = setTimeout(() => { this._toast = ''; }, duration);
	}

	#close() {
		this._state = 'idle';
		this._toast = '';
		clearTimeout(this.#toastTimer);
		this.#removeListeners();
		this.#visualizer?.hide();
		this.#recognizer = null;
		document.documentElement.style.overflow = '';
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('gesture-recorder', GestureRecorder);
});