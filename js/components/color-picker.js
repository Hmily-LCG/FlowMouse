import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { icon } from '../icons.js'; 
import { tooltip } from '../tooltip.js';

class ColorPicker extends LitElement {
	static properties = {
		value: { type: String },
		alpha: { type: Boolean },
		defaultValue: { type: String, attribute: 'default-value' },
		blurRadius: { type: Number, attribute: 'blur-radius' },
		defaultBlurRadius: { type: Number, attribute: 'default-blur-radius' },
		_isOpen: { state: true },
		_h: { state: true },
		_s: { state: true },
		_v: { state: true },
		_a: { state: true },
		_blur: { state: true },
	};

	static styles = css`
		:host {
			display: inline-flex;
			align-items: center;
			position: relative;
			font-family: inherit;
			vertical-align: middle;
		}

		* {
			box-sizing: border-box;
		}

		.checkerboard {
			background-image:
				linear-gradient(45deg, #ccc 25%, transparent 25%),
				linear-gradient(-45deg, #ccc 25%, transparent 25%),
				linear-gradient(45deg, transparent 75%, #ccc 75%),
				linear-gradient(-45deg, transparent 75%, #ccc 75%);
			background-size: 8px 8px;
			background-position: 0 0, 0 4px, 4px -4px, -4px 0;
		}

		.trigger {
			width: 36px;
			height: 24px;
			border-radius: 6px;
			border: none;
			cursor: pointer;
			padding: 0;
			overflow: hidden;
			transition: box-shadow 0.2s;
			box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.15);
		}

		.trigger:hover {
			box-shadow: inset 0 0 0 1.5px var(--accent-color);
		}

		.trigger:focus-visible {
			outline: none;
			box-shadow: inset 0 0 0 1.5px var(--accent-color), 0 0 0 2px rgba(66, 133, 244, 0.25);
		}

		.trigger-color {
			width: 100%;
			height: 100%;
		}

		.panel {
			position: absolute;
			top: calc(100% + 6px);
			left: 50%;
			transform: translateX(-50%);
			z-index: 1000;
			background: var(--card-bg);
			border: 1px solid var(--border-color-solid);
			border-radius: 12px;
			box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
			padding: 12px;
			width: 232px;
			opacity: 0;
			visibility: hidden;
			transition: opacity 0.15s ease, visibility 0.15s ease;
			user-select: none;
		}

		.panel.open {
			opacity: 1;
			visibility: visible;
		}

		.sv-area {
			position: relative;
			width: 100%;
			height: 150px;
			border-radius: 8px;
			overflow: hidden;
			cursor: crosshair;
			touch-action: none;
		}

		.sv-area canvas {
			width: 100%;
			height: 100%;
			display: block;
		}

		.sv-thumb {
			position: absolute;
			width: 14px;
			height: 14px;
			border-radius: 50%;
			border: 2px solid #fff;
			box-shadow: 0 0 0 1px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.15);
			pointer-events: none;
			transform: translate(-50%, -50%);
			transition: box-shadow 0.1s;
		}

		.slider-track {
			position: relative;
			width: 100%;
			height: 14px;
			border-radius: 7px;
			cursor: pointer;
			touch-action: none;
			margin-top: 10px;
		}

		.slider-track canvas {
			width: 100%;
			height: 100%;
			display: block;
			border-radius: 7px;
		}

		.slider-thumb {
			position: absolute;
			top: 50%;
			width: 16px;
			height: 16px;
			border-radius: 50%;
			border: 2px solid #fff;
			box-shadow: 0 0 0 1px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.15);
			pointer-events: none;
			transform: translate(-50%, -50%);
		}

		.input-row {
			display: flex;
			gap: 6px;
			margin-top: 10px;
			align-items: center;
		}

		.hex-input {
			flex: 1;
			min-width: 0;
			padding: 5px 8px;
			border-radius: 6px;
			border: 0;
			box-shadow: 0 0 0 0.75px var(--border-color);
			background: var(--input-bg);
			color: var(--text-primary);
			font-size: 12px;
			font-family: var(--font-mono);
			text-align: center;
			direction: ltr;
			outline: none;
			transition: box-shadow 0.15s ease;
		}

		.hex-input:focus {
			box-shadow: 0 0 0 2px var(--input-focus-border-color);
		}

		.alpha-input-wrap {
			display: flex;
			align-items: center;
			gap: 1px;
			flex-shrink: 0;
		}

		.alpha-input {
			width: 40px;
			padding: 5px 4px;
			border-radius: 6px;
			border: 0;
			box-shadow: 0 0 0 0.75px var(--border-color);
			background: var(--input-bg);
			color: var(--text-primary);
			font-size: 12px;
			font-family: var(--font-mono);
			text-align: center;
			outline: none;
			transition: box-shadow 0.15s ease;
			-moz-appearance: textfield;
		}

		.alpha-input::-webkit-inner-spin-button,
		.alpha-input::-webkit-outer-spin-button {
			-webkit-appearance: none;
		}

		.alpha-input:focus {
			box-shadow: 0 0 0 2px var(--input-focus-border-color);
		}

		.alpha-unit {
			font-size: 11px;
			color: var(--text-secondary);
			margin-inline-start: 1px;
		}

		.blur-row {
			display: flex;
			gap: 6px;
			margin-top: 10px;
			align-items: center;
		}

		.blur-label {
			font-size: 11px;
			color: var(--text-secondary);
			flex-shrink: 0;
		}

		.blur-slider {
			flex: 1;
			min-width: 0;
			height: 14px;
			-webkit-appearance: none;
			appearance: none;
			background: var(--border-color);
			border-radius: 7px;
			outline: none;
			cursor: pointer;
		}

		.blur-slider::-webkit-slider-thumb {
			-webkit-appearance: none;
			width: 16px;
			height: 16px;
			border-radius: 50%;
			background: #fff;
			border: 2px solid #fff;
			box-shadow: 0 0 0 1px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.15);
			cursor: pointer;
		}

		.blur-slider::-moz-range-thumb {
			width: 12px;
			height: 12px;
			border-radius: 50%;
			background: #fff;
			border: 2px solid #fff;
			box-shadow: 0 0 0 1px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.15);
			cursor: pointer;
		}

		.blur-value {
			font-size: 11px;
			color: var(--text-secondary);
			min-width: 28px;
			text-align: end;
			direction: ltr;
			flex-shrink: 0;
		}

		.footer-row {
			display: flex;
			gap: 8px;
			margin-top: 8px;
			align-items: center;
		}

		.preview-swatch {
			flex: 1;
			height: 24px;
			border-radius: 6px;
			overflow: hidden;
		}

		.preview-color {
			width: 100%;
			height: 100%;
			border-radius: inherit;
			box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
		}

		.reset-btn {
			height: 24px;
			border-radius: 6px;
			border: 0;
			box-shadow: 0 0 0 0.75px var(--border-color-solid);
			background: transparent;
			color: var(--text-secondary);
			cursor: pointer;
			transition: all 0.15s;
			flex-shrink: 0;
			display: flex;
			align-items: center;
			gap: 3px;
			padding: 0 8px;
			font-size: 11px;
			font-family: inherit;
		}

		.reset-btn svg {
			width: 12px;
			height: 12px;
			transform: translateY(1px);
		}

		.reset-btn:hover {
			background: var(--bg-tertiary);
			color: var(--text-primary);
			box-shadow: 0 0 0 2px var(--input-focus-border-color);
		}

		.reset-btn:focus-visible {
			box-shadow: 0 0 0 2px var(--input-focus-border-color);
			outline: none;
		}
	`;

