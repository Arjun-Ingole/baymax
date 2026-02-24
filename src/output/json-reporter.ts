import type { ScanSummary, JsonOutput } from '../types.js';

export const renderJson = (summary: ScanSummary): void => {
  const output: JsonOutput = {
    version: '1.0.0',
    scannedAt: summary.scannedAt,
    summary: {
      agentsDetected: summary.agentsDetected,
      high: summary.highCount,
      medium: summary.mediumCount,
      low: summary.lowCount,
      info: summary.infoCount,
    },
    findings: summary.findings,
  };
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
};
