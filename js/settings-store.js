const { DEFAULT_SETTINGS } = window.GestureConstants;

function reorderMouseGestures(storedMG) {
	if (!storedMG) return {};
	const defaultOrder = Object.keys(DEFAULT_SETTINGS.mouseGestures || {});
	const ordered = {};
	for (const p of defaultOrder) {
		if (p in storedMG) ordered[p] = storedMG[p];
	}
	for (const p of Object.keys(storedMG)) {
		if (!(p in ordered)) ordered[p] = storedMG[p];
	}
	return ordered;
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

export const SettingsStore = {
	_current: structuredClone(DEFAULT_SETTINGS),
	_listeners: [],
	_listening: false,
	_resetting: false,

	get current() { return this._current; },

	async load() {
		if (!this._listening) {
			chrome.storage.onChanged.addListener((changes, namespace) => {
				if (namespace === 'sync') {
					this.handleExternalChange(changes);
				}
			});
			this._listening = true;
		}

		return new Promise((resolve) => {
			chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
				this._current = { ...structuredClone(DEFAULT_SETTINGS), ...items };

				this._current.wheelGestures = {
					...structuredClone(DEFAULT_SETTINGS.wheelGestures || {}),
					...(this._current.wheelGestures || {}),
				};
				this._current.specialGestures = {
					...structuredClone(DEFAULT_SETTINGS.specialGestures || {}),
					...(this._current.specialGestures || {}),
				};

				this._current.mouseGestures = reorderMouseGestures(this._current.mouseGestures);

				resolve(this._current);
			});
		});
	},

	async save(patch = {}) {
		const now = new Date().toISOString();
		Object.assign(this._current, patch, { lastSyncTime: now });

		try {
			await chrome.storage.sync.set(this._current);
			return true;
		} catch (e) {
			console.error('Settings save failed:', e);
			return false;
		}
	},

	async reset() {
		this._resetting = true;
		return new Promise((resolve) => {
			chrome.storage.sync.clear(() => {
				this._current = structuredClone(DEFAULT_SETTINGS);
				this._resetting = false;
				resolve();
			});
		});
	},

	handleExternalChange(changes) {
		if (this._resetting) return { changed: {}, hasChange: false };
		let changed = {};
		let hasChange = false;

		for (const [key, storageChange] of Object.entries(changes)) {
			let newValue = storageChange.newValue;
			
			if (key === 'mouseGestures' && newValue) {
				newValue = reorderMouseGestures(newValue);
			}

			if (!deepEqual(this._current[key], newValue)) {
				this._current[key] = newValue;
				changed[key] = newValue;
				hasChange = true;
			}
		}

		if (hasChange) this._notifyExternal(changed);
		return { changed, hasChange };
	},

	onChange(fn) {
		this._listeners.push(fn);
		return () => {
			const i = this._listeners.indexOf(fn);
			if (i >= 0) this._listeners.splice(i, 1);
		};
	},

	_notifyExternal(changed) {
		this._listeners.forEach(fn => fn(changed, this._current));
	}
};