import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { PulumiAdapter } from '../../parsers/pulumi-adapter';
import { PulumiParserOptions } from '../../parsers/pulumi-types';
import { DriftDetector } from '../../detector';
import { CloudProvider, DriftResult } from '../../types';
import { AWSScanner } from '../../scanners/aws';
import { Output } from '../output';
import * as path from 'path';

/**
 * Display drift results
 */
function displayDriftResults(results: DriftResult[], format: string) {
  if (format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(chalk.green('✓ No drift detected'));
    return;
  }

  console.log(chalk.yellow(`⚠ Found ${results.length} drifted resources:\n`));

  for (const result of results) {
    if (!result.hasDrift) continue;

    console.log(chalk.bold(`Resource: ${result.resourceName}`));
    console.log(chalk.gray(`  ID: ${result.resourceId}`));
    console.log(chalk.gray(`  Severity: ${result.severity}`));
    console.log(chalk.gray(`  Drifted Properties: ${result.driftedProperties.length}\n`));

    if (format === 'table') {
      for (const prop of result.driftedProperties) {
        console.log(chalk.cyan(`    ${prop.propertyPath}:`));
        console.log(chalk.gray(`      Expected: ${JSON.stringify(prop.expectedValue)}`));
        console.log(chalk.gray(`      Actual: ${JSON.stringify(prop.actualValue)}`));
        console.log();
      }
    }
  }
}

/**
 * CLI command for Pulumi-based drift detection
 */
export const pulumiCommand = new Command('pulumi')
  .description('Scan Pulumi projects for drift')
  .option('-d, --dir <directory>', 'Pulumi project directory', process.cwd())
  .option('-s, --stack <name>', 'Stack name (dev, prod, etc.)', 'dev')
  .option('-e, --export <file>', 'Path to stack export JSON file')
  .option('--include-export', 'Include stack export in analysis', false)
  .option('-p, --provider <provider>', 'Cloud provider (aws, azure, gcp)', 'aws')
  .option('-r, --region <region>', 'AWS region', 'us-east-1')
  .option('--profile <profile>', 'AWS profile name')
  .option('-o, --output <format>', 'Output format (json, table, summary)', 'table')
  .action(async (options) => {
    const spinner = ora('Initializing Pulumi drift detection').start();

    try {
      // Parse Pulumi project
      spinner.text = 'Parsing Pulumi project...';
      
      const pulumiOptions: PulumiParserOptions = {
        projectDir: path.resolve(options.dir),
        stackName: options.stack,
        includeStackExport: options.includeExport || !!options.export,
        stackExportPath: options.export ? path.resolve(options.export) : undefined,
        resolveConfig: true,
      };

      const adapter = new PulumiAdapter();
      const iacDefinition = await adapter.parseToIaCDefinition(pulumiOptions);

      spinner.succeed(`Parsed ${iacDefinition.resources.length} resources from Pulumi project`);

      // Scan cloud provider
      spinner.start('Scanning cloud resources...');
      
      const provider = options.provider as CloudProvider;
      let actualResources;

      switch (provider) {
        case 'aws':
          const awsScanner = new AWSScanner({
            region: options.region,
            profile: options.profile,
          });
          actualResources = await awsScanner.scan();
          break;
        case 'azure':
          spinner.fail('Azure scanning not yet implemented');
          process.exit(1);
        case 'gcp':
          spinner.fail('GCP scanning not yet implemented');
          process.exit(1);
        default:
          spinner.fail(`Unsupported provider: ${provider}`);
          process.exit(1);
      }

      spinner.succeed(`Scanned ${actualResources.length} resources from ${provider.toUpperCase()}`);

      // Detect drift
      spinner.start('Analyzing drift...');
      
      const detector = new DriftDetector({
        providers: [provider],
        ignoreProperties: ['lastModified', 'createdAt', 'updatedAt'],
      });

      const driftResults = detector.detectDrift(
        iacDefinition.resources,
        actualResources
      );

      spinner.succeed('Drift analysis complete');

      // Display results
      console.log();
      console.log(chalk.bold.blue('='.repeat(60)));
      console.log(chalk.bold.blue(`  Pulumi Drift Detection Results`));
      console.log(chalk.bold.blue('='.repeat(60)));
      console.log();
      console.log(chalk.gray(`Project: ${pulumiOptions.projectDir}`));
      console.log(chalk.gray(`Stack: ${options.stack}`));
      console.log(chalk.gray(`Provider: ${provider.toUpperCase()}`));
      console.log();

      displayDriftResults(driftResults, options.output);

      // Exit with appropriate code
      const hasDrift = driftResults.some((r) => r.hasDrift);
      process.exit(hasDrift ? 1 : 0);
    } catch (error) {
      spinner.fail('Pulumi drift detection failed');
      console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
