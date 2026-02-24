import chalk from 'chalk';
import type { ScanSummary, Finding, RiskLevel } from '../types.js';
import os from 'node:os';

const riskColor = (level: RiskLevel) => {
  switch (level) {
    case 'high': return chalk.red.bold;
    case 'medium': return chalk.yellow;
    case 'low': return chalk.blue;
    default: return chalk.dim;
  }
};

const riskSymbol = (level: RiskLevel) => {
  switch (level) {
    case 'high': return chalk.red.bold('!');
    case 'medium': return chalk.yellow('~');
    case 'low': return chalk.blue('-');
    default: return chalk.dim('·');
  }
};

const shortenPath = (p: string) => p.replace(os.homedir(), '~');

const renderFinding = (f: Finding) => {
  const color = riskColor(f.riskLevel);
  const symbol = riskSymbol(f.riskLevel);
  console.log(`  ${symbol} ${color(`[${f.riskLevel.toUpperCase()}]`)}  ${chalk.white.bold(f.title)}`);
  console.log(`       ${chalk.dim(f.description)}`);
  console.log(`       ${chalk.cyan('→')} ${f.remediation}`);
  console.log(`       ${chalk.dim(`ID: ${f.id}`)}`);
  console.log();
};

export const renderFindings = (summary: ScanSummary, options: { quiet?: boolean } = {}): void => {
  // Header
  console.log();
  console.log(`  ${chalk.cyan.bold('Baymax')}  ${chalk.dim('v1.0.0  ·  AI agent permission scanner')}`);
  console.log();

  if (summary.agentsDetected.length === 0) {
    console.log(chalk.dim('  No supported AI agent configs detected in this directory.'));
    console.log();
    return;
  }

  // Group findings by agent
  const byAgent = new Map<string, Finding[]>();
  for (const f of summary.findings) {
    const key = `${f.agentId}::${f.configPath}`;
    if (!byAgent.has(key)) byAgent.set(key, []);
    byAgent.get(key)!.push(f);
  }

  if (summary.findings.length === 0) {
    console.log(chalk.green('  ✓ No risky permissions detected across all scanned agents.'));
    console.log();
  } else {
    // Sort findings by risk level
    const riskOrder: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, info: 3 };
    const findings = [...summary.findings].sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

    // Group by agent label + config path
    const groups = new Map<string, { label: string; configPath: string; findings: Finding[] }>();
    for (const f of findings) {
      if (options.quiet && f.riskLevel !== 'high') continue;
      const key = `${f.agentLabel}::${f.configPath}`;
      if (!groups.has(key)) {
        groups.set(key, { label: f.agentLabel, configPath: f.configPath, findings: [] });
      }
      groups.get(key)!.findings.push(f);
    }

    for (const group of groups.values()) {
      console.log(`  ${chalk.bold(group.label)}  ${chalk.dim('·  ' + shortenPath(group.configPath))}`);
      console.log('  ' + chalk.dim('─'.repeat(60)));
      for (const f of group.findings) {
        renderFinding(f);
      }
    }
  }

  // Summary box
  const high = summary.highCount > 0 ? chalk.red.bold(`${summary.highCount} high`) : chalk.dim(`${summary.highCount} high`);
  const medium = summary.mediumCount > 0 ? chalk.yellow(`${summary.mediumCount} medium`) : chalk.dim(`${summary.mediumCount} medium`);
  const low = summary.lowCount > 0 ? chalk.blue(`${summary.lowCount} low`) : chalk.dim(`${summary.lowCount} low`);
  const detected = summary.agentsDetected.length;
  const scanned = summary.agentsScanned.length;

  console.log('  ' + chalk.dim('┌' + '─'.repeat(44) + '┐'));
  console.log(`  ${chalk.dim('│')}  ${high}  ·  ${medium}  ·  ${low}  ${chalk.dim('│')}`);
  console.log(`  ${chalk.dim('│')}  ${chalk.dim(`${detected} agent${detected !== 1 ? 's' : ''} detected · ${scanned} scanned`)}          ${chalk.dim('│')}`);
  if (summary.highCount > 0 || summary.mediumCount > 0) {
    console.log(`  ${chalk.dim('│')}  ${chalk.dim('Run: baymax explain <id>  for details')}     ${chalk.dim('│')}`);
  }
  console.log('  ' + chalk.dim('└' + '─'.repeat(44) + '┘'));
  console.log();
};
