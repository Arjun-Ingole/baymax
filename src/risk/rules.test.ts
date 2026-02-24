import { describe, it, expect } from 'vitest';
import { RULES } from './rules.js';

describe('RULES registry', () => {
  const ruleIds = Object.keys(RULES);

  it('has at least 10 rules defined', () => {
    expect(ruleIds.length).toBeGreaterThanOrEqual(10);
  });

  it.each(ruleIds)('rule %s has required fields', (ruleId) => {
    const rule = RULES[ruleId];
    expect(rule.id).toBe(ruleId);
    expect(rule.title).toBeTruthy();
    expect(rule.description).toBeTruthy();
    expect(rule.remediation).toBeTruthy();
    expect(['high', 'medium', 'low', 'info']).toContain(rule.defaultRiskLevel);
  });

  it('contains key rules for common threats', () => {
    expect(RULES['SHELL_UNRESTRICTED_ALWAYS']).toBeDefined();
    expect(RULES['MCP_SERVER_REGISTERED']).toBeDefined();
    expect(RULES['SANDBOX_DISABLED']).toBeDefined();
    expect(RULES['SKIP_ALL_CONFIRMATIONS']).toBeDefined();
    expect(RULES['NETWORK_UNRESTRICTED']).toBeDefined();
    expect(RULES['APPROVAL_POLICY_AUTO']).toBeDefined();
  });

  it('SHELL_UNRESTRICTED_ALWAYS is high risk', () => {
    expect(RULES['SHELL_UNRESTRICTED_ALWAYS'].defaultRiskLevel).toBe('high');
  });

  it('TOOL_ALWAYS_ALLOWED is low risk', () => {
    expect(RULES['TOOL_ALWAYS_ALLOWED'].defaultRiskLevel).toBe('low');
  });
});
