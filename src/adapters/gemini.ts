import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { z } from 'zod';
import { defineAdapter } from './base.js';
import { safeReadJson } from '../utils/file-reader.js';
import { classifyFinding } from '../risk/classifier.js';
import { makeFindingId } from '../utils/finding-id.js';
import type { Finding, NormalizedPermission } from '../types.js';

const GeminiSettingsSchema = z.object({
  trustedFolders: z.array(z.string()).optional(),
  sandboxEnabled: z.boolean().optional(),
  mcpServers: z.record(z.unknown()).optional(),
}).passthrough();

const AGENT_ID = 'gemini' as const;
const AGENT_LABEL = 'Gemini CLI';

const getConfigPaths = () => [path.join(os.homedir(), '.gemini', 'settings.json')];

const extractFindings = (settings: z.infer<typeof GeminiSettingsSchema>, configPath: string): Finding[] => {
  const findings: Finding[] = [];

  for (const folder of settings.trustedFolders ?? []) {
    const isGlobal = folder === os.homedir() || folder === '/' || folder === '~';
    const ruleId = isGlobal ? 'TRUSTED_DIR_GLOBAL' : 'FS_WRITE_REPO';
    const permission: NormalizedPermission = {
      capability: 'fs-write',
      scope: isGlobal ? 'global' : 'path',
      persistence: 'always',
      constraints: [folder],
      rawKey: 'trustedFolders',
      rawValue: folder,
    };
    const classified = classifyFinding(permission, ruleId);
    findings.push({
      id: makeFindingId(AGENT_ID, 'trustedfolders', folder),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      permission,
      ...classified,
      ruleId,
    });
  }

  if (settings.sandboxEnabled === false) {
    const permission: NormalizedPermission = {
      capability: 'shell',
      scope: 'global',
      persistence: 'always',
      constraints: [],
      rawKey: 'sandboxEnabled',
      rawValue: false,
    };
    const classified = classifyFinding(permission, 'SANDBOX_DISABLED');
    findings.push({
      id: makeFindingId(AGENT_ID, 'sandboxenabled', 'false'),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      permission,
      ...classified,
      ruleId: 'SANDBOX_DISABLED',
    });
  }

  for (const serverName of Object.keys(settings.mcpServers ?? {})) {
    const permission: NormalizedPermission = {
      capability: 'mcp',
      scope: 'global',
      persistence: 'always',
      constraints: [],
      rawKey: `mcpServers.${serverName}`,
      rawValue: serverName,
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

export const geminiAdapter = defineAdapter({
  agentId: AGENT_ID,
  agentLabel: AGENT_LABEL,

  detect() {
    return getConfigPaths().some(p => {
      try { return fs.existsSync(p); } catch { return false; }
    });
  },

  async scan() {
    const findings: Finding[] = [];
    for (const configPath of getConfigPaths()) {
      const raw = safeReadJson(configPath);
      if (!raw) continue;
      const parsed = GeminiSettingsSchema.safeParse(raw);
      if (!parsed.success) continue;
      findings.push(...extractFindings(parsed.data, configPath));
    }
    return findings;
  },
});
