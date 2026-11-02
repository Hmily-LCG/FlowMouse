import { LitElement, html, svg, nothing, unsafeHTML, classMap, staticHtml, unsafeStatic } from './lib/lit-all.min.js';

const CONFIG = {
	DISTANCE_THRESHOLD: 30,
	REQUIRED_DRAG_DISTANCE: 150,
	REQUIRED_SUPER_DRAG_DISTANCE: 75,
};

const DOUBLE_CLICK_DELAY = 500;

const isMacOrLinux = /Mac|Linux/i.test(navigator.platform);
const isMac = /Mac/i.test(navigator.platform);

const prefersReducedMotion = () => false;

const motion = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const visualizer = new window.GestureOverlay();
const recognizer = new window.GestureRecognizer({ distanceThreshold: CONFIG.DISTANCE_THRESHOLD });
const dragRecognizer = new window.GestureRecognizer({ distanceThreshold: CONFIG.DISTANCE_THRESHOLD });

const TRAIL_SMOOTHING = {
	gesture: { minCutoff: 5.0, beta: 0.01, dcutoff: 1.0 },
	drag: { minCutoff: 1.0, beta: 0.007, dcutoff: 1.0 },
};

function showTrail(mode) {
	visualizer.setMode(mode);
	visualizer.updateSettings(TRAIL_SMOOTHING[mode]);
	visualizer.show();
}

const msg = key => window.i18n.getMessage(key);
const arrowsToSvg = text => window.GestureConstants.arrowsToSvg(text);

const arrows = pattern => unsafeHTML(arrowsToSvg(pattern));

