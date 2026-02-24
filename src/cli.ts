#!/usr/bin/env node
import path from 'node:path';
import { Command } from 'commander';
import { runScan } from './scan.js';
import { renderFindings } from './output/renderer.js';
import { renderJson } from './output/json-reporter.js';
import { renderMarkdown } from './output/markdown-reporter.js';
import { explainFinding } from './explain.js';
import { logger } from './utils/logger.js';

const program = new Command()
  .name('baymax')
  .description('Scan AI agent permission configs for dangerous "always allow" settings')
  .version('1.0.0', '-v, --version');

program
  .command('scan')
  .description('Scan AI agent configs for risky permissions')
  .argument('[directory]', 'Project directory to scan', '.')
  .option('--json', 'Output results as JSON')
  .option('--quiet', 'Only show high-risk findings')
  .action(async (directory: string, flags: { json?: boolean; quiet?: boolean }) => {
    try {
      const projectDir = path.resolve(directory);
      const summary = await runScan({ projectDir, json: flags.json ?? false, quiet: flags.quiet ?? false });
      if (flags.json) {
        renderJson(summary);
      } else {
        renderFindings(summary, { quiet: flags.quiet });
      }
      process.exit(summary.highCount > 0 ? 1 : 0);
    } catch (err) {
      logger.error(`Error: ${String(err)}`);
      process.exit(2);
    }
  });

program
  .command('explain')
  .description('Show full detail and remediation for a finding by ID')
  .argument('<id>', 'Finding ID (from scan output)')
  .option('--dir <directory>', 'Project directory', '.')
  .action(async (id: string, flags: { dir: string }) => {
    try {
      await explainFinding(id, flags.dir);
    } catch (err) {
      logger.error(`Error: ${String(err)}`);
      process.exit(2);
    }
  });

program
  .command('export')
  .description('Export scan results as a report')
  .argument('[directory]', 'Project directory to scan', '.')
  .option('--md', 'Export as Markdown')
  .option('--output <path>', 'Output file path', './baymax-report.md')
  .action(async (directory: string, flags: { md?: boolean; output: string }) => {
    try {
      const projectDir = path.resolve(directory);
      const summary = await runScan({ projectDir, json: false, quiet: false });
      if (flags.md) {
        renderMarkdown(summary, flags.output);
        logger.log(`Report written to ${flags.output}`);
      } else {
        logger.warn('Specify an export format: --md');
      }
    } catch (err) {
      logger.error(`Error: ${String(err)}`);
      process.exit(2);
    }
  });

program.parseAsync();