	constructor() {
		super();
		this.value = '#000000';
		this.alpha = false;
		this.defaultValue = null;
		this.blurRadius = null;
		this.defaultBlurRadius = null;
		this._isOpen = false;
		this._h = 0;
		this._s = 0;
		this._v = 0;
		this._a = 100;
		this._blur = 0;
		this._dragging = null;
	}

	connectedCallback() {
		super.connectedCallback();
		this._onDocMouseDown = (e) => {
			if (!e.composedPath().includes(this)) this._isOpen = false;
		};
		this._onDocKeyDown = (e) => {
			if (this._isOpen && e.key === 'Escape') this._isOpen = false;
		};
		document.addEventListener('mousedown', this._onDocMouseDown);
		document.addEventListener('keydown', this._onDocKeyDown);
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		document.removeEventListener('mousedown', this._onDocMouseDown);
		document.removeEventListener('keydown', this._onDocKeyDown);
		this.#stopDrag();
	}

	willUpdate(changed) {
		if (changed.has('value') && !this._dragging) {
			const parsed = this.#parseHex(this.value || '#000000');
			const hsv = this.#rgbToHsv(parsed.r, parsed.g, parsed.b);
			this._h = hsv.h;
			this._s = hsv.s;
			this._v = hsv.v;
			if (parsed.a != null) this._a = parsed.a;
		}
		if (changed.has('blurRadius') && this.blurRadius != null) {
			this._blur = this.blurRadius;
		}
	}

