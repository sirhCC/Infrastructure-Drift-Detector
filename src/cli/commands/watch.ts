import { Command } from 'commander';
import { ConfigLoader } from '../../config/loader';
import { TerraformParser } from '../../parsers/terraform-enhanced';
import { AWSScanner } from '../../scanners/aws/index';
import { DriftDetector } from '../../detector';
import { Output } from '../output';

/**
 * Watch command - continuous monitoring for drift
 */
export function createWatchCommand(): Command {
  const command = new Command('watch');

  command
    .description('Continuously monitor infrastructure for drift')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-i, --interval <minutes>', 'Scan interval in minutes', '60')
    .option('-p, --provider <provider>', 'Cloud provider (aws, azure, gcp)', 'aws')
    .option('-t, --terraform <path>', 'Path to Terraform directory or file')
    .option('--severity <level>', 'Minimum severity to report (low, medium, high, critical)', 'medium')
    .action(async (options) => {
      try {
        Output.header('Infrastructure Drift Monitoring');

        // Load configuration
        const configLoader = options.config
          ? new ConfigLoader()
          : ConfigLoader.autoLoad();

        if (options.config) {
          configLoader.loadFromFile(options.config);
        }

        const config = configLoader.getConfig();
        const interval = parseInt(options.interval, 10);

        Output.info(`Starting continuous monitoring (scanning every ${interval} minutes)`);
        Output.info('Press Ctrl+C to stop\n');

        let scanCount = 0;

        // Scan function
        const performScan = async () => {
          scanCount++;
          const timestamp = new Date().toISOString();
          
          console.log(chalk.gray(`\n[${ timestamp}] Scan #${scanCount}`));
          console.log(chalk.gray('─'.repeat(60)));

          try {
            // Parse Terraform
            const terraformPath = options.terraform || config.terraform?.directories?.[0] || './infrastructure';
            const parser = new TerraformParser();
            
            let iacDefinitions;
            if (terraformPath.endsWith('.tf')) {
              iacDefinitions = [parser.parse(terraformPath)];
            } else {
              iacDefinitions = parser.parseDirectory(terraformPath);
            }

            const expectedResources = iacDefinitions.flatMap((def: any) => def.resources);

            // Scan cloud
            const provider = options.provider || 'aws';
            let actualResources: any[] = [];

            if (provider === 'aws') {
              const awsConfig = config.providers?.aws || { enabled: true };
              const scanner = new AWSScanner(awsConfig);
              actualResources = await scanner.scan();
            }

            // Detect drift
            const detector = new DriftDetector({
              providers: [provider as any],
              ignoreProperties: config.drift?.ignoreProperties
            });

            const driftResults = detector.detectDrift(expectedResources, actualResources);

            // Filter by severity
            const minSeverity = options.severity;
            const severityOrder = ['low', 'medium', 'high', 'critical'];
            const minIndex = severityOrder.indexOf(minSeverity);
            
            const filteredResults = driftResults.filter((result: any) => {
              if (!result.hasDrift) return false;
              const resultIndex = severityOrder.indexOf(result.severity);
              return resultIndex >= minIndex;
            });

            // Report results
            if (filteredResults.length === 0) {
              Output.success('No drift detected');
            } else {
              Output.warning(`Found drift in ${filteredResults.length} resource(s)`);
              
              const bySeverity = {
                critical: filteredResults.filter((r: any) => r.severity === 'critical').length,
                high: filteredResults.filter((r: any) => r.severity === 'high').length,
                medium: filteredResults.filter((r: any) => r.severity === 'medium').length,
                low: filteredResults.filter((r: any) => r.severity === 'low').length
              };

              console.log(`  Critical: ${bySeverity.critical}, High: ${bySeverity.high}, Medium: ${bySeverity.medium}, Low: ${bySeverity.low}`);

              // Show top 3 critical/high issues
              const topIssues = filteredResults
                .filter((r: any) => r.severity === 'critical' || r.severity === 'high')
                .slice(0, 3);

              if (topIssues.length > 0) {
                console.log('\n  Top issues:');
                topIssues.forEach((result: any) => {
                  Output.driftResult(result);
                });
              }
            }

            const nextScan = new Date(Date.now() + interval * 60 * 1000).toLocaleTimeString();
            console.log(chalk.gray(`\nNext scan at ${nextScan}`));

          } catch (error) {
            Output.error('Scan failed:', error);
          }
        };

        // Initial scan
        await performScan();

        // Schedule periodic scans
        setInterval(performScan, interval * 60 * 1000);

      } catch (error) {
        Output.error('Watch command failed:', error);
        process.exit(1);
      }
    });

  return command;
}

// Import chalk for the watch command
import chalk from 'chalk';
