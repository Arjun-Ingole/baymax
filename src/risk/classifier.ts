import type { NormalizedPermission, RiskLevel } from '../types.js';
import { RULES } from './rules.js';

export interface ClassifiedFinding {
  riskLevel: RiskLevel;
  score: number;
  title: string;
  summary: string;       // tight one-liner for terminal
  description: string;   // full prose for JSON / Markdown
  remediation: string;
}

const SENSITIVE_PATH_PATTERNS = [
  '.ssh', '.aws', '.gnupg', '.gpg', 'keychain', 'Keychain',
  '.env', '.npmrc', '.pypirc', '.netrc', '.git-credentials',
  'credentials', 'secrets', 'private_key', '.kube',
];

export const isSensitivePath = (p: string): boolean =>
  SENSITIVE_PATH_PATTERNS.some(pattern => p.includes(pattern));

// Commands that warrant medium risk even when restricted to a specific pattern.
// Anything NOT in this set gets downgraded to low — it's either a known-safe
// utility or a specific tool the user deliberately vetted.
const MEDIUM_RISK_SHELL_COMMANDS = new Set([
  'node', 'python', 'python3', 'ruby', 'perl', 'bun', 'deno', 'tsx', 'ts-node',
  'npm', 'yarn', 'pnpm', 'npx',
  'git', 'git add', 'git commit', 'git push',
  'find', 'grep', 'rg', 'ag',
  'curl', 'wget',
  'cat', 'head', 'tail', 'less', 'more',
  'env', 'printenv',
  'aws', 'gcloud', 'kubectl', 'docker',
  'rm', 'mv', 'cp',
  'ssh', 'scp', 'rsync',
  'sh', 'bash', 'zsh', 'eval', 'sudo',
  'make',
]);

// Extract the base command (possibly two-word, e.g. "git add") from a Bash pattern
const extractShellCommand = (pattern: string): string => {
  const inner = pattern.replace(/^(?:Bash|Shell)\(/, '').replace(/\)$/, '');
  const base = inner.split(/[:*]/)[0].trim();
  const words = base.split(/\s+/);
  if (words.length >= 2) {
    const twoWord = `${words[0]} ${words[1]}`;
    if (MEDIUM_RISK_SHELL_COMMANDS.has(twoWord)) return twoWord;
  }
  return words[0] ?? base;
};

export const classifyFinding = (
  permission: NormalizedPermission,
  ruleId: string,
): ClassifiedFinding => {
  const rule = RULES[ruleId];

  if (!rule) {
    return {
      riskLevel: 'info',
      score: 1,
      title: 'Unknown permission',
      summary: `Unrecognized permission at key: ${permission.rawKey}`,
      description: `Unrecognized permission at key: ${permission.rawKey}`,
      remediation: 'Review this configuration key manually.',
    };
  }

  let riskLevel: RiskLevel = rule.defaultRiskLevel;
  let score = rule.baseScore;

  // Elevate medium → high when persistence=always AND scope=global
  if (permission.persistence === 'always' && permission.scope === 'global') {
    if (riskLevel === 'medium') {
      riskLevel = 'high';
      score = Math.min(10, score + 2);
    }
  }

  // Downgrade high → medium for session-only
  if (permission.persistence === 'session' && riskLevel === 'high') {
    riskLevel = 'medium';
    score = Math.max(1, score - 2);
  }

  // Downgrade for repo-scoped constraints
  if (permission.scope === 'repo' && riskLevel === 'medium') {
    score = Math.max(1, score - 1);
  }

  // For restricted shell patterns, only keep medium if the command is known-risky.
  // Unknown / specific tools (sqlite3, xxd, npx standard, etc.) → low.
  if (ruleId === 'SHELL_RESTRICTED_ALWAYS' && riskLevel === 'medium') {
    const pattern = permission.constraints[0] ?? (typeof permission.rawValue === 'string' ? permission.rawValue : '');
    const cmd = extractShellCommand(pattern);
    if (!MEDIUM_RISK_SHELL_COMMANDS.has(cmd.toLowerCase())) {
      riskLevel = 'low';
      score = Math.max(1, score - 3);
    }
    // node --check only does syntax validation, not execution
    const inner = pattern.replace(/^(?:Bash|Shell)\(/, '').split(/[:*]/)[0].trim();
    if (cmd === 'node' && inner.includes('--check')) {
      riskLevel = 'low';
      score = Math.max(1, score - 3);
    }
  }

  return {
    riskLevel,
    score,
    title: rule.title,
    summary: rule.summary,
    description: rule.description,
    remediation: rule.remediation,
  };
};
