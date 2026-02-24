import { describe, it, expect } from 'vitest';
import { codexAdapter } from './codex.js';

describe('codexAdapter', () => {
  it('has correct agentId and agentLabel', () => {
    expect(codexAdapter.agentId).toBe('codex');
    expect(codexAdapter.agentLabel).toBe('Codex CLI');
  });

  it('detect() returns a boolean', () => {
    expect(typeof codexAdapter.detect('.')).toBe('boolean');
  });

  it('scan() returns an array', async () => {
    const result = await codexAdapter.scan('.');
    expect(Array.isArray(result)).toBe(true);
  });

  it('scan() does not throw on missing config', async () => {
    await expect(codexAdapter.scan('/nonexistent/path')).resolves.toBeDefined();
  });
});
