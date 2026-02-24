import path from 'node:path';
import chalk from 'chalk';
import { runScan } from './scan.js';
import { logger } from './utils/logger.js';
import os from 'node:os';

export const explainFinding = async (findingId: string, projectDir = process.cwd()): Promise<void> => {
  const summary = await runScan({ projectDir: path.resolve(projectDir), json: false, quiet: false });
  const finding = summary.findings.find(f => f.id === findingId);

  if (!finding) {
    logger.error(`No finding found with ID: ${findingId}`);
    logger.dim('Run "baymax scan" to see available finding IDs.');
    process.exit(1);
  }

  const shortenPath = (p: string) => p.replace(os.homedir(), '~');

  console.log();
  console.log(`  ${chalk.cyan.bold('Baymax')}  ${chalk.dim('·  explain')}`);
  console.log();
  console.log(`  ${chalk.bold(finding.title)}`);
  console.log(`  ${chalk.dim('─'.repeat(60))}`);
  console.log();
  console.log(`  ${chalk.bold('Agent:')}       ${finding.agentLabel}`);
  console.log(`  ${chalk.bold('Risk:')}        ${finding.riskLevel === 'high' ? chalk.red.bold('HIGH') : finding.riskLevel === 'medium' ? chalk.yellow('MEDIUM') : chalk.blue('LOW')}`);
  console.log(`  ${chalk.bold('Config:')}      ${chalk.dim(shortenPath(finding.configPath))}`);
  console.log(`  ${chalk.bold('Key:')}         ${chalk.dim(finding.permission.rawKey)}`);
  console.log(`  ${chalk.bold('Value:')}       ${chalk.dim(JSON.stringify(finding.permission.rawValue))}`);
  console.log(`  ${chalk.bold('Capability:')} ${finding.permission.capability}`);
  console.log(`  ${chalk.bold('Scope:')}       ${finding.permission.scope}`);
  console.log(`  ${chalk.bold('Persistence:')} ${finding.permission.persistence}`);
  console.log();
  console.log(`  ${chalk.bold('What this means:')}`);
  console.log(`  ${finding.description}`);
  console.log();
  console.log(`  ${chalk.bold('Remediation:')}`);
  console.log(`  ${chalk.cyan('→')} ${finding.remediation}`);
  console.log();
};
