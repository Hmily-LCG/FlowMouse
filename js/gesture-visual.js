class ShadowHost {
	#useDialog;
	#container = null;
	#shadow = null;
	#dialog = null;
	#foreignObject = null;
	#baseStyle = null;
	#builtInCssStyle = null;
	#builtInCss = '';
	#customCssStyle = null;
	#customCss = '';

	constructor(options) {
		this.#useDialog = options?.useDialog ?? false;
	}

	get shadow() { return this.#dialog ?? this.#shadow; }

	get container() { return this.#container; }

	get foreignObject() { return this.#foreignObject; }

	get isConnected() { return this.#container?.isConnected ?? false; }

	createElement(tagName) {
		if (document instanceof XMLDocument) {
			return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
		}
		return document.createElement(tagName);
	}

	setHTML(el, html) {
		if (document instanceof XMLDocument) {
			const doc = new DOMParser().parseFromString(html, 'text/html');
			el.replaceChildren(...doc.body.childNodes);
		} else {
			el.innerHTML = html;
		}
	}

	init(lang, isRtl, options) {
		if (this.#container) {
			if (!this.#container.isConnected) {
				this.cleanup();
			} else {
				return true;
			}
		}

		if (document.contentType === 'application/xml') {
			return false;
		}

		this.#container = this.createElement('div');
		this.#container.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			z-index: 2147483647;
			display: block !important;
			background: transparent !important;
			margin: 0 !important;
			padding: 0 !important;
			border: 0 !important;
			overflow: visible !important;
			opacity: 1 !important;
		`;

		this.setLang(lang, isRtl);

		this.#shadow = this.#container.attachShadow({ mode: 'closed' });

		if (this.#useDialog) {
			this.#dialog = this.createElement('dialog');
			this.#dialog.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				pointer-events: none;
				z-index: 2147483647;
				max-width: none;
				max-height: none;
				margin: 0;
				padding: 0;
				border: none;
				background: transparent;
				overflow: visible;
			`;
			this.#shadow.appendChild(this.#dialog);
			if (options?.topLayer !== 'modal') {
				this.#dialog.setAttribute('open', '');
			}
		}

		const contentRoot = this.shadow;

		this.#baseStyle = this.createElement('style');
		this.#baseStyle.textContent = this.#generateBaseCss(lang);
		contentRoot.appendChild(this.#baseStyle);

		this.#builtInCssStyle = this.createElement('style');
		this.#builtInCssStyle.textContent = this.#builtInCss || '';
		contentRoot.appendChild(this.#builtInCssStyle);

		this.#customCssStyle = this.createElement('style');
		this.#customCssStyle.textContent = this.#customCss || '';
		contentRoot.appendChild(this.#customCssStyle);

		this.#mount();
		if (options?.topLayer) this.#enterTopLayer(options.topLayer);
		return true;
	}

	setBuiltInCss(cssText) {
		this.#builtInCss = cssText || '';
		if (this.#builtInCssStyle) {
			this.#builtInCssStyle.textContent = this.#builtInCss;
		}
	}

	setCustomCss(cssText) {
		this.#customCss = cssText || '';
		if (this.#customCssStyle) {
			this.#customCssStyle.textContent = this.#customCss;
		}
	}

	setLang(lang, isRtl) {
		if (this.#container) {
			this.#container.lang = lang || '';
			this.#container.dir = isRtl ? 'rtl' : 'ltr';
		}
		if (this.#baseStyle) {
			this.#baseStyle.textContent = this.#generateBaseCss(lang);
		}
	}

	updateForeignObjectTransform() {
		if (!this.#foreignObject || !document.documentElement.getScreenCTM) return;
		try {
			const svg = document.documentElement;
			const ctm = svg.getScreenCTM();
			if (!ctm) return;

			const inv = ctm.inverse();

			this.#foreignObject.setAttribute('transform', `matrix(${inv.a}, ${inv.b}, ${inv.c}, ${inv.d}, ${inv.e}, ${inv.f})`);

			this.#foreignObject.setAttribute('x', '0');
			this.#foreignObject.setAttribute('y', '0');
			this.#foreignObject.setAttribute('width', window.innerWidth);
			this.#foreignObject.setAttribute('height', window.innerHeight);
		} catch (e) {
			console.warn('Failed to update foreignObject transform:', e);
		}
	}

	cleanup() {
		if (this.#dialog?.open) this.#dialog.close();
		if (this.#container?.hidePopover && this.#container?.matches(':popover-open')) this.#container.hidePopover();
		if (this.#foreignObject && this.#foreignObject.parentNode) {
			this.#foreignObject.parentNode.removeChild(this.#foreignObject);
		} else if (this.#container && this.#container.parentNode) {
			this.#container.parentNode.removeChild(this.#container);
		}
		this.#container = null;
		this.#shadow = null;
		this.#dialog = null;
		this.#foreignObject = null;
		this.#baseStyle = null;
		this.#builtInCssStyle = null;
		this.#customCssStyle = null;
	}


	#mount() {
		if (document.contentType === 'image/svg+xml' || (document.documentElement && document.documentElement.tagName.toLowerCase() === 'svg')) {
			this.#mountToSvg();
		} else {
			document.documentElement.appendChild(this.#container);
		}
	}

	#enterTopLayer(strategy) {
		if (!this.#container) return;
		if (strategy === 'modal') {
			if (!this.#dialog) throw new Error('ShadowHost: topLayer "modal" requires useDialog');
			if (this.#dialog.matches(':modal')) return;
			this.#dialog.showModal();
		} else {
			if (typeof this.#container.showPopover !== 'function') return;
			if (!this.#container.hasAttribute('popover')) {
				this.#container.setAttribute('popover', 'manual');
			}
			if (this.#container.matches(':popover-open')) return;
			this.#container.showPopover();
		}
	}

	#generateBaseCss(lang) {
		const fontFamily = "'Segoe UI',sans-serif";
		let extraRules = '';

		switch (lang) {
			case 'ja':
				extraRules = 'font-variant-east-asian: proportional-width;';
				break;
		}

		let css = `:host{font-family:${fontFamily} !important;${extraRules}}`;
		if (this.#useDialog) css += 'dialog::backdrop{background:transparent}';
		return css;
	}

	#mountToSvg() {
		this.#foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
		this.#foreignObject.setAttribute('width', '100%');
		this.#foreignObject.setAttribute('height', '100%');
		this.#foreignObject.setAttribute('x', '0');
		this.#foreignObject.setAttribute('y', '0');
		this.#foreignObject.style.pointerEvents = 'none';

		this.#foreignObject.appendChild(this.#container);
		document.documentElement.appendChild(this.#foreignObject);

		requestAnimationFrame(() => this.updateForeignObjectTransform());
	}
}

class LowPassFilter {
	constructor() {
		this.hasLast = false;
		this.lastOut = 0;
	}

	filter(value, alpha) {
		if (!this.hasLast) {
			this.hasLast = true;
			this.lastOut = value;
			return value;
		}
		this.lastOut = alpha * value + (1.0 - alpha) * this.lastOut;
		return this.lastOut;
	}
	
	lastValue() { return this.lastOut; }
	reset() { this.hasLast = false; }
}

class OneEuroFilter {
	constructor(minCutoff = 1.0, beta = 0.007, dcutoff = 1.0) {
		this.minCutoff = minCutoff;
		this.beta = beta;
		this.dcutoff = dcutoff;
		
		this.xFilter = new LowPassFilter();
		this.yFilter = new LowPassFilter();
		this.dxFilter = new LowPassFilter();
		this.dyFilter = new LowPassFilter();
		
		this.lastTime = null;
		this.timeOffset = null;
	}

	reset() {
		this.xFilter.reset();
		this.yFilter.reset();
		this.dxFilter.reset();
		this.dyFilter.reset();
		this.lastTime = null;
		this.timeOffset = null;
	}

	alpha(cutoff, freq) {
		const te = 1.0 / freq;
		const tau = 1.0 / (2 * Math.PI * cutoff);
		return 1.0 / (1.0 + tau / te);
	}

	filter(x, y, timestamp = null) {
		const now = performance.now();
		
		let effectiveTime;
		if (timestamp != null) {
			this.timeOffset = timestamp - now;
			effectiveTime = timestamp;
		} else {
			if (this.timeOffset === null) {
				this.timeOffset = 0;
			}
			effectiveTime = now + this.timeOffset;
		}

		if (this.lastTime === null) {
			this.lastTime = effectiveTime;
			return { 
				x: this.xFilter.filter(x, 1), 
				y: this.yFilter.filter(y, 1) 
			};
		}

		const dt = (effectiveTime - this.lastTime) / 1000.0;
		this.lastTime = effectiveTime;

		const freq = (dt > 0.00001) ? (1.0 / dt) : 60.0;

		const prevX = this.xFilter.lastValue();
		const prevY = this.yFilter.lastValue();
		
		const dx = (x - prevX) * freq;
		const dy = (y - prevY) * freq;

		const dAlpha = this.alpha(this.dcutoff, freq);
		const edx = this.dxFilter.filter(dx, dAlpha);
		const edy = this.dyFilter.filter(dy, dAlpha);

		const speed = Math.sqrt(edx * edx + edy * edy);
		const cutoff = this.minCutoff + this.beta * speed;
		
		const posAlpha = this.alpha(cutoff, freq);
		const newX = this.xFilter.filter(x, posAlpha);
		const newY = this.yFilter.filter(y, posAlpha);

		return { x: newX, y: newY };
	}
}


function colorWithAlpha(color, defaultAlpha = 1) {
	if (!color) return `rgba(0, 0, 0, ${defaultAlpha})`;
	if (color.startsWith('oklch(')) {
		if (/\//.test(color)) return color;
		if (defaultAlpha < 1) return color.replace(')', ` / ${defaultAlpha})`);
		return color;
	}
	const r = parseInt(color.slice(1, 3), 16);
	const g = parseInt(color.slice(3, 5), 16);
	const b = parseInt(color.slice(5, 7), 16);
	const a = color.length >= 9 ? parseInt(color.slice(7, 9), 16) / 255 : defaultAlpha;
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function colorHasAlpha(color) {
	if (!color || typeof color !== 'string') return false;
	if (color.startsWith('oklch(')) {
		const m = color.match(/\/\s*([\d.]+)/);
		return m ? parseFloat(m[1]) < 1 : false;
	}
	if (color.startsWith('#') && color.length >= 9) {
		return parseInt(color.slice(7, 9), 16) < 255;
	}
	const m = color.match(/rgba?\(.+?,\s*([\d.]+)\s*\)|hsla?\(.+?,\s*([\d.]+)\s*\)/);
	if (m) {
		const a = parseFloat(m[1] ?? m[2]);
		return a < 1;
	}
	return false;
}

function escapeHtml(text) {
	const element = document.createElement('div');
	element.textContent = text;
	return element.innerHTML;
}


class GestureOverlay {
	constructor() {
		this.canvas = null;
		this.ctx = null;
		this.trail = [];
		this.hud = null;

		this.host = new ShadowHost();

		this.animationFrameId = null;
		this.isDrawScheduled = false;

		this.settings = {
			hudBgColor: '#000000b3',
			hudTextColor: '#ffffff',
			hudBlurRadius: 5,
			enableHudShadow: true,
			trailColor: '#4285f4',
			trailWidth: 5,
			showTrailOrigin: true,
			showRawTrail: false,
			customCss: '',
			lang: '',
			isRtl: false,
			duplicatePointLimit: 8,
			enablePathInterpolation: true,

			enableInputStabilization: true,
			stabilizationCatchUpDelay: 25,      
			stabilizationCatchUpThreshold: 0.5, 

			minCutoff: 1.0, 
			beta: 0.007,    
			dcutoff: 1.0,   
		};

		this.lagTimer = null;

		this.filter = new OneEuroFilter(
			this.settings.minCutoff,
			this.settings.beta,
			this.settings.dcutoff
		);

		this.lastPointInput = null;
		this.duplicatePointCount = 0;
	}

	init() {
		if (!this.host.init(this.settings.lang, this.settings.isRtl, { topLayer: 'popover' })) return false;
		this.host.setCustomCss(this.settings.customCss);
		if (this.canvas) return true;

		const shadow = this.host.shadow;

		this.canvas = this.host.createElement('canvas');
		this.canvas.className = 'fm-gesture-trail';
		this.canvas.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			display: none;
		`;

		this.resizeHandler = () => {
			if (!this.canvas) return;
			const dpr = window.devicePixelRatio || 1;
			const width = window.innerWidth;
			const height = window.innerHeight;

			this.canvas.width = width * dpr;
			this.canvas.height = height * dpr;
			this.canvas.style.width = width + 'px';
			this.canvas.style.height = height + 'px';
			this.ctx = this.canvas.getContext('2d');
			this.ctx.scale(dpr, dpr);

			if (this.host.foreignObject) {
				this.host.updateForeignObjectTransform();
			}
		};

		this.resizeHandler();

		shadow.appendChild(this.canvas);

		this.hud = this.host.createElement('div');
		this.hud.className = 'fm-gesture-hud';
		this.updateHudStyle();
		shadow.appendChild(this.hud);

		void this.hud.offsetHeight;

		window.addEventListener('resize', this.resizeHandler);

		return true;
	}

	updateHudStyle() {
		this.host.setBuiltInCss(this.#generateStyles());
	}

	#generateStyles() {
		const bg = colorWithAlpha(this.settings.hudBgColor, 0.7);
		const text = colorWithAlpha(this.settings.hudTextColor);
		const blur = this.settings.hudBlurRadius ?? 5;
		const shadow = this.settings.enableHudShadow ? '0 4px 15px rgba(0,0,0,0.3)' : 'none';

		return `
			.fm-gesture-hud {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -40%);
				background-color: ${bg};
				color: ${text};
				padding-inline: 27px 30px;
				padding-block: 15px 16px;
				border-radius: 10px;
				font-size: 24px;
				line-height: 32px;
				font-weight: 600;
				pointer-events: none;
				opacity: 0;
				transition: opacity 0.2s, transform 0.2s;
				text-align: center;
				box-shadow: ${shadow};
				backdrop-filter: blur(${blur}px);
				user-select: none;
			}
			.fm-gesture-hud.fm-gesture-hud--arrows-only {
				padding-inline-end: 27px;
			}
			.fm-gesture-hud-layout {
				display: inline-flex;
				align-items: center;
				gap: 12px;
				text-align: start;
				max-width: 80vw;
			}
			.fm-gesture-hud-arrows {
				line-height: 32px;
			}
			.fm-gesture-hud-texts {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				flex-shrink: 0;
				white-space: nowrap;
				gap: 4px;
			}
		`;
	}

	updateSettings(settings) {
		this.settings = { ...this.settings, ...settings };
		if (this.host.container && (settings.lang !== undefined || settings.isRtl !== undefined)) {
			this.host.setLang(this.settings.lang, this.settings.isRtl);
		}
		if (settings.customCss !== undefined) {
			this.host.setCustomCss(this.settings.customCss);
		}
		this.updateHudStyle();
	}

	show() {
		if (this._teardownTimer) {
			clearTimeout(this._teardownTimer);
			this._teardownTimer = null;
		}
		if (this.host.container && !this.host.isConnected) {
			this.cleanup();
		}
		if (!this.init()) return;
		this.trail = [];

		this.filter.minCutoff = this.settings.minCutoff;
		this.filter.beta = this.settings.beta;
		this.filter.dcutoff = this.settings.dcutoff;

		this.filter.reset();
		this.lastPointInput = null;
		this.duplicatePointCount = 0;
		this.canvas.style.display = 'block';
	}

	hide() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
			this.isDrawScheduled = false;
		}
		if (this.lagTimer) {
			clearTimeout(this.lagTimer);
			this.lagTimer = null;
		}
		if (this._teardownTimer) {
			clearTimeout(this._teardownTimer);
			this._teardownTimer = null;
		}
		if (this.canvas) {
			this.canvas.style.display = 'none';
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
		if (this.hud) {
			this.hud.style.opacity = '0';
			this.hud.style.transform = 'translate(-50%, -40%)';
		}
		this.trail = [];

		this._teardownTimer = setTimeout(() => {
			this._teardownTimer = null;
			this.#teardown();
		}, 220);
	}

	#teardown() {
		if (this._teardownTimer) {
			clearTimeout(this._teardownTimer);
			this._teardownTimer = null;
		}
		if (this.resizeHandler) {
			window.removeEventListener('resize', this.resizeHandler);
			this.resizeHandler = null;
		}
		this.host.cleanup();
		this.ctx = null;
		this.canvas = null;
		this.hud = null;
	}

	addPoint(x, y, timestamp = null) {
		if (!this.init()) return;
		if (this.lastPointInput && this.lastPointInput.x === x && this.lastPointInput.y === y) {
			this.duplicatePointCount++;
		} else {
			this.duplicatePointCount = 1;
			this.lastPointInput = { x, y };
		}

		if (this.duplicatePointCount >= this.settings.duplicatePointLimit) return;

		if (this.lagTimer) {
			clearTimeout(this.lagTimer);
			this.lagTimer = null;
		}

		if (this.settings.enableInputStabilization) {
			const filtered = this.filter.filter(x, y, timestamp);
			this.trail.push({ x: filtered.x, y: filtered.y, rawX: x, rawY: y });
			this.#scheduleDraw();
			this.lagTimer = setTimeout(() => this.#catchUp(), this.settings.stabilizationCatchUpDelay);
		} else {
			this.trail.push({ x, y, rawX: x, rawY: y });
			this.#scheduleDraw();
		}
	}

	addPoints(points) {
		if (!this.init()) return;
		const validPoints = [];
		for (const p of points) {
			if (this.lastPointInput && this.lastPointInput.x === p.x && this.lastPointInput.y === p.y) {
				this.duplicatePointCount++;
			} else {
				this.duplicatePointCount = 1;
				this.lastPointInput = { x: p.x, y: p.y };
			}
			if (this.duplicatePointCount < this.settings.duplicatePointLimit) {
				validPoints.push(p);
			}
		}

		if (validPoints.length === 0) return;

		if (this.lagTimer) {
			clearTimeout(this.lagTimer);
			this.lagTimer = null;
		}

		if (this.settings.enableInputStabilization) {
			for (const p of validPoints) {
				const filtered = this.filter.filter(p.x, p.y, p.timestamp);
				this.trail.push({ x: filtered.x, y: filtered.y, rawX: p.x, rawY: p.y });
			}
			this.#scheduleDraw();
			this.lagTimer = setTimeout(() => this.#catchUp(), this.settings.stabilizationCatchUpDelay);
		} else {
			for (const p of validPoints) {
				this.trail.push({ x: p.x, y: p.y, rawX: p.x, rawY: p.y });
			}
			this.#scheduleDraw();
		}
	}

	#catchUp() {
		if (!this.trail.length || !this.settings.enableInputStabilization) return;

		const last = this.trail[this.trail.length - 1];
		const dx = last.rawX - last.x;
		const dy = last.rawY - last.y;

		const threshold = this.settings.stabilizationCatchUpThreshold;
		if (dx * dx + dy * dy < threshold * threshold) return;

		this.addPoint(last.rawX, last.rawY);
	}

	updateAction(arrows, texts) {
		if (!Array.isArray(texts)) throw new TypeError('updateAction: texts must be an array');

		if (!arrows && texts.length === 0) {
			if (this.hud) this.hud.style.opacity = '0';
			return;
		}

		if (!this.init()) return;

		let innerHTML = '\u200B';
		const hasText = texts.length > 0 && texts.some(t => t);

		if (arrows && hasText) {
			const arrowsHtml = window.GestureConstants.arrowsToSvg(arrows);
			const textsHtml = texts.map(t => `<div class="fm-gesture-hud-text">${escapeHtml(t)}</div>`).join('');

			innerHTML += `<div class="fm-gesture-hud-layout">`
				+ `<div class="fm-gesture-hud-arrows">${arrowsHtml}</div>`
				+ `<div class="fm-gesture-hud-texts">${textsHtml}</div>`
				+ `</div>`;
		} else if (arrows) {
			innerHTML += window.GestureConstants.arrowsToSvg(arrows);
		} else {
			innerHTML += texts.map(t => `<div class="fm-gesture-hud-text">${escapeHtml(t)}</div>`).join('');
		}

		this.host.setHTML(this.hud, innerHTML);
		this.hud.classList.toggle('fm-gesture-hud--arrows-only', !hasText);
		this.hud.style.opacity = '1';
		this.hud.style.transform = 'translate(-50%, -50%)';
	}

	#scheduleDraw() {
		if (!this.isDrawScheduled) {
			this.isDrawScheduled = true;
			this.animationFrameId = requestAnimationFrame(() => {
				try {
					this.#draw();
				} finally {
					this.isDrawScheduled = false;
					this.animationFrameId = null;
				}
			});
		}
	}

	#draw() {
		if (!this.ctx) return;

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		if (this.trail.length < 1) return;

		const width = this.settings.trailWidth;
		const color = this.settings.trailColor;

		ctx.save();
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;

		if (this.trail.length >= 2) {
			ctx.beginPath();
			ctx.strokeStyle = color;
			ctx.lineWidth = width;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			if (this.trail.length < 3 || !this.settings.enablePathInterpolation) {
				ctx.moveTo(this.trail[0].x, this.trail[0].y);
				for (let i = 1; i < this.trail.length; i++) {
					ctx.lineTo(this.trail[i].x, this.trail[i].y);
				}
			} else {
				ctx.moveTo(this.trail[0].x, this.trail[0].y);
				let i;
				for (i = 1; i < this.trail.length - 2; i++) {
					const xc = (this.trail[i].x + this.trail[i + 1].x) / 2;
					const yc = (this.trail[i].y + this.trail[i + 1].y) / 2;
					ctx.quadraticCurveTo(this.trail[i].x, this.trail[i].y, xc, yc);
				}
				ctx.quadraticCurveTo(
					this.trail[i].x,
					this.trail[i].y,
					this.trail[i + 1].x,
					this.trail[i + 1].y
				);
			}
			ctx.stroke();
		}

		if (this.settings.showRawTrail && this.trail.length >= 2) {
			ctx.beginPath();
			ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
			ctx.lineWidth = 1;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			ctx.moveTo(this.trail[0].rawX, this.trail[0].rawY);
			for (let i = 1; i < this.trail.length; i++) {
				ctx.lineTo(this.trail[i].rawX, this.trail[i].rawY);
			}
			ctx.stroke();
		}

		if (this.settings.showTrailOrigin) {
			const originRadius = Math.max(width * 1.2, 4);
			const ox = this.trail[0].x, oy = this.trail[0].y;

			if (colorHasAlpha(color)) {
				ctx.globalCompositeOperation = 'destination-out';
				ctx.beginPath();
				ctx.arc(ox, oy, originRadius, 0, Math.PI * 2);
				ctx.fill();
				ctx.globalCompositeOperation = 'source-over';
			}

			ctx.beginPath();
			ctx.fillStyle = color;
			ctx.arc(ox, oy, originRadius, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.restore();
	}

	cleanup() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
			this.isDrawScheduled = false;
		}
		if (this.lagTimer) {
			clearTimeout(this.lagTimer);
			this.lagTimer = null;
		}
		this.trail = [];
		this.#teardown();
	}
}


class ToastOverlay {
	constructor() {
		this.host = new ShadowHost();
		this._activeToasts = [];
		this.settings = {
			hudBgColor: '#000000b3',
			hudTextColor: '#ffffff',
			hudBlurRadius: 5,
			customCss: '',
			lang: '',
			isRtl: false,
		};
	}

	updateSettings(settings) {
		if (settings.hudBgColor !== undefined) this.settings.hudBgColor = settings.hudBgColor;
		if (settings.hudTextColor !== undefined) this.settings.hudTextColor = settings.hudTextColor;
		if (settings.hudBlurRadius !== undefined) this.settings.hudBlurRadius = settings.hudBlurRadius;
		if (settings.customCss !== undefined) this.settings.customCss = settings.customCss;
		if (settings.lang !== undefined) this.settings.lang = settings.lang;
		if (settings.isRtl !== undefined) this.settings.isRtl = settings.isRtl;
		if (this.host.container) {
			if (settings.lang !== undefined || settings.isRtl !== undefined) {
				this.host.setLang(this.settings.lang, this.settings.isRtl);
			}
			if (settings.customCss !== undefined) {
				this.host.setCustomCss(this.settings.customCss);
			}
			this.host.setBuiltInCss(this.#generateStyles());
		}
	}

	#ensureHost() {
		if (this.host.container && !this.host.isConnected) {
			this.#teardown();
		}
		if (!this.host.init(this.settings.lang, this.settings.isRtl, { topLayer: 'popover' })) return false;
		this.host.setCustomCss(this.settings.customCss);
		this.host.setBuiltInCss(this.#generateStyles());
		return true;
	}

	#generateStyles() {
		const bg = colorWithAlpha(this.settings.hudBgColor, 0.75);
		const text = colorWithAlpha(this.settings.hudTextColor);
		const blur = this.settings.hudBlurRadius ?? 5;

		return `
			.fm-toast {
				position: fixed;
				bottom: 18%;
				left: 50%;
				transform: translateX(-50%) translateY(12px);
				background: ${bg};
				color: ${text};
				padding: 10px 20px;
				border-radius: 10px;
				font-size: 13.5px;
				line-height: 1.5;
				max-width: min(420px, 80vw);
				text-align: center;
				white-space: pre-line;
				word-break: break-word;
				opacity: 0;
				transition: opacity 0.25s cubic-bezier(.4,0,.2,1),
							transform 0.25s cubic-bezier(.4,0,.2,1);
				backdrop-filter: blur(${blur}px);
				pointer-events: none;
				user-select: none;
				z-index: 1;
			}
			.fm-toast.fm-toast--visible {
				opacity: 1;
				transform: translateX(-50%) translateY(0);
			}
			.fm-toast.fm-toast--clickable {
				pointer-events: auto;
				cursor: pointer;
			}
			.fm-toast.fm-toast--clickable:hover {
				filter: brightness(1.08);
			}
		`;
	}

	showToast(message, options = {}) {
		console.log(message, options);
		const { duration = 5000, onClick = null } = options;
		if (!this.#ensureHost()) return () => {};

		const toast = this.host.createElement('div');
		toast.className = 'fm-toast';
		if (onClick) toast.classList.add('fm-toast--clickable');
		toast.textContent = message;

		const offsetPx = this._activeToasts.reduce((sum, t) => sum + (t.offsetHeight || 0) + 8, 0);
		if (offsetPx > 0) {
			toast.style.marginBottom = offsetPx + 'px';
		}

		this.host.shadow.appendChild(toast);
		this._activeToasts.push(toast);

		void toast.offsetHeight;
		toast.classList.add('fm-toast--visible');

		let dismissed = false;
		const dismiss = () => {
			if (dismissed) return;
			dismissed = true;
			clearTimeout(timerId);
			toast.classList.remove('fm-toast--visible');
			const idx = this._activeToasts.indexOf(toast);
			if (idx !== -1) this._activeToasts.splice(idx, 1);
			this.#recalcOffsets();

			setTimeout(() => {
				if (toast.parentNode) toast.parentNode.removeChild(toast);
				if (this._activeToasts.length === 0) {
					this.#teardown();
				}
			}, 260);
		};

		if (onClick) {
			toast.addEventListener('click', () => { onClick(); dismiss(); });
		}

		const timerId = setTimeout(dismiss, duration);

		return dismiss;
	}

	#recalcOffsets() {
		let offset = 0;
		for (const t of this._activeToasts) {
			t.style.marginBottom = offset > 0 ? offset + 'px' : '';
			offset += (t.offsetHeight || 0) + 8;
		}
	}

	#teardown() {
		this.host.cleanup();
	}

	cleanup() {
		this._activeToasts = [];
		this.#teardown();
	}
}

window.ShadowHost = ShadowHost;
window.GestureOverlay = GestureOverlay;
window.ToastOverlay = ToastOverlay;