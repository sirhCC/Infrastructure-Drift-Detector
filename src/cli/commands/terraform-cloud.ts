import { Command } from 'commander';
import { TerraformCloudClient } from '../../integrations/terraform-cloud';
import { DriftDetector } from '../../detector';
import { DriftHistoryStore } from '../../reporting/history';
import chalk from 'chalk';

export function createTerraformCloudCommand(): Command {
  const command = new Command('tfc');

  command
    .description('Terraform Cloud/Enterprise integration')
    .option('--token <token>', 'Terraform Cloud API token (or TFC_TOKEN env var)')
    .option('--org <organization>', 'Terraform Cloud organization')
    .option('--workspace <name>', 'Workspace name');

  // List workspaces
  command
    .command('list-workspaces')
    .description('List all workspaces in organization')
    .action(async (options, cmd) => {
      const parent = cmd.parent.opts();
      const client = createClient(parent);

      try {
        const workspaces = await client.listWorkspaces();
        
        console.log(chalk.blue.bold('\n📦 Terraform Cloud Workspaces\n'));
        
        for (const ws of workspaces) {
          const lockIcon = ws.locked ? '🔒' : '  ';
          console.log(`${lockIcon} ${chalk.bold(ws.name)}`);
          console.log(`   Terraform: ${ws.terraformVersion}`);
          console.log(`   ID: ${chalk.gray(ws.id)}\n`);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Sync drift to TFC
  command
    .command('sync-drift')
    .description('Sync drift detection results to Terraform Cloud')
    .option('-p, --project <name>', 'Project name', 'default')
    .action(async (options, cmd) => {
      const parent = cmd.parent.opts();
      const client = createClient(parent);

      try {
        console.log(chalk.blue.bold('\n🔄 Syncing Drift to Terraform Cloud\n'));

        // Get latest drift scan
        const historyStore = new DriftHistoryStore(options.project);
        const history = historyStore.getAllScans();
        
        if (history.length === 0) {
          console.log(chalk.yellow('No drift history found. Run a scan first.'));
          return;
        }

        const latestScan = history[history.length - 1];
        const driftCount = latestScan.driftedResources;

        console.log(`Found ${driftCount} drifted resources`);

        // Set workspace variable with drift count
        await client.setWorkspaceVariable(
          parent.workspace,
          'DRIFT_COUNT',
          driftCount.toString(),
          false,
          'env'
        );

        console.log(chalk.green(`✓ Synced drift count to workspace variable DRIFT_COUNT`));

        // Trigger plan if drift detected
        if (driftCount > 0) {
          console.log(chalk.yellow('\n⚠️  Triggering Terraform plan due to drift...'));
          
          const runId = await client.createRun(
            parent.workspace,
            `Drift detected: ${driftCount} resources have drift`
          );

          console.log(chalk.green(`✓ Created run: ${runId}`));
          console.log(`   View at: https://app.terraform.io/app/${parent.org}/workspaces/${parent.workspace}/runs/${runId}`);
        }

      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Get current state
  command
    .command('get-state')
    .description('Download current Terraform state from workspace')
    .option('-o, --output <file>', 'Output file', 'terraform.tfstate')
    .action(async (options, cmd) => {
      const parent = cmd.parent.opts();
      const client = createClient(parent);

      try {
        console.log(chalk.blue('Downloading state from Terraform Cloud...'));

        const state = await client.getCurrentState(parent.workspace);
        
        const fs = require('fs');
        fs.writeFileSync(options.output, JSON.stringify(state, null, 2));

        console.log(chalk.green(`✓ State saved to ${options.output}`));
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Run drift scan against TFC state
  command
    .command('scan')
    .description('Run drift scan using Terraform Cloud state')
    .option('-p, --project <name>', 'Project name', 'default')
    .option('--terraform <path>', 'Path to Terraform files', './infrastructure')
    .action(async (options, cmd) => {
      const parent = cmd.parent.opts();
      const client = createClient(parent);

      try {
        console.log(chalk.blue.bold('\n🔍 Scanning for Drift (Terraform Cloud)\n'));

        // Download current state
        console.log('Downloading state from Terraform Cloud...');
        const state = await client.getCurrentState(parent.workspace);

        // Save temporarily
        const fs = require('fs');
        const tmpState = './.tfc-state.json';
        fs.writeFileSync(tmpState, JSON.stringify(state, null, 2));

        // Run drift detection
        const detector = new DriftDetector({
          providers: ['aws', 'azure', 'gcp'],
        });

        console.log('Scanning for drift...\n');
        // Note: This would need to be adapted to use TFC state
        console.log(chalk.yellow('⚠️  Full drift detection against TFC state coming soon'));
        console.log(chalk.gray('For now, download state and run: drift-detector scan --state ./.tfc-state.json'));

        // Cleanup
        fs.unlinkSync(tmpState);

      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Setup webhook
  command
    .command('setup-webhook')
    .description('Configure webhook for Terraform Cloud notifications')
    .requiredOption('--url <url>', 'Webhook URL')
    .action(async (options, cmd) => {
      const parent = cmd.parent.opts();
      const client = createClient(parent);

      try {
        await client.createNotificationConfig(parent.workspace, options.url);
        console.log(chalk.green('✓ Webhook configured successfully'));
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  return command;
}

function createClient(options: any): TerraformCloudClient {
  const token = options.token || process.env.TFC_TOKEN;
  const organization = options.org || process.env.TFC_ORGANIZATION;
  const workspace = options.workspace || process.env.TFC_WORKSPACE;

  if (!token) {
    throw new Error('Terraform Cloud token is required (--token or TFC_TOKEN env var)');
  }

  if (!organization) {
    throw new Error('Organization is required (--org or TFC_ORGANIZATION env var)');
  }

  return new TerraformCloudClient({
    token,
    organization,
    workspace,
  });
}
