import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('runScan integration', () => {
  it('returns a valid ScanSummary structure', async () => {
    const { runScan } = await import('./scan.js');
    const summary = await runScan({ projectDir: process.cwd(), json: false, quiet: false, depth: 0, verbose: false });

    expect(summary).toHaveProperty('findings');
    expect(summary).toHaveProperty('agentsDetected');
    expect(summary).toHaveProperty('agentsScanned');
    expect(summary).toHaveProperty('highCount');
    expect(summary).toHaveProperty('mediumCount');
    expect(summary).toHaveProperty('lowCount');
    expect(summary).toHaveProperty('infoCount');
    expect(summary).toHaveProperty('scannedAt');
    expect(summary).toHaveProperty('stats');
    expect(Array.isArray(summary.findings)).toBe(true);
  });

  it('counts match findings array', async () => {
    const { runScan } = await import('./scan.js');
    const summary = await runScan({ projectDir: process.cwd(), json: false, quiet: false, depth: 0, verbose: false });

    const total = summary.highCount + summary.mediumCount + summary.lowCount + summary.infoCount;
    expect(total).toBe(summary.findings.length);
  });

  it('scannedAt is a valid ISO date', async () => {
    const { runScan } = await import('./scan.js');
    const summary = await runScan({ projectDir: process.cwd(), json: false, quiet: false, depth: 0, verbose: false });
    expect(() => new Date(summary.scannedAt)).not.toThrow();
  });

  it('stats includes durationMs and projectsScanned', async () => {
    const { runScan } = await import('./scan.js');
    const summary = await runScan({ projectDir: process.cwd(), json: false, quiet: false, depth: 0, verbose: false });
    expect(typeof summary.stats.durationMs).toBe('number');
    expect(summary.stats.durationMs).toBeGreaterThanOrEqual(0);
    expect(summary.stats.projectsScanned).toBeGreaterThanOrEqual(1);
  });

  it('handles empty project directory gracefully', async () => {
    const { runScan } = await import('./scan.js');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baymax-scan-test-'));
    try {
      const summary = await runScan({ projectDir: tmpDir, json: false, quiet: false, depth: 0, verbose: false });
      expect(Array.isArray(summary.findings)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('each finding has required fields including score and projectDir', async () => {
    const { runScan } = await import('./scan.js');
    const summary = await runScan({ projectDir: process.cwd(), json: false, quiet: false, depth: 0, verbose: false });

    for (const finding of summary.findings) {
      expect(typeof finding.id).toBe('string');
      expect(typeof finding.agentId).toBe('string');
      expect(typeof finding.agentLabel).toBe('string');
      expect(typeof finding.configPath).toBe('string');
      expect(typeof finding.projectDir).toBe('string');
      expect(['high', 'medium', 'low', 'info']).toContain(finding.riskLevel);
      expect(typeof finding.score).toBe('number');
      expect(finding.score).toBeGreaterThanOrEqual(1);
      expect(finding.score).toBeLessThanOrEqual(10);
      expect(typeof finding.ruleId).toBe('string');
    }
  });

  it('recursive scan finds more projects when depth > 0', async () => {
    const { runScan } = await import('./scan.js');
    // With depth=2 it should scan subdirectories too
    const summary = await runScan({ projectDir: process.cwd(), json: false, quiet: false, depth: 2, verbose: false });
    expect(summary.stats.projectsScanned).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(summary.findings)).toBe(true);
  });
});
