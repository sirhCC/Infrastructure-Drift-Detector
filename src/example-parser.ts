/**
 * Example: Enhanced Terraform Parser
 * 
 * This example demonstrates the enhanced parser features:
 * - Variable and local resolution
 * - Nested blocks (ingress/egress)
 * - Count and for_each
 * - Module parsing
 * - Data sources
 */

import { TerraformParser as TerraformParserEnhanced } from './parsers/terraform-enhanced';
import * as path from 'path';

function main() {
  console.log('=== Enhanced Terraform Parser Example ===\n');

  // Parse example Terraform file
  const examplePath = path.join(__dirname, '../examples/terraform/main.tf');
  const parser = new TerraformParserEnhanced();

  try {
    console.log('Parsing Terraform configuration...\n');
    const iacDefinition = parser.parse(examplePath);

    console.log(`✓ Provider: ${iacDefinition.provider}`);
    console.log(`✓ Total resources found: ${iacDefinition.resources.length}\n`);

    // Display resources by type
    const byType: Record<string, number> = {};
    iacDefinition.resources.forEach(resource => {
      byType[resource.type] = (byType[resource.type] || 0) + 1;
    });

    console.log('Resources by type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

    // Display modules
    const modules = parser.getModules();
    if (modules.length > 0) {
      console.log(`\n✓ Modules found: ${modules.length}`);
      modules.forEach(module => {
        console.log(`\n  Module: ${module.name}`);
        console.log(`  Source: ${module.source}`);
        if (module.version) {
          console.log(`  Version: ${module.version}`);
        }
        console.log(`  Variables: ${Object.keys(module.variables).length}`);
      });
    }

    // Show some example resources
    console.log('\n=== Example Resources ===\n');

    // Find a security group with nested blocks
    const securityGroup = iacDefinition.resources.find(r => 
      r.id.includes('security_group')
    );
    
    if (securityGroup) {
      console.log('Security Group with nested blocks:');
      console.log(`  Name: ${securityGroup.name}`);
      console.log(`  ID: ${securityGroup.id}`);
      if (securityGroup.properties.ingress) {
        console.log(`  Ingress rules: ${securityGroup.properties.ingress.length}`);
        securityGroup.properties.ingress.forEach((rule: any, i: number) => {
          console.log(`    Rule ${i + 1}: ${rule.protocol} port ${rule.from_port}-${rule.to_port}`);
        });
      }
    }

    // Find resources created with count
    const countResources = iacDefinition.resources.filter(r => 
      r.id.includes('[') && r.id.includes(']')
    );
    
    if (countResources.length > 0) {
      console.log(`\n✓ Resources created with count: ${countResources.length}`);
      countResources.forEach(r => {
        console.log(`  - ${r.id}`);
      });
    }

    // Find resources created with for_each
    const forEachResources = iacDefinition.resources.filter(r => 
      r.id.includes('["') && r.id.includes('"]')
    );
    
    if (forEachResources.length > 0) {
      console.log(`\n✓ Resources created with for_each: ${forEachResources.length}`);
      forEachResources.forEach(r => {
        console.log(`  - ${r.id}`);
      });
    }

    // Find data sources
    const dataSources = iacDefinition.resources.filter(r => 
      r.id.startsWith('data.')
    );
    
    if (dataSources.length > 0) {
      console.log(`\n✓ Data sources: ${dataSources.length}`);
      dataSources.forEach(r => {
        console.log(`  - ${r.id}`);
      });
    }

    console.log('\n✓ Parsing complete!');

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('Note: Example file not found. Create examples/terraform/main.tf to test.');
    } else {
      console.error('Error:', error);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main };
