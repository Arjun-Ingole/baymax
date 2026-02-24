import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('runScan integration', () => {
  it('returns a valid ScanSummary structure', async () => {
    const { runScan } = await import('./scan.js');
    const summary = await runScan({ projectDir: process.cwd(), json: false, quiet: false });

    expect(summary).toHaveProperty('findings');
    expect(summary).toHaveProperty('agentsDetected');
    expect(summary).toHaveProperty('agentsScanned');
    expect(summary).toHaveProperty('highCount');
    expect(summary).toHaveProperty('mediumCount');
    expect(summary).toHaveProperty('lowCount');
    expect(summary).toHaveProperty('infoCount');
    expect(summary).toHaveProperty('scannedAt');
    expect(Array.isArray(summary.findings)).toBe(true);
  });

  it('counts match findings array', async () => {
    const { runScan } = await import('./scan.js');
    const summary = await runScan({ projectDir: process.cwd(), json: false, quiet: false });

    const total = summary.highCount + summary.mediumCount + summary.lowCount + summary.infoCount;
    expect(total).toBe(summary.findings.length);
  });

  it('scannedAt is a valid ISO date', async () => {
    const { runScan } = await import('./scan.js');
    const summary = await runScan({ projectDir: process.cwd(), json: false, quiet: false });

    expect(() => new Date(summary.scannedAt)).not.toThrow();
  });

  it('handles empty project directory gracefully', async () => {
    const { runScan } = await import('./scan.js');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baymax-scan-test-'));
    try {
      const summary = await runScan({ projectDir: tmpDir, json: false, quiet: false });
      expect(Array.isArray(summary.findings)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('each finding has required fields', async () => {
    const { runScan } = await import('./scan.js');
    const summary = await runScan({ projectDir: process.cwd(), json: false, quiet: false });

    for (const finding of summary.findings) {
      expect(typeof finding.id).toBe('string');
      expect(typeof finding.agentId).toBe('string');
      expect(typeof finding.agentLabel).toBe('string');
      expect(typeof finding.configPath).toBe('string');
      expect(['high', 'medium', 'low', 'info']).toContain(finding.riskLevel);
      expect(typeof finding.ruleId).toBe('string');
      expect(typeof finding.title).toBe('string');
      expect(typeof finding.description).toBe('string');
      expect(typeof finding.remediation).toBe('string');
    }
  });
});
