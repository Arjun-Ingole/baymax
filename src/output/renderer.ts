import chalk from 'chalk';
import os from 'node:os';
import type { ScanSummary, Finding, RiskLevel } from '../types.js';

// ── Spinner ──────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private frame = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start() {
    process.stdout.write('\x1B[?25l'); // hide cursor
    this.interval = setInterval(() => {
      process.stdout.write(`\r  ${chalk.cyan(SPINNER_FRAMES[this.frame])}  ${chalk.dim(this.message)}`);
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
    }, 80);
    return this;
  }

  stop(finalMessage?: string) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r\x1B[2K'); // clear line
    process.stdout.write('\x1B[?25h'); // show cursor
    if (finalMessage) console.log(finalMessage);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const shortenPath = (p: string) => p.replace(os.homedir(), '~');

const riskColor = (level: RiskLevel) => {
  switch (level) {
    case 'high':   return chalk.red.bold;
    case 'medium': return chalk.yellow;
    case 'low':    return chalk.blue;
    default:       return chalk.dim;
  }
};

const riskBadge = (level: RiskLevel) => {
  switch (level) {
    case 'high':   return chalk.bgRed.white.bold(` HIGH `);
    case 'medium': return chalk.bgYellow.black.bold(` MED  `);
    case 'low':    return chalk.bgBlue.white(` LOW  `);
    default:       return chalk.bgGray.white(` INFO `);
  }
};

const scoreBar = (score: number): string => {
  const filled = Math.round(score / 10 * 6);
  const bar = '█'.repeat(filled) + '░'.repeat(6 - filled);
  const color = score >= 7 ? chalk.red : score >= 4 ? chalk.yellow : chalk.blue;
  return color(bar) + chalk.dim(` ${score}/10`);
};

const renderFinding = (f: Finding, index: number) => {
  const color = riskColor(f.riskLevel);
  console.log(
    `  ${chalk.dim(`${index}.`)} ${riskBadge(f.riskLevel)}  ${chalk.white.bold(f.title)}`
  );
  console.log(
    `     ${chalk.dim('risk score')} ${scoreBar(f.score)}`
  );
  console.log(
    `     ${chalk.dim(f.description)}`
  );
  console.log(
    `     ${chalk.cyan('→')} ${f.remediation}`
  );
  console.log(
    `     ${chalk.dim(`id: ${f.id}`)}`
  );
  console.log();
};

// ── Main renderer ─────────────────────────────────────────────────────────────

export const renderFindings = (summary: ScanSummary, options: { quiet?: boolean; verbose?: boolean } = {}): void => {
  const { stats } = summary;

  // Header
  console.log();
  console.log(`  ${chalk.bold('baymax')}  ${chalk.dim(`AI agent permission scanner`)}`);
  console.log();

  // Nothing detected
  if (summary.agentsDetected.length === 0) {
    console.log(chalk.dim('  No supported AI agent configs detected.'));
    console.log();
    _renderFooter(summary);
    return;
  }

  // All clear
  if (summary.findings.length === 0 || (options.quiet && summary.highCount === 0)) {
    console.log(`  ${chalk.green('✓')} ${chalk.green.bold('All clear.')} ${chalk.dim('No risky permissions found across')} ${chalk.white(summary.agentsDetected.length)} ${chalk.dim('agents.')}`);
    console.log();
    _renderFooter(summary);
    return;
  }

  // Sort: high first, then by score desc
  const riskOrder: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, info: 3 };
  const sortedFindings = [...summary.findings]
    .filter(f => !options.quiet || f.riskLevel === 'high')
    .sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || b.score - a.score);

  // Group by projectDir + agentLabel
  type Group = { projectDir: string; agentLabel: string; configPath: string; findings: Finding[] };
  const groups = new Map<string, Group>();
  for (const f of sortedFindings) {
    const key = `${f.projectDir}::${f.agentLabel}::${f.configPath}`;
    if (!groups.has(key)) {
      groups.set(key, { projectDir: f.projectDir, agentLabel: f.agentLabel, configPath: f.configPath, findings: [] });
    }
    groups.get(key)!.findings.push(f);
  }

  // Track current project for section headers
  let lastProject = '';
  let findingIndex = 1;

  for (const group of groups.values()) {
    const relProject = group.projectDir === process.cwd()
      ? chalk.dim('(current directory)')
      : chalk.dim(shortenPath(group.projectDir));

    // Project header (only when it changes)
    if (stats.projectsScanned > 1 && group.projectDir !== lastProject) {
      console.log(`  ${chalk.bold.underline(shortenPath(group.projectDir))}`);
      lastProject = group.projectDir;
    }

    // Agent sub-header
    console.log(
      `  ${chalk.bold(group.agentLabel)}` +
      `  ${chalk.dim('·')}  ${chalk.dim(shortenPath(group.configPath))}`
    );
    console.log(`  ${chalk.dim('─'.repeat(62))}`);
    console.log();

    for (const f of group.findings) {
      renderFinding(f, findingIndex++);
    }
  }

  _renderFooter(summary, options);
};

const _renderFooter = (summary: ScanSummary, options: { quiet?: boolean } = {}) => {
  const { stats } = summary;
  const high   = summary.highCount   > 0 ? chalk.red.bold(`${summary.highCount} high`)     : chalk.dim(`${summary.highCount} high`);
  const medium = summary.mediumCount > 0 ? chalk.yellow(`${summary.mediumCount} medium`)  : chalk.dim(`${summary.mediumCount} medium`);
  const low    = summary.lowCount    > 0 ? chalk.blue(`${summary.lowCount} low`)           : chalk.dim(`${summary.lowCount} low`);

  const duration = stats.durationMs < 1000
    ? chalk.dim(`${stats.durationMs}ms`)
    : chalk.dim(`${(stats.durationMs / 1000).toFixed(1)}s`);

  const projectsInfo = stats.projectsScanned > 1
    ? chalk.dim(`${stats.projectsScanned} projects`)
    : chalk.dim(`${summary.agentsDetected.length} agent${summary.agentsDetected.length !== 1 ? 's' : ''} detected`);

  console.log(`  ${high}  ${chalk.dim('·')}  ${medium}  ${chalk.dim('·')}  ${low}    ${duration}  ${chalk.dim('·')}  ${projectsInfo}`);

  if (summary.highCount > 0 || summary.mediumCount > 0) {
    console.log();
    console.log(`  ${chalk.dim('run')}  ${chalk.cyan('baymax explain <id>')}  ${chalk.dim('for full detail and remediation')}`);
  }

  console.log();
};
