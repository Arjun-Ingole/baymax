import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { z } from 'zod';
import { defineAdapter } from './base.js';
import { safeReadJson } from '../utils/file-reader.js';
import { classifyFinding } from '../risk/classifier.js';
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

const getConfigPaths = (projectDir: string) => [
  path.join(os.homedir(), '.claude', 'settings.json'),
  path.join(projectDir, '.claude', 'settings.json'),
  path.join(projectDir, '.claude', 'settings.local.json'),
];

const extractFindings = (settings: z.infer<typeof ClaudeSettingsSchema>, configPath: string): Finding[] => {
  const findings: Finding[] = [];

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
      permission,
      ...classified,
      ruleId,
    });
  }

  for (const [serverName, serverConfig] of Object.entries(settings.mcpServers ?? {})) {
    const permission: NormalizedPermission = {
      capability: 'mcp',
      scope: 'global',
      persistence: 'always',
      constraints: [serverConfig.command],
      rawKey: `mcpServers.${serverName}`,
      rawValue: serverConfig,
    };

    const classified = classifyFinding(permission, 'MCP_SERVER_REGISTERED');
    findings.push({
      id: makeFindingId(AGENT_ID, 'mcpservers', serverName),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      permission,
      ...classified,
      ruleId: 'MCP_SERVER_REGISTERED',
    });
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
      findings.push(...extractFindings(parsed.data, configPath));
    }
    return findings;
  },
});
