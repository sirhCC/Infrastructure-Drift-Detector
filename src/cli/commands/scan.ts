import { Command } from 'commander';
import { ConfigLoader } from '../../config/loader';
import { TerraformParser } from '../../parsers/terraform-enhanced';
import { AWSScanner } from '../../scanners/aws/index';
import { DriftDetector } from '../../detector';
import { Output } from '../output';
import { DriftHistoryStore } from '../../reporting';
import { NotificationManager } from '../../notifications';
import { 
  NotificationConfig as NotificationManagerConfig,
  NotificationChannelConfig,
  SlackConfig,
  EmailConfig,
  TeamsConfig,
  DiscordConfig,
  WebhookConfig,
} from '../../notifications/types';

/**
 * Scan command - detect drift in infrastructure
 */
export function createScanCommand(): Command {
  const command = new Command('scan');

  command
    .description('Scan infrastructure and detect configuration drift')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-p, --provider <provider>', 'Cloud provider (aws, azure, gcp)', 'aws')
    .option('-r, --region <region>', 'Cloud provider region', 'us-east-1')
    .option('-t, --terraform <path>', 'Path to Terraform directory or file')
    .option('--format <format>', 'Output format (text, json)', 'text')
    .option('--severity <level>', 'Minimum severity to report (low, medium, high, critical)', 'low')
    .option('--no-history', 'Skip saving scan results to history')
    .option('--history-dir <path>', 'Directory for storing drift history', './drift-history')
    .option('--show-comparison', 'Show comparison with previous scan')
    .action(async (options) => {
      const scanStartTime = Date.now();
      try {
        Output.header('Infrastructure Drift Detection');

        // Load configuration
        const spinner = Output.spinner('Loading configuration...').start();
        const configLoader = options.config
          ? new ConfigLoader()
          : ConfigLoader.autoLoad();

        if (options.config) {
          configLoader.loadFromFile(options.config);
        }

        const config = configLoader.getConfig();
        spinner.succeed('Configuration loaded');

        // Validate configuration
        const validation = configLoader.validate();
        if (!validation.valid) {
          spinner.fail('Configuration validation failed');
          validation.errors.forEach(error => Output.error(error));
          process.exit(1);
        }

        // Parse Terraform files
        const terraformPath = options.terraform || config.terraform?.directories?.[0] || './infrastructure';
        const parseSpinner = Output.spinner(`Parsing Terraform configuration from ${terraformPath}...`).start();
        
        const parser = new TerraformParser();
        let iacDefinitions;

        try {
          if (terraformPath.endsWith('.tf')) {
            iacDefinitions = [parser.parse(terraformPath)];
          } else {
            iacDefinitions = parser.parseDirectory(terraformPath);
          }
          
          const totalResources = iacDefinitions.reduce((sum, def) => sum + def.resources.length, 0);
          parseSpinner.succeed(`Parsed ${totalResources} resources from Terraform`);
        } catch (error: any) {
          parseSpinner.fail('Failed to parse Terraform configuration');
          if (error.code === 'ENOENT') {
            Output.warning(`Terraform path not found: ${terraformPath}`);
            Output.info('Use --terraform flag to specify the correct path');
          } else {
            Output.error('Parse error:', error);
          }
          process.exit(1);
        }

        // Scan cloud resources
        const provider = options.provider || 'aws';
        const scanSpinner = Output.spinner(`Scanning ${provider.toUpperCase()} resources...`).start();

        let actualResources: any[] = [];

        if (provider === 'aws') {
          const awsConfig = config.providers?.aws || { enabled: true, region: options.region };
          const scanner = new AWSScanner(awsConfig);
          actualResources = await scanner.scan();
          scanSpinner.succeed(`Found ${actualResources.length} actual resources in ${provider.toUpperCase()}`);
        } else {
          scanSpinner.fail(`Provider ${provider} not yet supported`);
          process.exit(1);
        }

        // Detect drift
        const driftSpinner = Output.spinner('Detecting drift...').start();
        const expectedResources = iacDefinitions.flatMap(def => def.resources);
        
        const detector = new DriftDetector({
          providers: [provider as any],
          ignoreProperties: config.drift?.ignoreProperties
        });

        const driftResults = detector.detectDrift(expectedResources, actualResources);
        driftSpinner.succeed('Drift detection complete');

        // Initialize history store
        const historyStore = new DriftHistoryStore(options.historyDir);
        
        // Compare with previous scan if requested
        let comparison = null;
        if (options.showComparison) {
          comparison = historyStore.compareWithPrevious(driftResults);
        }

        // Save to history (unless disabled)
        if (options.history !== false) {
          const scanDuration = Date.now() - scanStartTime;
          const severityCounts = {
            critical: driftResults.filter(r => r.hasDrift && r.severity === 'critical').length,
            high: driftResults.filter(r => r.hasDrift && r.severity === 'high').length,
            medium: driftResults.filter(r => r.hasDrift && r.severity === 'medium').length,
            low: driftResults.filter(r => r.hasDrift && r.severity === 'low').length
          };

          const scanId = historyStore.addScan({
            provider,
            region: options.region,
            totalResources: actualResources.length,
            driftedResources: driftResults.filter(r => r.hasDrift).length,
            severityCounts,
            results: driftResults,
            metadata: {
              terraformPath,
              configFile: options.config,
              scanDuration
            }
          });

          Output.info(`Scan saved to history (ID: ${scanId})`);

          // Send notifications
          if (config.notifications?.enabled) {
            const notifySpinner = Output.spinner('Sending notifications...').start();
            try {
              const notificationConfig = convertToNotificationConfig(config.notifications);
              const notificationManager = new NotificationManager(notificationConfig);
              
              const notificationResults = await notificationManager.notify(driftResults, {
                provider,
                region: options.region,
                totalResources: actualResources.length,
                scanDuration,
                scanId,
              });

              const successful = notificationResults.filter(r => r.success).length;
              const failed = notificationResults.filter(r => !r.success).length;

              if (failed === 0) {
                notifySpinner.succeed(`Notifications sent to ${successful} channel(s)`);
              } else {
                notifySpinner.warn(`Notifications sent: ${successful} succeeded, ${failed} failed`);
                notificationResults.filter(r => !r.success).forEach(result => {
                  Output.error(`  ${result.channel}: ${result.error}`);
                });
              }
            } catch (error: any) {
              notifySpinner.fail(`Failed to send notifications: ${error.message}`);
            }
          }
        }

        // Filter by severity
        const minSeverity = options.severity;
        const severityOrder = ['low', 'medium', 'high', 'critical'];
        const minIndex = severityOrder.indexOf(minSeverity);
        
        const filteredResults = driftResults.filter(result => {
          if (!result.hasDrift) return false;
          const resultIndex = severityOrder.indexOf(result.severity);
          return resultIndex >= minIndex;
        });

        // Display comparison if available
        if (comparison) {
          Output.header('Comparison with Previous Scan');
          console.log();
          Output.info(`New drift: ${comparison.new.length}`);
          Output.success(`Fixed drift: ${comparison.fixed.length}`);
          Output.warning(`Ongoing drift: ${comparison.ongoing.length}`);
          console.log();

          if (comparison.new.length > 0) {
            Output.warning('Newly detected drift:');
            comparison.new.forEach(result => {
              console.log(`  • ${result.resourceId}`);
            });
            console.log();
          }

          if (comparison.fixed.length > 0) {
            Output.success('Fixed drift:');
            comparison.fixed.forEach(result => {
              console.log(`  • ${result.resourceId}`);
            });
            console.log();
          }
        }

        // Display results
        Output.header('Drift Detection Results');

        if (options.format === 'json') {
          console.log(JSON.stringify(filteredResults, null, 2));
        } else {
          // Text format
          if (filteredResults.length === 0) {
            Output.success('No drift detected! All resources match IaC definitions.');
          } else {
            Output.warning(`Found drift in ${filteredResults.length} resource(s):\n`);
            
            filteredResults.forEach(result => {
              Output.driftResult(result);
              
              if (result.driftedProperties.length > 0) {
                result.driftedProperties.slice(0, 3).forEach((prop: any) => {
                  console.log(`      ${prop.propertyPath}: ${prop.changeType}`);
                  console.log(`        Expected: ${JSON.stringify(prop.expectedValue)}`);
                  console.log(`        Actual: ${JSON.stringify(prop.actualValue)}`);
                });
                
                if (result.driftedProperties.length > 3) {
                  console.log(`      ... and ${result.driftedProperties.length - 3} more`);
                }
              }
              console.log();
            });

            // Summary by severity
            Output.header('Summary');
            const bySeverity = {
              critical: filteredResults.filter(r => r.severity === 'critical').length,
              high: filteredResults.filter(r => r.severity === 'high').length,
              medium: filteredResults.filter(r => r.severity === 'medium').length,
              low: filteredResults.filter(r => r.severity === 'low').length
            };

            Output.table([
              { label: 'Critical', value: bySeverity.critical },
              { label: 'High', value: bySeverity.high },
              { label: 'Medium', value: bySeverity.medium },
              { label: 'Low', value: bySeverity.low },
              { label: 'Total', value: filteredResults.length }
            ]);

            process.exit(filteredResults.length > 0 ? 1 : 0);
          }
        }

      } catch (error) {
        Output.error('Scan failed:', error);
        process.exit(1);
      }
    });

  return command;
}

