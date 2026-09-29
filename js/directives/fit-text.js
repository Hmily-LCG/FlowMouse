import { directive, AsyncDirective } from '../lib/lit-all.min.js';

const targets = new WeakMap();
const active = new Set();
const MUTATION_OPTIONS = { characterData: true, childList: true, subtree: true };
let resizeObserver;
let mutationObserver;
let fontListenerAttached = false;

function handleMutations(records) {
	for (const { target } of records) {
		for (let node = target; node; node = node.parentNode) targets.get(node)?.fit();
	}
}

function observe(instance, el) {
	resizeObserver ??= new ResizeObserver((entries) => {
		for (const { target } of entries) targets.get(target)?.resized();
	});
	mutationObserver ??= new MutationObserver(handleMutations);
	if (!fontListenerAttached && document.fonts) {
		fontListenerAttached = true;
		document.fonts.addEventListener('loadingdone', () => {
			for (const inst of active) inst.fit();
		});
	}
	resizeObserver.observe(el);
	mutationObserver.observe(el, MUTATION_OPTIONS);
	active.add(instance);
}

class FitTextDirective extends AsyncDirective {
	static #pending = new Set();

	static #flush() {
		handleMutations(mutationObserver.takeRecords());
		const batch = [...FitTextDirective.#pending];
		FitTextDirective.#pending.clear();
		const results = batch.map((inst) => inst.#measure());
		batch.forEach((inst, i) => results[i] && inst.#apply(results[i]));
	}

	#el = null;
	#transform = '';
	#origin = '';
	#width = -1;

	update(part) {
		const el = part.element;
		if (this.#el !== el) {
			this.#el = el;
			this.#transform = el.style.transform;
			this.#origin = el.style.transformOrigin;
			Object.assign(el.style, {
				display: 'inline-block',
				minWidth: '0',
				maxWidth: '100%',
				whiteSpace: 'nowrap',
			});
			targets.set(el, this);
			observe(this, el);
		}
		this.fit();
		return this.render();
	}

	fit() {
		const pending = FitTextDirective.#pending;
		if (!pending.size) queueMicrotask(FitTextDirective.#flush);
		pending.add(this);
	}

	resized() {
		if (this.#el.clientWidth !== this.#width) this.fit();
	}

	#measure() {
		const el = this.#el;
		if (!el?.isConnected) return null;
		const { scrollWidth, clientWidth } = el;
		this.#width = clientWidth;
		if (!clientWidth || scrollWidth <= clientWidth) return { transform: '', origin: this.#origin };
		return {
			transform: `scaleX(${clientWidth / scrollWidth})`,
			origin: getComputedStyle(el).direction === 'rtl' ? 'right' : 'left',
		};
	}

	#apply({ transform, origin }) {
		const { style } = this.#el;
		if (origin !== this.#origin) style.transformOrigin = this.#origin = origin;
		if (transform !== this.#transform) style.transform = this.#transform = transform;
	}

	disconnected() {
		if (!this.#el) return;
		resizeObserver.unobserve(this.#el);
		active.delete(this);
	}

	reconnected() {
		if (!this.#el) return;
		observe(this, this.#el);
		this.fit();
	}

	render() {}
}

export const fitText = directive(FitTextDirective);