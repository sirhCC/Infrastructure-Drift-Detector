#!/usr/bin/env node

import { Command } from 'commander';
import { createScanCommand } from './commands/scan';
import { createCompareCommand } from './commands/compare';
import { createReportCommand } from './commands/report';
import { createWatchCommand } from './commands/watch';
import { createHistoryCommand } from './commands/history';
import { remediateCommand } from './commands/remediate';
import { pulumiCommand } from './commands/pulumi';
import chalk from 'chalk';

const program = new Command();

program
  .name('drift-detector')
  .description('Infrastructure Drift Detector - Monitor cloud infrastructure for configuration drift')
  .version('0.1.0');

// ASCII Art Banner
console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   Infrastructure Drift Detector                      ║
║   Monitor & detect configuration drift               ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`));

// Add commands
program.addCommand(createScanCommand());
program.addCommand(createCompareCommand());
program.addCommand(createReportCommand());
program.addCommand(createWatchCommand());
program.addCommand(createHistoryCommand());
program.addCommand(remediateCommand);
program.addCommand(pulumiCommand);

// Init command
program
  .command('init')
  .description('Initialize a new drift detector configuration')
  .option('-f, --format <format>', 'Configuration format (yaml, json)', 'yaml')
  .action((options) => {
    console.log(chalk.green('✓'), 'Initializing drift detector configuration...\n');
    
    const configTemplate = options.format === 'json' 
      ? './examples/config/drift-detector.json'
      : './examples/config/drift-detector.yml';
    
    console.log('Creating configuration file:', chalk.cyan(configTemplate));
    console.log('\nNext steps:');
    console.log('  1. Edit the configuration file with your settings');
    console.log('  2. Configure your cloud provider credentials');
    console.log('  3. Run:', chalk.cyan('drift-detector scan'));
    console.log('\nFor more information, see the README.md\n');
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
