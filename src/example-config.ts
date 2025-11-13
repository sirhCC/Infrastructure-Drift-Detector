/**
 * Example: Configuration System Usage
 * 
 * Demonstrates how to:
 * 1. Load configuration from files (YAML/JSON)
 * 2. Load from environment variables
 * 3. Auto-discover configuration
 * 4. Validate configuration
 * 5. Manage credentials securely
 */

import { ConfigLoader } from './config/loader';
import { CredentialManager } from './config/credentials';
import * as path from 'path';

async function main() {
  console.log('=== Configuration System Example ===\n');

  // Example 1: Auto-load configuration
  console.log('1. Auto-loading configuration...');
  const autoLoader = ConfigLoader.autoLoad();
  const autoConfig = autoLoader.getConfig();
  console.log(`   ✓ Loaded configuration`);
  console.log(`   Providers enabled: ${Object.keys(autoConfig.providers || {}).join(', ')}\n`);

  // Example 2: Load from specific YAML file
  console.log('2. Loading from YAML file...');
  try {
    const yamlLoader = new ConfigLoader();
    const yamlPath = path.join(__dirname, '../examples/config/drift-detector.yml');
    yamlLoader.loadFromFile(yamlPath);
    const yamlConfig = yamlLoader.getConfig();
    
    console.log(`   ✓ Loaded YAML configuration`);
    console.log(`   AWS enabled: ${yamlConfig.providers?.aws?.enabled}`);
    console.log(`   AWS region: ${yamlConfig.providers?.aws?.region}`);
    console.log(`   Scan interval: ${yamlConfig.scan?.interval} minutes\n`);
  } catch (error) {
    console.log(`   ⚠ YAML file not found (expected for new setup)\n`);
  }

  // Example 3: Load from JSON file
  console.log('3. Loading from JSON file...');
  try {
    const jsonLoader = new ConfigLoader();
    const jsonPath = path.join(__dirname, '../examples/config/drift-detector.json');
    jsonLoader.loadFromFile(jsonPath);
    const jsonConfig = jsonLoader.getConfig();
    
    console.log(`   ✓ Loaded JSON configuration`);
    console.log(`   Report formats: ${jsonConfig.reporting?.formats?.join(', ')}\n`);
  } catch (error) {
    console.log(`   ⚠ JSON file not found (expected for new setup)\n`);
  }

  // Example 4: Load from environment variables
  console.log('4. Loading from environment variables...');
  const envLoader = new ConfigLoader();
  envLoader.loadFromEnv();
  const envConfig = envLoader.getConfig();
  
  console.log(`   ✓ Loaded environment configuration`);
  console.log(`   AWS region from env: ${envConfig.providers?.aws?.region || 'not set'}\n`);

  // Example 5: Validate configuration
  console.log('5. Validating configuration...');
  const validation = autoLoader.validate();
  
  if (validation.valid) {
    console.log(`   ✓ Configuration is valid\n`);
  } else {
    console.log(`   ⚠ Configuration has errors:`);
    validation.errors.forEach(error => console.log(`      - ${error}`));
    console.log();
  }

  // Example 6: Get AWS credentials
  console.log('6. Loading AWS credentials...');
  const awsConfig = autoConfig.providers?.aws;
  const awsCredentials = CredentialManager.getAWSCredentials(awsConfig);
  
  console.log(`   Region: ${awsCredentials.region}`);
  console.log(`   Profile: ${awsCredentials.profile || 'default chain'}`);
  console.log(`   Has access key: ${!!awsCredentials.accessKeyId}\n`);

  // Example 7: Mask sensitive data for logging
  console.log('7. Masking sensitive credentials...');
  const sensitiveData = {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1'
  };
  
  const masked = CredentialManager.maskCredentials(sensitiveData);
  console.log('   Original (should not be logged):');
  console.log('   Masked version:', JSON.stringify(masked, null, 2));
  console.log();

  // Example 8: Update configuration programmatically
  console.log('8. Updating configuration programmatically...');
  autoLoader.updateConfig({
    scan: {
      interval: 120
    }
  });
  console.log(`   ✓ Updated scan interval to ${autoLoader.getConfig().scan?.interval} minutes\n`);

  // Example 9: Save configuration
  console.log('9. Saving configuration...');
  try {
    const outputPath = './drift-detector-generated.yml';
    autoLoader.saveToFile(outputPath, 'yaml');
    console.log(`   ✓ Saved configuration to ${outputPath}\n`);
  } catch (error) {
    console.log(`   Note: Could not save (may need write permissions)\n`);
  }

  // Display final configuration summary
  console.log('=== Configuration Summary ===');
  const finalConfig = autoLoader.getConfig();
  
  console.log('\nProviders:');
  if (finalConfig.providers?.aws?.enabled) {
    console.log(`  ✓ AWS (${finalConfig.providers.aws.region})`);
  }
  if (finalConfig.providers?.azure?.enabled) {
    console.log(`  ✓ Azure`);
  }
  if (finalConfig.providers?.gcp?.enabled) {
    console.log(`  ✓ GCP`);
  }

  console.log('\nScan Settings:');
  console.log(`  Interval: ${finalConfig.scan?.interval} minutes`);
  console.log(`  Parallel: ${finalConfig.scan?.parallel}`);
  console.log(`  Timeout: ${finalConfig.scan?.timeout}s`);

  console.log('\nNotifications:');
  console.log(`  Enabled: ${finalConfig.notifications?.enabled}`);
  if (finalConfig.notifications?.channels?.slack) {
    console.log(`  Slack: configured`);
  }

  console.log('\nReporting:');
  console.log(`  Formats: ${finalConfig.reporting?.formats?.join(', ')}`);
  console.log(`  Output: ${finalConfig.reporting?.outputDir}`);

  console.log('\n✓ Configuration system ready!');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };
