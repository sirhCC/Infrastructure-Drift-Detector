/**
 * Auto-Remediation Example
 * Demonstrates how to use the remediation engine
 */

import { RemediationEngine } from './remediation/engine';
import { RemediationSeverity } from './remediation/types';
import { DriftDetector } from './detector';
import { TerraformParser } from './parsers/terraform';
import { AWSScanner } from './scanners/aws';

async function remediationExample() {
  console.log('🔧 Auto-Remediation Example\n');

  // Step 1: Detect drift (from previous scan)
  console.log('1. Detecting drift...');
  
  const parser = new TerraformParser();
  const iacDefinition = parser.parse('./examples/terraform/main.tf');
  const iacResources = iacDefinition.resources;

  const scanner = new AWSScanner({
    region: 'us-east-1',
    profile: 'default'
  });

  const actualResources = await scanner.scan();

  const detector = new DriftDetector({
    providers: ['aws'],
    ignoreProperties: ['arn', 'id', 'created_at']
  });

  const driftResults = detector.detectDrift(iacResources, actualResources);
  const drifted = driftResults.filter(r => r.hasDrift);

  console.log(`   Found ${drifted.length} resources with drift\n`);

  if (drifted.length === 0) {
    console.log('✅ No drift detected. Nothing to remediate.');
    return;
  }

  // Step 2: Create remediation plan (dry-run mode)
  console.log('2. Creating remediation plan (dry-run)...');

  const engine = new RemediationEngine({
    dryRun: true,                    // Preview only
    autoApprove: false,              // Require manual approval
    requireApprovalFor: [
      RemediationSeverity.MEDIUM_RISK,
      RemediationSeverity.HIGH_RISK,
      RemediationSeverity.CRITICAL
    ],
    terraformPath: 'terraform',
    terraformWorkDir: './examples/terraform',
    maxConcurrent: 3,
    continueOnError: false,
    rollbackOnError: true,
    backupBeforeChange: true,
    destructiveActionsAllowed: false,
    logDir: './remediation-logs',
    verboseLogging: true
  });

  const plan = await engine.createPlan(driftResults, 'scan-123');

  console.log(`   Created plan with ${plan.totalActions} actions`);
  console.log(`   - Safe actions: ${plan.safeActions}`);
  console.log(`   - Requires approval: ${plan.requiresApproval}`);
  console.log(`   - Critical: ${plan.criticalActions}\n`);

  // Step 3: Preview actions
  console.log('3. Preview of remediation actions:\n');

  plan.actions.slice(0, 5).forEach((action, i) => {
    console.log(`   ${i + 1}. [${action.severity}] ${action.resourceName}`);
    console.log(`      Property: ${action.propertyPath}`);
    console.log(`      Change: ${action.currentValue} → ${action.desiredValue}`);
    console.log(`      Strategy: ${action.strategy}`);
    console.log();
  });

  if (plan.actions.length > 5) {
    console.log(`   ... and ${plan.actions.length - 5} more actions\n`);
  }

  // Step 4: Execute plan (dry-run)
  console.log('4. Executing dry-run...');

  const results = await engine.executePlan(plan);

  console.log(`   Execution complete:`);
  console.log(`   - Succeeded: ${results.filter(r => r.success).length}`);
  console.log(`   - Failed: ${results.filter(r => !r.success).length}\n`);

  // Step 5: Show example results
  console.log('5. Sample results:\n');

  results.slice(0, 3).forEach((result, i) => {
    const status = result.success ? '✓' : '✗';
    console.log(`   ${status} ${result.action.resourceName}.${result.action.propertyPath}`);
    console.log(`      Duration: ${result.duration}ms`);
    if (result.action.terraformPlan) {
      console.log(`      Plan preview: ${result.action.terraformPlan.slice(0, 100)}...`);
    }
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
    console.log();
  });

  // Step 6: Actually apply changes (if not dry-run)
  console.log('6. To apply changes for real:\n');
  console.log('   // Update config');
  console.log('   engine.updateConfig({ dryRun: false });\n');
  console.log('   // Execute again');
  console.log('   const liveResults = await engine.executePlan(plan);\n');

  // Step 7: Approval workflow example
  console.log('7. Approval workflow:\n');
  console.log('   // Get actions requiring approval');
  console.log('   const needsApproval = plan.actions.filter(a => a.requiresApproval);\n');
  console.log('   // Approve specific action');
  console.log('   await engine.approveAction(needsApproval[0].id, "admin@example.com");\n');

  // Step 8: Rollback example
  console.log('8. Rollback on failure:');
  console.log('   - Automatic rollback is enabled by default');
  console.log('   - State backups are created before changes');
  console.log('   - Failed actions can be rolled back automatically\n');

  console.log('✅ Remediation example complete!');
}

// Example: Safe auto-remediation (tags only)
async function autoRemediateTags() {
  console.log('🏷️  Auto-Remediate Tags Example\n');

  const engine = new RemediationEngine({
    dryRun: false,                   // Actually apply changes
    autoApprove: true,               // Auto-approve safe actions
    requireApprovalFor: [            // Only auto-approve SAFE severity
      RemediationSeverity.LOW_RISK,
      RemediationSeverity.MEDIUM_RISK,
      RemediationSeverity.HIGH_RISK,
      RemediationSeverity.CRITICAL
    ],
    includeResources: [],            // Only remediate resources with...
    backupBeforeChange: true,
    rollbackOnError: true
  });

  // Filter to only tag changes
  console.log('This would only remediate tag changes automatically.\n');
  console.log('Higher risk changes would require manual approval.');
}

// Example: Targeted remediation
async function targetedRemediation() {
  console.log('🎯 Targeted Remediation Example\n');

  const engine = new RemediationEngine({
    dryRun: false,
    autoApprove: false,
    includeResources: ['aws_instance.web_server'],  // Only this resource
    excludeResources: ['aws_instance.database'],    // Skip this one
    maxActionsPerRun: 10,                           // Limit actions
    destructiveActionsAllowed: false                // No deletions
  });

  console.log('This would only remediate:');
  console.log('  - aws_instance.web_server');
  console.log('  - Maximum 10 actions');
  console.log('  - No destructive operations\n');
}

// Run examples
if (require.main === module) {
  remediationExample()
    .then(() => console.log('\n' + '='.repeat(50) + '\n'))
    .then(() => autoRemediateTags())
    .then(() => console.log('\n' + '='.repeat(50) + '\n'))
    .then(() => targetedRemediation())
    .catch(console.error);
}
