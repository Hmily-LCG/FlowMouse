import { directive, AsyncDirective } from './lib/lit-all.min.js';

const supportsPopover = typeof HTMLElement !== 'undefined' &&
	typeof HTMLElement.prototype.showPopover === 'function';

let tooltipEl;

function ensureTooltip() {
	if (tooltipEl) return tooltipEl;
	tooltipEl = document.createElement('div');
	tooltipEl.className = 'fm-tooltip';
	tooltipEl.setAttribute('popover', 'manual');
	document.body.appendChild(tooltipEl);
	return tooltipEl;
}

class TooltipDirective extends AsyncDirective {
	#onEnter = null;
	#onLeave = null;

	#positionTooltip(el) {
		if (!el.checkVisibility()) return;
		const anchor = el.getBoundingClientRect();
		const { width: tw, height: th } = tooltipEl.getBoundingClientRect();
		const vw = document.documentElement.clientWidth;
		const vh = document.documentElement.clientHeight;
		const gap = 6;
		const pad = 4;
		const left = Math.max(pad, Math.min(anchor.left + anchor.width / 2 - tw / 2, vw - tw - pad));
		const top = anchor.bottom + gap + th + pad > vh
			? Math.max(pad, anchor.top - th - gap)
			: anchor.bottom + gap;
		tooltipEl.style.left = `${left}px`;
		tooltipEl.style.top = `${top}px`;
	}

	update(part, [text]) {
		const el = part.element;
		if (this.#onEnter) {
			el.removeEventListener('mouseenter', this.#onEnter);
			el.removeEventListener('mouseleave', this.#onLeave);
		}
		if (text) {
			el.setAttribute('aria-label', text);
		} else {
			el.removeAttribute('aria-label');
		}
		if (!supportsPopover) {
			el.title = text;
			return this.render(text);
		}
		this.#onEnter = () => {
			if (!text) return;
			const tip = ensureTooltip();
			tip.textContent = text;
			tip.showPopover();
			this.#positionTooltip(el);
			window.addEventListener('scroll', this.#onLeave, { once: true, capture: true });
		};
		this.#onLeave = () => {
			tooltipEl?.hidePopover();
			window.removeEventListener('scroll', this.#onLeave, { capture: true });
		};
		el.addEventListener('mouseenter', this.#onEnter);
		el.addEventListener('mouseleave', this.#onLeave);
		if (el.matches(':hover')) {
			if (!text) {
				tooltipEl?.hidePopover();
			} else if (tooltipEl?.matches(':popover-open')) {
				tooltipEl.textContent = text;
				this.#positionTooltip(el);
			} else {
				this.#onEnter();
			}
		}
		return this.render(text);
	}

	disconnected() {
		tooltipEl?.hidePopover();
	}

	render() {}
}

export const tooltip = directive(TooltipDirective);