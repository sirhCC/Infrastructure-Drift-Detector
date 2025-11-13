import { Command } from 'commander';
import { DriftHistoryStore } from '../../reporting';
import { Output } from '../output';

/**
 * History command - view and analyze drift history
 */
export function createHistoryCommand(): Command {
  const command = new Command('history');

  command
    .description('View and analyze drift detection history')
    .option('--dir <path>', 'Directory for drift history', './drift-history')
    .option('--list', 'List recent scans')
    .option('--stats', 'Show statistics')
    .option('--scan <id>', 'Show details for specific scan')
    .option('--limit <number>', 'Number of scans to show', '10')
    .option('--provider <provider>', 'Filter by provider')
    .option('--export <path>', 'Export history to JSON file')
    .option('--clear', 'Clear all history')
    .action(async (options) => {
      try {
        const historyStore = new DriftHistoryStore(options.dir);

        // Clear history
        if (options.clear) {
          const confirmed = true; // In production, would prompt for confirmation
          if (confirmed) {
            historyStore.clearHistory();
            Output.success('History cleared');
          }
          return;
        }

        // Export history
        if (options.export) {
          historyStore.exportToFile(options.export);
          Output.success(`History exported to ${options.export}`);
          return;
        }

        // Show specific scan
        if (options.scan) {
          const scan = historyStore.getScanById(options.scan);
          if (!scan) {
            Output.error(`Scan not found: ${options.scan}`);
            process.exit(1);
          }

          Output.header(`Scan Details: ${scan.id}`);
          console.log();
          console.log(`Timestamp: ${scan.timestamp.toISOString()}`);
          console.log(`Provider: ${scan.provider.toUpperCase()}`);
          if (scan.region) console.log(`Region: ${scan.region}`);
          console.log(`Total Resources: ${scan.totalResources}`);
          console.log(`Drifted Resources: ${scan.driftedResources}`);
          console.log();

          Output.header('Severity Breakdown');
          Output.table([
            { label: 'Critical', value: scan.severityCounts.critical },
            { label: 'High', value: scan.severityCounts.high },
            { label: 'Medium', value: scan.severityCounts.medium },
            { label: 'Low', value: scan.severityCounts.low }
          ]);

          if (scan.metadata) {
            console.log();
            Output.header('Metadata');
            if (scan.metadata.terraformPath) {
              console.log(`Terraform Path: ${scan.metadata.terraformPath}`);
            }
            if (scan.metadata.configFile) {
              console.log(`Config File: ${scan.metadata.configFile}`);
            }
            if (scan.metadata.scanDuration) {
              console.log(`Scan Duration: ${scan.metadata.scanDuration}ms`);
            }
          }

          console.log();
          Output.header('Drifted Resources');
          const driftedResults = scan.results.filter(r => r.hasDrift);
          if (driftedResults.length === 0) {
            Output.success('No drift detected in this scan');
          } else {
            driftedResults.forEach(result => {
              Output.driftResult(result);
            });
          }

          return;
        }

        // Show statistics
        if (options.stats) {
          const stats = historyStore.getStatistics();
          if (!stats) {
            Output.warning('No scan history available');
            return;
          }

          Output.header('Drift History Statistics');
          console.log();
          console.log(`Total Scans: ${stats.totalScans}`);
          console.log(`First Scan: ${stats.firstScan.toISOString()}`);
          console.log(`Last Scan: ${stats.lastScan.toISOString()}`);
          console.log(`Average Drift: ${stats.averageDriftPercentage.toFixed(2)}%`);
          console.log();

          if (stats.mostDriftedResources.length > 0) {
            Output.header('Most Frequently Drifted Resources');
            stats.mostDriftedResources.forEach(resource => {
              console.log(`  ${resource.resourceId}: ${resource.driftCount} times`);
            });
            console.log();
          }

          if (stats.driftTrend.length > 0) {
            Output.header('Drift Trend (Last 30 Days)');
            const last30Days = stats.driftTrend.slice(-30);
            last30Days.forEach(point => {
              const dateStr = point.date.toISOString().split('T')[0];
              const bar = '█'.repeat(Math.min(point.driftCount, 50));
              console.log(`  ${dateStr}: ${bar} (${point.driftCount})`);
            });
          }

          return;
        }

        // List recent scans (default)
        const limit = parseInt(options.limit, 10);
        let scans = options.provider
          ? historyStore.getScansByProvider(options.provider)
          : historyStore.getRecentScans(limit);

        if (scans.length === 0) {
          Output.warning('No scan history available');
          Output.info('Run a scan first: drift-detector scan');
          return;
        }

        Output.header(`Recent Scans (${scans.length})`);
        console.log();

        scans.forEach(scan => {
          const driftPercentage = scan.totalResources > 0
            ? ((scan.driftedResources / scan.totalResources) * 100).toFixed(1)
            : '0.0';

          const severityBadges = [
            scan.severityCounts.critical > 0 ? Output.colors.red(`C:${scan.severityCounts.critical}`) : null,
            scan.severityCounts.high > 0 ? Output.colors.yellow(`H:${scan.severityCounts.high}`) : null,
            scan.severityCounts.medium > 0 ? Output.colors.blue(`M:${scan.severityCounts.medium}`) : null,
            scan.severityCounts.low > 0 ? Output.colors.dim(`L:${scan.severityCounts.low}`) : null
          ].filter(Boolean).join(' ');

          console.log(Output.colors.bold(scan.id));
          console.log(`  ${scan.timestamp.toISOString()}`);
          console.log(`  ${scan.provider.toUpperCase()}${scan.region ? ` (${scan.region})` : ''}`);
          console.log(`  Resources: ${scan.totalResources} | Drifted: ${scan.driftedResources} (${driftPercentage}%)`);
          if (severityBadges) {
            console.log(`  Severity: ${severityBadges}`);
          }
          console.log();
        });

        Output.info(`Use --scan <id> to view details`);
        Output.info(`Use --stats to see statistics`);

      } catch (error) {
        Output.error('History command failed:', error);
        process.exit(1);
      }
    });

  return command;
}
