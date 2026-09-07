const { DEFAULT_SETTINGS } = window.GestureConstants;

function reorderMouseGestures(storedMG) {
	const defaultOrder = Object.keys(DEFAULT_SETTINGS.mouseGestures);
	const ordered = {};
	for (const p of defaultOrder) {
		if (p in storedMG) ordered[p] = storedMG[p];
	}
	for (const p of Object.keys(storedMG)) {
		if (!(p in ordered)) ordered[p] = storedMG[p];
	}
	return ordered;
}

function normalizeSetting(key, value) {
	if (key === 'mouseGestures' && value) {
		return reorderMouseGestures(value);
	}
	if (key === 'wheelGestures' && value) {
		return {
			...structuredClone(DEFAULT_SETTINGS.wheelGestures),
			...value,
		};
	}
	if (key === 'specialGestures' && value) {
		return {
			...structuredClone(DEFAULT_SETTINGS.specialGestures),
			...value,
		};
	}
	return value;
}

function deepEqual(obj1, obj2) {
	if (obj1 === obj2) return true;
	if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
		return false;
	}
	if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);
	if (keys1.length !== keys2.length) return false;
	for (const key of keys1) {
		if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
			return false;
		}
	}
	return true;
}

class SettingsStore {
	#current = structuredClone(DEFAULT_SETTINGS);
	#listeners = [];
	#listening = false;
	#resetting = false;
	#loaded = false;
	#loadPromise = null;

	constructor() {
		this.#loadPromise = this.#load();
	}

	get current() { this.#assertLoaded(); return this.#current; }

	async waitForLoad() {
		return await this.#loadPromise;
	}

	#assertLoaded() {
		if (!this.#loaded) throw new Error('SettingsStore not initialized');
	}

	async #load() {
		if (!this.#listening) {
			chrome.storage.onChanged.addListener((changes, namespace) => {
				if (namespace === 'sync') {
					this.handleExternalChange(changes);
				}
			});
			this.#listening = true;
		}

		return new Promise((resolve) => {
			chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
				this.#current = { ...structuredClone(DEFAULT_SETTINGS), ...items };

				for (const key of ['mouseGestures', 'wheelGestures', 'specialGestures']) {
					this.#current[key] = normalizeSetting(key, this.#current[key]);
				}

				this.#loaded = true;
				resolve(this.#current);
			});
		});
	}

	async save(patch = {}) {
		this.#assertLoaded();
		const now = new Date().toISOString();
		Object.assign(this.#current, patch, { lastSyncTime: now });

		try {
			await chrome.storage.sync.set(this.#current);
			return true;
		} catch (e) {
			console.error('Settings save failed:', e);
			return false;
		}
	}

	async reset() {
		this.#assertLoaded();
		this.#resetting = true;
		try {
			await chrome.storage.sync.clear();
			this.#current = structuredClone(DEFAULT_SETTINGS);
			await chrome.storage.sync.set(this.#current);
		} catch (e) {
			console.error('Settings reset failed:', e);
		} finally {
			this.#resetting = false;
		}
	}

	handleExternalChange(changes) {
		if (!this.#loaded || this.#resetting) return { changed: {}, hasChange: false };
		let changed = {};
		let hasChange = false;

		for (const [key, storageChange] of Object.entries(changes)) {
			let newValue = storageChange.newValue;

			if (newValue === undefined && key in DEFAULT_SETTINGS) {
				newValue = structuredClone(DEFAULT_SETTINGS[key]);
			}

			newValue = normalizeSetting(key, newValue);

			if (!deepEqual(this.#current[key], newValue)) {
				this.#current[key] = newValue;
				changed[key] = newValue;
				hasChange = true;
			}
		}

		if (hasChange) this.#notifyExternal(changed);
		return { changed, hasChange };
	}

	onChange(fn) {
		this.#listeners.push(fn);
		return () => {
			const i = this.#listeners.indexOf(fn);
			if (i >= 0) this.#listeners.splice(i, 1);
		};
	}

	#notifyExternal(changed) {
		this.#listeners.forEach(fn => fn(changed, this.#current));
	}
}

export const settingsStore = new SettingsStore();