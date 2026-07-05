importScripts('menu-patterns.js');

const isEdge = navigator.userAgent.includes('Edg/') || navigator.userAgent.includes('EdgA/');

const GLOBAL_MUTE_KEY = 'flowmouse_global_mute_state';

const ctxMenuSessions = new Map();

function sortAndClamp(items, sortOrder, maxItems, titleKey = 'title') {
	if (sortOrder && sortOrder !== 'default') {
		if (sortOrder === 'default_desc') {
			items = items.slice().reverse();
		} else {
			const [field, dir] = sortOrder.split('_');
			const asc = dir === 'asc';
			items = items.slice().sort((a, b) => {
				let va, vb;
				if (field === 'name') {
					va = (a[titleKey] || '').toLowerCase();
					vb = (b[titleKey] || '').toLowerCase();
					return asc ? va.localeCompare(vb) : vb.localeCompare(va);
				}
				va = a[field] || 0;
				vb = b[field] || 0;
				return asc ? va - vb : vb - va;
			});
		}
	}
	if (maxItems > 0 && items.length > maxItems) {
		items = items.slice(0, maxItems);
	}
	return items;
}

chrome.tabs.onCreated.addListener((tab) => {
	chrome.storage.session.get([GLOBAL_MUTE_KEY], (items) => {
		if (items[GLOBAL_MUTE_KEY]) {
			if (tab.id) {
				chrome.tabs.update(tab.id, { muted: true });
			}
		}
	});
});

function asyncMessageHandler(asyncHandler) {
	return (message, sender, sendResponse) => {
		asyncHandler(message, sender)
			.then(sendResponse)
			.catch((error) => {
				console.error('Error handling message:', message, error);
				sendResponse({ success: false, error: error.message });
			});
		return true;
	};
}

const CONTENT_ACTIONS = new Set([
	'scrollUp', 'scrollDown', 'scrollToTop', 'scrollToBottom',
	'stopLoading', 'copyUrl', 'copyTitle', 'copyTitleAndUrl', 'printPage', 'sendCustomEvent',
	'simulateKey', 'pasteClipboard', 'pasteContent', 'searchClipboard', 'searchLink',
	'menuShowTabs', 'menuRecentlyClosed', 'menuShowBookmarks',
	'customMenu',
]);

async function createTabAtPosition(sender, position, extraOpts = {}) {
	if (!sender.tab) {
		return await chrome.tabs.create({ active: true, ...extraOpts });
	}
	const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
	const createOpts = { active: true, windowId: sender.tab.windowId, ...extraOpts };
	switch (position) {
		case 'right': createOpts.index = sender.tab.index + 1; break;
		case 'left': createOpts.index = sender.tab.index; break;
		case 'first': createOpts.index = 0; break;
		case 'last':
		default: createOpts.index = tabs.length; break;
	}
	return await chrome.tabs.create(createOpts);
}

async function openInNewWindow(url, focused = true, incognito = false) {
	const createOpts = { focused, incognito };
	if (url) createOpts.url = url;
	const win = await chrome.windows.create(createOpts);
	return win.tabs[0];
}

function replaceUrlPlaceholders(template, tab) {
	const rawUrl = tab?.url || '';
	const raw = {
		tabUrl: rawUrl,
		tabTitle: tab?.title || '',
		tabDomain: '',
	};
	if (rawUrl) {
		try {
			raw.tabDomain = new URL(rawUrl).hostname;
		} catch { }
	}
	return (template || '').replace(/\{(tabUrl|tabTitle|tabDomain)(?::(raw))?\}/g, (_, key, mod) => {
		const val = raw[key] || '';
		return mod ? val : encodeURIComponent(val);
	});
}

let _offscreenCreating = null;

async function ensureOffscreen() {
	if (!chrome.offscreen) {
		throw new Error('chrome.offscreen API is not available in this browser');
	}
	if (await chrome.offscreen.hasDocument()) {
		return;
	}
	if (_offscreenCreating) {
		return _offscreenCreating;
	}
	_offscreenCreating = chrome.offscreen.createDocument({
		url: 'pages/offscreen.html',
		reasons: ['IFRAME_SCRIPTING'],
		justification: 'Run user-defined search-link transform scripts in an isolated sandbox',
	}).catch((e) => {
		// Swallow benign "only one offscreen document" race error
		if (!e?.message?.includes('single offscreen document')) throw e;
	}).finally(() => {
		_offscreenCreating = null;
	});
	return _offscreenCreating;
}

let _transformIdCounter = 0;

