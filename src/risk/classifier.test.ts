import { describe, it, expect } from 'vitest';
import { classifyFinding } from './classifier.js';
import type { NormalizedPermission } from '../types.js';

const makePermission = (overrides: Partial<NormalizedPermission> = {}): NormalizedPermission => ({
  capability: 'shell',
  scope: 'global',
  persistence: 'always',
  constraints: [],
  rawKey: 'test',
  rawValue: 'test',
  ...overrides,
});

describe('classifyFinding', () => {
  it('returns info for unknown rule', () => {
    const result = classifyFinding(makePermission(), 'NONEXISTENT_RULE');
    expect(result.riskLevel).toBe('info');
    expect(result.title).toBe('Unknown permission');
    expect(result.score).toBe(1);
  });

  it('returns high for SHELL_UNRESTRICTED_ALWAYS', () => {
    const result = classifyFinding(makePermission(), 'SHELL_UNRESTRICTED_ALWAYS');
    expect(result.riskLevel).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(7);
  });

  it('elevates medium → high when persistence=always and scope=global', () => {
    const result = classifyFinding(
      makePermission({ persistence: 'always', scope: 'global', capability: 'mcp' }),
      'MCP_SERVER_REGISTERED',
    );
    expect(result.riskLevel).toBe('high');
    expect(result.score).toBeGreaterThan(5);
  });

  it('keeps medium when scope is repo (not global)', () => {
    const result = classifyFinding(
      makePermission({ persistence: 'always', scope: 'repo', capability: 'mcp' }),
      'MCP_SERVER_REGISTERED',
    );
    expect(result.riskLevel).toBe('medium');
  });

  it('downgrades high → medium when persistence=session', () => {
    const result = classifyFinding(
      makePermission({ persistence: 'session', scope: 'global' }),
      'SHELL_UNRESTRICTED_ALWAYS',
    );
    expect(result.riskLevel).toBe('medium');
    expect(result.score).toBeLessThan(9);
  });

  it('returns low for TOOL_ALWAYS_ALLOWED', () => {
    const result = classifyFinding(
      makePermission({ capability: 'unknown', scope: 'repo' }),
      'TOOL_ALWAYS_ALLOWED',
    );
    expect(result.riskLevel).toBe('low');
    expect(result.score).toBeLessThanOrEqual(3);
  });

  it('returns proper title and remediation from rule', () => {
    const result = classifyFinding(makePermission(), 'SHELL_UNRESTRICTED_ALWAYS');
    expect(result.title).toBe('Unrestricted shell execution always allowed');
    expect(result.remediation).toContain('allowedTools');
  });

  it('returns high for SKIP_ALL_CONFIRMATIONS', () => {
    const result = classifyFinding(makePermission(), 'SKIP_ALL_CONFIRMATIONS');
    expect(result.riskLevel).toBe('high');
  });

  it('returns high for SANDBOX_DISABLED', () => {
    const result = classifyFinding(makePermission(), 'SANDBOX_DISABLED');
    expect(result.riskLevel).toBe('high');
  });

  it('returns high for SENSITIVE_PATH_TRUSTED', () => {
    const result = classifyFinding(makePermission(), 'SENSITIVE_PATH_TRUSTED');
    expect(result.riskLevel).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(7);
  });
});
