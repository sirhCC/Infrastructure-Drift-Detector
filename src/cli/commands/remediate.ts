/**
 * CLI Command: remediate
 * Execute drift remediation with approval workflow
 */

import { Command } from 'commander';
import { RemediationEngine } from '../../remediation/engine';
import { RemediationConfig, RemediationSeverity, RemediationStatus } from '../../remediation/types';
import { ConfigLoader } from '../../config';
import { DriftHistoryStore } from '../../reporting/history';
import chalk from 'chalk';
import * as readline from 'readline';

export const remediateCommand = new Command('remediate')
  .description('Remediate detected drift')
  .option('--scan-id <id>', 'Scan ID to remediate (from history)')
  .option('--plan-id <id>', 'Execute existing remediation plan')
  .option('--dry-run', 'Preview changes without applying', true)
  .option('--no-dry-run', 'Actually apply changes')
  .option('--auto-approve', 'Automatically approve safe actions', false)
  .option('--auto-approve-all', 'Automatically approve ALL actions (dangerous!)', false)
  .option('--terraform-dir <path>', 'Terraform working directory')
  .option('--terraform-bin <path>', 'Path to terraform binary')
  .option('--max-concurrent <number>', 'Max concurrent remediations', '1')
  .option('--continue-on-error', 'Continue if one action fails', false)
  .option('--no-rollback', 'Disable automatic rollback on failure')
  .option('--include <resources...>', 'Only remediate these resources')
  .option('--exclude <resources...>', 'Skip these resources')
  .option('--log-dir <path>', 'Directory for remediation logs')
  .option('--config <path>', 'Path to config file')
  .option('--history-dir <path>', 'Directory for drift history', './drift-history')
  .action(async (options) => {
    try {
      console.log(chalk.bold('\n🔧 Infrastructure Drift Remediation\n'));

      // Load configuration
      const configLoader = new ConfigLoader();
      const config = options.config ? await configLoader.loadFromFile(options.config) : undefined;

      // Initialize history store
      const historyStore = new DriftHistoryStore(options.historyDir);

      // Get scan to remediate
      let scanId = options.scanId;
      if (!scanId && !options.planId) {
        // Use most recent scan
        const recentScans = await historyStore.getRecentScans(1);
        if (recentScans.length === 0) {
          console.log(chalk.red('No scans found in history. Run `drift-detector scan` first.'));
          process.exit(1);
        }
        scanId = recentScans[0].id;
        console.log(chalk.gray(`Using most recent scan: ${scanId}\n`));
      }

      // Load scan from history
      const scan = await historyStore.getScanById(scanId);
      if (!scan) {
        console.log(chalk.red(`Scan not found: ${scanId}`));
        process.exit(1);
      }

      if (!scan.results || scan.results.length === 0) {
        console.log(chalk.yellow('No drift detected in this scan. Nothing to remediate.'));
        process.exit(0);
      }

      // Configure remediation engine
      const remediationConfig: Partial<RemediationConfig> = {
        dryRun: options.dryRun,
        autoApprove: options.autoApproveAll ? true : options.autoApprove,
        terraformPath: options.terraformBin,
        terraformWorkDir: options.terraformDir,
        maxConcurrent: parseInt(options.maxConcurrent),
        continueOnError: options.continueOnError,
        rollbackOnError: !options.noRollback,
        logDir: options.logDir,
        verboseLogging: true,
        destructiveActionsAllowed: options.autoApproveAll,
        backupBeforeChange: true,
        includeResources: options.include,
        excludeResources: options.exclude,
        requireApprovalFor: options.autoApproveAll
          ? []
          : [
              RemediationSeverity.LOW_RISK,
              RemediationSeverity.MEDIUM_RISK,
              RemediationSeverity.HIGH_RISK,
              RemediationSeverity.CRITICAL
            ]
      };

      const engine = new RemediationEngine(remediationConfig);

      // Create remediation plan
      console.log(chalk.cyan('📋 Creating remediation plan...\n'));
      const plan = await engine.createPlan(scan.results, scanId);

      // Display plan summary
      displayPlanSummary(plan);

      if (plan.totalActions === 0) {
        console.log(chalk.yellow('\nNo remediable actions found.'));
        process.exit(0);
      }

      // Confirm execution
      if (!options.dryRun && !options.autoApproveAll) {
        const confirmed = await confirmExecution(plan);
        if (!confirmed) {
          console.log(chalk.yellow('\nRemediation cancelled.'));
          process.exit(0);
        }
      }

      // Execute plan
      console.log(chalk.cyan(`\n${ options.dryRun ? '🔍 Running dry-run...' : '⚙️  Executing remediation...'}\n`));
      const results = await engine.executePlan(plan);

      // Display results
      console.log(chalk.bold('\n📊 Remediation Results:\n'));
      displayResults(plan, results);

      // Summary
      if (plan.failureCount === 0) {
        console.log(chalk.green.bold(`\n✅ All actions completed successfully!`));
      } else if (plan.successCount > 0) {
        console.log(chalk.yellow.bold(`\n⚠️  Partial success: ${plan.successCount} succeeded, ${plan.failureCount} failed`));
      } else {
        console.log(chalk.red.bold(`\n❌ Remediation failed`));
      }

      if (options.dryRun) {
        console.log(chalk.gray('\n💡 This was a dry-run. Use --no-dry-run to apply changes.'));
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Display plan summary
 */
function displayPlanSummary(plan: any) {
  console.log(chalk.bold('Plan Summary:'));
  console.log(`  Total Actions: ${chalk.bold(plan.totalActions)}`);
  console.log(`  Safe (auto-approve): ${chalk.green(plan.safeActions)}`);
  console.log(`  Requires Approval: ${chalk.yellow(plan.requiresApproval)}`);
  console.log(`  Critical: ${chalk.red(plan.criticalActions)}`);
  console.log(`  Mode: ${plan.dryRun ? chalk.cyan('DRY-RUN') : chalk.yellow('LIVE')}`);

  console.log(chalk.bold('\n📝 Actions:'));
  for (const action of plan.actions.slice(0, 10)) {
    const severityColor = getSeverityColor(action.severity);
    const badge = severityColor(`[${action.severity}]`.padEnd(14));
    console.log(`  ${badge} ${action.description}`);
  }

  if (plan.actions.length > 10) {
    console.log(chalk.gray(`  ... and ${plan.actions.length - 10} more`));
  }
}

/**
 * Display execution results
 */
function displayResults(plan: any, results: any[]) {
  for (const result of results) {
    const icon = result.success ? chalk.green('✓') : chalk.red('✗');
    const duration = chalk.gray(`(${result.duration}ms)`);
    console.log(`${icon} ${result.action.resourceName}.${result.action.propertyPath} ${duration}`);

    if (result.error) {
      console.log(chalk.red(`  Error: ${result.error}`));
    }

    if (result.rollbackPerformed) {
      console.log(chalk.yellow('  ↶ Rolled back'));
    }
  }

  console.log();
  console.log(`Success: ${chalk.green(plan.successCount)} | Failed: ${chalk.red(plan.failureCount)}`);
}

/**
 * Confirm execution with user
 */
async function confirmExecution(plan: any): Promise<boolean> {
  if (plan.criticalActions > 0) {
    console.log(chalk.red.bold(`\n⚠️  WARNING: This plan includes ${plan.criticalActions} CRITICAL actions!`));
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow('\nProceed with remediation? (yes/no): '), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Get color for severity
 */
function getSeverityColor(severity: string): (text: string) => string {
  switch (severity) {
    case RemediationSeverity.SAFE:
      return chalk.gray;
    case RemediationSeverity.LOW_RISK:
      return chalk.green;
    case RemediationSeverity.MEDIUM_RISK:
      return chalk.yellow;
    case RemediationSeverity.HIGH_RISK:
      return chalk.magenta;
    case RemediationSeverity.CRITICAL:
      return chalk.red;
    default:
      return chalk.white;
  }
}
