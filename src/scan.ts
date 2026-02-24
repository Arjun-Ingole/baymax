import path from 'node:path';
import fs from 'node:fs';
import { ALL_ADAPTERS } from './adapters/index.js';
import { buildSummary } from './risk/scorer.js';
import { logger } from './utils/logger.js';
import type { ScanOptions, ScanSummary, Finding, AgentId } from './types.js';

// Directories to always skip during recursive scan
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', '.cache', 'coverage', '.turbo',
  'vendor', 'bower_components', 'target', '.gradle',
]);

/**
 * Find all project directories up to `depth` levels deep that contain
 * at least one agent config file.
 */
function findProjectDirs(rootDir: string, maxDepth: number): string[] {
  const projects: string[] = [];

  const walk = (dir: string, depth: number) => {
    // Always include the root regardless
    if (depth === 0) {
      projects.push(dir);
    } else {
      // Check if any adapter detects this dir
      const hasConfig = ALL_ADAPTERS.some(a => {
        try { return a.detect(dir); } catch { return false; }
      });
      if (hasConfig) projects.push(dir);
    }

    if (depth >= maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue; // skip all hidden dirs (.claude, .git, etc.)
      walk(path.join(dir, entry.name), depth + 1);
    }
  };

  walk(rootDir, 0);

  // Deduplicate
  return [...new Set(projects)];
}

export const runScan = async (options: ScanOptions): Promise<ScanSummary> => {
  const { projectDir, depth } = options;
  const startTime = Date.now();

  const projectDirs = depth > 0
    ? findProjectDirs(projectDir, depth)
    : [projectDir];

  const allFindings: Finding[] = [];
  const agentsDetectedSet = new Set<AgentId>();
  const agentsScannedSet = new Set<AgentId>();
  let configsChecked = 0;
  let configsFound = 0;

  for (const dir of projectDirs) {
    const detectedAdapters = ALL_ADAPTERS.filter(a => {
      try { return a.detect(dir); } catch { return false; }
    });

    for (const adapter of detectedAdapters) {
      agentsDetectedSet.add(adapter.agentId);
      configsChecked++;
      try {
        const findings = await adapter.scan(dir);
        if (findings.length >= 0) configsFound++; // adapter successfully ran
        allFindings.push(...findings);
        agentsScannedSet.add(adapter.agentId);
      } catch (err) {
        logger.warn(`Warning: could not scan ${adapter.agentLabel} in ${dir}: ${String(err)}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;

  // Deduplicate: global adapters (Cursor, Codex, etc.) produce the same finding
  // ID regardless of which project dir triggered them — keep first occurrence only.
  const seenIds = new Set<string>();
  const dedupedFindings = allFindings.filter(f => {
    if (seenIds.has(f.id)) return false;
    seenIds.add(f.id);
    return true;
  });

  return buildSummary(
    dedupedFindings,
    [...agentsDetectedSet],
    [...agentsScannedSet],
    {
      configsChecked,
      configsFound,
      projectsScanned: projectDirs.length,
      durationMs,
    },
  );
};