/**
 * Convert config notification format to NotificationManager format
 */
function convertToNotificationConfig(configNotif: any): NotificationManagerConfig {
    const channels: NotificationChannelConfig[] = [];

    if (configNotif.channels?.slack) {
      channels.push({
        type: 'slack',
        enabled: true,
        config: {
          webhookUrl: configNotif.channels.slack.webhookUrl,
          channel: configNotif.channels.slack.channel,
          username: configNotif.channels.slack.username,
          iconEmoji: configNotif.channels.slack.iconEmoji,
        } as SlackConfig,
      });
    }

    if (configNotif.channels?.email) {
      channels.push({
        type: 'email',
        enabled: true,
        config: {
          host: configNotif.channels.email.smtp.host,
          port: configNotif.channels.email.smtp.port,
          secure: configNotif.channels.email.smtp.secure,
          auth: configNotif.channels.email.smtp.auth,
          from: configNotif.channels.email.from,
          to: configNotif.channels.email.to,
          cc: configNotif.channels.email.cc,
          subject: configNotif.channels.email.subject,
        } as EmailConfig,
      });
    }

    if (configNotif.channels?.teams) {
      channels.push({
        type: 'teams',
        enabled: true,
        config: {
          webhookUrl: configNotif.channels.teams.webhookUrl,
        } as TeamsConfig,
      });
    }

    if (configNotif.channels?.discord) {
      channels.push({
        type: 'discord',
        enabled: true,
        config: {
          webhookUrl: configNotif.channels.discord.webhookUrl,
          username: configNotif.channels.discord.username,
          avatarUrl: configNotif.channels.discord.avatarUrl,
        } as DiscordConfig,
      });
    }

    if (configNotif.channels?.webhook) {
      channels.push({
        type: 'webhook',
        enabled: true,
        config: {
          url: configNotif.channels.webhook.url,
          method: configNotif.channels.webhook.method,
          headers: configNotif.channels.webhook.headers,
          authentication: configNotif.channels.webhook.authentication,
        } as WebhookConfig,
      });
    }

    return {
      enabled: configNotif.enabled,
      channels,
      severityFilter: configNotif.filters?.severityFilter,
      minDriftPercentage: configNotif.filters?.minDriftPercentage,
      onlyOnNewDrift: configNotif.filters?.onlyOnNewDrift,
    };
}
