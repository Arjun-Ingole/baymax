export type Capability =
  | 'shell'
  | 'fs-read'
  | 'fs-write'
  | 'network'
  | 'mcp'
  | 'env'
  | 'unknown';

export type Scope = 'global' | 'repo' | 'path' | 'unknown';
export type Persistence = 'always' | 'session' | 'once' | 'unknown';
export type RiskLevel = 'high' | 'medium' | 'low' | 'info';
export type AgentId = 'claude-code' | 'cursor' | 'codex' | 'gemini' | 'copilot' | 'aider';

export interface NormalizedPermission {
  capability: Capability;
  scope: Scope;
  persistence: Persistence;
  constraints: string[];
  rawKey: string;
  rawValue: unknown;
}

export interface Finding {
  id: string;
  agentId: AgentId;
  agentLabel: string;
  configPath: string;
  permission: NormalizedPermission;
  riskLevel: RiskLevel;
  ruleId: string;
  title: string;
  description: string;
  remediation: string;
}

export interface ScanSummary {
  agentsDetected: AgentId[];
  agentsScanned: AgentId[];
  findings: Finding[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  scannedAt: string;
}

export interface AgentAdapter {
  agentId: AgentId;
  agentLabel: string;
  detect(projectDir: string): boolean;
  scan(projectDir: string): Promise<Finding[]>;
}

export interface ScanOptions {
  projectDir: string;
  json: boolean;
  quiet: boolean;
}

export interface JsonOutput {
  version: string;
  scannedAt: string;
  summary: {
    agentsDetected: string[];
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings: Finding[];
}