async function handleAction(request, sender) {
	switch (request.action) {
		case 'back':
			if (sender.tab?.id) {
				await chrome.tabs.goBack(sender.tab.id).catch(() => { });
			}
			return { success: true };

		case 'forward':
			if (sender.tab?.id) {
				await chrome.tabs.goForward(sender.tab.id).catch(() => { });
			}
			return { success: true };

		case 'urlLevelUp':
			if (sender.tab?.id && sender.tab.url) {
				const u = new URL(sender.tab.url);
				const newPath = u.pathname.replace(/\/([^/]+)\/?$/, '');
				if (newPath !== u.pathname) {
					await chrome.tabs.update(sender.tab.id, { url: u.origin + newPath });
				}
			}
			return { success: true };

		case 'urlToRoot':
			if (sender.tab?.id && sender.tab.url) {
				const u = new URL(sender.tab.url);
				if (u.pathname !== '/' || u.search || u.hash) {
					await chrome.tabs.update(sender.tab.id, { url: u.origin });
				}
			}
			return { success: true };

		case 'refresh':
			if (sender.tab?.id) {
				await chrome.tabs.reload(sender.tab.id, { bypassCache: !!request.hardReload });
			}
			return { success: true };

		case 'closeTab': {
			if (sender.tab?.id) {
				if (request.skipPinned && sender.tab.pinned) {
					return { success: true };
				}
				const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
				const currentPos = tabs.findIndex(t => t.id === sender.tab.id);
				const afterClose = request.afterClose || 'default';

				if (request.keepWindow && tabs.length === 1) {
					await chrome.tabs.create({ active: true, windowId: sender.tab.windowId });
				}

				if (afterClose !== 'default' && tabs.length > 1 && currentPos !== -1) {
					let targetPos;
					if (afterClose === 'left') {
						targetPos = currentPos > 0 ? currentPos - 1 : tabs.length - 1;
					} else if (afterClose === 'right') {
						targetPos = currentPos < tabs.length - 1 ? currentPos + 1 : 0;
					}
					if (targetPos !== undefined) {
						await chrome.tabs.update(tabs[targetPos].id, { active: true });
					}
				}

				await chrome.tabs.remove(sender.tab.id);
			}
			return { success: true };
		}

		case 'closeWindow':
			if (sender.tab?.windowId) {
				await chrome.windows.remove(sender.tab.windowId);
			}
			return { success: true };

		case 'closeBrowser': {
			const windows = await chrome.windows.getAll({});
			for (const win of windows) {
				await chrome.windows.remove(win.id);
			}
			return { success: true };
		}

		case 'restoreTab':
			if (sender.tab?.incognito) return { success: false };
			await chrome.sessions.restore(null).catch(() => { });
			return { success: true };

		case 'newTab': {
			const active = request.active !== false;
			const position = request.position || 'last';
			if (position === 'newWindow') {
				await openInNewWindow(undefined, active, sender.tab?.incognito);
			} else {
				await createTabAtPosition(sender, position, { active });
			}
			return { success: true };
		}

		case 'openTabAtPosition': {
			if (sender.tab && request.incognito && !sender.tab.incognito) {
				const granted = await requestPermission(['incognito'], sender.tab.windowId);
				if (granted) {
					await chrome.windows.create({ incognito: true, url: request.url });
				}
				return { success: true };
			}

			const position = request.position || 'right';
			const active = request.active !== false;

			if (position === 'newWindow') {
				await openInNewWindow(request.url, active, sender.tab?.incognito);
			} else if (position === 'current' && sender.tab) {
				await chrome.tabs.update(sender.tab.id, { url: request.url, active });
			} else {
				await createTabAtPosition(sender, position, {
					url: request.url,
					active,
					openerTabId: sender.tab?.id,
				});
			}
			return { success: true };
		}

		case 'openIncognitoTabs': {
			const urls = request.urls || [];
			const queries = request.queries || [];
			if (!sender.tab || (urls.length === 0 && queries.length === 0)) return { success: true };
			if (sender.tab.incognito) {
				for (const url of urls) {
					await chrome.tabs.create({ url, windowId: sender.tab.windowId });
				}
				for (const query of queries) {
					const tab = await chrome.tabs.create({ windowId: sender.tab.windowId });
					await chrome.search.query({ text: query, tabId: tab.id });
				}
			} else {
				const granted = await requestPermission(['incognito'], sender.tab.windowId);
				if (granted) {
					const newWin = await chrome.windows.create({ incognito: true, url: urls.length > 0 ? urls : undefined });
					if (newWin) {
						for (const query of queries) {
							const tab = await chrome.tabs.create({ windowId: newWin.id });
							await chrome.search.query({ text: query, tabId: tab.id });
						}
					}
				}
			}
			return { success: true };
		}

		case 'systemSearch': {
			if (sender.tab) {
				if (request.incognito && !sender.tab.incognito) {
					const granted = await requestPermission(['incognito'], sender.tab.windowId);
					if (granted) {
						const newWin = await chrome.windows.create({ incognito: true });
						if (newWin && newWin.tabs && newWin.tabs.length > 0) {
							await chrome.search.query({ text: request.query, tabId: newWin.tabs[0].id });
						}
					}
					return { success: true };
				}

				const position = request.position || 'right';
				const active = request.active !== false;

				if (position === 'newWindow') {
					const newTab = await openInNewWindow(undefined, active, sender.tab?.incognito);
					await chrome.search.query({ text: request.query, tabId: newTab.id });
				} else if (position === 'current') {
					await chrome.search.query({ text: request.query, tabId: sender.tab.id });
				} else {
					const newTab = await createTabAtPosition(sender, position, {
						url: undefined,
						active,
						openerTabId: sender.tab.id,
					});
					if (newTab) {
						await chrome.search.query({ text: request.query, tabId: newTab.id });
					}
				}
			}
			return { success: true };
		}

		case 'saveImage':
			if (request.url) {
				requestPermission(['downloads', 'pageCapture'], sender.tab?.windowId ?? null).then(async (granted) => {
					if (!granted) return;

					if (request.url.startsWith('data:')) {
						{
							await chrome.downloads.download({
								url: request.url,
								filename: request.filename || null,
								saveAs: false
							});
						}
						return;
					}

					const imageUrl = request.url;

					{
						const sourceTabId = sender.tab?.id ?? null;
						if (!sourceTabId) {
							return;
						}

						const MHTML_MAX_RETRIES = 2;
						const MHTML_RETRY_DELAY = 500;
						try {
							let mhtmlBlob;
							for (let i = 0; i <= MHTML_MAX_RETRIES; i++) {
								try {
									mhtmlBlob = await chrome.pageCapture.saveAsMHTML({ tabId: sourceTabId });
									if (mhtmlBlob) break;
								} catch (e) {
									if (i >= MHTML_MAX_RETRIES) throw e;
									await new Promise(r => setTimeout(r, MHTML_RETRY_DELAY));
								}
							}
							const mhtmlText = await mhtmlBlob.text();

							const resource = findResourceInMhtml(mhtmlText, imageUrl);

							if (resource && resource.dataUrl) {
								const filename = getFilename(imageUrl, resource.type);
								await chrome.downloads.download({
									url: resource.dataUrl,
									filename: filename,
									saveAs: false
								});
							} else {
								notifyDownloadError(sourceTabId);
							}
						} catch (e) {
							console.error('MHTML capture failed:', e);
							notifyDownloadError(sourceTabId);
						}
					}
				});
			}
			return { success: true };

		case 'saveAsMhtml':
			if (sender.tab?.id) {
				requestPermission(['downloads', 'pageCapture'], sender.tab.windowId).then(async (granted) => {
					if (!granted) return;

					const MHTML_MAX_RETRIES = 2;
					const MHTML_RETRY_DELAY = 500;
					try {
						let mhtmlBlob;
						for (let i = 0; i <= MHTML_MAX_RETRIES; i++) {
							try {
								mhtmlBlob = await chrome.pageCapture.saveAsMHTML({ tabId: sender.tab.id });
								if (mhtmlBlob) break;
							} catch (e) {
								if (i >= MHTML_MAX_RETRIES) throw e;
								await new Promise(r => setTimeout(r, MHTML_RETRY_DELAY));
							}
						}

						const reader = new FileReader();
						const dataUrl = await new Promise((resolve, reject) => {
							reader.onload = () => resolve(reader.result);
							reader.onerror = () => reject(reader.error);
							reader.readAsDataURL(mhtmlBlob);
						});

						const title = (sender.tab.title || 'page').replace(/[<>:"/\\|?*]+/g, '_').substring(0, 200);
						const filename = title + '.mhtml';

						await chrome.downloads.download({
							url: dataUrl,
							filename: filename,
							saveAs: true
						});
					} catch (e) {
						console.error('MHTML save failed:', e);
					}
				});
			}
			return { success: true };

		case 'closeOtherTabs': {
			if (sender.tab) {
				const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
				const targetTabs = tabs
					.filter(tab => tab.id !== sender.tab.id && !(request.skipPinned && tab.pinned));

				if (request.preserveTab) {
					await Promise.all(targetTabs.filter(tab => !tab.discarded).map(tab => chrome.tabs.discard(tab.id)));
				} else {
					const tabsToRemove = targetTabs.map(tab => tab.id);
					if (tabsToRemove.length > 0) {
						await chrome.tabs.remove(tabsToRemove);
					}
				}
			}
			return { success: true };
		}

		case 'closeRightTabs': {
			if (sender.tab) {
				const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
				const targetTabs = tabs
					.filter(tab => tab.index > sender.tab.index && !(request.skipPinned && tab.pinned));

				if (request.preserveTab) {
					await Promise.all(targetTabs.filter(tab => !tab.discarded).map(tab => chrome.tabs.discard(tab.id)));
				} else {
					const tabsToRemove = targetTabs.map(tab => tab.id);
					if (tabsToRemove.length > 0) {
						await chrome.tabs.remove(tabsToRemove);
					}
				}
			}
			return { success: true };
		}

		case 'closeLeftTabs': {
			if (sender.tab) {
				const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
				const targetTabs = tabs
					.filter(tab => tab.index < sender.tab.index && !(request.skipPinned && tab.pinned));

				if (request.preserveTab) {
					await Promise.all(targetTabs.filter(tab => !tab.discarded).map(tab => chrome.tabs.discard(tab.id)));
				} else {
					const tabsToRemove = targetTabs.map(tab => tab.id);
					if (tabsToRemove.length > 0) {
						await chrome.tabs.remove(tabsToRemove);
					}
				}
			}
			return { success: true };
		}

		case 'refreshAllTabs': {
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			for (const tab of tabs) {
				await chrome.tabs.reload(tab.id, { bypassCache: !!request.hardReload });
			}
			return { success: true };
		}

		case 'stopAllLoading': {
			{
				const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
				await Promise.all(tabs.map(tab => {
					if (isRestrictedUrl(tab.url)) return;
					return chrome.scripting.executeScript({
						target: { tabId: tab.id, allFrames: true },
						func: () => window.stop(),
						injectImmediately: true,
					}).catch(() => {
					});
				}));
			}
			return { success: true };
		}

		case 'closeAllTabs': {
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			const tabsToRemove = tabs
				.filter(tab => !(request.skipPinned && tab.pinned))
				.map(tab => tab.id);
			if (tabsToRemove.length > 0) {
				const remainingTabs = tabs.length - tabsToRemove.length;
				if (remainingTabs === 0) {
					await chrome.tabs.create({ active: true, windowId: sender.tab.windowId });
				}
				await chrome.tabs.remove(tabsToRemove);
			}
			return { success: true };
		}

		case 'switchLeftTab': {
			if (sender.tab) {
				const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
				const currentPos = tabs.findIndex(t => t.id === sender.tab.id);
				if (currentPos === -1) return { success: true };
				if (request.noWrap && currentPos === 0) return { success: true };
				const prevPos = currentPos > 0 ? currentPos - 1 : tabs.length - 1;
				if (request.moveTab) {
					await chrome.tabs.move(sender.tab.id, { index: tabs[prevPos].index });
				} else {
					await chrome.tabs.update(tabs[prevPos].id, { active: true });
				}
			}
			return { success: true };
		}

		case 'switchRightTab': {
			if (sender.tab) {
				const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
				const currentPos = tabs.findIndex(t => t.id === sender.tab.id);
				if (currentPos === -1) return { success: true };
				if (request.noWrap && currentPos === tabs.length - 1) return { success: true };
				const nextPos = currentPos < tabs.length - 1 ? currentPos + 1 : 0;
				if (request.moveTab) {
					await chrome.tabs.move(sender.tab.id, { index: tabs[nextPos].index });
				} else {
					await chrome.tabs.update(tabs[nextPos].id, { active: true });
				}
			}
			return { success: true };
		}

		case 'switchFirstTab': {
			if (sender.tab) {
				const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
				if (tabs.length > 0) {
					if (request.moveTab) {
						await chrome.tabs.move(sender.tab.id, { index: 0 });
					} else {
						await chrome.tabs.update(tabs[0].id, { active: true });
					}
				}
			}
			return { success: true };
		}

		case 'switchLastTab': {
			if (sender.tab) {
				const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
				if (tabs.length > 0) {
					if (request.moveTab) {
						await chrome.tabs.move(sender.tab.id, { index: -1 });
					} else {
						await chrome.tabs.update(tabs[tabs.length - 1].id, { active: true });
					}
				}
			}
			return { success: true };
		}

		case 'switchLastActiveTab': {
			if (sender.tab) {
				const tabs = (await chrome.tabs.query({ windowId: sender.tab.windowId, active: false }))
					.filter(t => !t.hidden);
				if (tabs.length > 0) {
					const lastActiveTab = tabs.reduce((acc, cur) => acc.lastAccessed > cur.lastAccessed ? acc : cur);
					await chrome.tabs.update(lastActiveTab.id, { active: true });
				}
			}
			return { success: true };
		}

		case 'togglePinTab': {
			if (sender.tab?.id) {
				const tab = await chrome.tabs.get(sender.tab.id);
				await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
			}
			return { success: true };
		}

		case 'moveTabToNewWindow':
			if (sender.tab?.id) {
				await chrome.windows.create({ tabId: sender.tab.id, incognito: sender.tab.incognito });
			}
			return { success: true };

		case 'newWindow':
			await openInNewWindow(undefined, request.focused !== false);
			return { success: true };

		case 'newIncognito':
			await chrome.windows.create({ incognito: true });
			return { success: true };

		case 'addToBookmarks':
			if (sender.tab) {
				requestPermission(['bookmarks'], sender.tab.windowId).then(async (granted) => {
					if (!granted) return;
					const bookmark = {
						title: sender.tab.title,
						url: sender.tab.url,
					};
					if (request.folderId) bookmark.parentId = request.folderId;

					const existing = (await chrome.bookmarks.search({ url: bookmark.url })).filter(b => b.url === bookmark.url);
					const isDuplicate = bookmark.parentId
						? existing.some(b => b.parentId === bookmark.parentId)
						: existing.length > 0;
					if (isDuplicate) return { success: true };

					await chrome.bookmarks.create(bookmark);
				});
			}
			return { success: true };

		case 'toggleFullscreen': {
			const win = await chrome.windows.getCurrent();
			if (win.state === 'fullscreen') {
				const storageKey = `flowmouse_fullscreen_prev_state_${win.id}`;
				const items = await chrome.storage.session.get([storageKey]);
				const prevState = items[storageKey] || 'normal';
				await chrome.windows.update(win.id, { state: prevState });
				await chrome.storage.session.remove(storageKey);
			} else {
				const storageKey = `flowmouse_fullscreen_prev_state_${win.id}`;
				await chrome.storage.session.set({ [storageKey]: win.state });
				await chrome.windows.update(win.id, { state: 'fullscreen' });
			}
			return { success: true };
		}

		case 'toggleMaximize': {
			const win = await chrome.windows.getCurrent();
			const newState = win.state === 'maximized' ? 'normal' : 'maximized';
			await chrome.windows.update(win.id, { state: newState });
			return { success: true };
		}

		case 'minimize': {
			const win = await chrome.windows.getCurrent();
			await chrome.windows.update(win.id, { state: 'minimized' });
			return { success: true };
		}

		case 'zoomIn':
		case 'zoomOut': {
			if (!sender.tab?.id) return { success: false };
			const currentZoom = await chrome.tabs.getZoom(sender.tab.id);
			const direction = request.action === 'zoomIn' ? 1 : -1;
			let newZoom;
			if (request.zoomMode === 'fixed') {
				const delta = (request.zoomDelta || 10) / 100;
				newZoom = currentZoom + delta * direction;
			} else {
				const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
				if (direction === 1) {
					newZoom = ZOOM_LEVELS.find(z => z > currentZoom + 0.005) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
				} else {
					newZoom = [...ZOOM_LEVELS].reverse().find(z => z < currentZoom - 0.005) ?? ZOOM_LEVELS[0];
				}
			}
			newZoom = Math.min(5, Math.max(0.25, newZoom));
			await chrome.tabs.setZoom(sender.tab.id, newZoom);
			return { success: true };
		}

		case 'resetZoom': {
			if (!sender.tab?.id) return { success: false };
			const resetLevel = request.resetZoomLevel;
			const zoomFactor = resetLevel > 0 ? resetLevel / 100 : 0;
			await chrome.tabs.setZoom(sender.tab.id, zoomFactor);
			return { success: true };
		}

		case 'openCustomUrl': {
			let url = replaceUrlPlaceholders(request.customUrl, sender.tab);
			if (url) {
				const protocolRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

				url = url.trim();

				if (!protocolRegex.test(url)) {
					url = 'http://' + url;
				}

				if (sender.tab && request.incognito && !sender.tab.incognito) {
					const granted = await requestPermission(['incognito'], sender.tab.windowId);
					if (granted) {
						await chrome.windows.create({ incognito: true, url });
					}
					return { success: true };
				}

				const pos = request.position || 'last';
				const act = request.active !== false;
				if (pos === 'newWindow') {
					await openInNewWindow(url, act, sender.tab?.incognito);
				} else if (pos === 'current' && sender.tab) {
					await chrome.tabs.update(sender.tab.id, { url });
				} else {
					await createTabAtPosition(sender, pos, { url, active: act });
				}
			}
			return { success: true };
		}

		case 'sendExtensionMessage': {
			const targetId = (request.extensionId || '').trim();
			if (targetId) {
				let message = {};
				try {
					message = JSON.parse(request.message || '{}');
				} catch { }
				await chrome.runtime.sendMessage(targetId, message);
			}
			return { success: true };
		}

		case 'openDownloads':
			{
				await chrome.tabs.create({ url: 'chrome://downloads', active: true, windowId: sender.tab.windowId });
			}
			return { success: true };

		case 'openHistory':
			{
				await chrome.tabs.create({ url: 'chrome://history', active: true, windowId: sender.tab.windowId });
			}
			return { success: true };

		case 'openExtensions':
			{
				await chrome.tabs.create({ url: 'chrome://extensions', active: true, windowId: sender.tab.windowId });
			}
			return { success: true };

		case 'viewPageSource': {
			if (sender.tab?.url) {
				const url = 'view-source:' + sender.tab.url;
				const pos = request.position || 'right';
				if (pos === 'newWindow') {
					await openInNewWindow(url, request.active !== false, sender.tab?.incognito);
				} else if (pos === 'current' && sender.tab) {
					await chrome.tabs.update(sender.tab.id, { url });
				} else {
					const active = request.active !== false;
					await createTabAtPosition(sender, pos, { url, active });
				}
			}
			return { success: true };
		}

		case 'duplicateTab':
			if (sender.tab?.id) {
				await chrome.tabs.duplicate(sender.tab.id);
			}
			return { success: true };

		case 'toggleMuteTab': {
			if (sender.tab?.id) {
				const tab = await chrome.tabs.get(sender.tab.id);
				await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo.muted });
			}
			return { success: true };
		}

		case 'toggleMuteAllTabs': {
			const sessionItems = await chrome.storage.session.get([GLOBAL_MUTE_KEY]);
			const isMuted = sessionItems[GLOBAL_MUTE_KEY];
			const newState = !isMuted;

			await chrome.storage.session.set({ [GLOBAL_MUTE_KEY]: newState });
			const tabs = await chrome.tabs.query({});
			for (const tab of tabs) {
				await chrome.tabs.update(tab.id, { muted: newState });
			}
			return { success: true };
		}

		case 'openOptionsPage': {
			const optionsUrl = chrome.runtime.getURL('pages/options.html');
			const targetUrl = optionsUrl + (request.hash || '');

			chrome.tabs.create({ url: targetUrl });

			return { success: true };
		}

		case 'requestPermission':
			const granted = await requestPermission(request.permissions, sender.tab?.windowId ?? null);
			return { success: true, granted };

		case 'addSiteToMenu': {
			const menuId = request.menuId;
			const url = sender.tab?.url;
			if (!menuId || !url) return { success: false };
			const cur = await new Promise(res => chrome.storage.sync.get(['customMenus'], items => res(items.customMenus || {})));
			const { menus, added } = self.FlowMouseMenuPatterns.addSiteToMenuPatterns(cur, menuId, url);
			if (added) await chrome.storage.sync.set({ customMenus: menus });
			return { success: true, added };
		}

		case 'gestureStateUpdate':
			if (sender.tab?.id) {
				await chrome.tabs.sendMessage(sender.tab.id, {
					action: 'gestureStateUpdate',
					active: request.active
				}).catch(() => {
				});
			}
			return { success: true };

		case 'pauseGesture':
			if (sender.tab?.id) {
				await chrome.tabs.sendMessage(sender.tab.id, {
					action: 'pauseGesture'
				}).catch(() => {});
			}
			return { success: true };

		case 'areaSelect':
			if (sender.tab?.id) {
				await chrome.tabs.sendMessage(sender.tab.id, {
					action: 'areaSelectEnter',
					warnThreshold: request.warnThreshold,
					textUrl: request.textUrl,
					operationInterval: request.operationInterval,
				}).catch(() => {});
			}
			return { success: true };

		case 'areaSelectExit':
			if (sender.tab?.id) {
				await chrome.tabs.sendMessage(sender.tab.id, {
					action: 'areaSelectExit',
				}).catch(() => {});
			}
			return { success: true };

		case 'areaSelectUpdate':
			if (sender.tab?.id) {
				await chrome.tabs.sendMessage(sender.tab.id, {
					action: 'areaSelectUpdate',
					frameId: sender.frameId ?? 0,
					links: request.links,
				}).catch(() => {});
			}
			return { success: true };

		case 'areaSelectBatchOpen': {
			const urls = request.urls;
			const interval = Math.max(0, Math.min(60000, (parseFloat(request.operationInterval) || 0) * 1000));
			if (urls?.length && sender.tab) {
				const openerTabId = sender.tab.id;
				const baseIndex = sender.tab.index + 1;
				for (let i = 0; i < urls.length; i++) {
					if (i > 0 && interval > 0) {
						await new Promise(r => setTimeout(r, interval));
					}
					try { await chrome.tabs.get(openerTabId); } catch { break; }
					await chrome.tabs.create({
						url: urls[i],
						active: false,
						windowId: sender.tab.windowId,
						index: baseIndex + i,
						openerTabId,
					});
				}
			}
			return { success: true };
		}

		case 'gestureHudUpdate':
			if (sender.tab?.id) {
				await chrome.tabs.sendMessage(sender.tab.id, {
					action: 'gestureHudUpdate',
					data: request.data
				}).catch(() => {
				});
			}
			return { success: true };

		case 'gestureScrollUpdate':
			if (sender.tab?.id) {
				await chrome.tabs.sendMessage(sender.tab.id, {
					action: 'gestureScrollUpdate',
					data: request.data
				}).catch(() => {
				});
			}
			return { success: true };

		case 'getTabList': {
			if (sender.tab) {
				const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
				let mapped = tabs.map(t => ({
					id: t.id,
					title: t.title,
					url: t.url,
					favIconUrl: t.favIconUrl,
					active: t.active,
					index: t.index,
					lastAccess: t.lastAccessed,
				}));
				mapped = sortAndClamp(mapped, request.sortOrder, request.maxItems);
				return { success: true, tabs: mapped };
			}
			return { success: false };
		}

		case 'switchToTab':
			if (request.tabId) {
				await chrome.tabs.update(request.tabId, { active: true });
			}
			return { success: true };

		case 'restoreSession':
			if (request.sessionId) {
				await chrome.sessions.restore(request.sessionId).catch(() => {});
			}
			return { success: true };

		case 'getRecentlyClosedTabs': {
			const maxItems = request.maxItems ?? 12;
			const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
			let tabs = [];
			for (const session of sessions) {
				if (session.tab) {
					tabs.push({
						sessionId: session.tab.sessionId,
						title: session.tab.title,
						url: session.tab.url,
						favIconUrl: session.tab.favIconUrl,
						lastModified: session.lastModified,
					});
				} else if (session.window) {
					for (const tab of session.window.tabs || []) {
						tabs.push({
							sessionId: tab.sessionId,
							title: tab.title,
							url: tab.url,
							favIconUrl: tab.favIconUrl,
							lastModified: session.lastModified,
						});
					}
				}
			}
			if (maxItems > 0 && tabs.length > maxItems) {
				tabs = tabs.slice(0, maxItems);
			}
			tabs = sortAndClamp(tabs, request.sortOrder, 0);
			return { success: true, tabs };
		}

		case 'getBookmarks': {
			const folderId = request.folderId || '1';
			const granted = await requestPermission(['bookmarks'], sender.tab?.windowId);
			if (!granted) return { success: false };
			try {
				const nodes = await chrome.bookmarks.getChildren(folderId);
				let bookmarks = nodes
					.filter(n => n.url)
					.map(n => ({
						title: n.title,
						url: n.url,
						date: n.dateAdded,
					}));
				bookmarks = sortAndClamp(bookmarks, request.sortOrder, request.maxItems);
				return { success: true, bookmarks };
			} catch (error) {
				console.error('Failed to get bookmarks:', error);
				return { success: false, bookmarks: [] };
			}
		}


		case 'ctxMenuPrepare': {
			const { menuId } = request;
			if (!menuId) return { success: false };
			let resolve;
			const items = new Promise((r) => { resolve = r; });
			const timeout = setTimeout(() => resolve({ items: null }), 10000);
			ctxMenuSessions.set(menuId, {
				tabId: sender.tab?.id,
				frameId: sender.frameId ?? 0,
				items,
				setItems: (v) => { clearTimeout(timeout); resolve({ items: v }); },
			});
			return { success: true };
		}

		case 'ctxMenuSetItems': {
			const session = ctxMenuSessions.get(request.menuId);
			if (!session) return { success: false };
			session.setItems(request.items);
			return { success: true };
		}

		case 'ctxMenuFetch': {
			const session = ctxMenuSessions.get(request.menuId);
			if (!session) return { items: [] };
			return await session.items;
		}

		case 'ctxMenuDimensions': {
			const session = ctxMenuSessions.get(request.menuId);
			if (!session) return;
			chrome.tabs.sendMessage(session.tabId, {
				action: 'ctxMenuDimensions',
				menuId: request.menuId,
				width: request.width,
				height: request.height,
			}, { frameId: session.frameId }).catch(() => {});
			return { success: true };
		}

		case 'ctxMenuSelect': {
			const session = ctxMenuSessions.get(request.menuId);
			if (!session) return;
			chrome.tabs.sendMessage(session.tabId, {
				action: 'ctxMenuSelect',
				menuId: request.menuId,
				index: request.index,
			}, { frameId: session.frameId }).catch(() => {});
			ctxMenuSessions.delete(request.menuId);
			return { success: true };
		}

		case 'ctxMenuClose': {
			const session = ctxMenuSessions.get(request.menuId);
			if (!session) return;
			chrome.tabs.sendMessage(session.tabId, {
				action: 'ctxMenuClose',
				menuId: request.menuId,
			}, { frameId: session.frameId }).catch(() => {});
			ctxMenuSessions.delete(request.menuId);
			return { success: true };
		}

		case 'ctxMenuCleanup': {
			const session = ctxMenuSessions.get(request.menuId);
			if (session) session.setItems(null);
			ctxMenuSessions.delete(request.menuId);
			return { success: true };
		}

		case 'runTransform': {
			if (typeof request.code !== 'string') {
				return { ok: false, error: 'no code' };
			}
			await ensureOffscreen();
			const transformId = 'ft-' + (++_transformIdCounter);
			const replyPromise = new Promise((resolve) => {
				const timeout = setTimeout(() => {
					resolve({ ok: false, error: 'timeout' });
				}, 1500);
				chrome.runtime.sendMessage({
					target: 'offscreen',
					type: 'fm-transform',
					id: transformId,
					code: request.code,
					selection: request.selection || '',
					clipboard: request.clipboard || '',
				}).then((reply) => {
					clearTimeout(timeout);
					resolve(reply ?? { ok: false, error: 'no reply' });
				}).catch((e) => {
					clearTimeout(timeout);
					resolve({ ok: false, error: String(e?.message || e) });
				});
			});
			return replyPromise;
		}

		case 'actionChain': {
			const steps = request.steps;
			if (!steps?.length) return { success: true };
			const windowId = sender.tab?.windowId;

			const sleep = (ms) => new Promise(r => setTimeout(r, ms));

			for (const step of steps) {
				if (step.action === 'delay') {
					await sleep(step.delayMs || 500);
					continue;
				}

				const [activeTab] = await chrome.tabs.query({ active: true, windowId });
				if (!activeTab) continue;

				if (CONTENT_ACTIONS.has(step.action)) {
					await chrome.tabs.sendMessage(activeTab.id, {
						action: 'executeLocalAction',
						stepAction: step.action,
						stepConfig: step
					}).catch(() => {});
					if (steps.indexOf(step) < steps.length - 1) {
						await sleep(100);
					}
				} else {
					await handleAction(step, { tab: activeTab });
				}
			}
			return { success: true };
		}
	}
}

