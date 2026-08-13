class ConfettiSystem {
	constructor() {
		this.canvas = null;
		this.ctx = null;
		this.particles = [];
		this.animationId = null;
		this.isActive = false;
		this.lastTime = 0;

		this.colors = [
			'#4285f4',
			'#34a853',
			'#ea4335',
			'#fbbc04',
			'#46ccdc',
			'#a061ec'
		];

		this.resizeHandler = this.resize.bind(this);
	}

	init() {
		if (this.canvas) return;

		this.canvas = document.createElement('canvas');
		this.canvas.style.position = 'fixed';
		this.canvas.style.top = '0';
		this.canvas.style.left = '0';
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		this.canvas.style.pointerEvents = 'none';
		this.canvas.style.zIndex = '9999';
		document.body.appendChild(this.canvas);

		this.ctx = this.canvas.getContext('2d');
		window.addEventListener('resize', this.resizeHandler);
		this.resize();
	}

	resize() {
		if (this.canvas) {
			this.canvas.width = window.innerWidth;
			this.canvas.height = window.innerHeight;
		}
	}

	createParticle(x, y) {
		const isRibbon = Math.random() > 0.5;
		return {
			x: x,
			y: y,
			w: isRibbon ? Math.random() * 12 + 6 : Math.random() * 9 + 6,
			h: isRibbon ? Math.random() * 18 + 12 : Math.random() * 9 + 6,
			color: this.colors[Math.floor(Math.random() * this.colors.length)],
			vx: (Math.random() - 0.5) * 4,
			vy: Math.random() * 2 + 1,
			rotation: Math.random() * 360,
			rotationSpeed: (Math.random() - 0.5) * 4,
			tilt: Math.random() * 10,
			tiltSpeed: Math.random() * 0.1,
			friction: 0.98,
			gravity: 0.05,
		};
	}

	burst(count = 100) {
		this.init();
		this.isActive = true;
		this.lastTime = 0;

		for (let i = 0; i < count; i++) {
			const x = Math.random() * this.canvas.width;
			const y = -Math.random() * 100 - 20;
			this.particles.push(this.createParticle(x, y));
		}

		if (!this.animationId) {
			this.animate();
		}
	}

	startShower(duration = 3000) {
		this.init();
		this.isActive = true;
		this.lastTime = 0;
		const startTime = Date.now();

		const spawnInterval = setInterval(() => {
			if (!this.isActive) {
				clearInterval(spawnInterval);
				return;
			}

			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			let spawnCount = Math.ceil(5 * (1 - progress));

			if (Math.random() > 0.5) spawnCount = Math.max(0, spawnCount - 1);

			for (let i = 0; i < spawnCount; i++) {
				const x = Math.random() * this.canvas.width;
				this.particles.push(this.createParticle(x, -20));
			}
		}, 50);

		setTimeout(() => {
			clearInterval(spawnInterval);
			this.isActive = false;
		}, duration);

		if (!this.animationId) {
			this.animate();
		}
	}

	animate(timestamp) {
		if (!this.ctx || (!this.isActive && this.particles.length === 0)) {
			if (this.canvas && this.particles.length === 0) {
				this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
				this.animationId = null;
				this.lastTime = 0;
				return;
			}
		}

		if (!timestamp) timestamp = performance.now();
		const deltaTime = timestamp - (this.lastTime || timestamp);
		this.lastTime = timestamp;

		const timeScale = Math.min(deltaTime / 8.33, 4.0);

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];

			p.tilt += p.tiltSpeed * timeScale;
			p.y += p.vy * timeScale;
			p.x += (Math.sin(p.tilt) + p.vx) * timeScale;
			p.vx *= Math.pow(p.friction, timeScale);
			p.vy += p.gravity * timeScale;
			p.vy *= Math.pow(p.friction, timeScale);
			p.rotation += p.rotationSpeed * timeScale;

			if (p.y > this.canvas.height + 20) {
				this.particles.splice(i, 1);
				continue;
			}

			this.ctx.save();
			this.ctx.translate(p.x, p.y);
			this.ctx.rotate((p.rotation * Math.PI) / 180);

			this.ctx.scale(1, Math.cos(p.tilt));

			this.ctx.fillStyle = p.color;
			this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);

			this.ctx.restore();
		}

		this.animationId = requestAnimationFrame(this.animate.bind(this));
	}

	stop() {
		this.isActive = false;
	}
}

window.Confetti = new ConfettiSystem();