	updated(changed) {
		if (this._isOpen) {
			this.#drawSV();
			this.#drawHue();
			this.#drawAlpha();
		}
		const hexInput = this.shadowRoot.querySelector('.hex-input');
		if (hexInput && hexInput !== this.shadowRoot.activeElement) {
			const rgb = this.#hsvToRgb(this._h, this._s, this._v);
			hexInput.value = this.#rgbToHex(rgb.r, rgb.g, rgb.b);
		}
	}

	render() {
		const rgb = this.#hsvToRgb(this._h, this._s, this._v);
		const hex6 = this.#rgbToHex(rgb.r, rgb.g, rgb.b);
		const a01 = this._a / 100;
		const rgba = `rgba(${rgb.r},${rgb.g},${rgb.b},${a01})`;
		const displayHex = this.alpha ? this.#toHex8(hex6, this._a) : hex6;

		return html`
			<button class="trigger checkerboard"
				@click=${this.#toggle}
				title=${displayHex}>
				<div class="trigger-color" style="background:${rgba}"></div>
			</button>

			<div class="panel ${this._isOpen ? 'open' : ''}">
				<div class="sv-area"
					@pointerdown=${this.#onSVDown}>
					<canvas width="208" height="150"></canvas>
					<div class="sv-thumb"
						style="left:${this._s * 100}%;top:${(1 - this._v) * 100}%;background:${hex6}">
					</div>
				</div>

				<div class="slider-track"
					@pointerdown=${this.#onHueDown}>
					<canvas width="208" height="14" data-type="hue"></canvas>
					<div class="slider-thumb"
						style="left:calc(6px + (100% - 12px) * ${this._h / 360});background:hsl(${this._h},100%,50%)">
					</div>
				</div>

				${this.alpha ? html`
					<div class="slider-track checkerboard"
						@pointerdown=${this.#onAlphaDown}>
						<canvas width="208" height="14" data-type="alpha"></canvas>
						<div class="slider-thumb"
							style="left:calc(6px + (100% - 12px) * ${this._a / 100});background:${rgba}">
						</div>
					</div>
				` : ''}

				<div class="input-row">
					<input class="hex-input"
						type="text"
						maxlength="7"
						spellcheck="false"
						@input=${this.#onHexInput}
						@change=${this.#onHexInput}
						@keydown=${this.#onHexKeyDown}>
					${this.alpha ? html`
						<div class="alpha-input-wrap">
							<input class="alpha-input"
								type="number"
								min="0" max="100"
								.value=${String(this._a)}
								@change=${this.#onAlphaInput}
								@input=${this.#onAlphaInput}>
							<span class="alpha-unit">%</span>
						</div>
					` : ''}
				</div>

				${this.blurRadius != null ? html`
					<div class="blur-row">
						<span class="blur-label">${window.i18n?.getMessage('blur') || 'Blur'}</span>
						<input class="blur-slider" type="range" min="0" max="20" step="1"
							.value=${String(this._blur)}
							@input=${this.#onBlurInput}
							@change=${this.#onBlurInput}>
						<span class="blur-value">${this._blur}px</span>
					</div>
				` : ''}

				<div class="footer-row">
					<div class="preview-swatch checkerboard">
						<div class="preview-color" style="background:${rgba}"></div>
					</div>
					${this.defaultValue || this.defaultBlurRadius != null ? html`
						<button class="reset-btn" @click=${this.#onReset} .tooltip=${tooltip(window.i18n.getMessage('reset'))}>${unsafeHTML(icon('rotateCcw', { strokeWidth: 2.5 }))}</button>
					` : ''}
				</div>
			</div>
		`;
	}


	#toggle() {
		this._isOpen = !this._isOpen;
	}

	#onReset = () => {
		if (this.defaultValue) {
			const parsed = this.#parseHex(this.defaultValue);
			const hsv = this.#rgbToHsv(parsed.r, parsed.g, parsed.b);
			this._h = hsv.h;
			this._s = hsv.s;
			this._v = hsv.v;
			if (parsed.a != null) this._a = parsed.a;
			else this._a = 100;
		}
		if (this.defaultBlurRadius != null) this._blur = this.defaultBlurRadius;
		this.#emitChange();
	};


	#drawSV() {
		const canvas = this.shadowRoot.querySelector('.sv-area canvas');
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		const ctx = canvas.getContext('2d', { willReadFrequently: false });

		const hueColor = this.#hsvToRgb(this._h, 1, 1);
		ctx.fillStyle = `rgb(${hueColor.r},${hueColor.g},${hueColor.b})`;
		ctx.fillRect(0, 0, w, h);

		const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
		whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
		whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = whiteGrad;
		ctx.fillRect(0, 0, w, h);

		const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
		blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
		blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
		ctx.fillStyle = blackGrad;
		ctx.fillRect(0, 0, w, h);
	}

	#onSVDown = (e) => {
		e.preventDefault();
		this.shadowRoot.querySelector('.hex-input')?.blur();
		this._dragging = 'sv';
		this.#updateSVFromEvent(e);
		e.target.closest('.sv-area').setPointerCapture(e.pointerId);
		const el = e.target.closest('.sv-area');
		el.addEventListener('pointermove', this.#onSVMove);
		el.addEventListener('pointerup', this.#onSVUp);
	};

	#onSVMove = (e) => {
		if (this._dragging === 'sv') this.#updateSVFromEvent(e);
	};

	#onSVUp = (e) => {
		const el = e.target.closest('.sv-area') || this.shadowRoot.querySelector('.sv-area');
		el?.removeEventListener('pointermove', this.#onSVMove);
		el?.removeEventListener('pointerup', this.#onSVUp);
		this._dragging = null;
		this.#emitChange();
	};

	#updateSVFromEvent(e) {
		const rect = this.shadowRoot.querySelector('.sv-area').getBoundingClientRect();
		const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
		this._s = x;
		this._v = 1 - y;
		this.#emitInput();
	}


	#drawHue() {
		const canvas = this.shadowRoot.querySelector('canvas[data-type="hue"]');
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		const ctx = canvas.getContext('2d');
		const grad = ctx.createLinearGradient(0, 0, w, 0);
		for (let i = 0; i <= 6; i++) {
			grad.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
		}
		ctx.fillStyle = grad;
		const r = 7 * dpr;
		ctx.beginPath();
		ctx.roundRect(0, 0, w, h, r);
		ctx.fill();
	}

	#onHueDown = (e) => {
		e.preventDefault();
		this.shadowRoot.querySelector('.hex-input')?.blur();
		this._dragging = 'hue';
		this.#updateHueFromEvent(e);
		e.target.closest('.slider-track').setPointerCapture(e.pointerId);
		const el = e.target.closest('.slider-track');
		el.addEventListener('pointermove', this.#onHueMove);
		el.addEventListener('pointerup', this.#onHueUp);
	};

	#onHueMove = (e) => {
		if (this._dragging === 'hue') this.#updateHueFromEvent(e);
	};

	#onHueUp = (e) => {
		const el = e.target.closest('.slider-track') || this.shadowRoot.querySelector('canvas[data-type="hue"]')?.closest('.slider-track');
		el?.removeEventListener('pointermove', this.#onHueMove);
		el?.removeEventListener('pointerup', this.#onHueUp);
		this._dragging = null;
		this.#emitChange();
	};

	#updateHueFromEvent(e) {
		const track = this.shadowRoot.querySelector('canvas[data-type="hue"]')?.closest('.slider-track');
		if (!track) return;
		const rect = track.getBoundingClientRect();
		const x = Math.max(0, Math.min(1, (e.clientX - rect.left - 6) / (rect.width - 12)));
		this._h = Math.round(x * 360);
		this.#emitInput();
	}


	#drawAlpha() {
		const canvas = this.shadowRoot.querySelector('canvas[data-type="alpha"]');
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		const ctx = canvas.getContext('2d');
		const rgb = this.#hsvToRgb(this._h, this._s, this._v);

		ctx.clearRect(0, 0, w, h);
		const grad = ctx.createLinearGradient(0, 0, w, 0);
		grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
		grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
		ctx.fillStyle = grad;
		const r = 7 * dpr;
		ctx.beginPath();
		ctx.roundRect(0, 0, w, h, r);
		ctx.fill();
	}

	#onAlphaDown = (e) => {
		e.preventDefault();
		this.shadowRoot.querySelector('.hex-input')?.blur();
		this._dragging = 'alpha';
		this.#updateAlphaFromEvent(e);
		e.target.closest('.slider-track').setPointerCapture(e.pointerId);
		const el = e.target.closest('.slider-track');
		el.addEventListener('pointermove', this.#onAlphaMove);
		el.addEventListener('pointerup', this.#onAlphaUp);
	};

	#onAlphaMove = (e) => {
		if (this._dragging === 'alpha') this.#updateAlphaFromEvent(e);
	};

	#onAlphaUp = (e) => {
		const el = e.target.closest('.slider-track') || this.shadowRoot.querySelectorAll('.slider-track')[1];
		el?.removeEventListener('pointermove', this.#onAlphaMove);
		el?.removeEventListener('pointerup', this.#onAlphaUp);
		this._dragging = null;
		this.#emitChange();
	};

	#updateAlphaFromEvent(e) {
		const canvases = this.shadowRoot.querySelectorAll('canvas[data-type="alpha"]');
		const canvas = canvases[0];
		if (!canvas) return;
		const track = canvas.closest('.slider-track');
		const rect = track.getBoundingClientRect();
		const x = Math.max(0, Math.min(1, (e.clientX - rect.left - 6) / (rect.width - 12)));
		this._a = Math.round(x * 100);
		this.#emitInput();
	}


	#onHexInput = (e) => {
		e.stopPropagation();
		let val = e.target.value.trim();
		if (!val.startsWith('#')) val = '#' + val;
		if (/^#[0-9a-f]{6}$/i.test(val)) {
			const parsed = this.#parseHex(val);
			const hsv = this.#rgbToHsv(parsed.r, parsed.g, parsed.b);
			this._h = hsv.h;
			this._s = hsv.s;
			this._v = hsv.v;
			this.#emitInput();
			if (e.type === 'change') this.#emitChange();
		}
	};

