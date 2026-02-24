import { describe, it, expect } from 'vitest';
import { buildSummary } from './scorer.js';
import type { Finding, ScanStats } from '../types.js';

const makeStats = (): ScanStats => ({
  configsChecked: 1,
  configsFound: 1,
  projectsScanned: 1,
  durationMs: 10,
});

const makeFinding = (riskLevel: Finding['riskLevel'], id = 'test-id'): Finding => ({
  id,
  agentId: 'claude-code',
  agentLabel: 'Claude Code',
  configPath: '/test/settings.json',
  projectDir: '/test',
  riskLevel,
  score: 5,
  ruleId: 'SHELL_UNRESTRICTED_ALWAYS',
  summary: 'Test summary',
  title: 'Test',
  description: 'Test description',
  remediation: 'Test remediation',
  permission: {
    capability: 'shell',
    scope: 'global',
    persistence: 'always',
    constraints: [],
    rawKey: 'test',
    rawValue: 'test',
  },
});

describe('buildSummary', () => {
  it('counts findings by risk level', () => {
    const findings = [
      makeFinding('high', '1'),
      makeFinding('high', '2'),
      makeFinding('medium', '3'),
      makeFinding('low', '4'),
      makeFinding('info', '5'),
    ];
    const summary = buildSummary(findings, ['claude-code'], ['claude-code'], makeStats());
    expect(summary.highCount).toBe(2);
    expect(summary.mediumCount).toBe(1);
    expect(summary.lowCount).toBe(1);
    expect(summary.infoCount).toBe(1);
  });

  it('returns zero counts for empty findings', () => {
    const summary = buildSummary([], [], [], makeStats());
    expect(summary.highCount).toBe(0);
    expect(summary.mediumCount).toBe(0);
    expect(summary.lowCount).toBe(0);
    expect(summary.infoCount).toBe(0);
  });

  it('sets scannedAt as ISO8601 string', () => {
    const summary = buildSummary([], [], [], makeStats());
    expect(() => new Date(summary.scannedAt)).not.toThrow();
    expect(summary.scannedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('preserves agents detected and scanned', () => {
    const summary = buildSummary([], ['claude-code', 'cursor'], ['claude-code'], makeStats());
    expect(summary.agentsDetected).toEqual(['claude-code', 'cursor']);
    expect(summary.agentsScanned).toEqual(['claude-code']);
  });

  it('includes all findings in output', () => {
    const findings = [makeFinding('high', '1'), makeFinding('low', '2')];
    const summary = buildSummary(findings, ['claude-code'], ['claude-code'], makeStats());
    expect(summary.findings).toHaveLength(2);
  });

  it('includes stats in summary', () => {
    const stats = makeStats();
    const summary = buildSummary([], [], [], stats);
    expect(summary.stats).toEqual(stats);
  });
});