chrome.runtime.onMessage.addListener(asyncMessageHandler(async (request, sender) => {
	if (request.useActiveTab && sender.tab) {
		const [activeTab] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
		if (activeTab) {
			sender = { ...sender, tab: activeTab };
		}
	}

	return await handleAction(request, sender);
}));

chrome.runtime.onInstalled.addListener((details) => {
	function compareVersions(a, b) {
		const partsA = a.split('.').map(Number);
		const partsB = b.split('.').map(Number);
		for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
			const segA = partsA[i] || 0;
			const segB = partsB[i] || 0;
			if (segA !== segB) return segA > segB ? 1 : -1;
		}
		return 0;
	}

	if (details.reason === 'install') {
		chrome.tabs.create({
			url: chrome.runtime.getURL('pages/tutorial.html'),
			active: true
		});
	}

	if (details.reason === 'update' && details.previousVersion) {
		if (details.previousVersion.startsWith('1.1')) {
			chrome.storage.sync.get(['imageDragGestures'], (items) => {
				const gestures = items.imageDragGestures;
				if (Array.isArray(gestures)) {
					let changed = false;
					const newGestures = gestures.map(g => {
						if (g.action === 'customSearch') {
							changed = true;
							return {
								...g,
								action: 'imageSearch',
								engine: 'custom',
							};
						}
						return g;
					});

					if (changed) {
						chrome.storage.sync.set({ imageDragGestures: newGestures });
					}
				}
			});
		}

		function migrateScrollAmount() {
			chrome.storage.sync.get(['scrollAmount', 'scrollSmoothness', 'mouseGestures'], (items) => {
				if (items.scrollAmount === undefined && items.scrollSmoothness === undefined) return;

				const mouseGestures = items.mouseGestures || {};
				const scrollDistance = items.scrollAmount;

				if (scrollDistance !== undefined) {
					for (const config of Object.values(mouseGestures)) {
						if ((config.action === 'scrollUp' || config.action === 'scrollDown') && config.scrollDistance === undefined) {
							config.scrollDistance = Number(scrollDistance);
						}
					}
				}

				chrome.storage.sync.set({ mouseGestures }, () => {
					chrome.storage.sync.remove(['scrollAmount', 'scrollSmoothness']);
				});
			});
		}

		chrome.storage.sync.get(['gestures', 'customGestures', 'customGestureUrls', 'mouseGestures'], (items) => {
			if (items.mouseGestures && Object.keys(items.mouseGestures).length > 0) {
				migrateScrollAmount();
				return;
			}
			if (!items.customGestures && !items.customGestureUrls && !items.gestures) {
				migrateScrollAmount();
				return;
			}

			const LEGACY_DEFAULT_GESTURES = {
				'←': 'back', '→': 'forward', '↑': 'scrollUp', '↓': 'scrollDown',
				'↓→': 'closeTab', '←↑': 'restoreTab', '→↑': 'newTab', '→↓': 'refresh',
				'↑←': 'switchLeftTab', '↑→': 'switchRightTab', '↓←': 'stopLoading',
				'←↓': 'closeAllTabs', '↑↓': 'scrollToBottom', '↓↑': 'scrollToTop',
				'←→': 'closeTab', '→←': 'restoreTab',
			};
			const baseGestures = items.gestures || LEGACY_DEFAULT_GESTURES;
			const customGestures = items.customGestures || {};
			const customGestureUrls = items.customGestureUrls || {};
			const merged = { ...baseGestures, ...customGestures };

			const mouseGestures = {};
			for (const [pattern, action] of Object.entries(merged)) {
				if (action === null) continue;
				const entry = { action };
				if (customGestureUrls[pattern]) entry.customUrl = customGestureUrls[pattern];
				mouseGestures[pattern] = entry;
			}

			chrome.storage.sync.remove(['gestures', 'customGestures', 'customGestureUrls'], () => {
				chrome.storage.sync.set({ mouseGestures }, () => {
					migrateScrollAmount();
				});
			});
		});

		chrome.storage.sync.get(['enableAdvancedSettings', 'sectionAdvanced'], (items) => {
			if (items.sectionAdvanced !== undefined || items.enableAdvancedSettings === undefined) {
				return;
			}

			if (items.enableAdvancedSettings === true) {
				chrome.storage.sync.set({
					sectionAdvanced: { basic: true, drag: true }
				}, () => {
					chrome.storage.sync.remove(['enableAdvancedSettings']);
				});
			} else {
				chrome.storage.sync.set({
					sectionAdvanced: {}
				}, () => {
					chrome.storage.sync.remove(['enableAdvancedSettings']);
				});
			}
		});

		if (details.previousVersion.startsWith('1.2')) {
			const isMacOrLinux = /Mac|Linux/i.test(navigator.platform);
			if (isMacOrLinux) {
				chrome.storage.sync.set({ macLinuxHintDismissed: true });
			}
		}

		if (compareVersions(details.previousVersion, '2.0.2') <= 0) {
			chrome.storage.sync.set({ enableSuggestedGestures: false });
		}

		chrome.storage.sync.get(['mouseGestures', 'wheelGestures', 'specialGestures', 'actionChains'], (items) => {
			const updates = {};
			let changed = false;

			if (items.mouseGestures) {
				const mg = structuredClone(items.mouseGestures);
				for (const [pattern, config] of Object.entries(mg)) {
					if (config.action === 'copyUrl' && config.includeTitle) {
						config.action = 'copyTitleAndUrl';
						delete config.includeTitle;
						changed = true;
					}
				}
				if (changed) updates.mouseGestures = mg;
			}

			if (items.wheelGestures) {
				const wg = structuredClone(items.wheelGestures);
				let wgChanged = false;
				for (const config of Object.values(wg)) {
					if (config.action === 'copyUrl' && config.includeTitle) {
						config.action = 'copyTitleAndUrl';
						delete config.includeTitle;
						wgChanged = true;
					}
				}
				if (wgChanged) { updates.wheelGestures = wg; changed = true; }
			}

			if (items.specialGestures) {
				const sg = structuredClone(items.specialGestures);
				let sgChanged = false;
				for (const config of Object.values(sg)) {
					if (config.action === 'copyUrl' && config.includeTitle) {
						config.action = 'copyTitleAndUrl';
						delete config.includeTitle;
						sgChanged = true;
					}
				}
				if (sgChanged) { updates.specialGestures = sg; changed = true; }
			}

			if (items.actionChains) {
				const ac = structuredClone(items.actionChains);
				let acChanged = false;
				for (const chain of Object.values(ac)) {
					if (!chain.steps) continue;
					for (const step of chain.steps) {
						if (step.action === 'copyUrl' && step.includeTitle) {
							step.action = 'copyTitleAndUrl';
							delete step.includeTitle;
							acChanged = true;
						}
					}
				}
				if (acChanged) { updates.actionChains = ac; changed = true; }
			}

			if (changed) chrome.storage.sync.set(updates);
		});
	}


	{
		async function reinjectContentScripts(dispose) {
			const contentScript = chrome.runtime.getManifest().content_scripts[0];
			const tabs = await chrome.tabs.query({});
			for (const tab of tabs) {
				if (isRestrictedUrl(tab.url)) continue;
				try {
					if (dispose) {
						await chrome.scripting.executeScript({
							target: { tabId: tab.id, allFrames: contentScript.all_frames },
							func: () => window.dispatchEvent(new CustomEvent('flowmouse:dispose', { detail: { extensionId: chrome.runtime.id } })),
						});
					}
					await chrome.scripting.executeScript({
						target: { tabId: tab.id, allFrames: contentScript.all_frames },
						files: contentScript.js,
					});
				} catch {
				}
			}
		}

		if (details.reason === 'install' || (details.reason === 'update' && compareVersions(details.previousVersion, '1.50') > 0)) {
			reinjectContentScripts(details.reason === 'update');
		}
	}
});



