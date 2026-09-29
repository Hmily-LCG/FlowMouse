const isEdge = navigator.userAgent.includes('Edg/') || navigator.userAgent.includes('EdgA/');

const GLOBAL_MUTE_KEY = 'flowmouse_global_mute_state';

const ctxMenuSessions = new Map();

class Bookmarks {
	static #ROOT_IDS = new Set(['0', 'root________']);

	static #pathSegment(node) {
		if (node.folderType) return `System:${node.folderType}:${node.syncing}`;
		return `User:${node.title}`;
	}

	static #samePath(a, b) {
		return a.length === b.length && a.every((segment, i) => segment === b[i]);
	}

	static *#walk(nodes, depth = 0, ancestorPath = []) {
		for (const node of nodes) {
			if (!node.children) continue;
			if (Bookmarks.#ROOT_IDS.has(node.id)) {
				yield* Bookmarks.#walk(node.children, depth, ancestorPath);
				continue;
			}
			const path = [...ancestorPath, Bookmarks.#pathSegment(node)];
			yield { node, depth, path };
			yield* Bookmarks.#walk(node.children, depth + 1, path);
		}
	}

	static async pathOf(nodeId) {
		const segments = [];
		let currentId = nodeId;
		while (currentId && !Bookmarks.#ROOT_IDS.has(currentId)) {
			try {
				const [node] = await chrome.bookmarks.get(currentId);
				segments.push(Bookmarks.#pathSegment(node));
				currentId = node.parentId;
			} catch {
				break;
			}
		}
		return segments.reverse();
	}

	static async listFolders() {
		const tree = await chrome.bookmarks.getTree();
		const folders = [];
		for (const { node, depth, path } of Bookmarks.#walk(tree)) {
			folders.push({
				id: node.id,
				title: node.title,
				depth,
				linkCount: node.children.filter(c => c.url).length,
				path,
			});
		}
		return folders;
	}

	static async listLinks(folderId) {
		const nodes = await chrome.bookmarks.getChildren(folderId);
		return nodes
			.filter(n => n.url)
			.map(n => ({ title: n.title, url: n.url, date: n.dateAdded }));
	}

	static async #isFolder(id) {
		try {
			const [node] = await chrome.bookmarks.get(id);
			return !!node && !node.url;
		} catch {
			return false;
		}
	}

	static async resolveFolder(folderId) {
		if (!folderId) return null;
		const { id, path } = typeof folderId === 'string' ? { id: folderId } : folderId;
		const hasPath = Array.isArray(path) && path.length > 0;
		if (!id && !hasPath) return null;

		{
			const idExists = id ? await Bookmarks.#isFolder(id) : false;
			if (idExists) {
				if (!hasPath) return id;
				if (Bookmarks.#samePath(await Bookmarks.pathOf(id), path)) {
					return id;
				}
			}

			if (hasPath) {
				const tree = await chrome.bookmarks.getTree();
				for (const folder of Bookmarks.#walk(tree)) {
					if (Bookmarks.#samePath(folder.path, path)) return folder.node.id;
				}
			}

			return idExists ? id : null;
		}
	}

	static async addLink({ title, url, folderId }) {
		const bookmark = { title, url };
		const parentId = await Bookmarks.resolveFolder(folderId);
		if (parentId) bookmark.parentId = parentId;

		const existing = (await chrome.bookmarks.search({ url })).filter(b => b.url === url);
		const isDuplicate = bookmark.parentId
			? existing.some(b => b.parentId === bookmark.parentId)
			: existing.length > 0;
		if (isDuplicate) return null;

		return await chrome.bookmarks.create(bookmark);
	}
}

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
	'scrollUp', 'scrollDown', 'scrollLeft', 'scrollRight', 'scrollToTop', 'scrollToBottom', 'scrollToLeftEdge', 'scrollToRightEdge',
	'stopLoading', 'reloadFrame', 'copyUrl', 'copyTitle', 'copyTitleAndUrl', 'sendCustomEvent',
	'simulateKey', 'pasteClipboard', 'pasteContent', 'searchClipboard',
	'menuShowTabs', 'menuRecentlyClosed', 'menuShowBookmarks',
	'customMenu',

	'copy', 'copyLink', 'copyImageUrl', 'copyLinkText', 'copyLinkAndText',
	'search', 'openTab', 'openLink', 'openImage', 'imageSearch', 'saveImage', 'bookmarkLink',
]);

async function createTabAtPosition(tab, position, extraOpts = {}) {
	if (!tab) {
		return await chrome.tabs.create({ active: true, ...extraOpts });
	}
	const tabs = await chrome.tabs.query({ windowId: tab.windowId });
	const createOpts = { active: true, windowId: tab.windowId, ...extraOpts };
	switch (position) {
		case 'right': createOpts.index = tab.index + 1; break;
		case 'left': createOpts.index = tab.index; break;
		case 'first': createOpts.index = 0; break;
		case 'last':
		default: createOpts.index = tabs.length; break;
	}
	return await chrome.tabs.create(createOpts);
}

