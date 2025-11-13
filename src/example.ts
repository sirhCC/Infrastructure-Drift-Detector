/**
 * Example: AWS Drift Detection
 * 
 * This example shows how to:
 * 1. Parse Terraform files
 * 2. Scan actual AWS resources
 * 3. Detect configuration drift
 */

import { TerraformParser } from './parsers/terraform';
import { AWSScanner } from './scanners/aws/index';
import { DriftDetector } from './detector';

async function main() {
  try {
    console.log('=== Infrastructure Drift Detection Example ===\n');

    // Step 1: Parse Terraform files to get expected state
    console.log('Step 1: Parsing Terraform configuration...');
    const parser = new TerraformParser();
    const iacDefinition = parser.parse('./infrastructure/main.tf');
    // Or parse entire directory: parser.parseDirectory('./infrastructure');
    
    console.log(`✓ Found ${iacDefinition.resources.length} resources in IaC definition\n`);

    // Step 2: Scan actual AWS resources
    console.log('Step 2: Scanning AWS resources...');
    const awsScanner = new AWSScanner(
      {
        region: 'us-east-1'
        // Optional: provide credentials if not using default AWS credential chain
        // accessKeyId: 'YOUR_ACCESS_KEY',
        // secretAccessKey: 'YOUR_SECRET_KEY'
      },
      {
        // Optionally limit what to scan
        includeEC2: true,
        includeS3: true,
        includeVPC: true,
        includeSecurityGroups: true,
        includeRDS: true
      }
    );

    const actualResources = await awsScanner.scan();
    console.log(`✓ Found ${actualResources.length} actual resources in AWS\n`);

    // Step 3: Detect drift
    console.log('Step 3: Detecting drift...');
    const detector = new DriftDetector({
      providers: ['aws'],
      ignoreProperties: [
        'launch_time',
        'created_at',
        'last_modified',
        'status'
      ]
    });

    const driftResults = detector.detectDrift(
      iacDefinition.resources,
      actualResources
    );

    // Step 4: Display results
    console.log('\n=== Drift Detection Results ===\n');
    
    const driftedResources = driftResults.filter(r => r.hasDrift);
    
    if (driftedResources.length === 0) {
      console.log('✓ No drift detected! All resources match IaC definitions.');
    } else {
      console.log(`⚠ Found drift in ${driftedResources.length} resource(s):\n`);
      
      driftedResources.forEach(result => {
        console.log(`\n📦 Resource: ${result.resourceName} (${result.resourceId})`);
        console.log(`   Severity: ${result.severity.toUpperCase()}`);
        console.log(`   Drifted Properties:`);
        
        result.driftedProperties.forEach(prop => {
          console.log(`   - ${prop.propertyPath} [${prop.changeType}]`);
          console.log(`     Expected: ${JSON.stringify(prop.expectedValue)}`);
          console.log(`     Actual: ${JSON.stringify(prop.actualValue)}`);
        });
      });

      // Summary by severity
      console.log('\n=== Summary by Severity ===');
      const bySeverity = {
        critical: driftedResources.filter(r => r.severity === 'critical').length,
        high: driftedResources.filter(r => r.severity === 'high').length,
        medium: driftedResources.filter(r => r.severity === 'medium').length,
        low: driftedResources.filter(r => r.severity === 'low').length
      };
      
      console.log(`  Critical: ${bySeverity.critical}`);
      console.log(`  High: ${bySeverity.high}`);
      console.log(`  Medium: ${bySeverity.medium}`);
      console.log(`  Low: ${bySeverity.low}`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main };