const MENU_ID_REFRESH = 'flowmouse-need-refresh';
const MENU_ID_RESTRICTED = 'flowmouse-restricted';
const MENU_ID_BLACKLIST = 'flowmouse-blacklist-toggle';

let fileSchemeAllowed = false;
chrome.extension.isAllowedFileSchemeAccess().then(v => { fileSchemeAllowed = v; });

function isRestrictedUrl(url) {
	if (!url) return true;

	if (url.startsWith(chrome.runtime.getURL(''))) {
		return false;
	}

	if (url.startsWith('file:')) {
		return !fileSchemeAllowed;
	}

	const restrictedProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'about:', 'edge:', 'view-source:', 'devtools:'];
	for (const protocol of restrictedProtocols) {
		if (url.startsWith(protocol)) return true;
	}

	{
		if (url.startsWith('https://chrome.google.com/webstore') ||
			url.startsWith('https://chromewebstore.google.com') ||
			(isEdge && url.startsWith('https://microsoftedge.microsoft.com/addons'))) {
			return true;
		}
	}

	return false;
}

async function isContentScriptLoaded(tabId) {
	try {
		const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
		return response && response.pong === true;
	} catch (e) {
		return false;
	}
}

function getMsg(key, fallback) {
	try {
		if (typeof key !== 'string') {
			return fallback
		}
		const msg = chrome.i18n.getMessage(key);
		return msg || fallback;
	} catch (e) {
		return fallback;
	}
}

