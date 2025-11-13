import { Command } from 'commander';
import {
  AnomalyDetector,
  SecurityDetector,
  CostAnalyzer,
  ComplianceChecker,
} from '../../detection';
import { DriftHistoryStore } from '../../reporting/history';
import { DetectedResource } from '../../types';
import chalk from 'chalk';

export function createAnalyzeCommand(): Command {
  const command = new Command('analyze');

  command
    .description('Advanced drift analysis with ML, security, cost, and compliance checks')
    .option('-p, --project <name>', 'Project name', 'default')
    .option('--anomalies', 'Detect anomalous drift patterns using ML')
    .option('--security', 'Check for security policy violations')
    .option('--cost', 'Analyze cost impact of drift')
    .option('--compliance <framework>', 'Check compliance (CIS, PCI-DSS, HIPAA, SOC2)')
    .option('--all', 'Run all analysis types')
    .option('--min-samples <number>', 'Minimum historical samples for ML (default: 10)', '10')
    .option('--threshold <number>', 'Anomaly detection threshold 0-1 (default: 0.7)', '0.7')
    .option('-o, --output <file>', 'Output file for results')
    .action(async (options) => {
      try {
        console.log(chalk.blue.bold('\n🔍 Advanced Drift Analysis\n'));

        // Load historical data
        const historyStore = new DriftHistoryStore(options.project);
        const history = historyStore.getAllScans();

        if (history.length === 0) {
          console.log(chalk.yellow('⚠️  No historical data found. Run some scans first.'));
          return;
        }

        const latestScan = history[history.length - 1];
        const resources: DetectedResource[] = (latestScan as any).drifts || [];

        console.log(chalk.gray(`Analyzing ${resources.length} resources from latest scan...`));
        console.log(chalk.gray(`Historical data: ${history.length} scans\n`));

        const results: any = {
          timestamp: new Date().toISOString(),
          project: options.project,
          resourceCount: resources.length,
        };

        // Anomaly Detection
        if (options.anomalies || options.all) {
          console.log(chalk.cyan.bold('🤖 Machine Learning Anomaly Detection'));
          const detector = new AnomalyDetector({
            threshold: parseFloat(options.threshold),
            minSamples: parseInt(options.minSamples),
          });

          const anomalies = await detector.detectAnomalies(resources, history as any);
          results.anomalies = anomalies;

          console.log(chalk.gray(`Found ${anomalies.length} anomalous resources\n`));

          if (anomalies.length > 0) {
            console.log(chalk.bold('Top Anomalies:'));
            for (const anomaly of anomalies.slice(0, 5)) {
              const scoreColor = anomaly.score > 0.9 ? chalk.red : anomaly.score > 0.7 ? chalk.yellow : chalk.white;
              console.log(`  ${scoreColor('●')} ${anomaly.resourceId}`);
              console.log(`    Score: ${scoreColor(anomaly.score.toFixed(2))} | Confidence: ${anomaly.confidence.toFixed(2)}`);
              console.log(`    Reason: ${anomaly.reason}`);
              console.log(`    Features: ${Object.entries(anomaly.features).map(([k, v]) => `${k}=${(v as number).toFixed(2)}`).join(', ')}\n`);
            }
          }
        }

        // Security Violations
        if (options.security || options.all) {
          console.log(chalk.cyan.bold('🔒 Security Policy Violations'));
          const securityDetector = new SecurityDetector();
          const violations = await securityDetector.detectViolations(resources);
          results.securityViolations = violations;

          console.log(chalk.gray(`Found ${violations.length} security violations\n`));

          if (violations.length > 0) {
            const critical = violations.filter(v => v.severity === 'critical');
            const high = violations.filter(v => v.severity === 'high');

            if (critical.length > 0) {
              console.log(chalk.red.bold(`⚠️  ${critical.length} CRITICAL violations:`));
              for (const v of critical) {
                console.log(`  ${chalk.red('●')} ${v.violationType} - ${v.resourceId}`);
                console.log(`    ${v.description}`);
                console.log(`    ${chalk.gray('Remediation:')} ${v.remediation}\n`);
              }
            }

            if (high.length > 0) {
              console.log(chalk.yellow.bold(`⚠️  ${high.length} HIGH severity violations:`));
              for (const v of high.slice(0, 3)) {
                console.log(`  ${chalk.yellow('●')} ${v.violationType} - ${v.resourceId}`);
                console.log(`    ${v.description}\n`);
              }
            }
          } else {
            console.log(chalk.green('✓ No security violations detected\n'));
          }
        }

        // Cost Impact Analysis
        if (options.cost || options.all) {
          console.log(chalk.cyan.bold('💰 Cost Impact Analysis'));
          const costAnalyzer = new CostAnalyzer();
          const impacts = await costAnalyzer.analyzeCostImpact(resources);
          results.costImpacts = impacts;

          if (impacts.length > 0) {
            const totals = costAnalyzer.getTotalCostImpact(impacts);
            
            console.log(chalk.bold('Summary:'));
            console.log(`  Total Cost Increases: ${chalk.red(`$${totals.totalIncrease.toFixed(2)}/month`)}`);
            console.log(`  Total Cost Decreases: ${chalk.green(`$${totals.totalDecrease.toFixed(2)}/month`)}`);
            const netColor = totals.netImpact > 0 ? chalk.red : chalk.green;
            console.log(`  Net Impact: ${netColor(`$${Math.abs(totals.netImpact).toFixed(2)}/month`)}`);
            console.log(`  Affected Resources: ${totals.affectedResources}\n`);

            console.log(chalk.bold('Top Cost Impacts:'));
            for (const impact of impacts.slice(0, 5)) {
              const impactColor = impact.driftCostImpact > 0 ? chalk.red : chalk.green;
              const symbol = impact.driftCostImpact > 0 ? '+' : '';
              console.log(`  ${impactColor('●')} ${impact.resourceId}`);
              console.log(`    Current: $${impact.currentMonthlyCost.toFixed(2)}/month`);
              console.log(`    Impact: ${impactColor(`${symbol}$${impact.driftCostImpact.toFixed(2)}/month (${impact.impactPercentage.toFixed(1)}%)`)}`);
              console.log(`    ${chalk.gray(impact.recommendation)}\n`);
            }
          } else {
            console.log(chalk.gray('No significant cost impact detected\n'));
          }
        }

        // Compliance Checking
        if (options.compliance || options.all) {
          const framework = options.compliance || 'CIS';
          console.log(chalk.cyan.bold(`📋 Compliance Check: ${framework}`));
          
          const checker = new ComplianceChecker();
          const report = await checker.checkCompliance(resources, framework);
          results.compliance = report;

          const scoreColor = report.complianceScore >= 80 ? chalk.green : report.complianceScore >= 60 ? chalk.yellow : chalk.red;
          
          console.log(chalk.bold('Compliance Score:'), scoreColor(`${report.complianceScore.toFixed(1)}%`));
          console.log(`  Passed Controls: ${chalk.green(report.passedControls)}`);
          console.log(`  Failed Controls: ${chalk.red(report.failedControls)}`);
          console.log(`  Total Controls: ${report.totalControls}\n`);

          console.log(chalk.bold('Violations by Severity:'));
          console.log(`  Critical: ${chalk.red(report.summary.critical)}`);
          console.log(`  High: ${chalk.yellow(report.summary.high)}`);
          console.log(`  Medium: ${report.summary.medium}`);
          console.log(`  Low: ${chalk.gray(report.summary.low)}\n`);

          if (report.violations.length > 0) {
            console.log(chalk.bold('Top Violations:'));
            const topViolations = report.violations
              .sort((a, b) => {
                const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
              })
              .slice(0, 5);

            for (const v of topViolations) {
              const sevColor = v.severity === 'critical' ? chalk.red : v.severity === 'high' ? chalk.yellow : chalk.white;
              console.log(`  ${sevColor('●')} ${v.controlId}: ${v.controlName}`);
              console.log(`    Resource: ${v.resourceId}`);
              console.log(`    ${v.description}`);
              console.log(`    ${chalk.gray('Fix:')} ${v.remediation}\n`);
            }
          }
        }

        // Save results
        if (options.output) {
          const fs = require('fs');
          fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
          console.log(chalk.green(`\n✓ Results saved to ${options.output}`));
        }

        console.log(chalk.blue.bold('\n✓ Analysis complete\n'));
      } catch (error) {
        console.error(chalk.red('Error during analysis:'), error);
        process.exit(1);
      }
    });

  return command;
}