function withArrows(text) {
	return text
		.replace(/(<span class=["']svg-arrow["']>)(.*?)(<\/span>)/g, (m, open, pattern, close) => open + arrowsToSvg(pattern) + close)
		.replaceAll('%arrow%', arrowsToSvg('→'));
}

const t = key => unsafeHTML(withArrows(msg(key)));

function getHudText(pattern) {
	const actionKey = window.GestureConstants.DEFAULT_GESTURES[pattern];
	return actionKey ? msg(window.GestureConstants.actionLabelKey(actionKey)) : '';
}

function getSuperDragHudText(dragType) {
	if (dragType === 'text') return msg(window.GestureConstants.actionLabelKey('search', 'text'));
	if (dragType === 'link') return msg(window.GestureConstants.actionLabelKey('openLink', 'link'));
	return '';
}

function virtualMouse({ left = '', right = '' } = {}) {
	return html`
		<div class="virtual-mouse-container">
			<div class="virtual-mouse">
				<div class="mouse-button mouse-left ${left}"></div>
				<div class="mouse-button mouse-right ${right}"></div>
				<div class="mouse-wheel"></div>
			</div>
		</div>`;
}

function discoveryChip(icon, label, done = false, gesture = nothing) {
	return html`
		<div class=${classMap({ 'discovery-item': true, completed: done, 'success-pulse': done })} data-gesture=${gesture}>
			<div class="discovery-icon">${icon}</div>
			<div class="discovery-name">${label}</div>
		</div>`;
}

function continueButton(visible, onClick) {
	return html`
		<div class="continue-row">
			<button class=${classMap({ 'btn': true, 'btn-primary': true, 'continue-btn': true, 'is-visible': visible })}
				@click=${onClick}>${t('tutorialContinue')}</button>
		</div>`;
}

class TutorialStep extends LitElement {
	static properties = {
		tutorial: { attribute: false },
	};

	createRenderRoot() {
		return this;
	}

	onEnter(arrival) { }

	onLeave() { }

	blocksContextMenu() {
		return false;
	}


	onRightPress(e) {
		return true;
	}

	onGestureStart(e) { }

	onGestureMove(x, gesture) { }

	onGestureEnd(gesture) {
		if (gesture.pattern) this.tutorial.react(gesture.pattern);
	}

	onGestureCancel(reason) { }


	onLeftPress(e) { }

	onLeftRelease() { }

	dragTypeFor(e) {
		return null;
	}

	onDragComplete(type, points) { }

	onDragEnd() { }
}

const GUIDE_DRAWING = `
	<div class="guide-track"><div class="guide-reveal"><div class="guide-dots"></div></div></div>
	<svg class="guide-head" viewBox="-20 -10 20 20"><path class="guide-halo" d="M -10 -8 L -2 0 L -10 8" /><path d="M -10 -8 L -2 0 L -10 8" /></svg>
	<span class="guide-origin"></span>`;

class GestureGuide {
	constructor(distance) {
		this.distance = distance;
		this.el = document.createElement('div');
		this.el.className = 'gesture-guide';
		this.el.setAttribute('aria-hidden', 'true');
		this.el.innerHTML = GUIDE_DRAWING;
		this.el.style.setProperty('--distance', distance + 'px');
		document.body.append(this.el);
	}

	show(x, y) {
		this.el.style.translate = `${x}px ${y}px`;
		this.el.style.setProperty('--progress', 0);
		this.el.classList.remove('visible', 'ready', 'off');
		void this.el.offsetWidth;
		this.el.classList.add('visible');
	}

	hide() {
		this.el.classList.remove('visible', 'ready', 'off');
	}

	progressAt(x, startX) {
		return Math.max(0, Math.min((x - startX) / this.distance, 1));
	}

	update(progress, offTrack, ready) {
		this.el.style.setProperty('--progress', progress);
		this.el.classList.toggle('off', offTrack);
		this.el.classList.toggle('ready', ready);
	}
}


class StrokeSparks {
	static MAX = 120;
	static DRAG = 4;
	static HOLD = 0.08;

	#canvas = null;
	#ctx = null;
	#width = 0;
	#height = 0;
	#pool = Array.from({ length: StrokeSparks.MAX }, () => (
		{ flight: null, ox: 0, oy: 0, vx: 0, vy: 0, px: 0, py: 0, u: 0, v: 0, age: 0, end: 1, size: 1, color: '' }
	));
	#count = 0;
	#frame = 0;
	#last = 0;
	#tickNo = 0;

	burst(points, options = {}) {
		let total = 0;
		for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
		if (total < 1) {
			options.onArrive?.();
			return;
		}
		const flight = this.#flight(options);
		if (!flight) return;

		const spacing = Math.max(7, total / (flight.target ? 40 : 90));
		const end = points[points.length - 1];
		const arrive = options.arrive ?? this.#arrival(flight, end.x, end.y);

		let walked = 0;
		let next = spacing / 2;
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1], b = points[i];
			const len = Math.hypot(b.x - a.x, b.y - a.y);
			if (len === 0) continue;
			const tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
			while (next <= walked + len) {
				const along = next / total;
				const at = (next - walked) / len;
				const spread = (Math.random() - 0.5) * 2;
				const speed = (60 + 260 * along) * (0.6 + Math.random() * 0.4);
				this.#spawn(flight,
					a.x + (b.x - a.x) * at - ty * spread * 3,
					a.y + (b.y - a.y) * at + tx * spread * 3,
					tx * speed - ty * spread * 50,
					ty * speed + tx * spread * 50,
					along * (flight.target ? 0.1 : 0.15),
					flight.target ? arrive + Math.random() * 0.12 : 0.45 + Math.random() * 0.4);
				next += spacing;
			}
			walked += len;
		}
		this.#launch(flight);
	}

	relay(from, to, options = {}) {
		const flight = this.#flight({ ...options, target: to });
		if (!flight) return;
		const r = from.getBoundingClientRect();
		const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
		const arrive = this.#arrival(flight, cx, cy);
		for (let i = 0; i < 16; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 80 + Math.random() * 140;
			this.#spawn(flight,
				cx + (Math.random() - 0.5) * r.width * 0.7,
				cy + (Math.random() - 0.5) * r.height * 0.7,
				Math.cos(angle) * speed,
				Math.sin(angle) * speed,
				Math.random() * 0.08,
				arrive + Math.random() * 0.1);
		}
		this.#launch(flight);
	}

	#flight({ target = null, onArrive = null, color = 'right', alive = null }) {
		if (prefersReducedMotion()) {
			onArrive?.();
			return null;
		}
		this.#fit();
		const rect = target?.getBoundingClientRect();
		const landable = !!rect && rect.width > 0 && rect.height > 0;
		if (!landable) onArrive?.();
		const style = getComputedStyle(document.body);
		const names = color === 'left' ? ['--accent-success', '--accent-success-text'] : ['--accent-primary', '--accent-text'];
		return {
			target: landable ? target : null,
			rect,
			spots: landable && target instanceof SVGSVGElement ? this.#shapeSpots(target, rect) : null,
			tick: this.#tickNo,
			onArrive: landable ? onArrive : null,
			landed: false,
			alive,
			sparks: 0,
			colors: names.map(name => style.getPropertyValue(name).trim()),
		};
	}

	#shapeSpots(icon, rect) {
		const paths = [...icon.querySelectorAll('path')];
		const lengths = paths.map(path => path.getTotalLength());
		const total = lengths.reduce((sum, len) => sum + len, 0);
		if (!total) return null;
		const spots = [];
		for (let i = 0; i < 48; i++) {
			let at = (i + 0.5) / 48 * total;
			let j = 0;
			while (j < paths.length - 1 && at > lengths[j]) at -= lengths[j++];
			const point = paths[j].getPointAtLength(at).matrixTransform(paths[j].getScreenCTM());
			spots.push({ u: (point.x - rect.left) / rect.width, v: (point.y - rect.top) / rect.height });
		}
		return spots;
	}

	#arrival(flight, x, y) {
		if (!flight.target) return 0;
		const r = flight.rect;
		const distance = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
		return Math.min(Math.max(0.4 + distance / 2000, 0.45), 0.8);
	}

	#spawn(flight, x, y, vx, vy, delay, end) {
		if (this.#count >= StrokeSparks.MAX) return;
		const s = this.#pool[this.#count++];
		s.flight = flight;
		s.ox = s.px = x;
		s.oy = s.py = y;
		s.vx = vx;
		s.vy = vy;
		s.u = 0.5 + (Math.random() - 0.5) * 0.6;
		s.v = 0.5 + (Math.random() - 0.5) * 0.6;
		s.age = -delay;
		s.end = end;
		s.size = 1 + Math.random() * 1.6;
		s.color = flight.colors[Math.random() < 0.6 ? 0 : 1];
		flight.sparks++;
	}

	#launch(flight) {
		if (flight.spots) {
			const first = this.#count - flight.sparks;
			for (let i = 0; i < flight.sparks; i++) {
				const spot = flight.spots[Math.floor(i * flight.spots.length / flight.sparks)];
				this.#pool[first + i].u = spot.u;
				this.#pool[first + i].v = spot.v;
			}
		}
		if (flight.sparks === 0 && flight.onArrive) {
			flight.landed = true;
			flight.onArrive();
		}
		if (!this.#frame && this.#count > 0) {
			this.#last = performance.now();
			this.#frame = requestAnimationFrame(this.#tick);
		}
	}

	#fit() {
		if (!this.#canvas) {
			this.#canvas = document.createElement('canvas');
			this.#canvas.className = 'stroke-sparks';
			this.#canvas.setAttribute('aria-hidden', 'true');
			document.body.append(this.#canvas);
			this.#ctx = this.#canvas.getContext('2d');
		}
		const scale = Math.min(window.devicePixelRatio || 1, 1.5);
		const w = Math.round(innerWidth * scale), h = Math.round(innerHeight * scale);
		if (this.#canvas.width !== w || this.#canvas.height !== h) {
			this.#canvas.width = w;
			this.#canvas.height = h;
		}
		this.#width = innerWidth;
		this.#height = innerHeight;
		this.#ctx.setTransform(scale, 0, 0, scale, 0, 0);
		this.#ctx.lineCap = 'round';
	}

	#rectOf(flight) {
		if (flight.tick !== this.#tickNo) {
			flight.tick = this.#tickNo;
			const r = flight.target.isConnected && flight.target.getBoundingClientRect();
			if (r && r.width && r.height) flight.rect = r;
		}
		return flight.rect;
	}

	#tick = (now) => {
		const dt = Math.min((now - this.#last) / 1000, 0.05);
		this.#last = now;
		this.#tickNo++;
		const ctx = this.#ctx;
		const k = StrokeSparks.DRAG, hold = StrokeSparks.HOLD;
		let landed = null;
		ctx.clearRect(0, 0, this.#width, this.#height);

		for (let i = 0; i < this.#count; i++) {
			const s = this.#pool[i];
			const f = s.flight;
			s.age += dt;
			if (f.alive && !f.alive()) s.age = Math.max(s.age, s.end);
			if (s.age >= s.end) {
				if (f.onArrive && !f.landed) {
					f.landed = true;
					(landed ??= []).push(f);
				}
				const last = this.#pool[--this.#count];
				this.#pool[this.#count] = s;
				this.#pool[i--] = last;
				continue;
			}
			if (s.age < 0) continue;

			const reach = (1 - Math.exp(-k * s.age)) / k;
			let x = s.ox + s.vx * reach;
			let y = s.oy + s.vy * reach;
			let fade;
			if (f.target) {
				const r = this.#rectOf(f);
				const pull = Math.max(0, (s.age - hold) / (s.end - hold)) ** 3;
				x += (r.left + r.width * s.u - x) * pull;
				y += (r.top + r.height * s.v - y) * pull;
				fade = Math.max(0, (pull - 0.85) / 0.15);
			} else {
				fade = s.age / s.end;
			}

			const dx = x - s.px, dy = y - s.py;
			const len = Math.hypot(dx, dy);
			const stretch = len > 0 ? Math.min(0.025 / Math.max(dt, 0.001), 28 / len) : 0;
			s.px = x;
			s.py = y;
			ctx.globalAlpha = f.target ? 1 - fade : (1 - fade) * (1 - fade);
			ctx.strokeStyle = s.color;
			ctx.lineWidth = s.size * 2 * (1 - fade * 0.5);
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x - dx * stretch, y - dy * stretch);
			ctx.stroke();
		}

		landed?.forEach(f => f.onArrive());

		if (this.#count > 0) {
			this.#frame = requestAnimationFrame(this.#tick);
		} else {
			ctx.clearRect(0, 0, this.#width, this.#height);
			this.#frame = 0;
		}
	};
}

const sparks = new StrokeSparks();

function popOnLanding(el) {
	if (!el || prefersReducedMotion()) return;
	el.animate([{ transform: 'scale(0.9)' }, { transform: 'none' }], { duration: 450, easing: motion('--ease-spring') });
}

const BASICS_HINTS = {
	start: 'tutorialStep1InstructionStart',
	idle: 'tutorialStep1InstructionIdle',
	pressing: 'tutorialStep1InstructionPressing',
	dragging: 'tutorialStep1InstructionDragging',
	releasing: 'tutorialStep1InstructionReleasing',
	off: 'tutorialWrongDirection',
};

class TutorialBasics extends TutorialStep {
	static properties = {
		_hint: { state: true },
		_pressed: { state: true },
	};

	#state = 'idle';
	#started = false;
	#guide = null;
	#guidePress = 0;
	#guideLastX = 0;

	constructor() {
		super();
		this._hint = 'start';
		this._pressed = false;
	}

	get #gestureGuide() {
		this.#guide ??= new GestureGuide(CONFIG.REQUIRED_DRAG_DISTANCE);
		return this.#guide;
	}

	onEnter() {
		this.#reset();
	}

	onLeave() {
		this.#gestureGuide.hide();
	}

	blocksContextMenu() {
		return true;
	}

	onGestureStart(e) {
		this.#started = true;
		this.#state = 'pressing';
		this._pressed = true;
		this._hint = 'pressing';
		this.#showGuideAfterEntrance(e.clientX, e.clientY);
	}

	onGestureMove(x, gesture) {
		this.#guideLastX = x;
		const progress = this.#gestureGuide.progressAt(x, gesture.startX);
		const offTrack = gesture.pattern !== '' && gesture.pattern !== '→';

		if (gesture.isActive) {
			if (offTrack) {
				this._hint = 'off';
			} else {
				const next = progress >= 1 ? 'releasing' : progress > 0.3 ? 'dragging' : null;
				if (next) {
					this.#state = next;
					this._hint = next;
				}
			}
		}
		this.#gestureGuide.update(progress, offTrack, !offTrack && this.#state === 'releasing');
	}

	onGestureEnd(gesture) {
		const { pattern } = gesture;
		if (this.#state === 'releasing' && pattern === '→') {
			this._pressed = false;
			this.tutorial.next({ force: true, motion: 'swipe', stroke: gesture.points });
			return;
		}

		if (this.#state !== 'idle' && gesture.isActive) {
			if (pattern && pattern !== '→') {
				this.tutorial.showMessage(withArrows(msg('tutorialWrongDirection')));
			} else if (this.#state === 'pressing' || this.#state === 'dragging') {
				this.tutorial.showMessage(msg('tutorialEarlyRelease'));
			}
		}
		this.#reset();
	}

	onGestureCancel(reason) {
		this.#reset();
		if (!window.i18n.isEdgeDesktop || (reason !== 'release-missed' && reason !== 'blur')) return;
		try { chrome.storage.sync.set({ edgeGestureConflict: true }); } catch (e) { }
		if (reason === 'release-missed') {
			this.tutorial.goTo('super-drag', { force: true });
		} else if (reason === 'blur') {
			this.tutorial.goToOnReturn('super-drag');
		}
	}

	#reset() {
		this.#state = 'idle';
		this._pressed = false;
		this._hint = this.#started ? 'idle' : 'start';
		this.#gestureGuide.hide();
	}

	#showGuideAfterEntrance(x, y) {
		const press = ++this.#guidePress;
		this.#guideLastX = x;
		this.tutorial.entrance.then(() => {
			if (press !== this.#guidePress || this.#state === 'idle' || this.tutorial.currentStep !== this) return;
			this.#gestureGuide.show(x, y);
			this.onGestureMove(this.#guideLastX, this.tutorial.gesture);
		});
	}

	updated(changed) {
		if (changed.has('_hint') && changed.get('_hint') !== undefined && this._hint !== 'idle' && this._hint !== 'start') {
			this.#nudgeHint();
		}
	}

	#nudgeHint() {
		const line = this.querySelector('.step-instruction');
		if (prefersReducedMotion()) return;
		line.getAnimations().filter(a => a.animationName === 'fm-rise' && a.playState === 'running').forEach(a => a.cancel());
		const frames = this._hint === 'pressing'
			? [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }]
			: [{ opacity: 0.5, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }];
		line.animate(frames, { duration: this._hint === 'pressing' ? 350 : 300, easing: motion('--ease-out') });
	}

	render() {
		return html`
			<h1 class="step-title">${t('tutorialWelcomeTitle')}</h1>
			<p class="step-subtitle">${t('tutorialWelcomeSubtitle')}</p>
			${virtualMouse({ right: this._pressed ? 'pressed' : 'pulsing' })}
			<p class="step-instruction" data-hint=${this._hint}>${t(BASICS_HINTS[this._hint])}</p>`;
	}
}

