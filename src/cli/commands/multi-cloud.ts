import { Command } from 'commander';
import { CrossCloudComparator } from '../../multi-cloud/cross-cloud-comparator';
import { DriftHistoryStore } from '../../reporting/history';
import chalk from 'chalk';

export function createMultiCloudCommand(): Command {
  const command = new Command('multi-cloud');

  command
    .description('Multi-cloud and multi-account operations')
    .addCommand(createCompareCommand())
    .addCommand(createMultiAccountCommand())
    .addCommand(createOrgScanCommand())
    .addCommand(createTagCommand());

  return command;
}

function createCompareCommand(): Command {
  return new Command('compare')
    .description('Compare resources across cloud providers')
    .option('-s, --scan-id <id>', 'Scan ID to compare')
    .option('-f, --file <path>', 'Path to scan results file')
    .option('--output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const comparator = new CrossCloudComparator();
        const historyStore = new DriftHistoryStore();

        let resources = [];

        if (options.scanId) {
          const scan = historyStore.getScanById(options.scanId);
          if (!scan) {
            console.error(chalk.red(`Scan not found: ${options.scanId}`));
            process.exit(1);
          }
          resources = scan.results;
        } else if (options.file) {
          const fs = require('fs');
          const data = JSON.parse(fs.readFileSync(options.file, 'utf8'));
          resources = data.resources || data.drifts || [];
        } else {
          console.error(chalk.red('Please specify --scan-id or --file'));
          process.exit(1);
        }

        console.log(chalk.blue('Comparing resources across cloud providers...'));

        const comparisons = await comparator.compareResources(resources);

        if (options.output === 'json') {
          console.log(JSON.stringify(comparisons, null, 2));
        } else {
          printComparisons(comparisons);
        }
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

function createMultiAccountCommand(): Command {
  return new Command('multi-account')
    .description('Scan multiple cloud accounts')
    .requiredOption('-c, --config <path>', 'Path to multi-account config file')
    .option('-p, --parallelism <number>', 'Number of parallel scans', '3')
    .option('--output <path>', 'Output file for results')
    .action(async (options) => {
      try {
        const { MultiAccountScanner } = require('../../multi-cloud/multi-account-scanner');

        console.log(chalk.blue('Loading multi-account configuration...'));

        const config = MultiAccountScanner.loadConfig(options.config);
        const scanner = new MultiAccountScanner(config);

        console.log(chalk.blue(`Scanning ${config.accounts.length} accounts...`));

        // TODO: Pass actual detector instance
        const results = await scanner.scanAll(null, parseInt(options.parallelism));

        console.log(chalk.green('\nScan Complete!'));
        console.log(chalk.white(`Total Accounts: ${results.totalAccounts}`));
        console.log(chalk.white(`Total Resources: ${results.totalResources}`));
        console.log(chalk.yellow(`Total Drift: ${results.totalDrift}`));

        console.log(chalk.white('\nTop Drifted Accounts:'));
        for (const account of results.topDriftedAccounts.slice(0, 5)) {
          console.log(chalk.white(`  ${account.accountName}: ${account.driftCount} drifts`));
        }

        if (options.output) {
          const fs = require('fs');
          fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
          console.log(chalk.green(`\nResults saved to: ${options.output}`));
        }
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

function createOrgScanCommand(): Command {
  return new Command('org-scan')
    .description('Scan entire cloud organization')
    .requiredOption('--provider <provider>', 'Cloud provider (aws, azure, gcp)')
    .requiredOption('--org-id <id>', 'Organization/Management Group ID')
    .option('--include <accounts>', 'Comma-separated account IDs to include')
    .option('--exclude <accounts>', 'Comma-separated account IDs to exclude')
    .option('--output <path>', 'Output file for results')
    .action(async (options) => {
      try {
        const { OrganizationScanner } = require('../../multi-cloud/org-scanner');

        const scanner = new OrganizationScanner();

        const config = {
          provider: options.provider,
          organizationId: options.orgId,
          credentials: {},
          includeAccounts: options.include?.split(','),
          excludeAccounts: options.exclude?.split(','),
        };

        console.log(chalk.blue(`Scanning ${options.provider.toUpperCase()} Organization: ${options.orgId}`));

        let result;
        if (options.provider === 'aws') {
          result = await scanner.scanAWSOrganization(config);
        } else if (options.provider === 'azure') {
          result = await scanner.scanAzureManagementGroup(config);
        } else if (options.provider === 'gcp') {
          result = await scanner.scanGCPOrganization(config);
        } else {
          console.error(chalk.red('Invalid provider. Use: aws, azure, or gcp'));
          process.exit(1);
        }

        console.log(chalk.green('\nOrganization Scan Complete!'));
        console.log(scanner.generateReport(result));

        if (options.output) {
          const fs = require('fs');
          fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
          console.log(chalk.green(`\nResults saved to: ${options.output}`));
        }
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

function createTagCommand(): Command {
  const tagCmd = new Command('tag');

  tagCmd
    .description('Tag-based resource operations')
    .addCommand(createTagGroupCommand())
    .addCommand(createTagReportCommand())
    .addCommand(createTagComplianceCommand());

  return tagCmd;
}

function createTagGroupCommand(): Command {
  return new Command('group')
    .description('Group resources by tag')
    .requiredOption('-s, --scan-id <id>', 'Scan ID')
    .requiredOption('-k, --key <key>', 'Tag key to group by')
    .action(async (options) => {
      try {
        const { TagBasedGrouping } = require('../../multi-cloud/tag-grouping');
        const historyStore = new DriftHistoryStore();

        const scan = historyStore.getScanById(options.scanId);
        if (!scan) {
          console.error(chalk.red(`Scan not found: ${options.scanId}`));
          process.exit(1);
        }

        const grouping = new TagBasedGrouping();
        const groups = grouping.groupByTag(scan.results, options.key);

        console.log(chalk.blue(`\nResources grouped by tag: ${options.key}`));
        console.log(chalk.white('='.repeat(50)));

        for (const [value, resources] of groups) {
          const driftCount = resources.filter((r: any) => r.hasDrift).length;
          console.log(chalk.white(`\n${value}:`));
          console.log(chalk.white(`  Total: ${resources.length}`));
          console.log(chalk.yellow(`  Drift: ${driftCount}`));
        }
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

function createTagReportCommand(): Command {
  return new Command('report')
    .description('Generate tag report')
    .requiredOption('-s, --scan-id <id>', 'Scan ID')
    .option('--output <path>', 'Output file for report')
    .action(async (options) => {
      try {
        const { TagBasedGrouping } = require('../../multi-cloud/tag-grouping');
        const historyStore = new DriftHistoryStore();

        const scan = historyStore.getScanById(options.scanId);
        if (!scan) {
          console.error(chalk.red(`Scan not found: ${options.scanId}`));
          process.exit(1);
        }

        const grouping = new TagBasedGrouping();
        const report = grouping.generateTagReport(scan.results);

        console.log(report);

        if (options.output) {
          const fs = require('fs');
          fs.writeFileSync(options.output, report);
          console.log(chalk.green(`\nReport saved to: ${options.output}`));
        }
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

function createTagComplianceCommand(): Command {
  return new Command('compliance')
    .description('Check tag compliance')
    .requiredOption('-s, --scan-id <id>', 'Scan ID')
    .requiredOption('-t, --tags <tags>', 'Comma-separated required tags')
    .action(async (options) => {
      try {
        const { TagBasedGrouping } = require('../../multi-cloud/tag-grouping');
        const historyStore = new DriftHistoryStore();

        const scan = historyStore.getScanById(options.scanId);
        if (!scan) {
          console.error(chalk.red(`Scan not found: ${options.scanId}`));
          process.exit(1);
        }

        const requiredTags = options.tags.split(',');
        const grouping = new TagBasedGrouping();
        const result = grouping.validateTagCompliance(scan.results, requiredTags);

        console.log(chalk.blue('\nTag Compliance Report'));
        console.log(chalk.white('='.repeat(50)));
        console.log(chalk.white(`Required Tags: ${requiredTags.join(', ')}`));
        console.log(chalk.white(`\nTotal Resources: ${scan.results.length}`));
        console.log(chalk.green(`Compliant: ${result.compliant.length}`));
        console.log(chalk.red(`Non-Compliant: ${result.nonCompliant.length}`));
        console.log(
          chalk.white(`Compliance Rate: ${(result.complianceRate * 100).toFixed(2)}%`)
        );

        if (result.nonCompliant.length > 0) {
          console.log(chalk.red('\nNon-Compliant Resources:'));
          for (const resource of result.nonCompliant.slice(0, 10)) {
            console.log(chalk.red(`  - ${resource.resourceType}: ${resource.resourceName}`));
          }
          if (result.nonCompliant.length > 10) {
            console.log(chalk.red(`  ... and ${result.nonCompliant.length - 10} more`));
          }
        }
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

function printComparisons(comparisons: any[]): void {
  for (const comparison of comparisons) {
    console.log(chalk.white(`\n${'='.repeat(60)}`));
    console.log(chalk.blue(`Resource Type: ${comparison.resourceType}`));
    console.log(chalk.white(`Total Resources: ${comparison.totalCount}`));

    const providers = Object.keys(comparison.providers);
    console.log(chalk.white(`Providers: ${providers.join(', ')}`));

    for (const provider of providers) {
      const resources = comparison.providers[provider];
      console.log(chalk.white(`  ${provider.toUpperCase()}: ${resources.length} resources`));
    }

    if (comparison.similarities.length > 0) {
      console.log(chalk.yellow(`\nFound ${comparison.similarities.length} similar resources:`));

      for (const similarity of comparison.similarities.slice(0, 3)) {
        const res1 = similarity.resources[0];
        const res2 = similarity.resources[1];
        const score = (similarity.similarityScore * 100).toFixed(0);

        console.log(
          chalk.white(
            `  ${res1.provider}:${res1.name} <-> ${res2.provider}:${res2.name} (${score}% similar)`
          )
        );
      }
    }

    if (comparison.recommendations.length > 0) {
      console.log(chalk.cyan('\nRecommendations:'));
      for (const rec of comparison.recommendations) {
        console.log(chalk.cyan(`  • ${rec}`));
      }
    }
  }
}
