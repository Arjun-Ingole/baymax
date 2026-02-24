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

// ── Command risk explanations ─────────────────────────────────────────────────
// When an agent has permanent access to a shell command, explain what that
// specific command can do — not a generic "commands run without confirmation".

const COMMAND_RISKS: Record<string, string> = {
  'cat':       'reads any file — can expose .env files, SSH keys, tokens in your project',
  'head':      'reads the top of any file — config files often store secrets at the top',
  'tail':      'streams file contents — logs frequently contain API keys, passwords, request data',
  'less':      'reads any file interactively — can expose sensitive contents on demand',
  'more':      'reads any file — can expose sensitive contents',
  'grep':      'searches file contents — can locate and print secrets, keys, tokens',
  'rg':        'searches file contents — can locate and print secrets, keys, tokens',
  'ag':        'searches file contents — can locate and print secrets, keys, tokens',
  'find':      'traverses the filesystem — can locate sensitive files like .env and private keys',
  'node':      'executes JavaScript with full system access — equivalent to running arbitrary code',
  'python':    'executes Python with full system access',
  'python3':   'executes Python with full system access',
  'ruby':      'executes Ruby with full system access',
  'perl':      'executes Perl with full system access',
  'bun':       'executes JavaScript/TypeScript with full system access',
  'deno':      'executes JavaScript/TypeScript with full system access',
  'tsx':       'executes TypeScript with full system access',
  'ts-node':   'executes TypeScript with full system access',
  'curl':      'makes outbound HTTP requests — can silently exfiltrate data',
  'wget':      'downloads files over the network — can exfiltrate data',
  'npm':       'runs package scripts — postinstall hooks and scripts execute arbitrary code',
  'yarn':      'runs package scripts — hooks and scripts execute arbitrary code',
  'pnpm':      'runs package scripts — hooks and scripts execute arbitrary code',
  'git':       'can read history, credentials, config — and push changes to remotes',
  'git add':   'stages files for commit — can include .env or secrets before anyone reviews',
  'git commit':'commits without review — agent mistakes become permanent in history',
  'git push':  'pushes to remote branches — no review gate before changes are published',
  'rm':        'deletes files permanently — one wrong pattern removes production config',
  'mv':        'moves or renames files — can overwrite or displace important files',
  'cp':        'copies files — can duplicate sensitive files to accessible locations',
  'env':       'prints environment variables — API keys, tokens, passwords are often stored here',
  'printenv':  'prints environment variables — API keys, tokens, passwords are often stored here',
  'export':    'sets environment variables — can inject values seen by subsequent commands',
  'ssh':       'opens remote shell connections — broad access to other systems',
  'scp':       'copies files to/from remote systems — can exfiltrate any accessible file',
  'rsync':     'syncs files to/from remote — can exfiltrate entire directories silently',
  'aws':       'runs AWS CLI — can access S3, secrets manager, IAM, and cloud credentials',
  'gcloud':    'runs Google Cloud CLI — can access cloud resources and service accounts',
  'kubectl':   'controls Kubernetes clusters — can read secrets and exec into pods',
  'docker':    'manages containers — can mount host filesystem and escalate privileges',
  'make':      'runs Makefile targets — targets can contain arbitrary shell commands',
  'sh':        'spawns a shell — can run any command, defeating the restriction entirely',
  'bash':      'spawns bash — can run any command, defeating the restriction entirely',
  'zsh':       'spawns zsh — can run any command, defeating the restriction entirely',
  'eval':      'evaluates a string as code — defeats any command-level restriction',
  'sudo':      'runs commands as root — full system access with elevated privileges',
  'chmod':     'changes file permissions — can expose or lock down critical files',
  'chown':     'changes file ownership — can transfer control of sensitive files',
  'ls':        'lists directory contents — reveals project structure, low direct risk',
  'pwd':       'prints working directory — informational only, very low risk',
  'echo':      'prints text — low risk unless used with output redirection to overwrite files',
  'mkdir':     'creates directories — low risk',
  'touch':     'creates empty files — low risk',
};

