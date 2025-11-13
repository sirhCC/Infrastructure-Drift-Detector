import { Command } from 'commander';
import { Output } from '../output';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Report command - generate drift reports
 */
export function createReportCommand(): Command {
  const command = new Command('report');

  command
    .description('Generate drift detection reports from previous scans')
    .argument('[input]', 'Input JSON file with drift results')
    .option('-f, --format <format>', 'Output format (html, csv, markdown)', 'html')
    .option('-o, --output <path>', 'Output file path')
    .option('--title <title>', 'Report title', 'Infrastructure Drift Report')
    .action(async (input, options) => {
      try {
        Output.header('Report Generation');

        // Load drift results
        let driftResults: any[] = [];
        
        if (input) {
          const spinner = Output.spinner(`Loading drift results from ${input}...`).start();
          const content = fs.readFileSync(input, 'utf-8');
          driftResults = JSON.parse(content);
          spinner.succeed(`Loaded ${driftResults.length} drift results`);
        } else {
          Output.error('No input file specified');
          Output.info('Use: drift-detector report <input.json>');
          process.exit(1);
        }

        // Generate report
        const spinner = Output.spinner(`Generating ${options.format.toUpperCase()} report...`).start();
        
        let reportContent: string;
        let ext: string;

        switch (options.format) {
          case 'html':
            reportContent = generateHTMLReport(driftResults, options.title);
            ext = '.html';
            break;
          case 'csv':
            reportContent = generateCSVReport(driftResults);
            ext = '.csv';
            break;
          case 'markdown':
            reportContent = generateMarkdownReport(driftResults, options.title);
            ext = '.md';
            break;
          default:
            spinner.fail(`Unsupported format: ${options.format}`);
            process.exit(1);
        }

        // Save report
        const outputPath = options.output || `drift-report-${Date.now()}${ext}`;
        fs.writeFileSync(outputPath, reportContent, 'utf-8');
        
        spinner.succeed(`Report generated: ${outputPath}`);
        
        Output.header('Report Summary');
        Output.table([
          { label: 'Format', value: options.format.toUpperCase() },
          { label: 'Output', value: outputPath },
          { label: 'Resources', value: driftResults.length },
          { label: 'With Drift', value: driftResults.filter(r => r.hasDrift).length }
        ]);

      } catch (error) {
        Output.error('Report generation failed:', error);
        process.exit(1);
      }
    });

  return command;
}

/**
 * Generate HTML report
 */
function generateHTMLReport(results: any[], title: string): string {
  const driftedResources = results.filter(r => r.hasDrift);
  const timestamp = new Date().toISOString();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .summary-card { background: #f9f9f9; padding: 20px; border-radius: 4px; text-align: center; }
    .summary-card .value { font-size: 2em; font-weight: bold; color: #4CAF50; }
    .summary-card .label { color: #666; margin-top: 5px; }
    .critical { color: #d32f2f; }
    .high { color: #f57c00; }
    .medium { color: #fbc02d; }
    .low { color: #1976d2; }
    .resource { background: #fff; border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .resource-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .resource-name { font-weight: bold; font-size: 1.1em; }
    .severity-badge { padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: bold; color: white; }
    .severity-badge.critical { background: #d32f2f; }
    .severity-badge.high { background: #f57c00; }
    .severity-badge.medium { background: #fbc02d; color: #333; }
    .severity-badge.low { background: #1976d2; }
    .property { margin: 8px 0 8px 20px; padding: 8px; background: #f5f5f5; border-left: 3px solid #2196F3; }
    .property-name { font-weight: bold; color: #333; }
    .property-value { margin-left: 20px; font-family: monospace; font-size: 0.9em; }
    .timestamp { color: #999; font-size: 0.9em; text-align: right; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <div class="timestamp">Generated: ${timestamp}</div>
    
    <div class="summary">
      <div class="summary-card">
        <div class="value">${results.length}</div>
        <div class="label">Total Resources</div>
      </div>
      <div class="summary-card">
        <div class="value critical">${driftedResources.filter(r => r.severity === 'critical').length}</div>
        <div class="label">Critical</div>
      </div>
      <div class="summary-card">
        <div class="value high">${driftedResources.filter(r => r.severity === 'high').length}</div>
        <div class="label">High</div>
      </div>
      <div class="summary-card">
        <div class="value medium">${driftedResources.filter(r => r.severity === 'medium').length}</div>
        <div class="label">Medium</div>
      </div>
    </div>

    <h2>Drifted Resources (${driftedResources.length})</h2>
    ${driftedResources.map(resource => `
      <div class="resource">
        <div class="resource-header">
          <span class="resource-name">${resource.resourceName}</span>
          <span class="severity-badge ${resource.severity}">${resource.severity.toUpperCase()}</span>
        </div>
        <div style="color: #666; font-size: 0.9em; margin-bottom: 10px;">${resource.resourceId}</div>
        ${resource.driftedProperties.map((prop: any) => `
          <div class="property">
            <div class="property-name">${prop.propertyPath} [${prop.changeType}]</div>
            <div class="property-value">Expected: ${JSON.stringify(prop.expectedValue)}</div>
            <div class="property-value">Actual: ${JSON.stringify(prop.actualValue)}</div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  </div>
</body>
</html>`;
}

/**
 * Generate CSV report
 */
function generateCSVReport(results: any[]): string {
  const rows = ['Resource ID,Resource Name,Severity,Property,Change Type,Expected Value,Actual Value'];
  
  results.filter(r => r.hasDrift).forEach(resource => {
    resource.driftedProperties.forEach((prop: any) => {
      rows.push([
        resource.resourceId,
        resource.resourceName,
        resource.severity,
        prop.propertyPath,
        prop.changeType,
        JSON.stringify(prop.expectedValue).replace(/"/g, '""'),
        JSON.stringify(prop.actualValue).replace(/"/g, '""')
      ].map(v => `"${v}"`).join(','));
    });
  });

  return rows.join('\n');
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(results: any[], title: string): string {
  const driftedResources = results.filter(r => r.hasDrift);
  const timestamp = new Date().toISOString();

  let markdown = `# ${title}\n\n`;
  markdown += `**Generated:** ${timestamp}\n\n`;
  
  // Summary
  markdown += `## Summary\n\n`;
  markdown += `| Metric | Count |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Resources | ${results.length} |\n`;
  markdown += `| Critical | ${driftedResources.filter(r => r.severity === 'critical').length} |\n`;
  markdown += `| High | ${driftedResources.filter(r => r.severity === 'high').length} |\n`;
  markdown += `| Medium | ${driftedResources.filter(r => r.severity === 'medium').length} |\n`;
  markdown += `| Low | ${driftedResources.filter(r => r.severity === 'low').length} |\n\n`;

  // Drifted resources
  markdown += `## Drifted Resources (${driftedResources.length})\n\n`;
  
  driftedResources.forEach(resource => {
    markdown += `### ${resource.resourceName} [${resource.severity.toUpperCase()}]\n\n`;
    markdown += `**ID:** \`${resource.resourceId}\`\n\n`;
    markdown += `**Drifted Properties:**\n\n`;
    
    resource.driftedProperties.forEach((prop: any) => {
      markdown += `- **${prop.propertyPath}** [${prop.changeType}]\n`;
      markdown += `  - Expected: \`${JSON.stringify(prop.expectedValue)}\`\n`;
      markdown += `  - Actual: \`${JSON.stringify(prop.actualValue)}\`\n`;
    });
    
    markdown += `\n`;
  });

  return markdown;
}