function removeAllMenus() {
	chrome.contextMenus.remove(MENU_ID_REFRESH, () => { chrome.runtime.lastError; });
	chrome.contextMenus.remove(MENU_ID_RESTRICTED, () => { chrome.runtime.lastError; });
}

function removeBlacklistMenu() {
	chrome.contextMenus.remove(MENU_ID_BLACKLIST, () => { chrome.runtime.lastError; });
}

function createBlacklistMenu(isInBlacklist) {
	removeBlacklistMenu();
	const title = isInBlacklist
		? chrome.i18n.getMessage('menuRemoveFromBlacklist')
		: chrome.i18n.getMessage('menuAddToBlacklist');
	chrome.contextMenus.create({
		id: MENU_ID_BLACKLIST,
		title: title,
		contexts: ['all']
	}, () => { chrome.runtime.lastError; });
}

function createRefreshMenu() {
	removeAllMenus();
	const title = chrome.i18n.getMessage('menuNeedRefresh');
	chrome.contextMenus.create({
		id: MENU_ID_REFRESH,
		title: title,
		contexts: ['all']
	}, () => { chrome.runtime.lastError; });
}

function createRestrictedMenu() {
	removeAllMenus();
	const title = chrome.i18n.getMessage('menuRestricted');
	chrome.contextMenus.create({
		id: MENU_ID_RESTRICTED,
		title: title,
		contexts: ['all']
	}, () => { chrome.runtime.lastError; });
}