const GESTURE_CARDS = [
	{ key: 'forward', pattern: '→', label: 'actionForward' },
	{ key: 'back', pattern: '←', label: 'actionBack' },
	{ key: 'up', pattern: '↑', label: 'actionScrollUp' },
	{ key: 'scroll', pattern: '↓', label: 'actionScrollDown' },
	{ key: 'close', pattern: '↓→', label: 'actionCloseTab' },
];

const MORE_GESTURES = [
	{ key: 'scrollToTop', pattern: '↓↑', label: 'actionScrollToTop' },
	{ key: 'scrollToBottom', pattern: '↑↓', label: 'actionScrollToBottom' },
	{ key: 'switchLeft', pattern: '↑←', label: 'actionSwitchLeftTab' },
	{ key: 'switchRight', pattern: '↑→', label: 'actionSwitchRightTab' },
];

const REQUIRED_GESTURES = 5;

class TutorialGestures extends TutorialStep {
	static properties = {
		_done: { state: true },
		_continueReady: { state: true },
	};

	#contextMenuNoticeSeen = false;
	#landing = new Set();
	#handedOn = false;

	constructor() {
		super();
		this._done = new Set();
		this._continueReady = false;
	}

	get #finished() {
		return this._done.size >= REQUIRED_GESTURES;
	}

	get #showContextMenuNotice() {
		return this.#finished && isMacOrLinux && true;
	}

	onEnter({ stroke } = {}) {
		if (this._done.has('forward') || this.#landing.has('forward')) return;
		if (stroke && !prefersReducedMotion()) {
			this.#land('forward', stroke, 0.85);
			return;
		}
		this.tutorial.entrance.then(() => setTimeout(() => this.#complete('forward'), 300));
	}

	blocksContextMenu() {
		return !this.#finished;
	}

	onGestureEnd(gesture) {
		super.onGestureEnd(gesture);
		const done = [...GESTURE_CARDS, ...MORE_GESTURES].find(g => g.pattern === gesture.pattern);
		if (!done || this._done.has(done.key) || this.#landing.has(done.key)) return;
		this.#complete(done.key, gesture.points);
	}

	#land(key, stroke, arrive) {
		this.#landing.add(key);
		sparks.burst(stroke, {
			target: this.#cardFor(key)?.querySelector('svg'),
			arrive,
			alive: this.#isShowing,
			onArrive: () => {
				this.#landing.delete(key);
				this.#complete(key);
			},
		});
	}

	#cardFor(key) {
		return this.querySelector(`[data-gesture="${key}"]`);
	}

	#isShowing = () => this.tutorial.currentStep === this;

	#complete(key, stroke) {
		if (this._done.has(key)) return;
		this._done = new Set(this._done).add(key);

		if (this.#showContextMenuNotice && !this.#contextMenuNoticeSeen) {
			this.#contextMenuNoticeSeen = true;
			try { chrome.storage.sync.set({ macLinuxHintDismissed: true }); } catch (e) { }
		}

		if (this.#finished && !this.#handedOn) {
			this.#handedOn = true;
			if (!this.#isShowing()) {
				this._continueReady = true;
				return;
			}
			const button = this.querySelector('.continue-btn');
			const options = {
				target: button,
				alive: this.#isShowing,
				onArrive: () => {
					this._continueReady = true;
					popOnLanding(button);
				},
			};
			if (stroke) sparks.burst(stroke, options);
			else sparks.relay(this.#cardFor(key), button, options);
		}
	}

	#renderCard(card) {
		const done = this._done.has(card.key);
		return html`
			<div class=${classMap({ 'glass-card': true, completed: done, 'success-pulse': done })} data-gesture=${card.key}>
				<div class="card-icon">${arrows(card.pattern)}</div>
				<div class="card-name">${t(card.label)}</div>
				<div class="card-status">${t(done ? 'tutorialCompleted' : 'tutorialPending')}</div>
			</div>`;
	}

	render() {
		const finished = this.#finished;
		return html`
			<h1 class="step-title">${t('tutorialStep2Title')}</h1>
			<p class="step-subtitle">${t('tutorialStep2Subtitle')}</p>

			<div class="cards-grid">
				${GESTURE_CARDS.map(card => this.#renderCard(card))}
			</div>

			<div class=${classMap({ 'discovery-expand-wrapper': true, visible: finished })}>
				<div class="discovery-banner">
					<div class="discovery-header">${t('tutorialStep2DiscoveryHeader')}</div>
					<div class="discovery-grid">
						${MORE_GESTURES.map(g => discoveryChip(arrows(g.pattern), t(g.label), this._done.has(g.key), g.key))}
					</div>
					<div class="discovery-footer">${t('tutorialStep2Footer')}</div>
				</div>
			</div>

			${this.#showContextMenuNotice ? html`<div class="setting-warning">${t('macLinuxContextMenuNotice')}</div>` : nothing}

			${continueButton(this._continueReady, () => this.tutorial.next())}`;
	}
}

