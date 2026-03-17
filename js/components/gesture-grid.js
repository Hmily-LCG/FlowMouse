import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icon } from '../icons.js'; 

class GestureGrid extends LitElement {
	static properties = {
		mouseGestures: { type: Object },       
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
			}

			.gesture-item .reset-btn,
			.gesture-item .delete-gesture-btn {
				position: absolute;
				top: 4px;
				inset-inline-end: 4px;
				width: 22px;
				height: 22px;
				border: none;
				border-radius: 50%;
				cursor: pointer;
				font-size: 12px;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				transition: all 0.2s;
				z-index: 1;
			}

			.gesture-item .reset-btn {
				background: transparent;
				color: var(--text-muted);
			}

			.gesture-item .reset-btn:hover {
				background: var(--primary-color);
				color: white;
			}

			.gesture-item .delete-gesture-btn {
				background: transparent;
				color: var(--text-muted);
				font-size: 14px;
			}

			.gesture-item .delete-gesture-btn:hover {
				background: var(--danger-color);
				color: white;
			}

			.gesture-item.modified {
				position: relative;
				background: rgba(66, 133, 244, 0.05);
				border-radius: 8px;
			}

			.gesture-item.custom {
				position: relative;
				background: rgba(52, 168, 83, 0.05);
			}
		`,
	];

	static GESTURE_DESC_KEYS = {
		'←': 'gestureDesc_L',
		'→': 'gestureDesc_R',
		'↑': 'gestureDesc_U',
		'↓': 'gestureDesc_D',
		'↓→': 'gestureDesc_DR',
		'←↑': 'gestureDesc_LU',
		'→↑': 'gestureDesc_RU',
		'→↓': 'gestureDesc_RD',
		'↑←': 'gestureDesc_UL',
		'↑→': 'gestureDesc_UR',
		'↓←': 'gestureDesc_DL',
		'←↓': 'gestureDesc_LD',
		'↑↓': 'gestureDesc_UD',
		'↓↑': 'gestureDesc_DU',
		'←→': 'gestureDesc_LR',
		'→←': 'gestureDesc_RL'
	};

	constructor() {
		super();
		this.mouseGestures = {};
	}

	#getFullGestures() {
		const result = {};
		for (const [pattern, config] of Object.entries(this.mouseGestures || {})) {
			result[pattern] = config.action;
		}
		return result;
	}

	render() {
		const gestures = this.#getFullGestures();
		const patterns = Object.keys(this.mouseGestures || {});

		return html`
			<div class="gesture-grid">
				${patterns.map(pattern => this.#renderItem(pattern, gestures))}
			</div>
		`;
	}

	#renderItem(pattern, gestures) {
		const { DEFAULT_GESTURES } = window.GestureConstants;
		const currentAction = gestures[pattern] || DEFAULT_GESTURES[pattern] || 'none';
		const defaultAction = DEFAULT_GESTURES[pattern] || 'none';
		const isCustom = !DEFAULT_GESTURES[pattern];
		const entryConfig = (this.mouseGestures || {})[pattern] || {};
		const hasCustomConfig = Object.keys(entryConfig).some(k => k !== 'action');
		const isModified = !isCustom && (currentAction !== defaultAction || hasCustomConfig);
		const descKey = GestureGrid.GESTURE_DESC_KEYS[pattern];
		const desc = descKey
			? window.i18n.getMessage(descKey)
			: (isCustom ? window.i18n.getMessage('customGesture') : '');
		const patternSvg = window.GestureConstants.arrowsToSvg(pattern);

		return html`
			<div class="gesture-item ${isModified ? 'modified' : ''} ${isCustom ? 'custom' : ''}">
				${isCustom ? html`
					<button class="delete-gesture-btn" @click=${() => this.#handleDelete(pattern)}
						title=${window.i18n.getMessage('deleteGesture')}
						style="display: inline-flex">${unsafeHTML(icon('x', { size: 14, strokeWidth: 2.5 }))}</button>
				` : html`
					<button class="reset-btn" @click=${() => this.#handleReset(pattern)}
						title=${window.i18n.getMessage('resetToDefault')}
						style="display: ${isModified ? 'inline-flex' : 'none'}">${unsafeHTML(icon('rotateCcw', { size: 13, strokeWidth: 2.5 }))}</button>
				`}
				${unsafeHTML(renderGestureSvg(pattern, { style: "width: 4em; height: 4em; display: block;" }))}
				<div class="gesture-pattern" title="${pattern} ${desc}">
					${unsafeHTML(patternSvg)} <span class="gesture-desc">${desc}</span>
				</div>
				<action-select
					.value=${currentAction}
					.config=${entryConfig}
					.gestureLabel=${`${pattern}${desc ? ' ' + desc : ''}`}
					data-pattern=${pattern}
					@action-change=${(e) => this.#handleActionChange(pattern, e)}
				></action-select>
			</div>
		`;
	}

	#handleActionChange(pattern, e) {
		const { action, config } = e.detail;

		this.dispatchEvent(new CustomEvent('permission-check', {
			detail: { action },
			bubbles: true,
			composed: true,
		}));

		const newMouseGestures = { ...(this.mouseGestures || {}) };
		newMouseGestures[pattern] = { action, ...config };

		this.mouseGestures = newMouseGestures;

		this.dispatchEvent(new CustomEvent('gestures-change', {
			detail: { mouseGestures: newMouseGestures },
			bubbles: true,
			composed: true,
		}));
	}

	#handleReset(pattern) {
		const { DEFAULT_GESTURES } = window.GestureConstants;
		const defaultAction = DEFAULT_GESTURES[pattern] || 'none';

		const newMouseGestures = { ...(this.mouseGestures || {}) };
		newMouseGestures[pattern] = { action: defaultAction };

		this.mouseGestures = newMouseGestures;

		this.dispatchEvent(new CustomEvent('gestures-change', {
			detail: { mouseGestures: newMouseGestures },
			bubbles: true,
			composed: true,
		}));
	}

	openActionSelect(pattern) {
		this.updateComplete.then(() => {
			const el = this.shadowRoot.querySelector(`action-select[data-pattern="${pattern}"]`);
			if (el) el.open();
		});
	}

	#handleDelete(pattern) {
		if (!confirm(window.i18n.getMessage('deleteGestureConfirm').replace('%pattern%', pattern))) {
			return;
		}

		this.dispatchEvent(new CustomEvent('gesture-delete', {
			detail: { pattern },
			bubbles: true,
			composed: true,
		}));
	}
}

window.i18n.waitForInit().then(() => {
	customElements.define('gesture-grid', GestureGrid);
});

/**
 * 手势路径可视化渲染函数
 * @param {string} sequence - 手势序列 (如 'RLRU', '→↓←')
 * @param {object} [options] - 配置项
 * @param {number} [options.width=100] - 基准宽度，用于比例化计算默认步长和偏移
 * @param {number} [options.step] - 路径步长，即单次移动的物理像素距离 (默认: width * 0.80)
 * @param {number} [options.drift] - 防重叠偏移量，用于错开往返重复的路径 (默认: width * 0.15)
 * @param {number} [options.padding] - SVG 视图容器的边缘留白 (默认: width * 0.15)
 * @param {string} [options.color='#3b82f6'] - 渲染颜色，包括路径、起点圆点和终点箭头
 * @param {string} [options.style='width: 2em; height: 2em; display: inline-block;'] - 其他CSS属性
 */
function renderGestureSvg(sequence, options = {}) {
  // --- 配置初始化 ---
  const width = options.width || 100;
  const settings = {
    step: Math.floor(width * 0.80), // 步长
    drift: Math.floor(width * 0.15), // 防重叠偏移量
    padding: Math.floor(width * 0.15), // 边缘留白
    color: "#3b82f6",
    style: 'width: 2em; height: 2em; display: inline-block;',
    ...options,
  };

  const moveMap = {
    "R": [1, 0], "L": [-1, 0], "U": [0, -1], "D": [0, 1],
    "→": [1, 0], "←": [-1, 0], "↑": [0, -1], "↓": [0, 1],
  };

  // --- 1. 坐标计算 ---
  let lx = 0, ly = 0, fx = 0, fy = 0;
  const chars = [...sequence.toUpperCase()].filter((c) => moveMap[c]);
  const points = [{ x: 0, y: 0 }];

  chars.forEach((char, i) => {
    const [dx, dy] = moveMap[char];
    lx += dx;
    ly += dy;
    // 物理坐标 = 逻辑位置 + 步骤累计漂移（解决回退重叠）
    if (i == 0 && chars.length > 1 && lx + moveMap[chars[1]][0] == 0 && ly + moveMap[chars[1]][1] == 0) {
      lx == 0 ? fx = 1 : fy = 1;
    }
    const x = (lx * settings.step) + ((i + fx) * settings.drift);
    const y = (ly * settings.step) + ((i + fy) * settings.drift);
    points.push({ x, y });
  });

  // --- 2. 自动缩放计算 (ViewBox) ---
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const vbW = Math.max(maxX - minX, 10) + settings.padding * 2;
  const vbH = Math.max(maxY - minY, 10) + settings.padding * 2;
  const vbX = minX - settings.padding;
  const vbY = minY - settings.padding;

  // --- 3. 构建 SVG 字符串 ---
  let svgNodes = "";
  if (points.length <= 1) return svgNodes;

  // 绘制路径线段
  {
    const pathD = points.map((
      p,
      i,
    ) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
    svgNodes += `
          <path d="${pathD}" fill="none" stroke="${settings.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  // 绘制起点
  {
    const p = points[0];
    svgNodes += `
         <circle cx="${p.x}" cy="${p.y}" r="8" fill="${settings.color}" />`;
  }

  // 绘制终点
  {
    const p = points[points.length - 1];
    const p1 = points[points.length - 2];
    const angle = Math.atan2(p.y - p1.y, p.x - p1.x) * 180 / Math.PI;

    svgNodes += `
          <g transform="translate(${p.x}, ${p.y}) rotate(${angle})">
              <polygon points="-12,-10 4,0 -12,10 -4,0" fill="${settings.color}" /> </g>`;
  }

  return `
        <svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" style="${settings.style}" preserveAspectRatio="xMidYMid meet">
            ${svgNodes}
        </svg>`;
}
