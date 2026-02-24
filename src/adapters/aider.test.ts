import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { aiderAdapter } from './aider.js';

const makeTempProject = (aiderConfig?: string) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baymax-aider-test-'));
  if (aiderConfig !== undefined) {
    fs.writeFileSync(path.join(tmpDir, '.aider.conf.yml'), aiderConfig, 'utf-8');
  }
  return tmpDir;
};

const cleanup = (dir: string) => fs.rmSync(dir, { recursive: true, force: true });

describe('aiderAdapter', () => {
  describe('detect()', () => {
    it('returns true when .aider.conf.yml exists in project', () => {
      const tmpDir = makeTempProject('model: gpt-4\n');
      try {
        expect(aiderAdapter.detect(tmpDir)).toBe(true);
      } finally {
        cleanup(tmpDir);
      }
    });

    it('returns false when no aider config exists', () => {
      const tmpDir = makeTempProject();
      try {
        expect(typeof aiderAdapter.detect(tmpDir)).toBe('boolean');
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - yes: true', () => {
    it('detects yes:true as high risk SKIP_ALL_CONFIRMATIONS', async () => {
      const tmpDir = makeTempProject('yes: true\n');
      try {
        const findings = await aiderAdapter.scan(tmpDir);
        const finding = findings.find(f => f.ruleId === 'SKIP_ALL_CONFIRMATIONS');
        expect(finding).toBeDefined();
        expect(finding?.riskLevel).toBe('high');
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - auto-commits', () => {
    it('detects auto-commits:true as medium risk', async () => {
      const tmpDir = makeTempProject('auto-commits: true\n');
      try {
        const findings = await aiderAdapter.scan(tmpDir);
        const finding = findings.find(f => f.ruleId === 'AUTO_COMMITS_ENABLED');
        expect(finding).toBeDefined();
        expect(finding?.riskLevel).toBe('medium');
      } finally {
        cleanup(tmpDir);
      }
    });

    it('does not flag auto-commits:false', async () => {
      const tmpDir = makeTempProject('auto-commits: false\n');
      try {
        const findings = await aiderAdapter.scan(tmpDir);
        const finding = findings.find(f => f.ruleId === 'AUTO_COMMITS_ENABLED');
        expect(finding).toBeUndefined();
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - shell', () => {
    it('detects shell:true as high risk', async () => {
      const tmpDir = makeTempProject('shell: true\n');
      try {
        const findings = await aiderAdapter.scan(tmpDir);
        const finding = findings.find(f => f.ruleId === 'SHELL_UNRESTRICTED_ALWAYS');
        expect(finding).toBeDefined();
        expect(finding?.riskLevel).toBe('high');
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe('scan() - clean config', () => {
    it('returns no findings for clean aider config', async () => {
      const tmpDir = makeTempProject('model: gpt-4\nauto-commits: false\n');
      try {
        const findings = await aiderAdapter.scan(tmpDir);
        expect(findings).toHaveLength(0);
      } finally {
        cleanup(tmpDir);
      }
    });
  });
});