function updateBadge(tabId, status) {
	if (status === 'normal') {
		chrome.action.setBadgeText({ tabId: tabId, text: '' });
	} else if (status === 'restricted') {
		chrome.action.setBadgeText({ tabId: tabId, text: '!' });
		chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#FFA500' });
	} else if (status === 'needRefresh') {
		chrome.action.setBadgeText({ tabId: tabId, text: '!' });
		chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#4285f4' });
	}
}

async function updateMenuForTab(tab) {
	const tabId = tab.id;
	const url = tab.url;
	const status = tab.status;

	if (status === 'loading') {
		removeAllMenus();
		updateBadge(tabId, 'normal');
		return;
	}

	const items = await chrome.storage.sync.get(['showRestrictedNotice', 'blacklist', 'enableBlacklistContextMenu']);
	let hostname = null;
	try {
		if (url) hostname = new URL(url).hostname;
	} catch (e) {
	}

	if (items.enableBlacklistContextMenu && hostname && !isRestrictedUrl(url)) {
		const isInBlacklist = items.blacklist && items.blacklist.includes(hostname);
		createBlacklistMenu(isInBlacklist);
	} else {
		removeBlacklistMenu();
	}

	if (items.showRestrictedNotice === false) {
		removeAllMenus();
		updateBadge(tabId, 'normal');
		return;
	}

	if (hostname && items.blacklist && items.blacklist.includes(hostname)) {
		removeAllMenus();
		updateBadge(tabId, 'normal');
		return;
	}

	if (isRestrictedUrl(url)) {
		createRestrictedMenu();
		updateBadge(tabId, 'restricted');
	} else {
		const loaded = await isContentScriptLoaded(tabId);
		if (loaded) {
			removeAllMenus();
			updateBadge(tabId, 'normal');
		} else {
			createRefreshMenu();
			updateBadge(tabId, 'needRefresh');
		}
	}
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if ((changeInfo.status === 'loading' || changeInfo.status === 'complete') && tab.active) {
		updateMenuForTab(tab);
	}
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
	try {
		const tab = await chrome.tabs.get(activeInfo.tabId);
		updateMenuForTab(tab);
	} catch (e) {
	}
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	if (info.menuItemId === MENU_ID_REFRESH) {
		if (tab && tab.id) {
			chrome.tabs.reload(tab.id);
		}
	} else if (info.menuItemId === MENU_ID_BLACKLIST) {
		if (tab && tab.url) {
			try {
				const hostname = new URL(tab.url).hostname;
				if (!hostname) return;
				const storageItems = await chrome.storage.sync.get(['blacklist']);
				let blacklist = storageItems.blacklist || [];
				if (blacklist.includes(hostname)) {
					blacklist = blacklist.filter(d => d !== hostname);
				} else {
					blacklist = [...blacklist, hostname];
				}
				await chrome.storage.sync.set({ blacklist });
			} catch (e) {
			}
		}
	} else if (info.menuItemId === MENU_ID_RESTRICTED) {
		const optionsUrl = chrome.runtime.getURL('pages/options.html');
		const targetUrl = optionsUrl + '#restricted-notice';

		const tabs = await chrome.tabs.query({});
		const existingTab = tabs.find(t => t.url && t.url.startsWith(optionsUrl));

		if (existingTab) {
			await chrome.tabs.update(existingTab.id, { url: targetUrl, active: true });
			await chrome.windows.update(existingTab.windowId, { focused: true });
		} else {
			chrome.tabs.create({ url: targetUrl });
		}
	}
});

