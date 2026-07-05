import { describe, it, expect } from 'vitest';
import '../js/transform-runner.js';
const { runTransformSync } = globalThis.FlowMouseTransformRunner;

describe('runTransformSync', () => {
  it('runs a body that returns a string', () => {
    expect(runTransformSync('return selection.toUpperCase()', 'abc', '')).toEqual({ ok: true, result: 'ABC' });
  });
  it('exposes clipboard', () => {
    expect(runTransformSync('return clipboard + selection', 'B', 'A')).toEqual({ ok: true, result: 'AB' });
  });
  it('coerces a non-string result', () => {
    expect(runTransformSync('return 42', 'x', '')).toEqual({ ok: true, result: '42' });
  });
  it('coerces null/undefined to empty string', () => {
    expect(runTransformSync('return undefined', 'x', '')).toEqual({ ok: true, result: '' });
  });
  it('captures a thrown error', () => {
    const r = runTransformSync('throw new Error("boom")', 'x', '');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('boom');
  });
  it('captures a syntax error', () => {
    const r = runTransformSync('return (', 'x', '');
    expect(r.ok).toBe(false);
  });
  it('does not interpolate inputs into the body (selection is an arg, not concatenated)', () => {
    // If selection were interpolated, this would break; as an arg it is a plain string.
    expect(runTransformSync('return selection', '"); doEvil(); ("', '')).toEqual({ ok: true, result: '"); doEvil(); ("' });
  });
});
