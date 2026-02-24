import fs from 'node:fs';
import type { ScanSummary, Finding } from '../types.js';

const riskBadge = (level: string) => {
  const map: Record<string, string> = { high: '🔴 HIGH', medium: '🟡 MEDIUM', low: '🔵 LOW', info: 'ℹ️ INFO' };
  return map[level] ?? level.toUpperCase();
};

const shortenPath = (p: string) => p.replace(process.env['HOME'] ?? '', '~');

const findingSection = (f: Finding) => `
### [${f.riskLevel.toUpperCase()}] ${f.title}

- **Agent:** ${f.agentLabel}
- **Config:** \`${shortenPath(f.configPath)}\`
- **Key:** \`${f.permission.rawKey}\`
- **Value:** \`${JSON.stringify(f.permission.rawValue)}\`
- **ID:** \`${f.id}\`

**What this means:** ${f.description}

**Remediation:** ${f.remediation}
`.trim();

export const renderMarkdown = (summary: ScanSummary, outputPath: string): void => {
  const lines: string[] = [
    '# Baymax Security Report',
    '',
    `**Scanned at:** ${summary.scannedAt}`,
    '',
    '## Summary',
    '',
    '| Risk Level | Count |',
    '|------------|-------|',
    `| High       | ${summary.highCount}     |`,
    `| Medium     | ${summary.mediumCount}     |`,
    `| Low        | ${summary.lowCount}     |`,
    `| Info       | ${summary.infoCount}     |`,
    '',
    `**Agents detected:** ${summary.agentsDetected.join(', ') || 'none'}`,
    '',
    '## Findings',
    '',
  ];

  if (summary.findings.length === 0) {
    lines.push('No findings detected. Your agent configurations look clean.');
  } else {
    const sorted = [...summary.findings].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2, info: 3 };
      return (order[a.riskLevel] ?? 4) - (order[b.riskLevel] ?? 4);
    });
    for (const f of sorted) {
      lines.push(findingSection(f));
      lines.push('');
    }
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
};
