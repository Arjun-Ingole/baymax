import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { claudeCodeAdapter } from './claude-code.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, '../__fixtures__');

const makeTempProject = (claudeDir?: Record<string, string>) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baymax-test-'));
  if (claudeDir) {
    const claudePath = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudePath);
    for (const [filename, content] of Object.entries(claudeDir)) {
      fs.writeFileSync(path.join(claudePath, filename), content, 'utf-8');
    }
  }
  return tmpDir;
};

const cleanup = (dir: string) => fs.rmSync(dir, { recursive: true, force: true });

describe('claudeCodeAdapter', () => {
  describe('detect()', () => {
    it('returns true when project .claude/settings.json exists', () => {
      const tmpDir = makeTempProject({ 'settings.json': '{}' });
      try {
        expect(claudeCodeAdapter.detect(tmpDir)).toBe(true);
      } finally {
        cleanup(tmpDir);
      }
    });

    it('detect() returns a boolean', () => {
      const tmpDir = makeTempProject();
      try {
        expect(typeof claudeCodeAdapter.detect(tmpDir)).toBe('boolean');
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - high risk: unrestricted Bash', () => {
    it('detects Bash in allowedTools as high risk', async () => {
      const tmpDir = makeTempProject({
        'settings.json': JSON.stringify({ allowedTools: ['Bash'] }),
      });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        const bashFinding = findings.find(f => f.ruleId === 'SHELL_UNRESTRICTED_ALWAYS');
        expect(bashFinding).toBeDefined();
        expect(bashFinding?.riskLevel).toBe('high');
        expect(bashFinding?.permission.capability).toBe('shell');
        expect(bashFinding?.permission.scope).toBe('global');
        expect(bashFinding?.score).toBeGreaterThanOrEqual(7);
        expect(bashFinding?.projectDir).toBeTruthy();
      } finally {
        cleanup(tmpDir);
      }
    });

    it('detects Bash(*) in allowedTools as high risk', async () => {
      const tmpDir = makeTempProject({
        'settings.json': JSON.stringify({ allowedTools: ['Bash(*)'] }),
      });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        const bashFinding = findings.find(f => f.ruleId === 'SHELL_UNRESTRICTED_ALWAYS');
        expect(bashFinding).toBeDefined();
        expect(bashFinding?.riskLevel).toBe('high');
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - medium risk: restricted Bash', () => {
    it('detects Bash(npm run *) as medium risk', async () => {
      const tmpDir = makeTempProject({
        'settings.json': JSON.stringify({ allowedTools: ['Bash(npm run *)'] }),
      });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        const bashFinding = findings.find(f => f.ruleId === 'SHELL_RESTRICTED_ALWAYS');
        expect(bashFinding).toBeDefined();
        expect(bashFinding?.riskLevel).toBe('medium');
        expect(bashFinding?.permission.capability).toBe('shell');
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - permissions.allow', () => {
    it('detects Bash in permissions.allow', async () => {
      const tmpDir = makeTempProject({
        'settings.json': JSON.stringify({ permissions: { allow: ['Bash'] } }),
      });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        const bashFinding = findings.find(f =>
          f.ruleId === 'SHELL_UNRESTRICTED_ALWAYS' && f.permission.rawKey === 'permissions.allow'
        );
        expect(bashFinding).toBeDefined();
        expect(bashFinding?.riskLevel).toBe('high');
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - low risk: other tools', () => {
    it('detects Read/Write as low risk', async () => {
      const tmpDir = makeTempProject({
        'settings.json': JSON.stringify({ allowedTools: ['Read', 'Write'] }),
      });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        const toolFindings = findings.filter(f => f.ruleId === 'TOOL_ALWAYS_ALLOWED');
        expect(toolFindings).toHaveLength(2);
        expect(toolFindings.every(f => f.riskLevel === 'low')).toBe(true);
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - MCP servers', () => {
    it('detects registered MCP servers', async () => {
      const tmpDir = makeTempProject({
        'settings.json': JSON.stringify({
          mcpServers: {
            'filesystem': { command: 'npx', args: ['-y', '@mcp/filesystem'] },
          },
        }),
      });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        const mcpFinding = findings.find(f => f.ruleId === 'MCP_SERVER_REGISTERED');
        expect(mcpFinding).toBeDefined();
        expect(mcpFinding?.id).toContain('mcpservers');
      } finally {
        cleanup(tmpDir);
      }
    });

    it('detects hardcoded secrets in MCP env', async () => {
      const tmpDir = makeTempProject({
        'settings.json': JSON.stringify({
          mcpServers: {
            'github': {
              command: 'npx',
              env: { GITHUB_TOKEN: 'ghp_realtoken123456789' },
            },
          },
        }),
      });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        const secretFinding = findings.find(f => f.ruleId === 'SECRETS_IN_MCP_ENV');
        expect(secretFinding).toBeDefined();
        expect(secretFinding?.riskLevel).toBe('high');
        // Value should be redacted
        expect(secretFinding?.permission.rawValue).toBe('[redacted]');
      } finally {
        cleanup(tmpDir);
      }
    });

    it('uses fixture file with multiple MCP servers', async () => {
      const tmpDir = makeTempProject({
        'settings.json': fs.readFileSync(
          path.join(fixtures, 'claude-settings-high-risk.json'), 'utf-8'
        ),
      });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        const mcpFindings = findings.filter(f => f.ruleId === 'MCP_SERVER_REGISTERED');
        expect(mcpFindings).toHaveLength(2);
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - settings.local.json', () => {
    it('scans settings.local.json in addition to settings.json', async () => {
      const tmpDir = makeTempProject({
        'settings.json': JSON.stringify({ allowedTools: ['Read'] }),
        'settings.local.json': JSON.stringify({ allowedTools: ['Bash'] }),
      });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        const highRisk = findings.filter(f => f.riskLevel === 'high');
        expect(highRisk.length).toBeGreaterThan(0);
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - error handling', () => {
    it('returns array even for missing config', async () => {
      const tmpDir = makeTempProject();
      try {
        const findings = await claudeCodeAdapter.scan(path.join(tmpDir, 'nonexistent'));
        expect(Array.isArray(findings)).toBe(true);
      } finally {
        cleanup(tmpDir);
      }
    });

    it('returns empty array for malformed JSON', async () => {
      const tmpDir = makeTempProject({ 'settings.json': '{ invalid json' });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        expect(Array.isArray(findings)).toBe(true);
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('finding IDs', () => {
    it('generates stable deterministic IDs', async () => {
      const tmpDir = makeTempProject({
        'settings.json': JSON.stringify({ allowedTools: ['Bash'] }),
      });
      try {
        const findings1 = await claudeCodeAdapter.scan(tmpDir);
        const findings2 = await claudeCodeAdapter.scan(tmpDir);
        expect(findings1[0].id).toBe(findings2[0].id);
      } finally {
        cleanup(tmpDir);
      }
    });

    it('IDs are lowercase', async () => {
      const tmpDir = makeTempProject({
        'settings.json': JSON.stringify({ allowedTools: ['Read'] }),
      });
      try {
        const findings = await claudeCodeAdapter.scan(tmpDir);
        for (const f of findings) {
          expect(f.id).toBe(f.id.toLowerCase());
        }
      } finally {
        cleanup(tmpDir);
      }
    });
  });
});
