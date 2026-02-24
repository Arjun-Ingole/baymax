import path from 'node:path';
import chalk from 'chalk';
import os from 'node:os';
import { runScan } from './scan.js';
import { logger } from './utils/logger.js';

const shortenPath = (p: string) => p.replace(os.homedir(), '~');

const scoreBar = (score: number): string => {
  const filled = Math.round(score / 10 * 8);
  const bar = '█'.repeat(filled) + '░'.repeat(8 - filled);
  const color = score >= 7 ? chalk.red : score >= 4 ? chalk.yellow : chalk.blue;
  return `${color(bar)} ${chalk.dim(`${score}/10`)}`;
};

export const explainFinding = async (findingId: string, projectDir = '.', depth = 2): Promise<void> => {
  const summary = await runScan({
    projectDir: path.resolve(projectDir),
    json: false,
    quiet: false,
    verbose: false,
    depth,
  });

  const finding = summary.findings.find(f => f.id === findingId);

  if (!finding) {
    logger.error(`\n  No finding with ID: ${findingId}`);
    logger.dim('  Run "baymax scan" to see available finding IDs.');
    process.exit(1);
  }

  const riskColor = finding.riskLevel === 'high'
    ? chalk.red.bold
    : finding.riskLevel === 'medium'
      ? chalk.yellow
      : chalk.blue;

  console.log();
  console.log(`  ${chalk.bold('baymax')}  ${chalk.dim('explain')}`);
  console.log();
  console.log(`  ${chalk.bold.white(finding.title)}`);
  console.log(`  ${chalk.dim('─'.repeat(62))}`);
  console.log();
  console.log(`  ${chalk.dim('agent')}        ${chalk.white(finding.agentLabel)}`);
  console.log(`  ${chalk.dim('risk')}         ${riskColor(finding.riskLevel.toUpperCase())}  ${scoreBar(finding.score)}`);
  console.log(`  ${chalk.dim('config')}       ${chalk.dim(shortenPath(finding.configPath))}`);
  console.log(`  ${chalk.dim('key')}          ${chalk.dim(finding.permission.rawKey)}`);
  console.log(`  ${chalk.dim('value')}        ${chalk.dim(JSON.stringify(finding.permission.rawValue))}`);
  console.log(`  ${chalk.dim('capability')}   ${finding.permission.capability}`);
  console.log(`  ${chalk.dim('scope')}        ${finding.permission.scope}`);
  console.log(`  ${chalk.dim('persistence')}  ${finding.permission.persistence}`);
  if (finding.permission.constraints.length > 0) {
    console.log(`  ${chalk.dim('constraints')}  ${chalk.dim(finding.permission.constraints.join(', '))}`);
  }
  console.log();
  console.log(`  ${chalk.bold('What this means')}`);
  console.log(`  ${finding.description}`);
  console.log();
  console.log(`  ${chalk.bold('How to fix it')}`);
  console.log(`  ${chalk.cyan('→')} ${finding.remediation}`);
  console.log();
};
