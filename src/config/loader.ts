import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as dotenv from 'dotenv';
import { DriftDetectorConfig, DEFAULT_CONFIG } from './types';

/**
 * Configuration loader with support for YAML, JSON, and environment variables
 */
export class ConfigLoader {
  private config: DriftDetectorConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG } as DriftDetectorConfig;
  }

  /**
   * Load configuration from file (YAML or JSON)
   */
  loadFromFile(filePath: string): DriftDetectorConfig {
    const resolvedPath = path.resolve(filePath);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Configuration file not found: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    let fileConfig: Partial<DriftDetectorConfig>;

    if (ext === '.yaml' || ext === '.yml') {
      fileConfig = yaml.load(content) as Partial<DriftDetectorConfig>;
    } else if (ext === '.json') {
      fileConfig = JSON.parse(content);
    } else {
      throw new Error(`Unsupported configuration file format: ${ext}`);
    }

    // Merge with defaults
    this.config = this.mergeConfig(DEFAULT_CONFIG, fileConfig);
    
    return this.config;
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnv(envFilePath?: string): void {
    // Load .env file if provided
    if (envFilePath && fs.existsSync(envFilePath)) {
      dotenv.config({ path: envFilePath });
    } else {
      dotenv.config();
    }

    // Override config with environment variables
    const envConfig = this.extractEnvConfig();
    this.config = this.mergeConfig(this.config, envConfig);
  }

  /**
   * Extract configuration from environment variables
   */
  private extractEnvConfig(): Partial<DriftDetectorConfig> {
    const envConfig: Partial<DriftDetectorConfig> = {
      providers: {}
    };

    // AWS configuration
    if (process.env.AWS_REGION || process.env.AWS_ACCESS_KEY_ID) {
      envConfig.providers!.aws = {
        enabled: process.env.AWS_ENABLED !== 'false',
        region: process.env.AWS_REGION,
        credentials: {
          profile: process.env.AWS_PROFILE,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          sessionToken: process.env.AWS_SESSION_TOKEN
        }
      };
    }

    // Azure configuration
    if (process.env.AZURE_SUBSCRIPTION_ID) {
      envConfig.providers!.azure = {
        enabled: process.env.AZURE_ENABLED !== 'false',
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
        tenantId: process.env.AZURE_TENANT_ID,
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET
      };
    }

    // GCP configuration
    if (process.env.GCP_PROJECT_ID) {
      envConfig.providers!.gcp = {
        enabled: process.env.GCP_ENABLED !== 'false',
        projectId: process.env.GCP_PROJECT_ID,
        serviceAccountKey: process.env.GCP_SERVICE_ACCOUNT_KEY
      };
    }

    // Scan configuration
    if (process.env.SCAN_INTERVAL) {
      envConfig.scan = {
        interval: parseInt(process.env.SCAN_INTERVAL, 10)
      };
    }

    // Notification configuration
    if (process.env.SLACK_WEBHOOK_URL) {
      envConfig.notifications = {
        enabled: true,
        channels: {
          slack: {
            webhookUrl: process.env.SLACK_WEBHOOK_URL,
            channel: process.env.SLACK_CHANNEL,
            username: process.env.SLACK_USERNAME
          }
        }
      };
    }

    // Logging configuration
    if (process.env.LOG_LEVEL) {
      envConfig.logging = {
        level: process.env.LOG_LEVEL as any,
        file: process.env.LOG_FILE,
        console: process.env.LOG_CONSOLE !== 'false'
      };
    }

    return envConfig;
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(
    base: Partial<DriftDetectorConfig>,
    override: Partial<DriftDetectorConfig>
  ): DriftDetectorConfig {
    const result = { ...base };

    for (const key in override) {
      const overrideValue = override[key as keyof DriftDetectorConfig];
      const baseValue = result[key as keyof DriftDetectorConfig];

      if (overrideValue !== undefined) {
        if (
          typeof overrideValue === 'object' &&
          !Array.isArray(overrideValue) &&
          overrideValue !== null &&
          typeof baseValue === 'object' &&
          !Array.isArray(baseValue) &&
          baseValue !== null
        ) {
          (result as any)[key] = this.mergeConfig(
            baseValue as any,
            overrideValue as any
          );
        } else {
          (result as any)[key] = overrideValue;
        }
      }
    }

    return result as DriftDetectorConfig;
  }

  /**
   * Get current configuration
   */
  getConfig(): DriftDetectorConfig {
    return this.config;
  }

  /**
   * Update configuration programmatically
   */
  updateConfig(updates: Partial<DriftDetectorConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  /**
   * Save configuration to file
   */
  saveToFile(filePath: string, format: 'yaml' | 'json' = 'yaml'): void {
    const ext = format === 'yaml' ? '.yml' : '.json';
    const outputPath = filePath.endsWith(ext) ? filePath : `${filePath}${ext}`;

    let content: string;

    if (format === 'yaml') {
      content = yaml.dump(this.config, { indent: 2, lineWidth: -1 });
    } else {
      content = JSON.stringify(this.config, null, 2);
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if at least one provider is enabled
    const providers = this.config.providers || {};
    const hasEnabledProvider = 
      providers.aws?.enabled ||
      providers.azure?.enabled ||
      providers.gcp?.enabled;

    if (!hasEnabledProvider) {
      errors.push('At least one cloud provider must be enabled');
    }

    // Validate AWS configuration
    if (providers.aws?.enabled) {
      if (!providers.aws.region && !process.env.AWS_REGION) {
        errors.push('AWS region is required when AWS provider is enabled');
      }
    }

    // Validate Azure configuration
    if (providers.azure?.enabled) {
      if (!providers.azure.subscriptionId) {
        errors.push('Azure subscription ID is required when Azure provider is enabled');
      }
    }

    // Validate GCP configuration
    if (providers.gcp?.enabled) {
      if (!providers.gcp.projectId) {
        errors.push('GCP project ID is required when GCP provider is enabled');
      }
    }

    // Validate notification configuration
    if (this.config.notifications?.enabled) {
      const channels = this.config.notifications.channels;
      if (!channels.slack && !channels.email && !channels.webhook) {
        errors.push('At least one notification channel must be configured');
      }

      if (channels.slack && !channels.slack.webhookUrl) {
        errors.push('Slack webhook URL is required');
      }

      if (channels.email) {
        if (!channels.email.smtp.host) {
          errors.push('Email SMTP host is required');
        }
        if (!channels.email.to || channels.email.to.length === 0) {
          errors.push('Email recipients are required');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Load configuration with automatic discovery
   * Looks for config files in standard locations
   */
  static autoLoad(): ConfigLoader {
    const loader = new ConfigLoader();
    
    // Try to find config file in standard locations
    const configPaths = [
      'drift-detector.yml',
      'drift-detector.yaml',
      'drift-detector.json',
      '.drift-detector.yml',
      '.drift-detector.yaml',
      '.drift-detector.json',
      'config/drift-detector.yml',
      'config/drift-detector.yaml',
      'config/drift-detector.json'
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log(`Found configuration file: ${configPath}`);
        loader.loadFromFile(configPath);
        break;
      }
    }

    // Always load from environment variables (will override file config)
    loader.loadFromEnv();

    return loader;
  }
}
