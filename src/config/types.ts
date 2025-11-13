/**
 * Configuration types for Infrastructure Drift Detector
 */

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  enabled: boolean;
  region?: string;
  credentials?: {
    profile?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  };
  resources?: {
    include?: string[];
    exclude?: string[];
  };
}

/**
 * AWS-specific configuration
 */
export interface AWSProviderConfig extends ProviderConfig {
  accountId?: string;
  regions?: string[];
}

/**
 * Azure-specific configuration
 */
export interface AzureProviderConfig extends ProviderConfig {
  subscriptionId?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * GCP-specific configuration
 */
export interface GCPProviderConfig extends ProviderConfig {
  projectId?: string;
  serviceAccountKey?: string;
}

/**
 * Scanning configuration
 */
export interface ScanConfig {
  interval?: number; // minutes
  schedule?: string; // cron expression
  parallel?: boolean;
  timeout?: number; // seconds
  retryAttempts?: number;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  enabled: boolean;
  channels: {
    slack?: {
      webhookUrl: string;
      channel?: string;
      username?: string;
      iconEmoji?: string;
    };
    email?: {
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
      from: string;
      to: string[];
      cc?: string[];
      subject?: string;
    };
    teams?: {
      webhookUrl: string;
    };
    discord?: {
      webhookUrl: string;
      username?: string;
      avatarUrl?: string;
    };
    webhook?: {
      url: string;
      method?: 'POST' | 'PUT';
      headers?: Record<string, string>;
      authentication?: {
        type: 'bearer' | 'basic' | 'api-key';
        token?: string;
        username?: string;
        password?: string;
        headerName?: string;
      };
    };
  };
  filters?: {
    minSeverity?: 'low' | 'medium' | 'high' | 'critical';
    severityFilter?: ('low' | 'medium' | 'high' | 'critical')[];
    minDriftPercentage?: number;
    onlyOnNewDrift?: boolean;
    resources?: string[];
  };
}

/**
 * Reporting configuration
 */
export interface ReportConfig {
  outputDir?: string;
  formats?: ('json' | 'html' | 'csv')[];
  includeTimestamp?: boolean;
  retention?: number; // days
}

/**
 * Remediation configuration
 */
export interface RemediationConfig {
  enabled: boolean;
  autoApply?: boolean;
  dryRun?: boolean;
  requireApproval?: boolean;
  autoApproveForSeverity?: ('safe' | 'low_risk' | 'medium_risk' | 'high_risk' | 'critical')[];
  backupState?: boolean;
  rollbackOnError?: boolean;
  terraform?: {
    binaryPath?: string;
    workingDirectory?: string;
    varFile?: string;
  };
  execution?: {
    maxConcurrent?: number;
    continueOnError?: boolean;
    timeout?: number; // seconds
  };
  filters?: {
    includeResources?: string[];
    excludeResources?: string[];
    maxActionsPerRun?: number;
    allowDestructive?: boolean;
  };
  logging?: {
    directory?: string;
    verbose?: boolean;
  };
}

/**
 * Terraform-specific configuration
 */
export interface TerraformConfig {
  directories?: string[];
  files?: string[];
  stateBackend?: {
    type: 's3' | 'azurerm' | 'gcs' | 'local';
    config?: Record<string, any>;
  };
  varFiles?: string[];
}

/**
 * Main configuration interface
 */
export interface DriftDetectorConfig {
  version?: string;
  
  providers: {
    aws?: AWSProviderConfig;
    azure?: AzureProviderConfig;
    gcp?: GCPProviderConfig;
  };

  terraform?: TerraformConfig;

  scan?: ScanConfig;

  drift?: {
    ignoreProperties?: string[];
    ignoreResources?: string[];
    thresholds?: {
      maxDriftPercentage?: number;
      maxDriftedResources?: number;
    };
  };

  notifications?: NotificationConfig;

  reporting?: ReportConfig;

  remediation?: RemediationConfig;

  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    console?: boolean;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Partial<DriftDetectorConfig> = {
  version: '1.0',
  scan: {
    interval: 60,
    parallel: true,
    timeout: 300,
    retryAttempts: 3
  },
  drift: {
    ignoreProperties: [
      'last_modified',
      'created_at',
      'updated_at',
      'launch_time',
      'status'
    ]
  },
  reporting: {
    outputDir: './reports',
    formats: ['json'],
    includeTimestamp: true,
    retention: 30
  },
  remediation: {
    enabled: false,
    autoApply: false,
    dryRun: true,
    requireApproval: true,
    autoApproveForSeverity: ['safe'],
    backupState: true,
    rollbackOnError: true,
    execution: {
      maxConcurrent: 1,
      continueOnError: false,
      timeout: 600
    },
    filters: {
      allowDestructive: false
    },
    logging: {
      verbose: true
    }
  },
  logging: {
    level: 'info',
    console: true
  }
};