// Extract the base command from a Bash pattern like "Bash(cat:*)" or "Bash(git add:*)"
const extractBaseCommand = (pattern: string): string => {
  const inner = pattern.replace(/^(?:Bash|Shell)\(/, '').replace(/\)$/, '');
  const base = inner.split(/[:*]/)[0].trim();
  const words = base.split(/\s+/);
  // Try two-word command first (e.g. "git add")
  if (words.length >= 2 && COMMAND_RISKS[`${words[0]} ${words[1]}`]) {
    return `${words[0]} ${words[1]}`;
  }
  return words[0] ?? base;
};

// Returns a specific explanation for the command, or falls back to the rule summary
const commandExplanation = (f: Finding): string => {
  if (f.ruleId === 'SHELL_RESTRICTED_ALWAYS' || f.ruleId === 'SHELL_UNRESTRICTED_ALWAYS') {
    const raw = typeof f.permission.rawValue === 'string' ? f.permission.rawValue : '';
    const pattern = f.permission.constraints[0] ?? raw;
    const cmd = extractBaseCommand(pattern || raw);
    const risk = COMMAND_RISKS[cmd.toLowerCase()];
    if (risk) return `${chalk.white(cmd)} — ${risk}`;
  }
  if (f.ruleId === 'TOOL_ALWAYS_ALLOWED') {
    const val = typeof f.permission.rawValue === 'string' ? f.permission.rawValue : '';
    const cmd = extractBaseCommand(val);
    const risk = COMMAND_RISKS[cmd.toLowerCase()];
    if (risk) return `${chalk.white(cmd)} — ${risk}`;
  }
  return f.summary;
};

// ── Safety score ──────────────────────────────────────────────────────────────

export const calcSafetyScore = (summary: ScanSummary): number =>
  Math.max(0, 100 - summary.highCount * 30 - summary.mediumCount * 10 - summary.lowCount * 3);

const renderScoreBar = (score: number): string => {
  const BAR_WIDTH = 20;
  const filled = Math.round((score / 100) * BAR_WIDTH);
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
  const colorFn = score >= 90 ? chalk.green : score >= 30 ? chalk.yellow : chalk.red;
  return `${colorFn(bar)}  ${colorFn.bold(`${score}/100`)}`;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const home = os.homedir();
const shorten = (p: string) => p.replace(home, '~');

const BADGE: Record<RiskLevel, string> = {
  high:   chalk.red.bold('HIGH'),
  medium: chalk.yellow('MED '),
  low:    chalk.dim('LOW '),
  info:   chalk.dim('INFO'),
};

// Contextual title: use the specific value/command rather than the generic rule title
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
    return `Hardcoded secret: ${key.split('.').pop() ?? ''}`;
  }
  return f.title;
};

const renderFinding = (f: Finding) => {
  const indent = '        ';
  console.log(`  ${BADGE[f.riskLevel]}  ${chalk.white.bold(contextualTitle(f))}`);
  console.log(`${indent}${chalk.dim(f.permission.rawKey)}  ${chalk.dim(`${f.agentLabel} · ${shorten(f.configPath)}`)}`);
  console.log(`${indent}${chalk.dim(commandExplanation(f))}`);
  console.log(`${indent}${chalk.cyan('→')} ${f.remediation}`);
  console.log();
};

// ── Main export ───────────────────────────────────────────────────────────────

export const renderFindings = (summary: ScanSummary, options: { quiet?: boolean } = {}): void => {
  const { stats } = summary;
  const score = calcSafetyScore(summary);

  console.log();

  // Nothing detected at all
  if (summary.agentsDetected.length === 0) {
    console.log(chalk.dim('  No supported AI agent configs detected.'));
    console.log();
    renderFooter(summary, score);
    return;
  }

  const visible = [...summary.findings]
    .filter(f => !options.quiet || f.riskLevel === 'high')
    .sort((a, b) => {
      const order: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, info: 3 };
      return order[a.riskLevel] - order[b.riskLevel] || b.score - a.score;
    });

  // Safety score header
  console.log(`  ${chalk.bold('Safety score')}  ${renderScoreBar(score)}`);
  console.log();

  // All clear
  if (visible.length === 0) {
    console.log(`  ${chalk.green('✓')}  ${chalk.green.bold('All clear')}  ${chalk.dim(`— no risky permissions across ${summary.agentsDetected.join(', ')}`)}`);
    console.log();
    renderFooter(summary, score);
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

  renderFooter(summary, score);
};

const renderFooter = (summary: ScanSummary, _score: number) => {
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
