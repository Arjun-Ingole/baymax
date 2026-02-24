import type { RiskLevel } from '../types.js';

export interface RuleDefinition {
  id: string;
  defaultRiskLevel: RiskLevel;
  title: string;
  description: string;
  remediation: string;
}

export const RULES: Record<string, RuleDefinition> = {
  SHELL_UNRESTRICTED_ALWAYS: {
    id: 'SHELL_UNRESTRICTED_ALWAYS',
    defaultRiskLevel: 'high',
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
    title: 'Restricted shell execution always allowed',
    description:
      'The agent can always run shell commands matching a specific pattern without confirmation.',
    remediation:
      'Review the command pattern for over-breadth. Prefer allowing specific commands ' +
      'rather than wildcard patterns.',
  },
  TOOL_ALWAYS_ALLOWED: {
    id: 'TOOL_ALWAYS_ALLOWED',
    defaultRiskLevel: 'low',
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
    title: 'MCP server registered',
    description:
      'An MCP server is registered in the agent config. MCP servers can expose ' +
      'combined capabilities: filesystem access, shell execution, and network access.',
    remediation:
      'Audit each registered MCP server. Remove any you do not actively use. ' +
      'Check what tools each server exposes before trusting it.',
  },
  FS_WRITE_GLOBAL: {
    id: 'FS_WRITE_GLOBAL',
    defaultRiskLevel: 'high',
    title: 'Global filesystem write access always allowed',
    description:
      'The agent has unrestricted write access to the filesystem with no path constraints.',
    remediation: 'Scope filesystem write permissions to the project directory only.',
  },
  FS_WRITE_REPO: {
    id: 'FS_WRITE_REPO',
    defaultRiskLevel: 'low',
    title: 'Repository filesystem write access always allowed',
    description: 'The agent has write access scoped to the current repository.',
    remediation:
      'Verify this is intentional. Consider whether write access should require per-session confirmation.',
  },
  NETWORK_UNRESTRICTED: {
    id: 'NETWORK_UNRESTRICTED',
    defaultRiskLevel: 'high',
    title: 'Unrestricted network access always allowed',
    description:
      'The agent can make outbound network requests to any destination. ' +
      'This enables silent data exfiltration.',
    remediation:
      'Restrict network access to specific domains or disable it entirely if not needed.',
  },
  TRUSTED_DIR_GLOBAL: {
    id: 'TRUSTED_DIR_GLOBAL',
    defaultRiskLevel: 'medium',
    title: 'Global directory permanently trusted',
    description:
      'A broad or sensitive directory path has been marked as permanently trusted.',
    remediation:
      'Remove home directory or root-level paths from trusted directories. ' +
      'Trust only specific project directories.',
  },
  SKIP_ALL_CONFIRMATIONS: {
    id: 'SKIP_ALL_CONFIRMATIONS',
    defaultRiskLevel: 'high',
    title: 'All confirmation prompts bypassed',
    description:
      'The agent is configured to skip all confirmation prompts. ' +
      'This is equivalent to "always allow" for every action.',
    remediation:
      'Remove the blanket skip-confirmation setting. Allow the agent to prompt for ' +
      'destructive or irreversible operations.',
  },
  SANDBOX_DISABLED: {
    id: 'SANDBOX_DISABLED',
    defaultRiskLevel: 'high',
    title: 'Sandboxing explicitly disabled',
    description:
      "The agent's sandbox protection has been explicitly turned off. " +
      'The agent runs with the full permissions of your user account.',
    remediation: "Re-enable sandboxing unless you have a specific technical reason to disable it.",
  },
  AUTO_COMMITS_ENABLED: {
    id: 'AUTO_COMMITS_ENABLED',
    defaultRiskLevel: 'medium',
    title: 'Automatic git commits enabled',
    description:
      'The agent is configured to commit changes to git without prompting.',
    remediation:
      'Disable auto-commits and review agent-generated changes before committing.',
  },
  APPROVAL_POLICY_AUTO: {
    id: 'APPROVAL_POLICY_AUTO',
    defaultRiskLevel: 'high',
    title: 'Approval policy set to auto',
    description:
      'The agent approval policy is set to automatically approve all actions without user confirmation.',
    remediation: 'Change approval_policy to "suggest" or "manual" to restore human oversight.',
  },
};
