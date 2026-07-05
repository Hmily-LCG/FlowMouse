import { describe, it, expect, beforeAll } from "vitest";

let DEFAULT_SETTINGS;

beforeAll(async () => {
	// constants.js is a browser IIFE that assigns to window.GestureConstants
	// and also sets window.litDisableBundleWarning = true.
	// Provide a minimal window shim so it runs under Node/Vitest.
	globalThis.window = globalThis;
	await import("../js/constants.js");
	DEFAULT_SETTINGS = globalThis.GestureConstants.DEFAULT_SETTINGS;
});

describe("DEFAULT_SETTINGS", () => {
	it("customMenus defaults to an empty object", () => {
		expect(DEFAULT_SETTINGS.customMenus).toEqual({});
	});
	it("searchEngines defaults to empty diff structure", () => {
		expect(DEFAULT_SETTINGS.searchEngines).toEqual({ overrides: {}, hidden: [], custom: [], order: [] });
	});
});
