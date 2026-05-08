import { LitElement, html, css, unsafeHTML } from '../../js/lib/lit-all.min.js';
import { commonStyles, optionStyles } from './shared-styles.js';
import { icons, icon } from '../icons.js';

class AboutPage extends LitElement {
	static properties = {
		_ready: { state: true },
	};

	static styles = [
		commonStyles,
		optionStyles,
		css`
			:host {
				display: block;
				padding: 20px;
			}

			.container {
				max-width: 700px;
			}

			.section {
				background: var(--bg-secondary);
				border-radius: 20px;
				padding: 20px 26px;
				margin-bottom: 20px;
				border: 1px solid var(--section-border);
				box-shadow: var(--section-shadow) 0px 1px 3px 0px;
			}

			.section h2 {
				font-size: 1.1em;
				margin-bottom: 12px;
				color: var(--accent-color);
				padding: 0;
				gap: 8px;
			}

			.section p {
				line-height: 1.7;
				color: var(--text-secondary);
				font-size: 14px;
				white-space: pre-line;
			}

			header {
				justify-content: center;
			}

			header h1 {
				justify-content: center;
			}

			.info-row-icon {
				display: inline-flex;
				color: var(--text-muted);
				flex-shrink: 0;
				width: 16px;
				height: 16px;
				margin-inline-end: 6px;
			}

			.info-row-icon svg {
				width: 16px;
				height: 16px;
			}

			.section-heading {
				display: flex;
				align-items: center;
				gap: 8px;
			}

			.section-heading-icon {
				display: inline-flex;
				color: var(--accent-color);
			}

			.section-heading-icon svg {
				width: 1.1em;
				height: 1.1em;
			}

			.feature-icon {
				display: inline-flex;
				flex-shrink: 0;
				color: var(--accent-color);
				margin-inline-end: 8px;
			}

			.feature-icon svg {
				width: 18px;
				height: 18px;
			}

			.badge-icon {
				display: inline-flex;
			}

			.badge-icon svg {
				width: 14px;
				height: 14px;
			}

			.credits-heading {
				color: #ea4335;
			}

			.info-row {
				display: flex;
				padding: 10px 0;
				border-bottom: 1px solid var(--border-color);
				gap: 5px;
			}

			.info-row:last-child {
				border-bottom: none;
			}

			.info-label {
				display: flex;
				align-items: center;
				min-width: 120px;
				flex-shrink: 0;
				color: var(--text-secondary);
				font-size: 14px;
			}

			.info-value {
				flex: 1;
				font-size: 14px;
			}

			.info-value a {
				color: var(--accent-color);
				text-decoration: none;
			}

			.info-value a:hover {
				text-decoration: underline;
			}

			.features {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: 10px;
			}

			.feature {
				background: var(--bg-tertiary);
				padding: 12px;
				border-radius: 8px;
				font-size: 14px;
				display: flex;
				align-items: center;
			}

			.privacy-badge {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 5px;
				background: linear-gradient(135deg, #34a853, #28a745);
				padding: 4px 10px;
				border-radius: 20px;
				font-size: 12px;
				color: #fff;
				margin-inline-end: 8px;
			}

			.badges {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				margin-top: 12px;
			}

			.credits {
				font-size: 13px;
				color: var(--text-secondary);
				line-height: 1.8;
			}

			.heart {
				color: #ea4335;
			}

			.back-btn {
				margin-top: 20px;
				text-decoration: none;
				box-shadow: none;
			}
		`,
	];

	constructor() {
		super();
		this._ready = false;
		this.#init();
	}

