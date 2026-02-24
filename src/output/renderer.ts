import chalk from 'chalk';
import os from 'node:os';
import type { ScanSummary, Finding, RiskLevel } from '../types.js';

// ── Spinner ───────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private frame = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private message: string) {}

  start() {
    process.stdout.write('\x1B[?25l');
    this.interval = setInterval(() => {
      process.stdout.write(`\r  ${chalk.cyan(SPINNER_FRAMES[this.frame])}  ${chalk.dim(this.message)}`);
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
    }, 80);
    return this;
  }

  stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    process.stdout.write('\r\x1B[2K');
    process.stdout.write('\x1B[?25h');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const home = os.homedir();
const shorten = (p: string) => p.replace(home, '~');

const BADGE: Record<RiskLevel, string> = {
  high:   chalk.red.bold('HIGH'),
  medium: chalk.yellow('MED '),
  low:    chalk.dim('LOW '),
  info:   chalk.dim('INFO'),
};

// Pull specific context from the finding to append to the title
// e.g. "MCP server registered" → "MCP server: filesystem-mcp"
const contextualTitle = (f: Finding): string => {
  const val = typeof f.permission.rawValue === 'string' ? f.permission.rawValue : null;
  const key = f.permission.rawKey;

  if (f.ruleId === 'MCP_SERVER_REGISTERED') {
    const name = key.split('.').pop() ?? val ?? '';
    return `MCP server: ${name}`;
  }
  if (f.ruleId === 'SHELL_RESTRICTED_ALWAYS' && f.permission.constraints[0]) {
    return f.permission.constraints[0];
  }
  if (f.ruleId === 'TOOL_ALWAYS_ALLOWED' && val) {
    return `Permanently allowed: ${val}`;
  }
  if ((f.ruleId === 'TRUSTED_DIR_GLOBAL' || f.ruleId === 'SENSITIVE_PATH_TRUSTED') && val) {
    return `Trusted path: ${val}`;
  }
  if (f.ruleId === 'SECRETS_IN_MCP_ENV') {
    const envKey = key.split('.').pop() ?? '';
    return `Hardcoded secret: ${envKey}`;
  }
  return f.title;
};

const renderFinding = (f: Finding) => {
  const badge  = BADGE[f.riskLevel];
  const title  = chalk.white.bold(contextualTitle(f));
  const agent  = chalk.dim(`${f.agentLabel} · ${shorten(f.configPath)}`);
  const indent = '        ';

  console.log(`  ${badge}  ${title}`);
  console.log(`${indent}${chalk.dim(f.permission.rawKey)}  ${agent}`);
  console.log(`${indent}${chalk.dim(f.summary)}`);
  console.log(`${indent}${chalk.cyan('→')} ${f.remediation}`);
  console.log();
};

// ── Main export ───────────────────────────────────────────────────────────────

export const renderFindings = (summary: ScanSummary, options: { quiet?: boolean } = {}): void => {
  const { stats } = summary;

  console.log();

  // Nothing detected at all
  if (summary.agentsDetected.length === 0) {
    console.log(chalk.dim('  No supported AI agent configs detected.'));
    console.log();
    renderFooter(summary);
    return;
  }

  const visible = [...summary.findings]
    .filter(f => !options.quiet || f.riskLevel === 'high')
    .sort((a, b) => {
      const order: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, info: 3 };
      return order[a.riskLevel] - order[b.riskLevel] || b.score - a.score;
    });

  // All clear
  if (visible.length === 0) {
    const agentList = summary.agentsDetected.join(', ');
    console.log(`  ${chalk.green('✓')}  ${chalk.green.bold('All clear')}  ${chalk.dim(`— no risky permissions across ${agentList}`)}`);
    console.log();
    renderFooter(summary);
    return;
  }

  // Project header only when scanning multiple projects
  let lastProject = '';
  for (const f of visible) {
    if (stats.projectsScanned > 1 && f.projectDir !== lastProject) {
      console.log(`  ${chalk.bold.underline(shorten(f.projectDir))}`);
      console.log();
      lastProject = f.projectDir;
    }
    renderFinding(f);
  }

  renderFooter(summary);
};

const renderFooter = (summary: ScanSummary) => {
  const { stats } = summary;

  const high   = summary.highCount   > 0 ? chalk.red.bold(`${summary.highCount} high`)   : chalk.dim(`${summary.highCount} high`);
  const medium = summary.mediumCount > 0 ? chalk.yellow(`${summary.mediumCount} medium`) : chalk.dim(`${summary.mediumCount} medium`);
  const low    = summary.lowCount    > 0 ? chalk.dim(`${summary.lowCount} low`)           : chalk.dim(`${summary.lowCount} low`);
  const dur    = chalk.dim(stats.durationMs < 1000 ? `${stats.durationMs}ms` : `${(stats.durationMs / 1000).toFixed(1)}s`);
  const scope  = stats.projectsScanned > 1
    ? chalk.dim(`${stats.projectsScanned} projects`)
    : chalk.dim(`${summary.agentsDetected.length} agent${summary.agentsDetected.length !== 1 ? 's' : ''}`);

  console.log(`  ${high}  ${chalk.dim('·')}  ${medium}  ${chalk.dim('·')}  ${low}  ${chalk.dim('·')}  ${dur}  ${chalk.dim('·')}  ${scope}`);
  console.log();
};
