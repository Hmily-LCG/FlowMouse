(function () {
	'use strict';

	const isFirefox = false;
	const isEdgeDesktop = navigator.userAgent.includes('Edg/');
	const isEdge = navigator.userAgent.includes('Edg/') || navigator.userAgent.includes('EdgA/');
	const isSafari = !!(window.FlowMouseCompat && window.FlowMouseCompat.isSafari);

	let translations = {};
	let currentLang = 'en';
	let initPromise = null;
	let currentThemeSetting = null;

	let platform = 'unknown';
	let platformName = 'System';
	const OS_NAMES = {
		'win': 'Windows', 'mac': 'macOS', 'linux': 'Linux',
		'cros': 'Chrome OS', 'android': 'Android', 'openbsd': 'OpenBSD'
	};

	const SUPPORTED_LANGUAGES = {
		"en": { name: "English", enName: "English" },
		"id": { name: "Bahasa Indonesia", enName: "Indonesian" },
		"ms": { name: "Bahasa Melayu", enName: "Malay" },
		"cs": { name: "Čeština", enName: "Czech" },
		"da": { name: "Dansk", enName: "Danish" },
		"de": { name: "Deutsch", enName: "German" },
		"es": { name: "Español (España)", enName: "Spanish" },
		"es_419": { name: "Español (Latinoamérica)", enName: "Spanish (Latin America)" },
		"fil": { name: "Filipino", enName: "Filipino" },
		"fr": { name: "Français", enName: "French" },
		"hr": { name: "Hrvatski", enName: "Croatian" },
		"it": { name: "Italiano", enName: "Italian" },
		"hu": { name: "Magyar", enName: "Hungarian" },
		"nl": { name: "Nederlands", enName: "Dutch" },
		"no": { name: "Norsk", enName: "Norwegian" },
		"pl": { name: "Polski", enName: "Polish" },
		"pt_BR": { name: "Português (Brasil)", enName: "Portuguese (Brazil)" },
		"pt_PT": { name: "Português (Portugal)", enName: "Portuguese (Portugal)" },
		"ro": { name: "Română", enName: "Romanian" },
		"sk": { name: "Slovenčina", enName: "Slovak" },
		"fi": { name: "Suomi", enName: "Finnish" },
		"sv": { name: "Svenska", enName: "Swedish" },
		"vi": { name: "Tiếng Việt", enName: "Vietnamese" },
		"tr": { name: "Türkçe", enName: "Turkish" },
		"el": { name: "Ελληνικά", enName: "Greek" },
		"bg": { name: "Български", enName: "Bulgarian" },
		"ru": { name: "Русский", enName: "Russian" },
		"sr": { name: "Српски", enName: "Serbian" },
		"uk": { name: "Українська", enName: "Ukrainian" },
		"ar": { name: "العربية", enName: "Arabic", dir: "rtl" },
		"fa": { name: "فارسی", enName: "Persian", dir: "rtl" },
		"he": { name: "עברית", enName: "Hebrew", dir: "rtl" },
		"bn": { name: "বাংলা", enName: "Bengali" },
		"hi": { name: "हिन्दी", enName: "Hindi" },
		"th": { name: "ไทย", enName: "Thai" },
		"ja": { name: "日本語", enName: "Japanese" },
		"ko": { name: "한국어", enName: "Korean" },
		"zh_CN": { name: "简体中文", enName: "Chinese (Simplified)" },
		"zh_TW": { name: "繁體中文", enName: "Chinese (Traditional)" },
	};

	function getSupportedLanguages() {
		return SUPPORTED_LANGUAGES;
	}

	function getHtmlLang() {
		return currentLang.replace('_', '-');
	}

	function getDir(lang) {
		const targetLang = lang || currentLang;
		if (SUPPORTED_LANGUAGES[targetLang] && SUPPORTED_LANGUAGES[targetLang].dir) {
			return SUPPORTED_LANGUAGES[targetLang].dir;
		}
		return 'ltr';
	}

	async function loadTranslations(lang) {
		if (!SUPPORTED_LANGUAGES[lang]) {
			return false;
		}
		try {
			const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
			const response = await fetch(url);
			if (response.ok) {
				translations = await response.json();
				currentLang = lang;
				return true;
			}
		} catch (e) {
			console.warn('Failed to load translations for:', lang);
		}
		return false;
	}

	function getMessage(key) {
		let message;
		if (translations[key] && translations[key].message) {
			message = translations[key].message;
		} else {
			if (typeof key !== 'string') {
				message = '[!!!] undefined';
			} else {
				message = chrome.i18n.getMessage(key) || '[!!!]' + key;
			}
		}
		if (message.indexOf('%browserName%') !== -1) {
			message = message.replaceAll("%browserName%", getBrowserName());
		}
		return message;
	}

	function applyI18n(rootElement = document) {
		if (currentLang && rootElement === document) {
			document.documentElement.lang = getHtmlLang();
			document.documentElement.dir = getDir();
		}

		rootElement.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.getAttribute('data-i18n');
			const message = getMessage(key);
			if (message && message !== key) {
				el.innerHTML = message;
			}
		});

		rootElement.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
			const key = el.getAttribute('data-i18n-placeholder');
			const message = getMessage(key);
			if (message && message !== key) {
				el.placeholder = message;
			}
		});

		rootElement.querySelectorAll('[data-i18n-title]').forEach(el => {
			const key = el.getAttribute('data-i18n-title');
			const message = getMessage(key);
			if (message && message !== key) {
				el.title = message;
			}
		});

		if (rootElement === document) {
			const titleEl = document.querySelector('title[data-i18n]');
			if (titleEl) {
				const key = titleEl.getAttribute('data-i18n');
				const message = getMessage(key);
				if (message && message !== key) {
					document.title = message;
				}
			}

			let i18nLoadStyle = document.getElementById('i18n-load-style');
			if (i18nLoadStyle) {
				i18nLoadStyle.remove();
			}
		}
	}

	function getSystemTheme() {
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
			return 'dark';
		}
		return 'light';
	}

	function applyTheme(theme, skipSave = false) {
		currentThemeSetting = theme;
		let actualTheme = theme;
		if (theme === 'auto') {
			actualTheme = getSystemTheme();
		}
		document.body.setAttribute('data-theme', actualTheme || 'dark');

		try {
			if (!skipSave) {
				localStorage.setItem('flowmouse_theme', theme);
			}
		} catch (e) {
		}
	}

	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (currentThemeSetting === 'auto') {
			applyTheme('auto', true);
		}
	});

	function getCurrentLanguage() {
		return currentLang;
	}

	let browserType;
	function getBrowserType() {
		if (browserType) return browserType;
		{
			if (isSafari) {
				browserType = 'safari';
			} else if (isEdge) {
				browserType = 'edge';
			} else {
				browserType = 'chrome';
			}
			return browserType;
		}
	}

	const browsers = {
		'chrome': {
			name: 'Chrome',
			storeLink: 'https://chromewebstore.google.com/',
			storeNameKey: 'storeNameChrome',
			flowmouseStoreLink: 'https://chromewebstore.google.com/detail/fnldhkfidchnjiokpoemdhoejmaojkgp/reviews/my-review?utm_source=item-share-cb',
			protocol: 'chrome://',
		},
		'edge': {
			name: 'Edge',
			storeLink: 'https://microsoftedge.microsoft.com/addons/',
			storeNameKey: 'storeNameEdge',
			flowmouseStoreLink: 'https://microsoftedge.microsoft.com/addons/detail/obaiedbdkdciaknhnmpcpodkndadhncc',
			protocol: 'edge://'
		},
		'firefox': {
			name: 'Firefox',
			storeLink: 'https://addons.mozilla.org/',
			storeNameKey: 'storeNameFirefox',
			flowmouseStoreLink: 'https://addons.mozilla.org/firefox/addon/flowmouse/',
			protocol: 'about:'
		},
		'safari': {
			name: 'Safari',
			storeLink: 'https://apps.apple.com/',
			storeNameKey: 'storeNameSafari',
			flowmouseStoreLink: '',
			protocol: ''
		}
	}

	let browserName;
	function getBrowserName() {
		if (browserName) return browserName;
		browserName = getBrowserInfo().name;
		return browserName;
	}

	function getBrowserInfo() {
		const browserType = getBrowserType();
		const browserConfig = browsers[browserType];

		return {
			browserType,
			name: browserConfig.name,
			storeLink: browserConfig.storeLink,
			flowmouseStoreLink: browserConfig.flowmouseStoreLink,
			storeName: getMessage(browserConfig.storeNameKey),
			protocol: browserConfig.protocol,
		};
	}

	async function init() {
		let cachedTheme
		try {
			cachedTheme = localStorage.getItem('flowmouse_theme');
			if (cachedTheme) {
				applyTheme(cachedTheme, true);
			}
		} catch (e) {
		}

		const items = await chrome.storage.sync.get({ language: 'auto', theme: 'auto' });

		if (items.theme !== cachedTheme) {
			applyTheme(items.theme);
		}

		let lang = items.language;
		if (lang === 'auto') {
			const uiLang = chrome.i18n.getUILanguage();
			lang = uiLang.replace('-', '_');

			if (lang === 'zh') {
				lang = 'zh_CN';
			}
		}

		let loaded = await loadTranslations(lang);

		if (!loaded && lang.includes('_')) {
			const baseLang = lang.split('_')[0];
			loaded = await loadTranslations(baseLang);
		}

		if (!loaded) {
			loaded = await loadTranslations('en');
		}

		applyI18n();

		try {
			const info = await chrome.runtime.getPlatformInfo();
			platform = info.os || 'unknown';
			platformName = OS_NAMES[info.os] || 'System';
		} catch (e) { }
	}

	async function waitForInit() {
		if (!initPromise) {
			throw new Error('i18n not initialized');
		}
		await initPromise;
		return;
	}

	function getModifierKeyName(key) {
		const isMac = platform === 'mac';
		const isLinux = platform === 'linux' || platform === 'cros' || platform === 'openbsd';
		switch (key) {
			case 'Ctrl': return isMac ? '⌃ Control' : 'Ctrl';
			case 'Alt': return isMac ? '⌥ Option' : 'Alt';
			case 'Shift': return isMac ? '⇧ Shift' : 'Shift';
			case 'Meta': return isMac ? '⌘ Cmd' : isLinux ? 'Super' : 'Win';
			default: return key;
		}
	}

	window.i18n = {
		getMessage,
		applyI18n,
		getCurrentLanguage,
		getSupportedLanguages,
		getHtmlLang,
		getDir,
		applyTheme,
		init,
		loadTranslations,
		waitForInit,
		isFirefox,
		isEdge,
		isEdgeDesktop,
		isSafari,
		getBrowserName,
		getBrowserInfo,
		getModifierKeyName,
		get platform() { return platform; },
		get platformName() { return platformName; },
		version: chrome.runtime.getManifest().version,
	};

	initPromise = init();
})();