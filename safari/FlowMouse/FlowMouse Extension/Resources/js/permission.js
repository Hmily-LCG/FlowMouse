(async function () {
	if (window.i18n && window.i18n.waitForInit) {
		await window.i18n.waitForInit();
	}

	const params = new URLSearchParams(window.location.search);
	const permissionsParam = params.get('permissions');
	let permissions = null;

	const titleEl = document.getElementById('title');
	const descEl = document.getElementById('description');
	const grantBtn = document.getElementById('grantBtn');
	const cancelBtn = document.getElementById('cancelBtn');
	const iconBookmarks = document.getElementById('icon-bookmarks');
	const iconDownloads = document.getElementById('icon-downloads');
	const iconIncognito = document.getElementById('icon-incognito');

	document.title = window.i18n.getMessage('permissionTitle');

	let isCustomAction = false;

	if (permissionsParam === 'bookmarks') {
		const titleText = window.i18n.getMessage('permissionBookmarksTitle');
		titleEl.textContent = titleText;
		descEl.textContent = window.i18n.getMessage('permissionBookmarksDesc');
		iconBookmarks.style.display = 'block';
		permissions = permissionsParam.split(',');
	}
	if (permissionsParam === 'downloads,pageCapture') {
		const titleText = window.i18n.getMessage('permissionDownloadsPageCaptureTitle');
		titleEl.textContent = titleText;
		descEl.textContent = window.i18n.getMessage('permissionDownloadsPageCaptureDesc');
		iconDownloads.style.display = 'block';
		permissions = permissionsParam.split(',');
	}
	if (permissionsParam === 'clipboardRead') {
		const titleText = window.i18n.getMessage('permissionClipboardReadTitle');
		titleEl.textContent = titleText;
		descEl.textContent = window.i18n.getMessage('permissionClipboardReadDesc');
		const iconClipboard = document.getElementById('icon-clipboard');
		if (iconClipboard) iconClipboard.style.display = 'block';
		permissions = permissionsParam.split(',');
	}
	if (permissionsParam === 'incognito') {
		{
			const titleText = window.i18n.getMessage('permissionIncognitoTitle');
			titleEl.textContent = titleText;
			descEl.textContent = window.i18n.getMessage('permissionIncognitoDesc');
			grantBtn.textContent = window.i18n.getMessage('openExtensionsSettings');
		}
		iconIncognito.style.display = 'block';
		isCustomAction = true;
	}

	if (!permissions && !isCustomAction) {
		descEl.textContent = 'Unknown permission requested.';
		grantBtn.disabled = true;
	} else {
		grantBtn.addEventListener('click', async () => {
			if (isCustomAction && permissionsParam === 'incognito') {
				{
					await chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
					window.close();
				}
				return;
			}

			if (!permissions) return;

			let granted = await chrome.permissions.request({ permissions: permissions });
			if (granted) {
				window.close();
			}
		});
	}

	cancelBtn.addEventListener('click', () => {
		window.close();
	});
})();