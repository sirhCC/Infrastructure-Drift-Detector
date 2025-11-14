import { DetectedResource } from '../types';

export interface MultiAccountConfig {
  accounts: AccountConfig[];
}

export interface AccountConfig {
  id: string;
  name: string;
  provider: 'aws' | 'azure' | 'gcp';
  credentials: {
    aws?: {
      accessKeyId?: string;
      secretAccessKey?: string;
      profile?: string;
      role?: string;
    };
    azure?: {
      clientId?: string;
      clientSecret?: string;
      tenantId?: string;
      subscriptionId?: string;
    };
    gcp?: {
      projectId?: string;
      credentials?: string;
    };
  };
  tags?: Record<string, string>;
  enabled?: boolean;
}

export interface MultiAccountScanResult {
  accountId: string;
  accountName: string;
  provider: string;
  resources: DetectedResource[];
  error?: string;
  scanDuration: number;
}

export interface AggregatedResults {
  totalAccounts: number;
  totalResources: number;
  totalDrift: number;
  byAccount: MultiAccountScanResult[];
  byProvider: Record<string, number>;
  topDriftedAccounts: Array<{
    accountId: string;
    accountName: string;
    driftCount: number;
  }>;
}

/**
 * Multi-Account/Subscription Scanner
 * Scan multiple cloud accounts in parallel
 */
export class MultiAccountScanner {
  private config: MultiAccountConfig;

  constructor(config: MultiAccountConfig) {
    this.config = config;
  }

  /**
   * Scan all configured accounts
   */
  async scanAll(
    detector: any,
    parallelism: number = 3
  ): Promise<AggregatedResults> {
    const enabledAccounts = this.config.accounts.filter(
      acc => acc.enabled !== false
    );

    console.log(`Scanning ${enabledAccounts.length} accounts...`);

    const results: MultiAccountScanResult[] = [];

    // Scan in batches for parallelism control
    for (let i = 0; i < enabledAccounts.length; i += parallelism) {
      const batch = enabledAccounts.slice(i, i + parallelism);
      const batchResults = await Promise.all(
        batch.map(account => this.scanAccount(account, detector))
      );
      results.push(...batchResults);
    }

    return this.aggregateResults(results);
  }

  /**
   * Scan a single account
   */
  private async scanAccount(
    account: AccountConfig,
    detector: any
  ): Promise<MultiAccountScanResult> {
    const startTime = Date.now();

    try {
      console.log(`Scanning account: ${account.name} (${account.provider})`);

      // Set credentials for this account
      this.setAccountCredentials(account);

      // Scan resources
      const resources = await this.scanAccountResources(account, detector);

      return {
        accountId: account.id,
        accountName: account.name,
        provider: account.provider,
        resources,
        scanDuration: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error(`Error scanning account ${account.name}:`, error.message);

      return {
        accountId: account.id,
        accountName: account.name,
        provider: account.provider,
        resources: [],
        error: error.message,
        scanDuration: Date.now() - startTime,
      };
    }
  }

  /**
   * Set credentials for an account
   */
  private setAccountCredentials(account: AccountConfig): void {
    switch (account.provider) {
      case 'aws':
        if (account.credentials.aws?.accessKeyId) {
          process.env.AWS_ACCESS_KEY_ID = account.credentials.aws.accessKeyId;
          process.env.AWS_SECRET_ACCESS_KEY = account.credentials.aws.secretAccessKey || '';
        }
        if (account.credentials.aws?.profile) {
          process.env.AWS_PROFILE = account.credentials.aws.profile;
        }
        if (account.credentials.aws?.role) {
          process.env.AWS_ROLE_ARN = account.credentials.aws.role;
        }
        break;

      case 'azure':
        if (account.credentials.azure) {
          process.env.AZURE_CLIENT_ID = account.credentials.azure.clientId || '';
          process.env.AZURE_CLIENT_SECRET = account.credentials.azure.clientSecret || '';
          process.env.AZURE_TENANT_ID = account.credentials.azure.tenantId || '';
          process.env.AZURE_SUBSCRIPTION_ID = account.credentials.azure.subscriptionId || '';
        }
        break;

      case 'gcp':
        if (account.credentials.gcp) {
          process.env.GOOGLE_PROJECT = account.credentials.gcp.projectId || '';
          if (account.credentials.gcp.credentials) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = account.credentials.gcp.credentials;
          }
        }
        break;
    }
  }

  /**
   * Scan resources in an account
   */
  private async scanAccountResources(
    account: AccountConfig,
    detector: any
  ): Promise<DetectedResource[]> {
    // This would integrate with the actual scanner implementations
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Aggregate results from all accounts
   */
  private aggregateResults(results: MultiAccountScanResult[]): AggregatedResults {
    const totalAccounts = results.length;
    let totalResources = 0;
    let totalDrift = 0;
    const byProvider: Record<string, number> = {};

    for (const result of results) {
      totalResources += result.resources.length;
      totalDrift += result.resources.filter(r => r.hasDrift).length;

      if (!byProvider[result.provider]) {
        byProvider[result.provider] = 0;
      }
      byProvider[result.provider] += result.resources.length;
    }

    const topDriftedAccounts = results
      .map(r => ({
        accountId: r.accountId,
        accountName: r.accountName,
        driftCount: r.resources.filter(res => res.hasDrift).length,
      }))
      .sort((a, b) => b.driftCount - a.driftCount)
      .slice(0, 10);

    return {
      totalAccounts,
      totalResources,
      totalDrift,
      byAccount: results,
      byProvider,
      topDriftedAccounts,
    };
  }

  /**
   * Load config from file
   */
  static loadConfig(filePath: string): MultiAccountConfig {
    const fs = require('fs');
    const yaml = require('js-yaml');
    const path = require('path');

    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath);

    if (ext === '.json') {
      return JSON.parse(content);
    } else if (ext === '.yml' || ext === '.yaml') {
      return yaml.load(content);
    } else {
      throw new Error(`Unsupported config format: ${ext}`);
    }
  }

  /**
   * Get account by ID
   */
  getAccount(accountId: string): AccountConfig | undefined {
    return this.config.accounts.find(acc => acc.id === accountId);
  }

  /**
   * Get accounts by provider
   */
  getAccountsByProvider(provider: 'aws' | 'azure' | 'gcp'): AccountConfig[] {
    return this.config.accounts.filter(acc => acc.provider === provider);
  }

  /**
   * Get accounts by tag
   */
  getAccountsByTag(key: string, value?: string): AccountConfig[] {
    return this.config.accounts.filter(acc => {
      if (!acc.tags) return false;
      if (value) {
        return acc.tags[key] === value;
      }
      return key in acc.tags;
    });
  }
}
