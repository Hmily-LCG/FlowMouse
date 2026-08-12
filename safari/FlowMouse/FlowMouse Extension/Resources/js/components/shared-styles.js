import { css, unsafeCSS } from '../../js/lib/lit-all.min.js';

function getStylesheetText(href) {
	try {
		for (const sheet of document.styleSheets) {
			if (sheet.href && sheet.href.endsWith(href)) {
				return [...sheet.cssRules].map(r => r.cssText).join('\n');
			}
		}
	} catch (e) {
	}
	return '';
}

export const commonStyles = css`
	${unsafeCSS(getStylesheetText('common.css'))}
`;

export const optionStyles = css`
	${unsafeCSS(getStylesheetText('option.css'))}
`;