import fs from 'node:fs';
import os from 'node:os';
import type { ScanSummary, Finding } from '../types.js';

const shortenPath = (p: string) => p.replace(os.homedir(), '~');

const findingSection = (f: Finding) => `
### [${f.riskLevel.toUpperCase()}] ${f.title}

| Field | Value |
|-------|-------|
| Agent | ${f.agentLabel} |
| Risk score | ${f.score}/10 |
| Config | \`${shortenPath(f.configPath)}\` |
| Key | \`${f.permission.rawKey}\` |
| Value | \`${JSON.stringify(f.permission.rawValue)}\` |
| Capability | ${f.permission.capability} |
| Scope | ${f.permission.scope} |
| ID | \`${f.id}\` |

**What this means:** ${f.description}

**How to fix it:** ${f.remediation}
`.trim();

export const renderMarkdown = (summary: ScanSummary, outputPath: string): void => {
  const { stats } = summary;
  const lines: string[] = [
    '# Baymax Security Report',
    '',
    `**Scanned at:** ${summary.scannedAt}`,
    `**Duration:** ${stats.durationMs}ms`,
    `**Projects scanned:** ${stats.projectsScanned}`,
    '',
    '## Summary',
    '',
    '| Risk Level | Count |',
    '|------------|-------|',
    `| 🔴 High    | ${summary.highCount} |`,
    `| 🟡 Medium  | ${summary.mediumCount} |`,
    `| 🔵 Low     | ${summary.lowCount} |`,
    '',
    `**Agents detected:** ${summary.agentsDetected.join(', ') || 'none'}`,
    '',
    '## Findings',
    '',
  ];

  if (summary.findings.length === 0) {
    lines.push('✅ No findings detected. Agent configurations look clean.');
  } else {
    const sorted = [...summary.findings].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2, info: 3 };
      return (order[a.riskLevel] ?? 4) - (order[b.riskLevel] ?? 4) || b.score - a.score;
    });
    for (const f of sorted) {
      lines.push(findingSection(f));
      lines.push('');
    }
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
};