chrome.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === 'sync') {
		if (changes.showRestrictedNotice || changes.language || changes.enableBlacklistContextMenu || changes.blacklist) {
			chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
				if (tabs[0]) {
					updateMenuForTab(tabs[0]);
				}
			});
		}
	}
});

function getFilename(url, mimeType) {
	let filename = null;

	if (url && !url.startsWith('data:')) {
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname;
			const name = pathname.substring(pathname.lastIndexOf('/') + 1);
			if (name && name.length > 0 && name.length < 255) {
				filename = decodeURIComponent(name);
			}
		} catch (e) {
		}
	}

	if (!filename) {
		filename = 'image';
	}

	if (mimeType) {
		const safeMime = mimeType.split(';')[0].trim().toLowerCase();
		const mimeMap = {
			'image/jpeg': '.jpg',
			'image/jpg': '.jpg',
			'image/png': '.png',
			'image/gif': '.gif',
			'image/webp': '.webp',
			'image/bmp': '.bmp',
			'image/svg+xml': '.svg',
			'image/x-icon': '.ico',
			'image/vnd.microsoft.icon': '.ico',
			'image/avif': '.avif',
			'image/jxl': '.jxl',
			'image/tiff': '.tiff'
		};

		const ext = mimeMap[safeMime];
		if (ext) {
			if (!/\.[a-zA-Z0-9]+$/i.test(filename)) {
				filename += ext;
			}
		} else if (safeMime.startsWith('image/')) {
			const subType = safeMime.split('/')[1];
			if (subType && /^[a-z0-9]+$/i.test(subType) && subType.length < 10) {
				if (!/\.[a-zA-Z0-9]+$/i.test(filename)) {
					filename += '.' + subType;
				}
			}
		}
	}

	return filename;
}