	#onHexKeyDown = (e) => {
		if (e.key === 'Enter') {
			e.target.blur();
		}
	};

	#onAlphaInput = (e) => {
		e.stopPropagation();
		const val = parseInt(e.target.value, 10);
		if (!isNaN(val)) {
			this._a = Math.max(0, Math.min(100, val));
			this.#emitInput();
			if (e.type === 'change') this.#emitChange();
		}
	};

	#onBlurInput = (e) => {
		e.stopPropagation();
		const val = parseInt(e.target.value, 10);
		if (!isNaN(val)) {
			this._blur = Math.max(0, Math.min(20, val));
			this.#emitInput();
			if (e.type === 'change') this.#emitChange();
		}
	};


	#getOutputValue() {
		const rgb = this.#hsvToRgb(this._h, this._s, this._v);
		const hex6 = this.#rgbToHex(rgb.r, rgb.g, rgb.b);
		return this.alpha ? this.#toHex8(hex6, this._a) : hex6;
	}

	#emitInput() {
		const val = this.#getOutputValue();
		this.value = val;
		const detail = { value: val };
		if (this.blurRadius != null) detail.blurRadius = this._blur;
		this.dispatchEvent(new CustomEvent('input', {
			bubbles: true, composed: true, detail,
		}));
	}

	#emitChange() {
		const val = this.#getOutputValue();
		this.value = val;
		const detail = { value: val };
		if (this.blurRadius != null) detail.blurRadius = this._blur;
		this.dispatchEvent(new CustomEvent('change', {
			bubbles: true, composed: true, detail,
		}));
	}

	#stopDrag() {
		this._dragging = null;
	}


	#parseHex(hex) {
		const m8 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
		if (m8) {
			return {
				r: parseInt(m8[1], 16),
				g: parseInt(m8[2], 16),
				b: parseInt(m8[3], 16),
				a: Math.round(parseInt(m8[4], 16) / 255 * 100),
			};
		}
		const m6 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
		if (m6) {
			return {
				r: parseInt(m6[1], 16),
				g: parseInt(m6[2], 16),
				b: parseInt(m6[3], 16),
				a: null,
			};
		}
		return { r: 0, g: 0, b: 0, a: null };
	}

	#toHex8(hex6, alphaPercent) {
		const a = Math.round(alphaPercent / 100 * 255).toString(16).padStart(2, '0');
		return hex6 + a;
	}

	#rgbToHex(r, g, b) {
		return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
	}

	#rgbToHsv(r, g, b) {
		r /= 255; g /= 255; b /= 255;
		const max = Math.max(r, g, b), min = Math.min(r, g, b);
		const d = max - min;
		let h = 0, s = max === 0 ? 0 : d / max, v = max;

		if (d !== 0) {
			switch (max) {
				case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
				case g: h = ((b - r) / d + 2) / 6; break;
				case b: h = ((r - g) / d + 4) / 6; break;
			}
		}
		return { h: Math.round(h * 360), s, v };
	}

	#hsvToRgb(h, s, v) {
		h = h / 360;
		let r, g, b;
		const i = Math.floor(h * 6);
		const f = h * 6 - i;
		const p = v * (1 - s);
		const q = v * (1 - f * s);
		const t = v * (1 - (1 - f) * s);
		switch (i % 6) {
			case 0: r = v; g = t; b = p; break;
			case 1: r = q; g = v; b = p; break;
			case 2: r = p; g = v; b = t; break;
			case 3: r = p; g = q; b = v; break;
			case 4: r = t; g = p; b = v; break;
			case 5: r = v; g = p; b = q; break;
		}
		return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
	}
}

customElements.define('color-picker', ColorPicker);