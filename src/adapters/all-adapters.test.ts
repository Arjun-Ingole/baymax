import { describe, it, expect } from 'vitest';
import { ALL_ADAPTERS } from './index.js';

describe('ALL_ADAPTERS registry', () => {
  it('contains exactly 6 adapters', () => {
    expect(ALL_ADAPTERS).toHaveLength(6);
  });

  it('has all expected agent IDs', () => {
    const ids = ALL_ADAPTERS.map(a => a.agentId);
    expect(ids).toContain('claude-code');
    expect(ids).toContain('cursor');
    expect(ids).toContain('codex');
    expect(ids).toContain('gemini');
    expect(ids).toContain('copilot');
    expect(ids).toContain('aider');
  });

  it('each adapter has agentId, agentLabel, detect, scan', () => {
    for (const adapter of ALL_ADAPTERS) {
      expect(typeof adapter.agentId).toBe('string');
      expect(typeof adapter.agentLabel).toBe('string');
      expect(typeof adapter.detect).toBe('function');
      expect(typeof adapter.scan).toBe('function');
    }
  });

  it('no duplicate agentIds', () => {
    const ids = ALL_ADAPTERS.map(a => a.agentId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it.each(ALL_ADAPTERS.map(a => [a.agentLabel, a] as const))(
    'adapter %s scan() resolves to an array',
    async (_, adapter) => {
      const result = await adapter.scan(process.cwd());
      expect(Array.isArray(result)).toBe(true);
    }
  );
});
