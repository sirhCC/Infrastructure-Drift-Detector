import { Command } from 'commander';
import { TerraformParser } from '../../parsers/terraform-enhanced';
import { DriftDetector } from '../../detector';
import { Output } from '../output';
import * as fs from 'fs';

/**
 * Compare command - compare two infrastructure states
 */
export function createCompareCommand(): Command {
  const command = new Command('compare');

  command
    .description('Compare two infrastructure states (Terraform vs actual, or file vs file)')
    .argument('<source>', 'Source Terraform file/directory or JSON state')
    .argument('[target]', 'Target Terraform file/directory or JSON state (if omitted, compares with current cloud state)')
    .option('-p, --provider <provider>', 'Cloud provider for target (aws, azure, gcp)', 'aws')
    .option('-r, --region <region>', 'Cloud provider region', 'us-east-1')
    .option('--format <format>', 'Output format (text, json)', 'text')
    .option('--ignore <properties...>', 'Properties to ignore during comparison')
    .action(async (source, target, options) => {
      try {
        Output.header('Infrastructure Comparison');

        // Parse source
        const sourceSpinner = Output.spinner(`Loading source: ${source}...`).start();
        const sourceResources = await loadResources(source);
        sourceSpinner.succeed(`Loaded ${sourceResources.length} resources from source`);

        // Parse target
        let targetResources;
        if (target) {
          const targetSpinner = Output.spinner(`Loading target: ${target}...`).start();
          targetResources = await loadResources(target);
          targetSpinner.succeed(`Loaded ${targetResources.length} resources from target`);
        } else {
          Output.info('No target specified, comparison against cloud state not yet implemented');
          Output.info('Please specify both source and target files/directories');
          process.exit(1);
        }

        // Compare
        const compareSpinner = Output.spinner('Comparing resources...').start();
        const detector = new DriftDetector({
          providers: [options.provider as any],
          ignoreProperties: options.ignore || []
        });

        const driftResults = detector.detectDrift(sourceResources, targetResources);
        compareSpinner.succeed('Comparison complete');

        // Display results
        Output.header('Comparison Results');

        const driftedResources = driftResults.filter((r: any) => r.hasDrift);

        if (options.format === 'json') {
          console.log(JSON.stringify(driftedResources, null, 2));
        } else {
          if (driftedResources.length === 0) {
            Output.success('No differences found! States are identical.');
          } else {
            Output.warning(`Found ${driftedResources.length} difference(s):\n`);

            driftedResources.forEach((result: any) => {
              console.log(`  📦 ${result.resourceName} (${result.resourceId})`);
              console.log(`     Severity: ${result.severity.toUpperCase()}`);
              
              result.driftedProperties.forEach((prop: any) => {
                console.log(`     • ${prop.propertyPath} [${prop.changeType}]`);
                console.log(`       Source:  ${JSON.stringify(prop.expectedValue)}`);
                console.log(`       Target:  ${JSON.stringify(prop.actualValue)}`);
              });
              console.log();
            });

            // Summary
            Output.header('Summary');
            const changeTypes = {
              added: driftedResources.flatMap((r: any) => 
                r.driftedProperties.filter((p: any) => p.changeType === 'added')
              ).length,
              removed: driftedResources.flatMap((r: any) => 
                r.driftedProperties.filter((p: any) => p.changeType === 'removed')
              ).length,
              modified: driftedResources.flatMap((r: any) => 
                r.driftedProperties.filter((p: any) => p.changeType === 'modified')
              ).length
            };

            Output.table([
              { label: 'Resources with drift', value: driftedResources.length },
              { label: 'Properties added', value: changeTypes.added },
              { label: 'Properties removed', value: changeTypes.removed },
              { label: 'Properties modified', value: changeTypes.modified }
            ]);
          }
        }

      } catch (error) {
        Output.error('Comparison failed:', error);
        process.exit(1);
      }
    });

  return command;
}

/**
 * Load resources from file or directory
 */
async function loadResources(path: string): Promise<any[]> {
  // Check if it's a JSON file
  if (path.endsWith('.json')) {
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
  }

  // Otherwise, treat as Terraform
  const parser = new TerraformParser();
  
  if (path.endsWith('.tf')) {
    const iacDef = parser.parse(path);
    return iacDef.resources;
  } else {
    const iacDefs = parser.parseDirectory(path);
    return iacDefs.flatMap((def: any) => def.resources);
  }
}
