import type { RiskLevel } from '../types.js';

export interface RuleDefinition {
  id: string;
  defaultRiskLevel: RiskLevel;
  baseScore: number;   // 1–10
  title: string;
  description: string;
  remediation: string;
}

export const RULES: Record<string, RuleDefinition> = {
  SHELL_UNRESTRICTED_ALWAYS: {
    id: 'SHELL_UNRESTRICTED_ALWAYS',
    defaultRiskLevel: 'high',
    baseScore: 9,
    title: 'Unrestricted shell execution always allowed',
    description:
      'The agent can run any shell command without restriction or confirmation. ' +
      'This includes commands that delete files, exfiltrate data, or modify system state.',
    remediation:
      'Remove "Bash" or "Bash(*)" from allowedTools. Use scoped patterns like ' +
      '"Bash(npm run *)" to allow only specific commands.',
  },
  SHELL_RESTRICTED_ALWAYS: {
    id: 'SHELL_RESTRICTED_ALWAYS',
    defaultRiskLevel: 'medium',
    baseScore: 5,
    title: 'Restricted shell execution always allowed',
    description:
      'The agent can always run shell commands matching a specific pattern without confirmation. ' +
      'Depending on the pattern, this may still be exploitable.',
    remediation:
      'Review the command pattern for over-breadth. Prefer allowing specific commands ' +
      'rather than wildcard patterns.',
  },
  TOOL_ALWAYS_ALLOWED: {
    id: 'TOOL_ALWAYS_ALLOWED',
    defaultRiskLevel: 'low',
    baseScore: 2,
    title: 'Tool permanently allowed',
    description:
      'A built-in tool has been granted permanent allow status, bypassing per-session confirmation.',
    remediation:
      'Consider whether this tool needs permanent trust. Remove from allowedTools ' +
      'to restore per-session confirmation.',
  },
  MCP_SERVER_REGISTERED: {
    id: 'MCP_SERVER_REGISTERED',
    defaultRiskLevel: 'medium',
    baseScore: 5,
    title: 'MCP server registered',
    description:
      'An MCP server is registered in the agent config. MCP servers can expose ' +
      'combined capabilities: filesystem access, shell execution, and network access. ' +
      'Each server expands the agent\'s attack surface.',
    remediation:
      'Audit each registered MCP server. Remove any you do not actively use. ' +
      'Check what tools each server exposes before trusting it.',
  },
  FS_WRITE_GLOBAL: {
    id: 'FS_WRITE_GLOBAL',
    defaultRiskLevel: 'high',
    baseScore: 8,
    title: 'Global filesystem write access always allowed',
    description:
      'The agent has unrestricted write access to the filesystem with no path constraints. ' +
      'It can overwrite any file your user account can access.',
    remediation: 'Scope filesystem write permissions to the project directory only.',
  },
  FS_WRITE_REPO: {
    id: 'FS_WRITE_REPO',
    defaultRiskLevel: 'low',
    baseScore: 2,
    title: 'Repository filesystem write access always allowed',
    description: 'The agent has write access scoped to the current repository.',
    remediation:
      'Verify this is intentional. Consider whether write access should require per-session confirmation.',
  },
  NETWORK_UNRESTRICTED: {
    id: 'NETWORK_UNRESTRICTED',
    defaultRiskLevel: 'high',
    baseScore: 8,
    title: 'Unrestricted network access always allowed',
    description:
      'The agent can make outbound network requests to any destination without prompting. ' +
      'This enables silent data exfiltration.',
    remediation:
      'Restrict network access to specific domains or disable it entirely if not needed.',
  },
  TRUSTED_DIR_GLOBAL: {
    id: 'TRUSTED_DIR_GLOBAL',
    defaultRiskLevel: 'medium',
    baseScore: 6,
    title: 'Broad directory permanently trusted',
    description:
      'A broad directory (home folder or filesystem root) has been marked as permanently trusted. ' +
      'The agent operates within this entire path without further confirmation.',
    remediation:
      'Remove home directory or root-level paths from trusted directories. ' +
      'Trust only specific project directories.',
  },
  SENSITIVE_PATH_TRUSTED: {
    id: 'SENSITIVE_PATH_TRUSTED',
    defaultRiskLevel: 'high',
    baseScore: 9,
    title: 'Sensitive path permanently trusted',
    description:
      'A path containing secrets or credentials (SSH keys, AWS config, .env files, keychains) ' +
      'has been granted permanent trust. The agent can read and potentially exfiltrate credentials.',
    remediation:
      'Remove sensitive paths from trusted directories immediately. ' +
      'Never grant agent access to credential stores or secret files.',
  },
  SKIP_ALL_CONFIRMATIONS: {
    id: 'SKIP_ALL_CONFIRMATIONS',
    defaultRiskLevel: 'high',
    baseScore: 8,
    title: 'All confirmation prompts bypassed',
    description:
      'The agent is configured to skip all confirmation prompts. ' +
      'This is equivalent to "always allow" for every action the agent takes.',
    remediation:
      'Remove the blanket skip-confirmation setting. Allow the agent to prompt for ' +
      'destructive or irreversible operations.',
  },
  SANDBOX_DISABLED: {
    id: 'SANDBOX_DISABLED',
    defaultRiskLevel: 'high',
    baseScore: 8,
    title: 'Sandboxing explicitly disabled',
    description:
      "The agent's sandbox protection has been explicitly turned off. " +
      'The agent runs with the full permissions of your user account, with no isolation.',
    remediation: 'Re-enable sandboxing unless you have a specific technical reason to disable it.',
  },
  AUTO_COMMITS_ENABLED: {
    id: 'AUTO_COMMITS_ENABLED',
    defaultRiskLevel: 'medium',
    baseScore: 4,
    title: 'Automatic git commits enabled',
    description:
      'The agent commits changes to git without prompting for review. ' +
      'Mistakes or unintended changes become part of repository history.',
    remediation:
      'Disable auto-commits and review agent-generated changes before committing.',
  },
  APPROVAL_POLICY_AUTO: {
    id: 'APPROVAL_POLICY_AUTO',
    defaultRiskLevel: 'high',
    baseScore: 9,
    title: 'Approval policy set to auto',
    description:
      'The agent approval policy is set to automatically approve all actions without user confirmation. ' +
      'Every file write, shell command, and network request proceeds without review.',
    remediation: 'Change approval_policy to "suggest" or "manual" to restore human oversight.',
  },
  SECRETS_IN_MCP_ENV: {
    id: 'SECRETS_IN_MCP_ENV',
    defaultRiskLevel: 'high',
    baseScore: 7,
    title: 'Credentials exposed in MCP server config',
    description:
      'An MCP server configuration contains what appear to be API keys, tokens, or passwords ' +
      'in its environment variables. These credentials are stored in plaintext in the config file.',
    remediation:
      'Move credentials to a secrets manager or environment variables sourced at runtime. ' +
      'Remove hardcoded secrets from config files.',
  },
};