async function createIncognitoTab(position, extraOpts = {}) {
	if (position === 'current') position = 'last';
	const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
	const incognitoWin = windows.find(w => w.incognito);
	if (!incognitoWin?.tabs?.length) {
		const createOpts = { incognito: true };
		if (extraOpts.url) createOpts.url = extraOpts.url;
		const win = await chrome.windows.create(createOpts);
		return win?.tabs?.[0];
	}
	const refTab = incognitoWin.tabs.find(t => t.active) || incognitoWin.tabs[0];
	const newTab = await createTabAtPosition(refTab, position, extraOpts);
	if (extraOpts.active !== false) {
		await chrome.windows.update(incognitoWin.id, { focused: true });
	}
	return newTab;
}

async function openInNewWindow(url, focused = true, incognito = false) {
	const createOpts = { focused, incognito };
	if (url) createOpts.url = url;
	const win = await chrome.windows.create(createOpts);
	return win.tabs[0];
}

async function getSenderWindow(sender) {
	if (sender.tab?.windowId != null) {
		return await chrome.windows.get(sender.tab.windowId);
	}
	return await chrome.windows.getCurrent();
}

function replaceUrlPlaceholders(template, tab, contentValues) {
	const rawUrl = tab?.url || '';
	const raw = {
		tabUrl: rawUrl,
		tabTitle: tab?.title || '',
		tabDomain: '',
		text: contentValues?.text || '',
		linkUrl: contentValues?.linkUrl || '',
		linkDomain: '',
		linkText: contentValues?.linkText || '',
		imageUrl: contentValues?.imageUrl || '',
	};
	if (rawUrl) {
		try {
			raw.tabDomain = new URL(rawUrl).hostname;
		} catch { }
	}
	if (raw.linkUrl) {
		try {
			raw.linkDomain = new URL(raw.linkUrl).hostname;
		} catch { }
	}
	return (template || '').replace(/\{(tabUrl|tabTitle|tabDomain|text|linkUrl|linkDomain|linkText|imageUrl)(?::(raw))?\}/g, (_, key, mod) => {
		const val = raw[key] || '';
		return mod ? val : encodeURIComponent(val);
	});
}

