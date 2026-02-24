import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { z } from 'zod';
import { defineAdapter } from './base.js';
import { safeReadJson } from '../utils/file-reader.js';
import { classifyFinding, isSensitivePath } from '../risk/classifier.js';
import { makeFindingId } from '../utils/finding-id.js';
import type { Finding, NormalizedPermission } from '../types.js';

const ClaudeSettingsSchema = z.object({
  allowedTools: z.array(z.string()).optional(),
  permissions: z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  }).optional(),
  mcpServers: z.record(z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  })).optional(),
}).passthrough();

const AGENT_ID = 'claude-code' as const;
const AGENT_LABEL = 'Claude Code';

const SECRET_PATTERN = /(?:key|token|secret|password|passwd|credential|api[_-]?key|auth)/i;

const getConfigPaths = (projectDir: string) => [
  path.join(os.homedir(), '.claude', 'settings.json'),
  path.join(projectDir, '.claude', 'settings.json'),
  path.join(projectDir, '.claude', 'settings.local.json'),
];

const extractFindings = (settings: z.infer<typeof ClaudeSettingsSchema>, configPath: string, projectDir: string): Finding[] => {
  const findings: Finding[] = [];

  // allowedTools array
  for (const tool of settings.allowedTools ?? []) {
    const isBashUnrestricted = tool === 'Bash' || tool === 'Bash(*)';
    const isBashRestricted = tool.startsWith('Bash(') && !isBashUnrestricted;

    const ruleId = isBashUnrestricted
      ? 'SHELL_UNRESTRICTED_ALWAYS'
      : isBashRestricted
        ? 'SHELL_RESTRICTED_ALWAYS'
        : 'TOOL_ALWAYS_ALLOWED';

    const permission: NormalizedPermission = {
      capability: isBashUnrestricted || isBashRestricted ? 'shell' : 'unknown',
      scope: isBashUnrestricted ? 'global' : 'repo',
      persistence: 'always',
      constraints: isBashUnrestricted ? [] : [tool],
      rawKey: 'allowedTools',
      rawValue: tool,
    };

    const classified = classifyFinding(permission, ruleId);
    findings.push({
      id: makeFindingId(AGENT_ID, 'allowedtools', tool),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId,
    });
  }

  // permissions.allow array (separate from allowedTools)
  for (const entry of settings.permissions?.allow ?? []) {
    // skip if already caught by allowedTools
    const isBashUnrestricted = entry === 'Bash' || entry === 'Bash(*)';
    const isBashRestricted = entry.startsWith('Bash(') && !isBashUnrestricted;

    const ruleId = isBashUnrestricted
      ? 'SHELL_UNRESTRICTED_ALWAYS'
      : isBashRestricted
        ? 'SHELL_RESTRICTED_ALWAYS'
        : 'TOOL_ALWAYS_ALLOWED';

    const permission: NormalizedPermission = {
      capability: isBashUnrestricted || isBashRestricted ? 'shell' : 'unknown',
      scope: isBashUnrestricted ? 'global' : 'repo',
      persistence: 'always',
      constraints: [entry],
      rawKey: 'permissions.allow',
      rawValue: entry,
    };

    const classified = classifyFinding(permission, ruleId);
    findings.push({
      id: makeFindingId(AGENT_ID, 'permissions.allow', entry),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId,
    });
  }

  // MCP servers
  for (const [serverName, serverConfig] of Object.entries(settings.mcpServers ?? {})) {
    const permission: NormalizedPermission = {
      capability: 'mcp',
      scope: 'global',
      persistence: 'always',
      constraints: [serverConfig.command, ...(serverConfig.args ?? [])],
      rawKey: `mcpServers.${serverName}`,
      rawValue: serverConfig,
    };

    const classified = classifyFinding(permission, 'MCP_SERVER_REGISTERED');
    findings.push({
      id: makeFindingId(AGENT_ID, 'mcpservers', serverName),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId: 'MCP_SERVER_REGISTERED',
    });

    // Check for hardcoded secrets in MCP env
    for (const [envKey, envVal] of Object.entries(serverConfig.env ?? {})) {
      if (SECRET_PATTERN.test(envKey) && envVal.length > 8) {
        const secretPermission: NormalizedPermission = {
          capability: 'secrets',
          scope: 'global',
          persistence: 'always',
          constraints: [envKey],
          rawKey: `mcpServers.${serverName}.env.${envKey}`,
          rawValue: '[redacted]',
        };
        const secretClassified = classifyFinding(secretPermission, 'SECRETS_IN_MCP_ENV');
        findings.push({
          id: makeFindingId(AGENT_ID, 'mcpservers', serverName, 'env', envKey),
          agentId: AGENT_ID,
          agentLabel: AGENT_LABEL,
          configPath,
          projectDir,
          permission: secretPermission,
          ...secretClassified,
          ruleId: 'SECRETS_IN_MCP_ENV',
        });
      }
    }
  }

  return findings;
};

export const claudeCodeAdapter = defineAdapter({
  agentId: AGENT_ID,
  agentLabel: AGENT_LABEL,

  detect(projectDir) {
    return getConfigPaths(projectDir).some(p => {
      try { return fs.existsSync(p); } catch { return false; }
    });
  },

  async scan(projectDir) {
    const findings: Finding[] = [];
    for (const configPath of getConfigPaths(projectDir)) {
      const raw = safeReadJson(configPath);
      if (!raw) continue;
      const parsed = ClaudeSettingsSchema.safeParse(raw);
      if (!parsed.success) continue;
      findings.push(...extractFindings(parsed.data, configPath, projectDir));
    }
    return findings;
  },
});