const chipIcon = paths => html`<svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const SUPER_DRAG_FEATURES = [
	{ label: 'tutorialStep3TextSearch', icon: chipIcon(svg`<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>`) },
	{ label: 'tutorialStep3LinkOpen', icon: chipIcon(svg`<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`) },
	{ label: 'tutorialStep3ImageOpen', icon: chipIcon(svg`<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>`) },
];

class TutorialSuperDrag extends TutorialStep {
	static properties = {
		_mouse: { state: true },
		_done: { state: true },
		_revealed: { state: true },
	};

	constructor() {
		super();
		this._mouse = '';
		this._done = false;
		this._revealed = false;
	}

	onEnter() {
		this._mouse = 'pulsing';
		setTimeout(() => {
			const range = document.createRange();
			range.selectNodeContents(this.querySelector('.selectable-text'));
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(range);
		}, 100);
	}

	blocksContextMenu() {
		return true;
	}

	onRightPress() {
		if (this._done) return true;
		this.tutorial.showMessage(withArrows(msg('tutorialDragWrongButton')));
		return false;
	}

	onLeftPress() {
		if (!this._done) this._mouse = 'pressed';
	}

	onLeftRelease() {
		this._mouse = this._done ? '' : 'pulsing';
	}

	dragTypeFor() {
		return window.getSelection().toString().trim() ? 'text' : null;
	}

	onDragComplete(type, points) {
		if (type !== 'text' || this._done) return;
		this._done = true;
		const button = this.querySelector('.continue-btn');
		sparks.burst(points, {
			target: button,
			alive: () => this.tutorial.currentStep === this,
			onArrive: () => {
				this._revealed = true;
				popOnLanding(button);
			},
		});
	}


	render() {
		return html`
			<h1 class="step-title">${t('tutorialStep3Title')}</h1>
			<p class="step-subtitle">${t('tutorialStep3Subtitle')}</p>

			<div class=${classMap({ 'super-drag-instruction': true, done: this._done })}>
				${virtualMouse({ left: this._mouse })}
				<div class="drag-arrow-indicator" aria-hidden="true">
					<div class="drag-arrow-origin">${unsafeHTML(GUIDE_DRAWING)}</div>
				</div>
				<div class="drag-hint-box">
					<div class="hint-title">${t('tutorialStep3HintTitle')}</div>
					<div class="hint-desc">${t('tutorialStep3HintDesc')}</div>
				</div>
			</div>

			<div class=${classMap({ 'step3-swap-container': true, 'show-discovery': this._revealed })}>
				<div class=${classMap({ 'draggable-content-box': true, 'step3-swap-item': true, completed: this._done, 'success-pulse': this._done })}>
					<div class="box-label">${t('tutorialStep3TextBoxLabel')}</div>
					<div class="selectable-text">${t('tutorialStep3SelectableText')}</div>
				</div>

				<div class="discovery-expand-wrapper step3-swap-item" id="step3DiscoveryWrapper">
					<div class="discovery-banner">
						<div class="discovery-header">${t('tutorialStep3DiscoveryHeader')}</div>
						<div class="discovery-grid">
							${SUPER_DRAG_FEATURES.map(f => discoveryChip(f.icon, t(f.label)))}
						</div>
						<div class="discovery-footer">${t('tutorialStep3Footer')}</div>
					</div>
				</div>
			</div>

			${isMac ? html`<div class="setting-warning">${t('macTextDragNotice')}</div>` : nothing}

			${continueButton(this._revealed, () => this.tutorial.next())}`;
	}
}

class TutorialDone extends TutorialStep {
	static properties = {
		_done: { state: true },
	};

	constructor() {
		super();
		this._done = false;
	}

	onEnter() {
		setTimeout(() => window.Confetti?.startShower(4000), 300);
	}

	onLeave() {
		window.Confetti?.stop();
	}

	blocksContextMenu() {
		return !this._done;
	}

	onRightPress() {
		if (this._done) return true;
		this.tutorial.showMessage(withArrows(msg('tutorialDragWrongButton')));
		return false;
	}

	dragTypeFor(e) {
		return e.target.closest?.('.settings-link') ? 'link' : null;
	}

	#landing = false;

	onDragComplete(type, points) {
		if (type !== 'link' || this.#landing) return;
		this._done = true;
		this.#landing = true;
		const x = points.at(-1).x;
		sparks.burst(points, {
			target: { isConnected: true, getBoundingClientRect: () => new DOMRect(x - 80, -48, 160, 24) },
			onArrive: () => {
				this.#landing = false;
				chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html#from-tutorial') });
			},
		});
	}

	#onLinkClick = (e) => {
		e.preventDefault();
		this.querySelector('.settings-instruction').animate(
			[
				{ transform: 'none', easing: 'ease-in-out' },
				{ transform: 'scale(1.05)', easing: 'ease-in-out' },
				{ transform: 'none' }
			],
			{ duration: 400 }
		);
	};

	render() {
		return html`
			<div class="completion-icon"><span>🎉</span></div>
			<h1 class="step-title">${t('tutorialStep4Title')}</h1>
			<p class="step-subtitle">${t('tutorialStep4Subtitle')}</p>

			<div class=${classMap({ 'settings-drag-container': true, completed: this._done, 'success-pulse': this._done })}>
				<div class="settings-instruction">${t('tutorialStep4Instruction')}</div>
				<a class="settings-link" href="#" @click=${this.#onLinkClick}>${t('tutorialSettingsLink')}</a>
				<div class="settings-hint">${t('tutorialSettingsHint')}</div>
			</div>`;
	}
}

const STEPS = [
	{ id: 'basics', tag: 'tutorial-basics', element: TutorialBasics },
	{ id: 'gestures', tag: 'tutorial-gestures', element: TutorialGestures },
	{ id: 'super-drag', tag: 'tutorial-super-drag', element: TutorialSuperDrag },
	{ id: 'done', tag: 'tutorial-done', element: TutorialDone },
];

const PAGE_REACTIONS = {
	'←': 'right', '→': 'left', '↑': 'down', '↓': 'up',
	'↓↑': 'down-big', '↑↓': 'up-big', '↑←': 'right', '↑→': 'left',
	'↓→': 'close', '←↓': 'close', '→↑': 'close', '→↓': 'close',
};

function nudge(x, y, duration) {
	return {
		duration,
		easing: 'ease-out',
		frames: [
			{ offset: 0.3, transform: `translate(${x}px, ${y}px)`, opacity: 1, easing: 'ease-out' },
			{ offset: 1, transform: 'none', opacity: 1 },
		],
	};
}

const REACTION_EFFECTS = {
	left: nudge(-15, 0, 400),
	right: nudge(15, 0, 400),
	up: nudge(0, -15, 400),
	down: nudge(0, 15, 400),
	'up-big': nudge(0, -40, 500),
	'down-big': nudge(0, 40, 500),
	close: {
		duration: 460,
		easing: 'ease-out',
		frames: [
			{ offset: 0.78, transform: 'scale(0.95)', opacity: 0.5, easing: 'ease-out' },
			{ offset: 1, transform: 'none', opacity: 1 },
		],
	},
};

let runningReaction = null;

function playReaction(el, name) {
	const effect = REACTION_EFFECTS[name];
	if (!effect || prefersReducedMotion()) return;

	const style = getComputedStyle(el);
	const start = { offset: 0, transform: style.transform, opacity: style.opacity, easing: effect.easing };
	runningReaction?.cancel();
	runningReaction = el.animate([start, ...effect.frames], { duration: effect.duration });
}

function stepFromHash() {
	const index = parseInt(location.hash.replace('#step', ''), 10);
	return index >= 0 && index < STEPS.length ? index : 0;
}

function whenEntered(step) {
	const entrance = step.getAnimations({ subtree: true })
		.filter(a => ['fm-fade-in', 'fm-rise', 'fm-swipe-in'].includes(a.animationName));
	const wait = Math.max(0, ...entrance.map(a => {
		const timing = a.effect.getComputedTiming();
		return timing.delay + timing.duration * 0.5 - (a.currentTime || 0);
	}));
	return new Promise(resolve => setTimeout(resolve, wait));
}

class TutorialPage extends LitElement {
	static properties = {
		_step: { state: true },
		_enter: { state: true },
		_leaving: { state: true },
		_leaveMotion: { state: true },
		_toast: { state: true },
		_toastShown: { state: true },
		_isActionPinned: { state: true },
	};

	#gestureActive = false;
	#pattern = [];
	#points = [];
	#preventContextMenu = false;
	#lastRightClickTime = 0;
	#dragType = null;
	#dragPoints = [];
	#skipFirstDragOver = false;
	#lastPointerType = 'mouse';

	#stepCooldown = false;
	#leaveTimer = null;
	#entrance = Promise.resolve();
	#messageTimer = null;
	#returnTo = null;

	constructor() {
		super();
		this._step = stepFromHash();
		this._enter = 'intro';
		this._leaving = -1;
		this._leaveMotion = null;
		this._toast = '';
		this._toastShown = false;
		this._isActionPinned = false;
	}

	createRenderRoot() {
		return this;
	}

	get currentStep() {
		return this.querySelector('#step' + this._step);
	}

	get entrance() {
		return this.#entrance;
	}

	get gesture() {
		return {
			startX: recognizer.startX,
			isActive: recognizer.isActive(),
			pattern: this.#pattern.join(''),
			points: this.#points,
		};
	}

	next(options) {
		this.goTo(this._step + 1, options);
	}

	goTo(target, { instant = false, force = false, fromHistory = false, motion = null, stroke = null } = {}) {
		const index = typeof target === 'string' ? STEPS.findIndex(s => s.id === target) : target;
		if (index < 0 || index >= STEPS.length || index === this._step) return;
		if (!instant && !force && this.#stepCooldown) return;
		if (!instant) {
			this.#stepCooldown = true;
			setTimeout(() => { this.#stepCooldown = false; }, 600);
		}

		const previous = this._step;
		motion ??= index > previous ? 'forward' : 'back';
		this.currentStep.onLeave();

		clearTimeout(this.#leaveTimer);
		this._enter = null;
		this._leaving = -1;
		if (!instant) {
			this._enter = motion;
			this._leaving = previous;
			this._leaveMotion = motion;
			this.#leaveTimer = setTimeout(() => { this._leaving = -1; }, 600);
		}
		this._step = index;

		if (!fromHistory) {
			history.pushState(null, '', '#step' + index);
		}
		this.#onStepShown({ stroke });
	}

	goToOnReturn(target) {
		this.#returnTo = target;
	}

	react(pattern) {
		playReaction(this.querySelector('.tutorial-container'), PAGE_REACTIONS[pattern]);
	}

	showMessage(markup) {
		const wasShown = this._toastShown;
		this._toast = markup;
		this._toastShown = true;

		if (wasShown && !prefersReducedMotion()) {
			this.updateComplete.then(() => this.querySelector('.try-again-message').animate(
				[
					{ opacity: 0, transform: 'translate(-50%, -24px) scale(0.96)' },
					{ opacity: 1, transform: 'translate(-50%, 0)' }
				],
				{ duration: 350, easing: motion('--ease-spring') }
			));
		}

		clearTimeout(this.#messageTimer);
		this.#messageTimer = setTimeout(() => { this._toastShown = false; }, 2000);
	}

	connectedCallback() {
		super.connectedCallback();
		document.addEventListener('contextmenu', this.#onContextMenu, true);
		document.addEventListener('pointerdown', this.#onPointerDown, true);
		document.addEventListener('pointermove', this.#onPointerMove, true);
		document.addEventListener('pointerup', this.#onPointerUp, true);
		if (window.i18n.isEdgeDesktop) document.addEventListener('lostpointercapture', this.#onLostPointerCapture, true);
		document.addEventListener('dragstart', this.#onDragStart);
		document.addEventListener('dragover', this.#onDragOver);
		document.addEventListener('dragleave', this.#onDragLeave, true);
		document.addEventListener('drop', this.#onDrop);
		document.addEventListener('dragend', this.#onDragEnd);
		document.addEventListener('keydown', this.#onKeyDown);
		window.addEventListener('blur', this.#onBlur);
		window.addEventListener('focus', this.#onFocus);
		window.addEventListener('popstate', this.#onPopState);
		chrome.action.getUserSettings().then(s => { this._isActionPinned = s.isOnToolbar; });
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		document.removeEventListener('contextmenu', this.#onContextMenu, true);
		document.removeEventListener('pointerdown', this.#onPointerDown, true);
		document.removeEventListener('pointermove', this.#onPointerMove, true);
		document.removeEventListener('pointerup', this.#onPointerUp, true);
		if (window.i18n.isEdgeDesktop) document.removeEventListener('lostpointercapture', this.#onLostPointerCapture, true);
		document.removeEventListener('dragstart', this.#onDragStart);
		document.removeEventListener('dragover', this.#onDragOver);
		document.removeEventListener('dragleave', this.#onDragLeave, true);
		document.removeEventListener('drop', this.#onDrop);
		document.removeEventListener('dragend', this.#onDragEnd);
		document.removeEventListener('keydown', this.#onKeyDown);
		window.removeEventListener('blur', this.#onBlur);
		window.removeEventListener('focus', this.#onFocus);
		window.removeEventListener('popstate', this.#onPopState);
	}

	firstUpdated() {
		visualizer.updateSettings({
			lang: window.i18n.getHtmlLang(),
			isRtl: window.i18n.getDir() === 'rtl',
			enableHudShadow: window.GestureConstants.DEFAULT_SETTINGS.enableHudShadow,
		});
		this.#onStepShown();
	}

	#onStepShown(arrival = {}) {
		document.body.dataset.activeStep = STEPS[this._step].id;
		const step = this.currentStep;
		this.#entrance = this.updateComplete.then(() => step.updateComplete).then(() => whenEntered(step));
		this.currentStep.onEnter(arrival);
	}

	#onPopState = () => {
		if (this.#gestureActive) {
			this.#cancelGesture('navigate');
		}
		this.goTo(stepFromHash(), { force: true, fromHistory: true });
	};

	#onFocus = () => {
		if (this.#returnTo === null) return;
		const target = this.#returnTo;
		this.#returnTo = null;
		this.goTo(target, { force: true });
	};

	#blockContextMenu(e) {
		e.preventDefault();
		e.stopPropagation();
	}

	#onContextMenu = (e) => {
		if (this.currentStep?.blocksContextMenu()) {
			this.#blockContextMenu(e);
			return;
		}

		if (isMacOrLinux) {
			if (e.ctrlKey || e.button !== 2) return;

			if (this.#preventContextMenu) {
				this.#blockContextMenu(e);
				return;
			}

			const now = Date.now();
			if (now - this.#lastRightClickTime < DOUBLE_CLICK_DELAY) {
				this.#lastRightClickTime = 0;
				recognizer.reset();
				this.#gestureActive = false;
			} else {
				this.#lastRightClickTime = now;
				this.#blockContextMenu(e);
			}
		} else if (this.#preventContextMenu) {
			this.#blockContextMenu(e);
		}
	};

	#onPointerDown = (e) => {
		this.#lastPointerType = e.pointerType;
		if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
		if (e.button === 0) {
			this.currentStep?.onLeftPress(e);
			return;
		}
		if (e.button !== 2 || !this.currentStep?.onRightPress(e)) return;

		this.#gestureActive = true;
		this.#preventContextMenu = false;
		this.#pattern = [];
		this.#points = [{ x: e.clientX, y: e.clientY }];
		recognizer.start(e.clientX, e.clientY, e.timeStamp);

		try {
			document.documentElement.setPointerCapture(e.pointerId);
		} catch (err) { }

		this.currentStep.onGestureStart(e);
	};

	#onPointerMove = (e) => {
		if (!this.#gestureActive) return;
		if (!(e.buttons & 2)) {
			this.#endGesture(e);
			return;
		}

		const coalesced = e.getCoalescedEvents();
		const points = (coalesced.length ? coalesced : [e]).map(evt => ({ x: evt.clientX, y: evt.clientY, timestamp: evt.timeStamp }));
		const result = recognizer.moveBatch(points);
		this.#points.push(...points);

		if (result.activated) {
			this.#preventContextMenu = true;
			showTrail('gesture');
		}

		if (recognizer.isActive()) {
			visualizer.addPoints(result.activated ? result.preActivationTrail : points);

			if (result.directionChanged) {
				this.#pattern = [...result.pattern];
				const hudText = getHudText(result.pattern);
				visualizer.updateAction(result.pattern, hudText ? [hudText] : []);
			}
		}

		this.currentStep.onGestureMove(e.clientX, this.gesture);
	};

	#onPointerUp = (e) => {
		if (e.button === 0) {
			this.currentStep?.onLeftRelease();
			return;
		}
		if (e.button !== 2 || !this.#gestureActive) return;
		this.#endGesture(e);
	};

	#endGesture(e) {
		const gesture = this.gesture;
		if (gesture.isActive) {
			e.preventDefault();
			e.stopPropagation();
			this.#lastRightClickTime = 0;
		}

		visualizer.hide();
		this.currentStep.onGestureEnd(gesture);

		this.#gestureActive = false;
		this.#pattern = [];
		recognizer.reset();

		setTimeout(() => { this.#preventContextMenu = false; }, 100);
	}

	#onLostPointerCapture = () => {
		if (this.#gestureActive) this.#cancelGesture('release-missed');
	};

	#cancelGesture(reason) {
		visualizer.hide();
		recognizer.reset();
		this.#gestureActive = false;
		this.#pattern = [];
		this.#preventContextMenu = false;
		this.currentStep.onGestureCancel(reason);
	}

	#onKeyDown = (e) => {
		if (e.key === 'Escape' && this.#gestureActive) {
			this.#cancelGesture('escape');
		}
	};

	#onBlur = () => {
		if (this.#gestureActive) {
			this.#cancelGesture('blur');
		}
	};

	#onDragStart = (e) => {
		const type = this.currentStep?.dragTypeFor(e);
		if (!type) return;
		this.#dragType = type;
		this.#dragPoints = [{ x: e.clientX, y: e.clientY }];
		dragRecognizer.start(e.clientX, e.clientY, e.timeStamp);
		this.#skipFirstDragOver = isMacOrLinux || this.#lastPointerType === 'touch' || this.#lastPointerType === 'pen';
	};

	#onDragOver = (e) => {
		if (!this.#dragType) return;
		if (this.#skipFirstDragOver) {
			this.#skipFirstDragOver = false;
			return;
		}

		const point = { x: e.clientX, y: e.clientY, timestamp: e.timeStamp };
		const result = dragRecognizer.move(point.x, point.y, point.timestamp);
		if (result.activated) {
			showTrail('drag');
			visualizer.addPoints(result.preActivationTrail);
		}

		if (!dragRecognizer.isActive()) return;

		e.preventDefault();
		if (!result.activated) visualizer.addPoints([point]);
		this.#dragPoints.push(point);

		if (result.directionChanged) {
			if (dragRecognizer.getPattern() === '→') {
				const hudText = getSuperDragHudText(this.#dragType);
				visualizer.updateAction('→', hudText ? [hudText] : []);
			} else {
				visualizer.updateAction('', []);
			}
		}
	};

	#onDragLeave = (e) => {
		if (this.#dragType && e.relatedTarget === null) {
			this.#endDrag();
		}
	};

	#onDrop = (e) => {
		if (this.#dragType && dragRecognizer.isActive()) {
			e.preventDefault();
			this.#completeDrag(e);
		}
		this.#endDrag();
	};

	#onDragEnd = (e) => {
		this.#completeDrag(e);
		this.#endDrag();
		this.currentStep?.onLeftRelease();
	};

	#completeDrag(e) {
		if (!this.#dragType) return;
		const isRightDrag = dragRecognizer.getPattern() === '→'
			&& e.clientX - dragRecognizer.startX > CONFIG.REQUIRED_SUPER_DRAG_DISTANCE;
		if (isRightDrag) {
			this.currentStep.onDragComplete(this.#dragType, this.#dragPoints);
		}
	}

	#endDrag() {
		if (!this.#dragType) return;
		visualizer.hide();
		this.#dragType = null;
		dragRecognizer.reset();
		this.currentStep.onDragEnd();
	}

	#renderStep(step, index) {
		const isCurrent = index === this._step;
		const classes = { 'step-section': true, active: isCurrent };
		if (isCurrent && this._enter) classes['enter-' + this._enter] = true;
		if (index === this._leaving) classes['leave-' + this._leaveMotion] = true;

		const tag = unsafeStatic(step.tag);
		return staticHtml`<${tag} id="step${index}" class=${classMap(classes)} .tutorial=${this}></${tag}>`;
	}

	render() {
		return html`
			<div class="tutorial-container">
				${STEPS.map((step, index) => this.#renderStep(step, index))}
			</div>

			${this._isActionPinned ? nothing : html`
				<div class="pin-hint-wrapper">
					<svg class="pin-hint-arrow" viewBox="0 -960 960 960" fill="currentColor">
						<path d="M480-525 291-336l-51-51 240-240 240 240-51 51-189-189Z"/>
					</svg>
					<div class="pin-hint-content">
						<div>${t('tutorialPinHint')}</div>
					</div>
				</div>
			`}

			<div class=${classMap({ 'try-again-message': true, show: this._toastShown })}>${unsafeHTML(this._toast)}</div>`;
	}
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'ping') {
		sendResponse({ pong: true });
	}
});

window.i18n.waitForInit().then(() => {
	for (const step of STEPS) {
		customElements.define(step.tag, step.element);
	}
	customElements.define('tutorial-page', TutorialPage);
});