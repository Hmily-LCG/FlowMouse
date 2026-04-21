class GestureRecognizer {
	#distanceThreshold;
	#longGestureMultiplier;
	#maxThreshold;
	#active = false;
	#startX = 0;
	#startY = 0;
	#startTimestamp = 0;
	#anchorX = 0;
	#anchorY = 0;
	#currentX = 0;
	#currentY = 0;
	#pattern = [];
	#points = [];
	#segmentLength = 0; 

	constructor(config = {}) {
		this.#distanceThreshold = config.distanceThreshold || 20;
		this.#longGestureMultiplier = config.longGestureMultiplier ?? 0.10;
		this.#maxThreshold = config.maxThreshold ?? 120;
		this.reset();
	}

	updateConfig(config) {
		if (config.distanceThreshold) {
			this.#distanceThreshold = config.distanceThreshold;
		}
		if (config.longGestureMultiplier !== undefined) {
			this.#longGestureMultiplier = config.longGestureMultiplier;
		}
	}

	reset() {
		this.#active = false;
		this.#startX = 0;
		this.#startY = 0;
		this.#startTimestamp = 0;
		this.#anchorX = 0;
		this.#anchorY = 0;
		this.#currentX = 0;
		this.#currentY = 0;
		this.#pattern = [];
		this.#points = [];
		this.#segmentLength = 0;
	}

	start(x, y, timestamp = 0) {
		this.reset();
		this.#startX = x;
		this.#startY = y;
		this.#startTimestamp = timestamp;
		this.#anchorX = x;
		this.#anchorY = y;
		this.#currentX = x;
		this.#currentY = y;
		this.#points.push({ x, y, timestamp });
	}

	move(x, y, timestamp = null) {
		this.#currentX = x;
		this.#currentY = y;
		this.#points.push({ x, y, timestamp });

		const result = {
			activated: false,       
			directionChanged: false, 
			direction: null,        
			pattern: this.#pattern.join(''),
			preActivationTrail: [],  
			totalDistance: 0,
		};

		const totalDeltaX = this.#currentX - this.#startX;
		const totalDeltaY = this.#currentY - this.#startY;
		const totalDistance = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);
		result.totalDistance = totalDistance;

		if (!this.#active && totalDistance > this.#distanceThreshold) {
			this.#active = true;
			result.activated = true;
			result.preActivationTrail = [...this.#points];

			if (this.#distanceThreshold >= 10) {
				let replayMultiplier = 0.7;
				if (this.#distanceThreshold < 15) replayMultiplier = 0.8;
				
				const replayThreshold = this.#distanceThreshold * replayMultiplier;
				
				this.#pattern = [];
				this.#anchorX = this.#startX;
				this.#anchorY = this.#startY;
				this.#segmentLength = 0;

				for (const p of this.#points) {
					const deltaX = p.x - this.#anchorX;
					const deltaY = p.y - this.#anchorY;
					const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

					if (dist > replayThreshold) {
						const direction = this.#getDirection(deltaX, deltaY);
						const lastDirection = this.#pattern[this.#pattern.length - 1];

						if (direction !== lastDirection) {
							this.#pattern.push(direction);
							this.#anchorX = p.x;
							this.#anchorY = p.y;
							this.#segmentLength = dist;
						} else {
							this.#segmentLength += dist;
							this.#anchorX = p.x;
							this.#anchorY = p.y;
						}
					}
				}
			}

			if (this.#pattern.length === 0) {
				const dir = this.#getDirection(totalDeltaX, totalDeltaY);
				this.#pattern.push(dir);
				this.#anchorX = this.#currentX;
				this.#anchorY = this.#currentY;
				this.#segmentLength = totalDistance;
			}

			result.pattern = this.#pattern.join('');
			result.direction = this.#pattern[this.#pattern.length - 1];
			result.directionChanged = true;
		}

		if (!this.#active) {
			return result;
		}

		const deltaX = this.#currentX - this.#anchorX;
		const deltaY = this.#currentY - this.#anchorY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		if (distance > this.#distanceThreshold) {
			const direction = this.#getDirection(deltaX, deltaY);
			const lastDirection = this.#pattern[this.#pattern.length - 1];

			if (direction === lastDirection) {
				this.#segmentLength += distance;
				this.#anchorX = this.#currentX;
				this.#anchorY = this.#currentY;
			} else {
				const adaptiveThreshold = Math.min(
					this.#maxThreshold,
					this.#distanceThreshold + this.#segmentLength * this.#longGestureMultiplier
				);

				if (distance > adaptiveThreshold) {
					this.#pattern.push(direction);
					result.directionChanged = true;
					result.direction = direction;
					result.pattern = this.#pattern.join('');

					this.#segmentLength = distance;
					this.#anchorX = this.#currentX;
					this.#anchorY = this.#currentY;
				}
			}
		}

		return result;
	}

	getPattern() {
		return this.#pattern.join('');
	}

	isActive() {
		return this.#active;
	}

	get startX() {
		return this.#startX;
	}

	get startY() {
		return this.#startY;
	}

	get currentX() {
		return this.#currentX;
	}

	get currentY() {
		return this.#currentY;
	}

	get startTimestamp() {
		return this.#startTimestamp;
	}

	#getDirection(deltaX, deltaY) {
		const absDeltaX = Math.abs(deltaX);
		const absDeltaY = Math.abs(deltaY);

		if (absDeltaX > absDeltaY) {
			return deltaX > 0 ? '→' : '←';
		} else {
			return deltaY > 0 ? '↓' : '↑';
		}
	}
}

window.GestureRecognizer = GestureRecognizer;