#!/usr/bin/env node
import path from 'node:path';
import { Command } from 'commander';
import { runScan } from './scan.js';
import { renderFindings, Spinner } from './output/renderer.js';
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
  .option('--verbose', 'Show all checked config paths')
  .option('--depth <n>', 'Depth to recurse into subdirectories (0 = current only)', '2')
  .action(async (directory: string, flags: { json?: boolean; quiet?: boolean; verbose?: boolean; depth: string }) => {
    try {
      const projectDir = path.resolve(directory);
      const depth = Math.max(0, parseInt(flags.depth, 10) || 2);

      let spinner: Spinner | null = null;
      if (!flags.json) {
        spinner = new Spinner('Scanning agent configs…').start();
      }

      const summary = await runScan({
        projectDir,
        json: flags.json ?? false,
        quiet: flags.quiet ?? false,
        verbose: flags.verbose ?? false,
        depth,
      });

      spinner?.stop();

      if (flags.json) {
        renderJson(summary);
      } else {
        renderFindings(summary, { quiet: flags.quiet, verbose: flags.verbose });
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
  .option('--depth <n>', 'Depth to recurse into subdirectories', '2')
  .action(async (id: string, flags: { dir: string; depth: string }) => {
    try {
      const depth = Math.max(0, parseInt(flags.depth, 10) || 2);
      await explainFinding(id, flags.dir, depth);
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
  .option('--depth <n>', 'Depth to recurse into subdirectories', '2')
  .action(async (directory: string, flags: { md?: boolean; output: string; depth: string }) => {
    try {
      const projectDir = path.resolve(directory);
      const depth = Math.max(0, parseInt(flags.depth, 10) || 2);
      const spinner = new Spinner('Scanning agent configs…').start();
      const summary = await runScan({ projectDir, json: false, quiet: false, verbose: false, depth });
      spinner.stop();
      if (flags.md) {
        renderMarkdown(summary, flags.output);
        logger.log(`  Report written to ${flags.output}`);
      } else {
        logger.warn('Specify an export format: --md');
      }
    } catch (err) {
      logger.error(`Error: ${String(err)}`);
      process.exit(2);
    }
  });

program.parseAsync();