function findResourceInMhtml(mhtmlContent, targetUrl) {
	if (!mhtmlContent || !targetUrl) return null;

	const boundaryMatch = mhtmlContent.match(/Content-Type:\s*multipart\/related;[\s\S]*?boundary="?([^";\r\n]+)"?/i);
	if (!boundaryMatch) return null;

	const boundary = '--' + boundaryMatch[1];

	const parts = mhtmlContent.split(boundary);

	for (const part of parts) {
		if (!part || part.trim() === '--') continue;

		const headerEndIndex = part.indexOf('\r\n\r\n');
		if (headerEndIndex === -1) continue;

		const headersRaw = part.substring(0, headerEndIndex);
		const bodyRaw = part.substring(headerEndIndex + 4);

		const locationMatch = headersRaw.match(/Content-Location:\s*([^\r\n]+)/i);
		if (locationMatch) {
			const location = locationMatch[1].trim();

			if (location === targetUrl) {
				const typeMatch = headersRaw.match(/Content-Type:\s*([^\r\n;]+)/i);
				const encodingMatch = headersRaw.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);

				const type = typeMatch ? typeMatch[1].trim() : 'application/octet-stream';
				const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : 'binary';

				let dataUrl = null;

				if (encoding === 'base64') {
					const cleanBody = bodyRaw.replace(/[\r\n\s]+/g, '');
					dataUrl = `data:${type};base64,${cleanBody}`;
				} else if (encoding === 'quoted-printable') {
					let decoded = bodyRaw.replace(/=(?:\r\n|\r|\n)/g, '');

					decoded = decoded.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
						return String.fromCharCode(parseInt(hex, 16));
					});

					const base64 = btoa(decoded);
					dataUrl = `data:${type};base64,${base64}`;
				}

				return {
					type,
					encoding,
					dataUrl
				};
			}
		}
	}

	return null;
}

async function notifyDownloadError(tabId) {
	if (tabId) {
		await chrome.tabs.sendMessage(tabId, { action: 'showDownloadError' }).catch(() => { });
	}
}

async function requestPermission(permissions, windowId) {
	if (permissions.includes('incognito')) {
		const isAllowed = await chrome.extension.isAllowedIncognitoAccess();
		if (isAllowed) return true;
	} else {
		const hasPermission = await chrome.permissions.contains({ permissions: permissions });
		if (hasPermission) return true;
	}

	return new Promise((resolve) => {
		const permUrl = chrome.runtime.getURL(`pages/permission.html?permissions=${permissions.join(',')}`);

		const checkGranted = async () => {
			if (permissions.includes('incognito')) {
				return await chrome.extension.isAllowedIncognitoAccess();
			}
			return await chrome.permissions.contains({ permissions: permissions });
		};

		const openAsTab = async () => {
			const tab = await chrome.tabs.create({ url: permUrl, active: true });
			const onTabRemoved = async (tabId) => {
				if (tabId === tab.id) {
					chrome.tabs.onRemoved.removeListener(onTabRemoved);
					resolve(await checkGranted());
				}
			};
			chrome.tabs.onRemoved.addListener(onTabRemoved);
		};

		const openPermissionWindow = async (winOptions) => {
			try {
				const popupWindow = await chrome.windows.create({
					url: permUrl,
					type: 'popup',
					width: 340,
					height: 380,
					left: winOptions?.left,
					top: winOptions?.top,
					focused: true
				});

				if (!popupWindow) {
					await openAsTab();
					return;
				}

				const onRemoved = async (closedWindowId) => {
					if (closedWindowId === popupWindow.id) {
						chrome.windows.onRemoved.removeListener(onRemoved);
						resolve(await checkGranted());
					}
				};
				chrome.windows.onRemoved.addListener(onRemoved);
			} catch (e) {
				try {
					await openAsTab();
				} catch (e2) {
					console.error('Failed to open permission popup:', e2);
					resolve(false);
				}
			}
		};

		if (windowId) {
			chrome.windows.get(windowId).then((win) => {
				const width = 340;
				const height = 380;
				const left = Math.round(win.left + (win.width - width) / 2);
				const top = Math.round(win.top + (win.height - height) / 2);
				openPermissionWindow({ left, top });
			}).catch(() => {
				openPermissionWindow(null);
			});
		} else {
			openPermissionWindow(null);
		}
	});
}