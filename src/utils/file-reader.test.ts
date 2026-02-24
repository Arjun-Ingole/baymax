import { describe, it, expect } from 'vitest';
import { safeReadJson, safeReadToml, safeReadYaml } from './file-reader.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, '../__fixtures__');

describe('safeReadJson', () => {
  it('reads valid JSON file', () => {
    const result = safeReadJson(path.join(fixtures, 'claude-settings-high-risk.json'));
    expect(result).toBeTruthy();
    expect((result as any).allowedTools).toContain('Bash');
  });

  it('returns null for non-existent file', () => {
    expect(safeReadJson('/nonexistent/path.json')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    // A TOML file is not valid JSON
    expect(safeReadJson(path.join(fixtures, 'codex-config-auto.toml'))).toBeNull();
  });
});

describe('safeReadToml', () => {
  it('reads valid TOML file', () => {
    const result = safeReadToml(path.join(fixtures, 'codex-config-auto.toml'));
    expect(result).toBeTruthy();
    expect((result as any).approval_policy).toBe('auto');
  });

  it('returns null for non-existent file', () => {
    expect(safeReadToml('/nonexistent/path.toml')).toBeNull();
  });
});

describe('safeReadYaml', () => {
  it('reads valid YAML file', () => {
    const result = safeReadYaml(path.join(fixtures, 'aider-config-risky.yml'));
    expect(result).toBeTruthy();
    expect((result as any).yes).toBe(true);
  });

  it('returns null for non-existent file', () => {
    expect(safeReadYaml('/nonexistent/path.yml')).toBeNull();
  });
});