	async #init() {
		await window.i18n.waitForInit();
		this._ready = true;
	}

	#getVersion() {
		return 'v' + window.i18n.version;
	}

	render() {
		if (!this._ready) return html``;
		const i18n = window.i18n;

		const features = [
			{ icon: 'mouseRight',   key: 'aboutFeature1' },
			{ icon: 'lineSquiggle', key: 'aboutFeature2' },
			{ icon: 'search',       key: 'aboutFeature3' },
			{ icon: 'ban',          key: 'aboutFeature4' },
			{ icon: 'cloud',        key: 'aboutFeature5' },
			{ icon: 'lock',         key: 'aboutFeature6' },
		];

		const badges = [
			{ icon: 'lock',        key: 'badgeNoNetwork' },
			{ icon: 'ban',         key: 'badgeNoData' },
			{ icon: 'circleCheck', key: 'badgeLocalRun' },
		];

		const infoRows = [
			{ icon: 'user',         label: i18n.getMessage('aboutAuthor'),     value: html`Hmily[LCG] & Coxxs` },
			{ icon: 'globe',        label: i18n.getMessage('aboutWebsite'),    value: html`<a href="https://www.52pojie.cn/thread-2080303-1-1.html" target="_blank">https://www.52pojie.cn/thread-2080303-1-1.html</a>` },
			{ icon: 'github',       label: i18n.getMessage('aboutOpenSource'), value: html`<a href="https://github.com/Hmily-LCG/FlowMouse" target="_blank">https://github.com/Hmily-LCG/FlowMouse</a>` },
			{ icon: 'mail',         label: i18n.getMessage('aboutEmail'),      value: html`<a href="mailto:Service@52pojie.cn">Service@52pojie.cn</a>` },
			{ icon: 'info',         label: i18n.getMessage('version'),         value: html`<span>${this.#getVersion()}</span>` },
		];

		return html`
			<div class="container">
				<header>
					<h1>
						<img src="../icons/icon128.png" class="logo-img" alt="Logo">
						<span>${i18n.getMessage('aboutTitle')}</span>
					</h1>
				</header>

				<div class="section">
					${infoRows.map(row => html`
						<div class="info-row">
							<span class="info-label">
								<span class="info-row-icon">${unsafeHTML(icon(row.icon, { size: 16, strokeWidth: 2 }))}</span>
								${row.label}
							</span>
							<span class="info-value">${row.value}</span>
						</div>
					`)}
				</div>

				<div class="section">
					<h2 class="section-heading">
						<span class="section-heading-icon">${unsafeHTML(icon('sparkles', { strokeWidth: 2 }))}</span>
						<span>${i18n.getMessage('aboutFeatures')}</span>
					</h2>
					<div class="features">
						${features.map(f => html`
							<div class="feature">
								<span class="feature-icon">${unsafeHTML(icon(f.icon, { size: 18, strokeWidth: 2 }))}</span>
								${i18n.getMessage(f.key)}
							</div>
						`)}
					</div>
				</div>

				<div class="section">
					<h2 class="section-heading">
						<span class="section-heading-icon">${unsafeHTML(icon('shieldCheck', { strokeWidth: 2 }))}</span>
						<span>${i18n.getMessage('aboutPrivacy')}</span>
					</h2>
					<p>${i18n.getMessage('aboutPrivacyText')}</p>
					<div class="badges">
						${badges.map(b => html`
							<span class="privacy-badge">
								<span class="badge-icon">${unsafeHTML(icon(b.icon, { size: 14, strokeWidth: 2 }))}</span>
								${i18n.getMessage(b.key)}
							</span>
						`)}
					</div>
				</div>

				<div class="section">
					<h2 class="section-heading">
						<span class="section-heading-icon credits-heading">${unsafeHTML(icon('heart', { strokeWidth: 2 }))}</span>
						<span>${i18n.getMessage('aboutCredits')}</span>
					</h2>
					<p class="credits">${i18n.getMessage('aboutCreditsText')}</p>
				</div>

				<a href="options.html" class="btn btn-secondary btn-lg back-btn">
					${unsafeHTML(icon('arrowLeft', { size: 16, strokeWidth: 2 }))}
					${i18n.getMessage('backToSettings')}
				</a>
			</div>
		`;
	}
}

customElements.define('about-page', AboutPage);