async function handleAction(request, sender, dragType, contentValues) {
	switch (request.action) {
		case 'back':
			if (!sender.tab?.id) return { success: false };
			try {
				await chrome.tabs.goBack(sender.tab.id);
			} catch (error) {
				return { success: false };
			}
			return { success: true };

		case 'forward':
			if (!sender.tab?.id) return { success: false };
			try {
				await chrome.tabs.goForward(sender.tab.id);
			} catch (error) {
				return { success: false };
			}
			return { success: true };

		case 'urlLevelUp': {
			if (!sender.tab?.id || !sender.tab.url) return { success: false };
			try {
				const u = new URL(sender.tab.url);
				const newPath = u.pathname.replace(/\/([^/]+)\/?$/, '');
				if (newPath === u.pathname) return { success: false };
				await chrome.tabs.update(sender.tab.id, { url: u.origin + newPath });
				return { success: true };
			} catch {
				return { success: false };
			}
		}

		case 'urlToRoot': {
			if (!sender.tab?.id || !sender.tab.url) return { success: false };
			try {
				const u = new URL(sender.tab.url);
				if (u.pathname === '/' && !u.search && !u.hash) return { success: false };
				await chrome.tabs.update(sender.tab.id, { url: u.origin });
				return { success: true };
			} catch {
				return { success: false };
			}
		}

		case 'refresh':
			if (!sender.tab?.id) return { success: false };
			await chrome.tabs.reload(sender.tab.id, { bypassCache: !!request.hardReload });
			return { success: true };

		case 'closeTab': {
			if (!sender.tab?.id) return { success: false };
			if (request.skipPinned && sender.tab.pinned) return { success: false };

			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			const currentPos = tabs.findIndex(t => t.id === sender.tab.id);
			let afterClose = request.afterClose || 'default';

			if (request.preserveTab && afterClose === 'default') {
				afterClose = currentPos === tabs.length - 1 ? 'left' : 'right';
			}

			if (!request.preserveTab && request.keepWindow && tabs.length === 1) {
				await chrome.tabs.create({ active: true, windowId: sender.tab.windowId });
			} else if (afterClose !== 'default' && tabs.length > 1 && currentPos !== -1) {
				let targetPos;
				if (afterClose === 'left') {
					targetPos = currentPos > 0 ? currentPos - 1 : currentPos + 1;
				} else if (afterClose === 'right') {
					targetPos = currentPos < tabs.length - 1 ? currentPos + 1 : currentPos - 1;
				}
				if (targetPos !== undefined) {
					await chrome.tabs.update(tabs[targetPos].id, { active: true });
				}
			}

			if (request.preserveTab) {
				if (tabs.length <= 1 || sender.tab.discarded) return { success: false };
				await chrome.tabs.discard(sender.tab.id);
			} else {
				await chrome.tabs.remove(sender.tab.id);
			}
			return { success: true };
		}

		case 'closeWindow':
			if (!sender.tab?.windowId) return { success: false };
			await chrome.windows.remove(sender.tab.windowId);
			return { success: true };

		case 'closeBrowser': {
			const windows = await chrome.windows.getAll({});
			if (windows.length === 0) return { success: false };
			for (const win of windows) {
				await chrome.windows.remove(win.id);
			}
			return { success: true };
		}

		case 'restoreTab':
			if (sender.tab?.incognito) return { success: false };
			try {
				await chrome.sessions.restore(null);
			} catch (error) {
				return { success: false };
			}
			return { success: true };

		case 'newTab': {
			const active = request.active !== false;
			const position = request.position || 'last';
			if (position === 'newWindow') {
				await openInNewWindow(undefined, active, sender.tab?.incognito);
			} else {
				await createTabAtPosition(sender.tab, position, { active });
			}
			return { success: true };
		}

		case 'openTabAtPosition': {
			if (!request.url) return { success: false };

			const position = request.position || 'right';
			const active = request.active !== false;

			if (sender.tab && request.incognito && !sender.tab.incognito) {
				const granted = await requestPermission(['incognito'], sender.tab.windowId);
				if (!granted) return { success: false };
				await createIncognitoTab(position, { url: request.url, active });
				return { success: true };
			}

			if (position === 'newWindow') {
				await openInNewWindow(request.url, active, sender.tab?.incognito);
			} else if (position === 'current' && sender.tab) {
				await chrome.tabs.update(sender.tab.id, { url: request.url, active });
			} else {
				await createTabAtPosition(sender.tab, position, {
					url: request.url,
					active,
					openerTabId: sender.tab?.id,
				});
			}
			return { success: true };
		}

		case 'systemSearch': {
			if (!request.query || !sender.tab) return { success: false };

			const position = request.position || 'right';
			const active = request.active !== false;

			if (request.incognito && !sender.tab.incognito) {
				const granted = await requestPermission(['incognito'], sender.tab.windowId);
				if (!granted) return { success: false };
				const newTab = await createIncognitoTab(position, { url: 'about:blank', active });
				if (!newTab) return { success: false };
				await chrome.search.query({ text: request.query, tabId: newTab.id });
				return { success: true };
			}

			if (position === 'newWindow') {
				const newTab = await openInNewWindow(undefined, active, sender.tab.incognito);
				await chrome.search.query({ text: request.query, tabId: newTab.id });
			} else if (position === 'current') {
				await chrome.search.query({ text: request.query, tabId: sender.tab.id });
			} else {
				const newTab = await createTabAtPosition(sender.tab, position, {
					url: 'about:blank',
					active,
					openerTabId: sender.tab.id,
				});
				if (!newTab) return { success: false };
				await chrome.search.query({ text: request.query, tabId: newTab.id });
			}
			return { success: true };
		}

		case 'saveImage': {
			if (!request.url) return { success: false };
			const granted = await requestPermission(['downloads', 'pageCapture'], sender.tab?.windowId ?? null);
			if (!granted) return { success: false };

			const subdir = sanitizeSubdir(request.subdir);

			if (request.url.startsWith('data:')) {
				{
					const filename = request.filename || (subdir ? getFilename(null, request.url.match(/^data:([^;,]+)/)?.[1]) : null);
					await chrome.downloads.download({
						url: request.url,
						filename: joinDownloadPath(subdir, filename),
						saveAs: false
					});
					return { success: true };
				}
			}

			const imageUrl = request.url;

			{
				if (!sender.tab?.id) return { success: false };
				const sourceTabId = sender.tab.id;

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
							filename: joinDownloadPath(subdir, filename),
							saveAs: false
						});
						return { success: true };
					}
					notifyDownloadError(sourceTabId);
					return { success: false };
				} catch (e) {
					console.error('MHTML capture failed:', e?.name, e?.message || e);
					notifyDownloadError(sourceTabId);
					return { success: false };
				}
			}
		}

		case 'saveAsMhtml': {
			if (sender.tab?.id) {
				const granted = await requestPermission(['downloads', 'pageCapture'], sender.tab.windowId);
				if (!granted) return { success: false };

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
					return { success: true };
				} catch (e) {
					console.error('MHTML save failed:', e);
					return { success: false };
				}
			}
			return { success: false };
		}

		case 'closeOtherTabs': {
			if (!sender.tab) return { success: false };
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			const targetTabs = tabs
				.filter(tab => tab.id !== sender.tab.id && !(request.skipPinned && tab.pinned));
			if (targetTabs.length === 0) return { success: false };

			if (request.preserveTab) {
				const toDiscard = targetTabs.filter(tab => !tab.discarded);
				if (toDiscard.length === 0) return { success: false };
				await Promise.all(toDiscard.map(tab => chrome.tabs.discard(tab.id)));
			} else {
				await chrome.tabs.remove(targetTabs.map(tab => tab.id));
			}
			return { success: true };
		}

		case 'closeRightTabs': {
			if (!sender.tab) return { success: false };
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			const targetTabs = tabs
				.filter(tab => tab.index > sender.tab.index && !(request.skipPinned && tab.pinned));
			if (targetTabs.length === 0) return { success: false };

			if (request.preserveTab) {
				const toDiscard = targetTabs.filter(tab => !tab.discarded);
				if (toDiscard.length === 0) return { success: false };
				await Promise.all(toDiscard.map(tab => chrome.tabs.discard(tab.id)));
			} else {
				await chrome.tabs.remove(targetTabs.map(tab => tab.id));
			}
			return { success: true };
		}

		case 'closeLeftTabs': {
			if (!sender.tab) return { success: false };
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			const targetTabs = tabs
				.filter(tab => tab.index < sender.tab.index && !(request.skipPinned && tab.pinned));
			if (targetTabs.length === 0) return { success: false };

			if (request.preserveTab) {
				const toDiscard = targetTabs.filter(tab => !tab.discarded);
				if (toDiscard.length === 0) return { success: false };
				await Promise.all(toDiscard.map(tab => chrome.tabs.discard(tab.id)));
			} else {
				await chrome.tabs.remove(targetTabs.map(tab => tab.id));
			}
			return { success: true };
		}

		case 'refreshAllTabs': {
			if (!sender.tab) return { success: false };
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			if (tabs.length === 0) return { success: false };
			for (const tab of tabs) {
				await chrome.tabs.reload(tab.id, { bypassCache: !!request.hardReload });
			}
			return { success: true };
		}

		case 'stopAllLoading': {
			if (!sender.tab) return { success: false };
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			if (tabs.length === 0) return { success: false };
			await Promise.all(tabs.map(tab => {
				if (isRestrictedUrl(tab.url)) return;
				return chrome.scripting.executeScript({
					target: { tabId: tab.id, allFrames: true },
					func: () => window.stop(),
					injectImmediately: true,
				}).catch(() => {
				});
			}));
			return { success: true };
		}

		case 'closeAllTabs': {
			if (!sender.tab) return { success: false };
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			const tabsToRemove = tabs
				.filter(tab => !(request.skipPinned && tab.pinned))
				.map(tab => tab.id);
			if (tabsToRemove.length === 0) return { success: false };
			const remainingTabs = tabs.length - tabsToRemove.length;
			if (remainingTabs === 0) {
				await chrome.tabs.create({ active: true, windowId: sender.tab.windowId });
			}
			await chrome.tabs.remove(tabsToRemove);
			return { success: true };
		}

		case 'switchLeftTab': {
			if (!sender.tab) return { success: false };
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			const currentPos = tabs.findIndex(t => t.id === sender.tab.id);
			if (currentPos === -1 || tabs.length < 2) return { success: false };
			if (request.noWrap && currentPos === 0) return { success: false };
			const prevPos = currentPos > 0 ? currentPos - 1 : tabs.length - 1;
			if (!request.moveTab && tabs[prevPos].active) return { success: false };
			if (request.moveTab) {
				await chrome.tabs.move(sender.tab.id, { index: tabs[prevPos].index });
			} else {
				await chrome.tabs.update(tabs[prevPos].id, { active: true });
			}
			return { success: true };
		}

		case 'switchRightTab': {
			if (!sender.tab) return { success: false };
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			const currentPos = tabs.findIndex(t => t.id === sender.tab.id);
			if (currentPos === -1 || tabs.length < 2) return { success: false };
			if (request.noWrap && currentPos === tabs.length - 1) return { success: false };
			const nextPos = currentPos < tabs.length - 1 ? currentPos + 1 : 0;
			if (!request.moveTab && tabs[nextPos].active) return { success: false };
			if (request.moveTab) {
				await chrome.tabs.move(sender.tab.id, { index: tabs[nextPos].index });
			} else {
				await chrome.tabs.update(tabs[nextPos].id, { active: true });
			}
			return { success: true };
		}

		case 'switchFirstTab': {
			if (!sender.tab) return { success: false };
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			if (tabs.length === 0) return { success: false };
			const first = tabs[0];
			if (request.moveTab) {
				if (first.id === sender.tab.id) return { success: false };
				await chrome.tabs.move(sender.tab.id, { index: 0 });
			} else {
				if (first.id === sender.tab.id || first.active) return { success: false };
				await chrome.tabs.update(first.id, { active: true });
			}
			return { success: true };
		}

		case 'switchLastTab': {
			if (!sender.tab) return { success: false };
			const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
			if (tabs.length === 0) return { success: false };
			const last = tabs[tabs.length - 1];
			if (request.moveTab) {
				if (last.id === sender.tab.id) return { success: false };
				await chrome.tabs.move(sender.tab.id, { index: -1 });
			} else {
				if (last.id === sender.tab.id || last.active) return { success: false };
				await chrome.tabs.update(last.id, { active: true });
			}
			return { success: true };
		}

		case 'switchLastActiveTab': {
			if (!sender.tab) return { success: false };
			const tabs = (await chrome.tabs.query({ windowId: sender.tab.windowId, active: false }))
				.filter(t => !t.hidden);
			if (tabs.length === 0) return { success: false };
			const lastActiveTab = tabs.reduce((acc, cur) => acc.lastAccessed > cur.lastAccessed ? acc : cur);
			await chrome.tabs.update(lastActiveTab.id, { active: true });
			return { success: true };
		}

		case 'togglePinTab': {
			if (!sender.tab?.id) return { success: false };
			const tab = await chrome.tabs.get(sender.tab.id);
			await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
			return { success: true };
		}

		case 'moveTabToNewWindow':
			if (!sender.tab?.id) return { success: false };
			await chrome.windows.create({ tabId: sender.tab.id, incognito: sender.tab.incognito });
			return { success: true };

		case 'newWindow':
			await openInNewWindow(undefined, request.focused !== false);
			return { success: true };

		case 'newIncognito': {
			await chrome.windows.create({ incognito: true });
			return { success: true };
		}

		case 'addToBookmarks': {
			if (!sender.tab?.url) return { success: false };
			const granted = await requestPermission(['bookmarks'], sender.tab.windowId);
			if (!granted) return { success: false };
			const node = await Bookmarks.addLink({
				title: sender.tab.title,
				url: sender.tab.url,
				folderId: request.folderId,
			});
			return { success: !!node };
		}

		case 'bookmarkLink': {
			if (!request.url) return { success: false };
			const granted = await requestPermission(['bookmarks'], sender.tab?.windowId);
			if (!granted) return { success: false };
			const node = await Bookmarks.addLink({
				title: request.title,
				url: request.url,
				folderId: request.folderId,
			});
			return { success: !!node };
		}

		case 'toggleFullscreen': {
			const win = await getSenderWindow(sender);
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
			const win = await getSenderWindow(sender);
			const newState = win.state === 'maximized' ? 'normal' : 'maximized';
			await chrome.windows.update(win.id, { state: newState });
			return { success: true };
		}

		case 'minimize': {
			const win = await getSenderWindow(sender);
			if (win.state === 'minimized') return { success: false };
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
			if (Math.abs(newZoom - currentZoom) < 1e-9) return { success: false };
			await chrome.tabs.setZoom(sender.tab.id, newZoom);
			return { success: true };
		}

		case 'resetZoom': {
			if (!sender.tab?.id) return { success: false };
			const resetLevel = request.resetZoomLevel;
			const currentZoom = await chrome.tabs.getZoom(sender.tab.id);
			let zoomFactor;
			if (resetLevel > 0) {
				zoomFactor = resetLevel / 100;
			} else {
				const settings = await chrome.tabs.getZoomSettings(sender.tab.id);
				zoomFactor = settings.defaultZoomFactor;
			}
			if (Math.abs(currentZoom - zoomFactor) < 1e-9) return { success: false };
			await chrome.tabs.setZoom(sender.tab.id, resetLevel > 0 ? zoomFactor : 0);
			return { success: true };
		}

		case 'openCustomUrl': {
			let url = replaceUrlPlaceholders(request.customUrl, sender.tab, contentValues);
			if (!url) return { success: false };
			const protocolRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

			url = url.trim();

			if (!protocolRegex.test(url)) {
				url = 'http://' + url;
			}


			const pos = request.position || 'last';
			const act = request.active !== false;

			if (sender.tab && request.incognito && !sender.tab.incognito) {
				const granted = await requestPermission(['incognito'], sender.tab.windowId);
				if (!granted) return { success: false };
				await createIncognitoTab(pos, { url, active: act });
				return { success: true };
			}
			if (pos === 'newWindow') {
				await openInNewWindow(url, act, sender.tab?.incognito);
			} else if (pos === 'current' && sender.tab) {
				await chrome.tabs.update(sender.tab.id, { url });
			} else {
				await createTabAtPosition(sender.tab, pos, { url, active: act });
			}
			return { success: true };
		}

		case 'sendExtensionMessage': {
			const targetId = (request.extensionId || '').trim();
			if (!targetId) return { success: false };
			let message = {};
			try {
				message = JSON.parse(request.message || '{}');
			} catch { }
			await chrome.runtime.sendMessage(targetId, message);
			return { success: true };
		}

		case 'openDownloads':
			if (sender.tab) {
				await chrome.tabs.create({ url: 'chrome://downloads', active: true, windowId: sender.tab.windowId });
				return { success: true };
			}
			return { success: false };

		case 'openHistory':
			if (sender.tab) {
				await chrome.tabs.create({ url: 'chrome://history', active: true, windowId: sender.tab.windowId });
				return { success: true };
			}
			return { success: false };

		case 'openExtensions':
			if (sender.tab) {
				await chrome.tabs.create({ url: 'chrome://extensions', active: true, windowId: sender.tab.windowId });
				return { success: true };
			}
			return { success: false };

		case 'printPage':
			await chrome.scripting.executeScript({
				target: { tabId: sender.tab.id, frameIds: [0] },
				func: () => { window.print(); },
			});
			return { success: true };

		case 'viewPageSource':
		case 'viewFrameSource': {
			const srcUrl = request.action === 'viewFrameSource' ? (sender.url || sender.tab?.url) : sender.tab?.url;
			if (!srcUrl) return { success: false };
			const url = 'view-source:' + srcUrl;
			const pos = request.position || 'right';
			if (pos === 'newWindow') {
				await openInNewWindow(url, request.active !== false, sender.tab.incognito);
			} else if (pos === 'current') {
				await chrome.tabs.update(sender.tab.id, { url });
			} else {
				const active = request.active !== false;
				await createTabAtPosition(sender.tab, pos, { url, active });
			}
			return { success: true };
		}

		case 'duplicateTab':
			if (!sender.tab?.id) return { success: false };
			await chrome.tabs.duplicate(sender.tab.id);
			return { success: true };

		case 'toggleMuteTab': {
			if (!sender.tab?.id) return { success: false };
			const tab = await chrome.tabs.get(sender.tab.id);
			await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo.muted });
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

		case 'openOptions': {
			await chrome.runtime.openOptionsPage();
			return { success: true };
		}

		case 'openOptionsPage': {
			const optionsUrl = chrome.runtime.getURL('pages/options.html');
			const targetUrl = optionsUrl + (request.hash || '');

			await chrome.tabs.create({ url: targetUrl });

			return { success: true };
		}

		case 'warmUp':
			return { success: true };

		case 'getTabZoom':
			if (!sender.tab) return { success: false };
			return { success: true, ...await getZoomInfo(sender.tab.id) };

		case 'requestPermission':
			const granted = await requestPermission(request.permissions, sender.tab?.windowId ?? null);
			return { success: true, granted };

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
			if (!sender.tab?.id) return { success: false };
			try {
				await chrome.tabs.sendMessage(sender.tab.id, {
					action: 'pauseGesture'
				});
			} catch {
				return { success: false };
			}
			return { success: true };

		case 'areaSelect':
			if (!sender.tab?.id) return { success: false };
			try {
				await chrome.tabs.sendMessage(sender.tab.id, {
					action: 'areaSelectEnter',
					overrideGlobal: request.overrideGlobal,
					warnThreshold: request.warnThreshold,
					textUrl: request.textUrl,
					delay: request.delay,
					autoAction: request.autoAction,
				});
			} catch {
				return { success: false };
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
			const interval = Math.max(0, Math.min(60000, (parseFloat(request.delay) || 0) * 1000));
			if (!urls?.length || !sender.tab) return { success: false };
			let openerTabId = sender.tab.id;
			const baseIndex = sender.tab.index + 1;
			for (let i = 0; i < urls.length; i++) {
				if (i > 0 && interval > 0) {
					await new Promise(r => setTimeout(r, interval));
				}
				if (openerTabId != null) {
					try {
						await chrome.tabs.get(openerTabId);
					} catch {
						openerTabId = undefined;
					}
				}
				await chrome.tabs.create({
					url: urls[i],
					active: false,
					windowId: sender.tab.windowId,
					index: baseIndex + i,
					openerTabId,
				});
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

		case 'gestureScrollUpdate': {
			if (!sender.tab?.id) return { success: false };
			try {
				const result = await chrome.tabs.sendMessage(sender.tab.id, {
					action: 'gestureScrollUpdate',
					data: request.data
				}, { frameId: 0 });
				return result ?? { success: false };
			} catch {
				return { success: false };
			}
		}

		case 'getTabInfo': {
			if (!sender.tab) return { success: false };
			return { success: true, title: sender.tab.title, url: sender.tab.url };
		}

		case 'getTabList': {
			if (!sender.tab) return { success: false };
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

		case 'switchToTab':
			if (!request.tabId) return { success: false };
			await chrome.tabs.update(request.tabId, { active: true });
			return { success: true };

		case 'restoreSession':
			if (!request.sessionId) return { success: false };
			try {
				await chrome.sessions.restore(request.sessionId);
			} catch {
				return { success: false };
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
			const granted = await requestPermission(['bookmarks'], sender.tab?.windowId);
			if (!granted) return { success: false };
			try {
				const folderId = await Bookmarks.resolveFolder(request.folderId) ?? '1';
				const links = await Bookmarks.listLinks(folderId);
				return { success: true, bookmarks: sortAndClamp(links, request.sortOrder, request.maxItems) };
			} catch (error) {
				console.error('Failed to get bookmarks:', error);
				return { success: false, bookmarks: [] };
			}
		}

		case 'getBookmarkFolders': {
			const granted = await requestPermission(['bookmarks'], sender.tab?.windowId);
			if (!granted) return { success: false, folders: [] };
			try {
				return { success: true, folders: await Bookmarks.listFolders() };
			} catch (error) {
				console.error('Failed to get bookmark folders:', error);
				return { success: false, folders: [] };
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
			if (!session) return { items: null };
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

		case 'actionChain': {
			if (!sender.tab) return { success: false };
			const steps = request.steps;
			if (!steps?.length) return { success: false };
			const stopOnSuccess = !!request.stopOnSuccess;
			const originTabId = sender.tab.id;
			const originDocumentId = sender.documentId;
			const contextId = request.contextId;
			let windowId = sender.tab.windowId;
			let firstStep = true;

			const sleep = (ms) => new Promise(r => setTimeout(r, ms));

			for (const step of steps) {
				if (step.action === 'delay') {
					await sleep(step.delayMs || 500);
					continue;
				}

				if (!firstStep || windowId == null) {
					try {
						const newWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
						if (newWindow.id != null) {
							windowId = newWindow.id;
						}
					} catch {
					}
				}
				firstStep = false;
				const [activeTab] = await chrome.tabs.query({ active: true, windowId });
				if (!activeTab) continue;

				let result;
				if (CONTENT_ACTIONS.has(step.action)) {
					const targetTabId = dragType ? originTabId : activeTab.id;
					const isOrigin = targetTabId === originTabId;
					const payload = {
						action: 'executeLocalAction',
						stepAction: step.action,
						stepConfig: step,
						contextId: isOrigin ? contextId : undefined,
					};
					result = await chrome.tabs.sendMessage(
						targetTabId,
						payload,
						isOrigin ? { documentId: originDocumentId } : { frameId: 0 }
					).catch(() => null);
					if (!result && isOrigin) {
						payload.contextId = undefined;
						result = await chrome.tabs.sendMessage(targetTabId, payload, { frameId: 0 }).catch(() => ({ success: false }));
					}
				} else {
					result = await handleAction(step, { tab: activeTab }, dragType, contentValues);
				}
				if (stopOnSuccess && result?.success) break;
			}
			return { success: true };
		}
	}
	return { success: false, error: `Unknown action: ${request.action}` };
}

chrome.runtime.onMessage.addListener(asyncMessageHandler(async (request, sender) => {
	if (request.useActiveTab && sender.tab) {
		const [activeTab] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
		if (activeTab) {
			sender = { ...sender, tab: activeTab };
		}
	}

	const { dragType, contentValues, ...actionRequest } = request;
	return await handleAction(actionRequest, sender, dragType, contentValues);
}));

async function getZoomInfo(tabId) {
	const [tabZoom, zoomSettings] = await Promise.all([
		chrome.tabs.getZoom(tabId),
		chrome.tabs.getZoomSettings(tabId).catch(() => null),
	]);
	return { tabZoom, defaultZoom: zoomSettings?.defaultZoomFactor };
}

chrome.tabs.onZoomChange.addListener(async ({ tabId, newZoomFactor }) => {
	const zoomSettings = await chrome.tabs.getZoomSettings(tabId).catch(() => null);
	chrome.tabs.sendMessage(tabId, {
		action: 'tabZoomChanged',
		tabZoom: newZoomFactor,
		defaultZoom: zoomSettings?.defaultZoomFactor,
	}).catch(() => {});
});

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
		(async () => {
			if (details.previousVersion.startsWith('1.1')) {
				try {
					const items = await chrome.storage.sync.get(['imageDragGestures']);
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
							await chrome.storage.sync.set({ imageDragGestures: newGestures });
						}
					}
				} catch (e) {
					console.error('Migration (1.1 -> 1.2 imageSearch) failed:', e);
				}
			}

			try {
				const items = await chrome.storage.sync.get(['gestures', 'customGestures', 'customGestureUrls', 'mouseGestures']);
				const hasLegacyData = items.customGestures || items.customGestureUrls || items.gestures;
				const alreadyMigrated = items.mouseGestures && Object.keys(items.mouseGestures).length > 0;

				if (!alreadyMigrated && hasLegacyData) {
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

					await chrome.storage.sync.set({ mouseGestures });
					await chrome.storage.sync.remove(['gestures', 'customGestures', 'customGestureUrls']);
				}
			} catch (e) {
				console.error('Migration (legacy gestures -> mouseGestures) failed:', e);
			}

			if (compareVersions(details.previousVersion, '2.1') < 0) {
				try {
					await chrome.storage.sync.remove(['enableAdvancedSettings', 'scrollAmount', 'scrollSmoothness']);
				} catch (e) {
					console.error('Migration (cleanup < 2.1) failed:', e);
				}
			}

			if (compareVersions(details.previousVersion, '2.0.2') <= 0) {
				try {
					await chrome.storage.sync.set({ enableSuggestedGestures: false });
				} catch (e) {
					console.error('Migration (<= 2.0.2 enableSuggestedGestures) failed:', e);
				}
			}

			try {
				const items = await chrome.storage.sync.get([
					'actionChains', 'textDragGestures', 'linkDragGestures', 'imageDragGestures',
				]);
				const updates = {};
				let chains = structuredClone(items.actionChains || {});
				let chainsChanged = false;

				const generateChainId = () => {
					const existing = new Set(Object.keys(chains));
					let id;
					do {
						id = `chain_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
					} while (existing.has(id));
					return id;
				};

				const migrateDragArray = (gestures, dragType) => {
					if (!Array.isArray(gestures)) return gestures;
					const order = [];
					const groups = new Map();
					for (const g of gestures) {
						const dir = g.direction || '→';
						if (!groups.has(dir)) {
							order.push(dir);
							groups.set(dir, []);
						}
						groups.get(dir).push(g);
					}

					let dragChanged = false;
					const result = [];
					for (const dir of order) {
						const itemsForDir = groups.get(dir);
						if (itemsForDir.length === 1) {
							result.push(itemsForDir[0]);
							continue;
						}
						dragChanged = true;
						const steps = [];
						for (const item of itemsForDir) {
							const { direction, ...rest } = item;
							if (!rest.action || rest.action === 'none' || rest.action === 'actionChain') continue;
							steps.push(structuredClone(rest));
						}
						if (steps.length === 0) {
							result.push({ direction: dir, action: 'none' });
						} else if (steps.length === 1) {
							result.push({ direction: dir, ...steps[0] });
						} else {
							const id = generateChainId();
							chains[id] = {
								name: '',
								type: dragType,
								stopOnSuccess: false,
								steps,
							};
							chainsChanged = true;
							result.push({ direction: dir, action: 'actionChain', chainId: id });
						}
					}
					return dragChanged ? result : gestures;
				};

				const text = migrateDragArray(items.textDragGestures, 'text');
				const link = migrateDragArray(items.linkDragGestures, 'link');
				const image = migrateDragArray(items.imageDragGestures, 'image');
				if (text !== items.textDragGestures) updates.textDragGestures = text;
				if (link !== items.linkDragGestures) updates.linkDragGestures = link;
				if (image !== items.imageDragGestures) updates.imageDragGestures = image;
				if (chainsChanged) updates.actionChains = chains;

				if (Object.keys(updates).length) {
					await chrome.storage.sync.set(updates);
				}
			} catch (e) {
				console.error('Migration (drag chain) failed:', e);
			}

			try {
				const items = await chrome.storage.sync.get([
					'mouseGestures', 'wheelGestures', 'specialGestures', 'actionChains',
				]);
				const updates = {};

				const migrateCopyUrl = (config) => {
					if (config.action === 'copyUrl' && config.includeTitle) {
						config.action = 'copyTitleAndUrl';
						delete config.includeTitle;
						return true;
					}
					return false;
				};

				if (items.mouseGestures) {
					const mg = structuredClone(items.mouseGestures);
					let changed = false;
					for (const config of Object.values(mg)) {
						if (migrateCopyUrl(config)) changed = true;
					}
					if (changed) updates.mouseGestures = mg;
				}

				if (items.wheelGestures) {
					const wg = structuredClone(items.wheelGestures);
					let changed = false;
					for (const config of Object.values(wg)) {
						if (migrateCopyUrl(config)) changed = true;
					}
					if (changed) updates.wheelGestures = wg;
				}

				if (items.specialGestures) {
					const sg = structuredClone(items.specialGestures);
					let changed = false;
					for (const config of Object.values(sg)) {
						if (migrateCopyUrl(config)) changed = true;
					}
					if (changed) updates.specialGestures = sg;
				}

				if (items.actionChains) {
					const chains = structuredClone(items.actionChains);
					let changed = false;
					for (const chain of Object.values(chains)) {
						if (!chain.steps) continue;
						for (const step of chain.steps) {
							if (migrateCopyUrl(step)) changed = true;
						}
					}
					if (changed) updates.actionChains = chains;
				}

				if (Object.keys(updates).length) {
					await chrome.storage.sync.set(updates);
				}
			} catch (e) {
				console.error('Migration (copyUrl → copyTitleAndUrl) failed:', e);
			}
		})();
	}


	{
		async function reinjectContentScripts(dispose) {
			const contentScript = chrome.runtime.getManifest().content_scripts[0];
			const tabs = await chrome.tabs.query({});
			await Promise.all(tabs.map(async (tab) => {
				if (isRestrictedUrl(tab.url)) return;
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
				} catch (error) {
					console.error('Failed to re-inject content scripts into tab:', error);
				}
			}));
		}

		if (details.reason === 'install' || (details.reason === 'update' && compareVersions(details.previousVersion, '1.50') > 0)) {
			reinjectContentScripts(details.reason === 'update');
		}
	}

	if (details.reason === 'install' || details.reason === 'update') {
		chrome.storage.local.get(['installDate'], (items) => {
			if (!items.installDate) {
				chrome.storage.local.set({ installDate: new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z' });
			}
		});
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

async function updateBadge(tabId, status) {
	try {
		if (status === 'normal') {
			await chrome.action.setBadgeText({ tabId: tabId, text: '' });
		} else if (status === 'restricted') {
			await Promise.all([
				chrome.action.setBadgeText({ tabId: tabId, text: '!' }),
				chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#FFA500' }),
			]);
		} else if (status === 'needRefresh') {
			await Promise.all([
				chrome.action.setBadgeText({ tabId: tabId, text: '!' }),
				chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#4285f4' }),
			]);
		}
	} catch (e) {
	}
}

async function updateMenuForTab(tab) {
	const tabId = tab.id;
	const url = tab.url;
	const status = tab.status;

	if (status === 'loading') {
		removeAllMenus();
		await updateBadge(tabId, 'normal');
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
		await updateBadge(tabId, 'normal');
		return;
	}

	if (hostname && items.blacklist && items.blacklist.includes(hostname)) {
		removeAllMenus();
		await updateBadge(tabId, 'normal');
		return;
	}

	if (isRestrictedUrl(url)) {
		createRestrictedMenu();
		await updateBadge(tabId, 'restricted');
	} else {
		const loaded = await isContentScriptLoaded(tabId);
		if (loaded) {
			removeAllMenus();
			await updateBadge(tabId, 'normal');
		} else {
			createRefreshMenu();
			await updateBadge(tabId, 'needRefresh');
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

function sanitizeSubdir(raw) {
	if (!raw || typeof raw !== 'string') return '';
	let s = raw.trim()
		.replace(/\\/g, '/')
		.replace(/\/+/g, '/');
	s = s.replace(/^\/|\/$/g, '');
	const segments = s.split('/').filter(seg => {
		if (!seg || seg === '.' || seg === '..') return false;
		if (/[<>:"|?*\x00-\x1f]/.test(seg)) return false;
		return true;
	});
	return segments.join('/');
}

function sanitizeFilename(raw) {
	if (!raw || typeof raw !== 'string') return '';
	const illegalRe = /[\/?<>\\:*|"]/g;
	const controlRe = /[\x00-\x1f\x80-\x9f]/g;
	const reservedRe = /^\.+$/;
	const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
	let name = raw
		.replace(illegalRe, '_')
		.replace(controlRe, '_')
		.replace(reservedRe, '_')
		.replace(windowsReservedRe, '_');
	let end = name.length;
	while (end > 0 && (name[end - 1] === '.' || name[end - 1] === ' ')) end--;
	name = name.slice(0, end);
	if (name.length > 255) name = name.slice(0, 255);
	return name;
}

function joinDownloadPath(subdir, filename) {
	const name = sanitizeFilename(filename);
	if (subdir) return subdir + '/' + (name || 'image.png');
	return name || null;
}

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