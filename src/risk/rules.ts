import type { RiskLevel } from '../types.js';

export interface RuleDefinition {
  id: string;
  defaultRiskLevel: RiskLevel;
  baseScore: number;
  title: string;
  summary: string;       // one tight line for terminal output
  description: string;   // full prose for JSON / Markdown
  remediation: string;
}

export const RULES: Record<string, RuleDefinition> = {
  SHELL_UNRESTRICTED_ALWAYS: {
    id: 'SHELL_UNRESTRICTED_ALWAYS',
    defaultRiskLevel: 'high',
    baseScore: 9,
    title: 'Unrestricted shell execution always allowed',
    summary: 'Any command can run without confirmation — delete, exfiltrate, anything.',
    description:
      'The agent can run any shell command without restriction or confirmation. ' +
      'This includes commands that delete files, exfiltrate data, or modify system state.',
    remediation:
      'Remove "Bash" or "Bash(*)" from allowedTools. Use scoped patterns like "Bash(npm run *)" instead.',
  },
  SHELL_RESTRICTED_ALWAYS: {
    id: 'SHELL_RESTRICTED_ALWAYS',
    defaultRiskLevel: 'medium',
    baseScore: 5,
    title: 'Restricted shell execution always allowed',
    summary: 'Commands matching this pattern run without confirmation every time.',
    description:
      'The agent can always run shell commands matching a specific pattern without confirmation. ' +
      'Depending on the pattern, this may still be exploitable.',
    remediation:
      'Review the pattern for over-breadth. Remove if rarely needed — confirm per-session instead.',
  },
  TOOL_ALWAYS_ALLOWED: {
    id: 'TOOL_ALWAYS_ALLOWED',
    defaultRiskLevel: 'low',
    baseScore: 2,
    title: 'Tool permanently allowed',
    summary: 'This tool bypasses per-session confirmation permanently.',
    description:
      'A built-in tool has been granted permanent allow status, bypassing per-session confirmation.',
    remediation:
      'Remove from allowedTools to restore per-session confirmation.',
  },
  MCP_SERVER_REGISTERED: {
    id: 'MCP_SERVER_REGISTERED',
    defaultRiskLevel: 'medium',
    baseScore: 5,
    title: 'MCP server registered',
    summary: 'MCP servers can expose filesystem, shell, and network access combined.',
    description:
      'An MCP server is registered in the agent config. MCP servers can expose ' +
      'combined capabilities: filesystem access, shell execution, and network access.',
    remediation:
      'Audit registered MCP servers. Remove any you don\'t actively use.',
  },
  FS_WRITE_GLOBAL: {
    id: 'FS_WRITE_GLOBAL',
    defaultRiskLevel: 'high',
    baseScore: 8,
    title: 'Global filesystem write access always allowed',
    summary: 'Agent can overwrite any file your account can access, without asking.',
    description:
      'The agent has unrestricted write access to the filesystem with no path constraints.',
    remediation: 'Scope filesystem write permissions to the project directory only.',
  },
  FS_WRITE_REPO: {
    id: 'FS_WRITE_REPO',
    defaultRiskLevel: 'low',
    baseScore: 2,
    title: 'Repository filesystem write access always allowed',
    summary: 'Write access is scoped to this repo — generally acceptable.',
    description: 'The agent has write access scoped to the current repository.',
    remediation:
      'Verify this is intentional. Remove if write access should require confirmation.',
  },
  NETWORK_UNRESTRICTED: {
    id: 'NETWORK_UNRESTRICTED',
    defaultRiskLevel: 'high',
    baseScore: 8,
    title: 'Unrestricted network access always allowed',
    summary: 'Agent can make outbound requests anywhere — enables silent exfiltration.',
    description:
      'The agent can make outbound network requests to any destination without prompting.',
    remediation:
      'Restrict to specific domains or disable entirely if network access isn\'t needed.',
  },
  TRUSTED_DIR_GLOBAL: {
    id: 'TRUSTED_DIR_GLOBAL',
    defaultRiskLevel: 'medium',
    baseScore: 6,
    title: 'Broad directory permanently trusted',
    summary: 'Agent operates across your entire home folder without further confirmation.',
    description:
      'A broad directory (home folder or filesystem root) has been marked as permanently trusted.',
    remediation:
      'Replace with specific project paths. Never trust your home or root directory.',
  },
  SENSITIVE_PATH_TRUSTED: {
    id: 'SENSITIVE_PATH_TRUSTED',
    defaultRiskLevel: 'high',
    baseScore: 9,
    title: 'Sensitive path permanently trusted',
    summary: 'Agent has permanent access to credentials — SSH keys, AWS config, .env, etc.',
    description:
      'A path containing secrets or credentials has been granted permanent trust. ' +
      'The agent can read and potentially exfiltrate those credentials.',
    remediation:
      'Remove this path from trusted directories immediately. Never grant agent access to credential stores.',
  },
  SKIP_ALL_CONFIRMATIONS: {
    id: 'SKIP_ALL_CONFIRMATIONS',
    defaultRiskLevel: 'high',
    baseScore: 8,
    title: 'All confirmation prompts bypassed',
    summary: 'Every agent action proceeds without asking — equivalent to always-allow for everything.',
    description:
      'The agent is configured to skip all confirmation prompts. ' +
      'This is equivalent to "always allow" for every action the agent takes.',
    remediation:
      'Remove the --yes / skip-confirmation setting. Let the agent prompt for destructive actions.',
  },
  SANDBOX_DISABLED: {
    id: 'SANDBOX_DISABLED',
    defaultRiskLevel: 'high',
    baseScore: 8,
    title: 'Sandboxing explicitly disabled',
    summary: 'Agent runs with full user-account permissions and no isolation.',
    description:
      "The agent's sandbox protection has been explicitly turned off. " +
      'The agent runs with the full permissions of your user account.',
    remediation: 'Re-enable sandboxing. Only disable if you have a specific technical reason.',
  },
  AUTO_COMMITS_ENABLED: {
    id: 'AUTO_COMMITS_ENABLED',
    defaultRiskLevel: 'medium',
    baseScore: 4,
    title: 'Automatic git commits enabled',
    summary: 'Agent commits to git without review — mistakes land in history silently.',
    description:
      'The agent commits changes to git without prompting for review.',
    remediation:
      'Set auto-commits: false and review agent changes before committing.',
  },
  APPROVAL_POLICY_AUTO: {
    id: 'APPROVAL_POLICY_AUTO',
    defaultRiskLevel: 'high',
    baseScore: 9,
    title: 'Approval policy set to auto',
    summary: 'All actions — writes, shell commands, network — auto-approved with no review.',
    description:
      'The agent approval policy is set to automatically approve all actions without user confirmation.',
    remediation: 'Change approval_policy to "suggest" or "manual" to restore human oversight.',
  },
  SECRETS_IN_MCP_ENV: {
    id: 'SECRETS_IN_MCP_ENV',
    defaultRiskLevel: 'high',
    baseScore: 7,
    title: 'Credentials hardcoded in MCP server config',
    summary: 'API keys or tokens stored in plaintext inside the config file.',
    description:
      'An MCP server configuration contains API keys, tokens, or passwords in its env block, stored in plaintext.',
    remediation:
      'Move credentials to a secrets manager or runtime env vars. Remove hardcoded values from the config.',
  },
};
