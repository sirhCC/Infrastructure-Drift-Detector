/**
 * Example: Drift History Tracking
 * 
 * This example demonstrates how to use the drift history tracking system
 * to store and analyze scan results over time.
 */

import { DriftHistoryStore } from './reporting';
import { DriftResult } from './types';

async function demonstrateHistory() {
  console.log('=== Drift History Tracking Demo ===\n');

  // Initialize history store
  const historyStore = new DriftHistoryStore('./examples/.drift-history');

  // Simulate first scan
  console.log('1. Adding first scan to history...');
  const firstScanResults: DriftResult[] = [
    {
      resourceId: 'i-1234567890abcdef0',
      resourceName: 'web-server-prod',
      resourceType: 'aws_instance',
      hasDrift: true,
      severity: 'high',
      driftedProperties: [
        {
          propertyPath: 'tags.Environment',
          expectedValue: 'production',
          actualValue: 'prod',
          changeType: 'modified'
        }
      ],
      detectedAt: new Date()
    },
    {
      resourceId: 'i-0987654321fedcba0',
      resourceName: 'db-server-1',
      resourceType: 'aws_instance',
      hasDrift: false,
      severity: 'low',
      driftedProperties: [],
      detectedAt: new Date()
    }
  ];

  const scanId1 = historyStore.addScan({
    provider: 'aws',
    region: 'us-east-1',
    totalResources: 10,
    driftedResources: 1,
    severityCounts: {
      critical: 0,
      high: 1,
      medium: 0,
      low: 0
    },
    results: firstScanResults,
    metadata: {
      terraformPath: './infrastructure',
      scanDuration: 5000
    }
  });

  console.log(`   Scan saved with ID: ${scanId1}\n`);

  // Simulate second scan
  console.log('2. Adding second scan (some drift fixed)...');
  const secondScanResults: DriftResult[] = [
    {
      resourceId: 'i-1234567890abcdef0',
      resourceName: 'web-server-prod',
      resourceType: 'aws_instance',
      hasDrift: false,
      severity: 'low',
      driftedProperties: [],
      detectedAt: new Date()
    },
    {
      resourceId: 'i-0987654321fedcba0',
      resourceName: 'db-server-prod',
      resourceType: 'aws_instance',
      hasDrift: false,
      severity: 'low',
      driftedProperties: [],
      detectedAt: new Date()
    }
  ];

  const scanId2 = historyStore.addScan({
    provider: 'aws',
    region: 'us-east-1',
    totalResources: 10,
    driftedResources: 0,
    severityCounts: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    },
    results: secondScanResults,
    metadata: {
      terraformPath: './infrastructure',
      scanDuration: 4800
    }
  });

  console.log(`   Scan saved with ID: ${scanId2}\n`);

  // Get recent scans
  console.log('3. Retrieving recent scans...');
  const recentScans = historyStore.getRecentScans(5);
  console.log(`   Found ${recentScans.length} recent scans\n`);

  recentScans.forEach((scan, index) => {
    console.log(`   Scan ${index + 1}:`);
    console.log(`     ID: ${scan.id}`);
    console.log(`     Date: ${scan.timestamp.toISOString()}`);
    console.log(`     Drift: ${scan.driftedResources}/${scan.totalResources} resources`);
    console.log();
  });

  // Get statistics
  console.log('4. Calculating statistics...');
  const stats = historyStore.getStatistics();
  
  if (stats) {
    console.log(`   Total scans: ${stats.totalScans}`);
    console.log(`   Average drift: ${stats.averageDriftPercentage.toFixed(2)}%`);
    console.log(`   First scan: ${stats.firstScan.toISOString()}`);
    console.log(`   Last scan: ${stats.lastScan.toISOString()}\n`);

    if (stats.mostDriftedResources.length > 0) {
      console.log('   Most drifted resources:');
      stats.mostDriftedResources.forEach(resource => {
        console.log(`     - ${resource.resourceId}: ${resource.driftCount} times`);
      });
      console.log();
    }
  }

  // Compare scans
  console.log('5. Comparing with previous scan...');
  const comparison = historyStore.compareWithPrevious(secondScanResults);
  
  if (comparison) {
    console.log(`   New drift: ${comparison.new.length} resources`);
    console.log(`   Fixed drift: ${comparison.fixed.length} resources`);
    console.log(`   Ongoing drift: ${comparison.ongoing.length} resources\n`);

    if (comparison.fixed.length > 0) {
      console.log('   Fixed resources:');
      comparison.fixed.forEach(result => {
        console.log(`     ✓ ${result.resourceId}`);
      });
      console.log();
    }
  }

  // Export history
  console.log('6. Exporting history...');
  const exportPath = './examples/.drift-history/export.json';
  historyStore.exportToFile(exportPath);
  console.log(`   History exported to: ${exportPath}\n`);

  console.log('=== Demo Complete ===\n');
  console.log('Try these CLI commands:');
  console.log('  drift-detector history --list');
  console.log('  drift-detector history --stats');
  console.log(`  drift-detector history --scan ${scanId1}`);
  console.log('  drift-detector scan --show-comparison');
}

// Run the demo
demonstrateHistory().catch(console.error);
