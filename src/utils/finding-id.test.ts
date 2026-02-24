import { describe, it, expect } from 'vitest';
import { makeFindingId } from './finding-id.js';

describe('makeFindingId', () => {
  it('joins parts with ::', () => {
    expect(makeFindingId('claude-code', 'allowedtools', 'bash')).toBe('claude-code::allowedtools::bash');
  });

  it('converts to lowercase', () => {
    expect(makeFindingId('Claude-Code', 'AllowedTools', 'Bash')).toBe('claude-code::allowedtools::bash');
  });

  it('replaces spaces with hyphens', () => {
    expect(makeFindingId('agent id', 'key name')).toBe('agent-id::key-name');
  });

  it('handles single part', () => {
    expect(makeFindingId('solo')).toBe('solo');
  });
});
