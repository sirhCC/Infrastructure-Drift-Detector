import { DetectedResource } from '../types';

export interface OrgScanConfig {
  provider: 'aws' | 'azure' | 'gcp';
  organizationId: string;
  credentials: any;
  includeAccounts?: string[];
  excludeAccounts?: string[];
  scanTags?: string[];
}

export interface OrgAccount {
  id: string;
  name: string;
  email?: string;
  status: string;
  parentId?: string;
  tags?: Record<string, string>;
}

export interface OrgScanResult {
  organizationId: string;
  provider: string;
  totalAccounts: number;
  scannedAccounts: number;
  accounts: Array<{
    account: OrgAccount;
    resources: DetectedResource[];
    error?: string;
  }>;
  hierarchy: OrgHierarchy;
  summary: {
    totalResources: number;
    totalDrift: number;
    driftByOU: Record<string, number>;
    driftByAccount: Record<string, number>;
  };
}

export interface OrgHierarchy {
  root: OrgNode;
}

export interface OrgNode {
  id: string;
  name: string;
  type: 'root' | 'ou' | 'account';
  children: OrgNode[];
  resourceCount?: number;
  driftCount?: number;
}

/**
 * Organization-Wide Scanner
 * Scan entire cloud organization hierarchies
 */
export class OrganizationScanner {
  /**
   * Scan AWS Organization
   */
  async scanAWSOrganization(config: OrgScanConfig): Promise<OrgScanResult> {
    const AWS = require('aws-sdk');
    const organizations = new AWS.Organizations();

    try {
      // List all accounts in organization
      const accounts = await this.listAWSAccounts(organizations);

      // Filter accounts based on config
      const filteredAccounts = this.filterAccounts(
        accounts,
        config.includeAccounts,
        config.excludeAccounts
      );

      console.log(`Found ${filteredAccounts.length} accounts in AWS Organization`);

      // Build organization hierarchy
      const hierarchy = await this.buildAWSHierarchy(organizations);

      // Scan accounts (placeholder)
      const accountResults = await this.scanAWSAccounts(filteredAccounts);

      return this.buildOrgResult(
        config.organizationId,
        'aws',
        filteredAccounts,
        accountResults,
        hierarchy
      );
    } catch (error: any) {
      throw new Error(`Failed to scan AWS Organization: ${error.message}`);
    }
  }

  /**
   * Scan Azure Management Group
   */
  async scanAzureManagementGroup(config: OrgScanConfig): Promise<OrgScanResult> {
    console.log('Scanning Azure Management Group...');

    // Placeholder implementation
    return {
      organizationId: config.organizationId,
      provider: 'azure',
      totalAccounts: 0,
      scannedAccounts: 0,
      accounts: [],
      hierarchy: { root: { id: 'root', name: 'Root', type: 'root', children: [] } },
      summary: {
        totalResources: 0,
        totalDrift: 0,
        driftByOU: {},
        driftByAccount: {},
      },
    };
  }

  /**
   * Scan GCP Organization
   */
  async scanGCPOrganization(config: OrgScanConfig): Promise<OrgScanResult> {
    console.log('Scanning GCP Organization...');

    // Placeholder implementation
    return {
      organizationId: config.organizationId,
      provider: 'gcp',
      totalAccounts: 0,
      scannedAccounts: 0,
      accounts: [],
      hierarchy: { root: { id: 'root', name: 'Root', type: 'root', children: [] } },
      summary: {
        totalResources: 0,
        totalDrift: 0,
        driftByOU: {},
        driftByAccount: {},
      },
    };
  }

  /**
   * List AWS accounts
   */
  private async listAWSAccounts(organizations: any): Promise<OrgAccount[]> {
    const accounts: OrgAccount[] = [];
    let nextToken: string | undefined;

    do {
      const response = await organizations
        .listAccounts({ NextToken: nextToken })
        .promise();

      for (const account of response.Accounts) {
        accounts.push({
          id: account.Id,
          name: account.Name,
          email: account.Email,
          status: account.Status,
        });
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return accounts;
  }

  /**
   * Build AWS organization hierarchy
   */
  private async buildAWSHierarchy(organizations: any): Promise<OrgHierarchy> {
    try {
      const roots = await organizations.listRoots().promise();
      const rootId = roots.Roots[0].Id;

      const rootNode = await this.buildAWSNode(organizations, rootId, 'root');

      return { root: rootNode };
    } catch (error) {
      // Return simple hierarchy if can't access organization structure
      return {
        root: {
          id: 'root',
          name: 'Organization',
          type: 'root',
          children: [],
        },
      };
    }
  }

  /**
   * Build AWS organization node recursively
   */
  private async buildAWSNode(
    organizations: any,
    parentId: string,
    type: 'root' | 'ou' | 'account'
  ): Promise<OrgNode> {
    const children: OrgNode[] = [];

    try {
      // List OUs under this parent
      const ous = await organizations
        .listOrganizationalUnitsForParent({ ParentId: parentId })
        .promise();

      for (const ou of ous.OrganizationalUnits) {
        const ouNode = await this.buildAWSNode(organizations, ou.Id, 'ou');
        children.push(ouNode);
      }

      // List accounts under this parent
      const accounts = await organizations
        .listAccountsForParent({ ParentId: parentId })
        .promise();

      for (const account of accounts.Accounts) {
        children.push({
          id: account.Id,
          name: account.Name,
          type: 'account',
          children: [],
        });
      }
    } catch (error) {
      // Ignore errors for inaccessible nodes
    }

    return {
      id: parentId,
      name: type === 'root' ? 'Organization' : parentId,
      type,
      children,
    };
  }

  /**
   * Filter accounts based on include/exclude lists
   */
  private filterAccounts(
    accounts: OrgAccount[],
    includeAccounts?: string[],
    excludeAccounts?: string[]
  ): OrgAccount[] {
    let filtered = accounts;

    if (includeAccounts && includeAccounts.length > 0) {
      filtered = filtered.filter(acc => includeAccounts.includes(acc.id));
    }

    if (excludeAccounts && excludeAccounts.length > 0) {
      filtered = filtered.filter(acc => !excludeAccounts.includes(acc.id));
    }

    return filtered;
  }

  /**
   * Scan AWS accounts (placeholder)
   */
  private async scanAWSAccounts(
    accounts: OrgAccount[]
  ): Promise<Array<{ account: OrgAccount; resources: DetectedResource[]; error?: string }>> {
    // Placeholder - would integrate with actual scanner
    return accounts.map(account => ({
      account,
      resources: [],
    }));
  }

  /**
   * Build organization scan result
   */
  private buildOrgResult(
    organizationId: string,
    provider: string,
    accounts: OrgAccount[],
    accountResults: Array<{ account: OrgAccount; resources: DetectedResource[]; error?: string }>,
    hierarchy: OrgHierarchy
  ): OrgScanResult {
    const totalResources = accountResults.reduce(
      (sum, result) => sum + result.resources.length,
      0
    );

    const totalDrift = accountResults.reduce(
      (sum, result) => sum + result.resources.filter(r => r.hasDrift).length,
      0
    );

    const driftByAccount: Record<string, number> = {};
    for (const result of accountResults) {
      driftByAccount[result.account.id] = result.resources.filter(r => r.hasDrift).length;
    }

    return {
      organizationId,
      provider,
      totalAccounts: accounts.length,
      scannedAccounts: accountResults.filter(r => !r.error).length,
      accounts: accountResults,
      hierarchy,
      summary: {
        totalResources,
        totalDrift,
        driftByOU: {},
        driftByAccount,
      },
    };
  }

  /**
   * Generate organization report
   */
  generateReport(result: OrgScanResult): string {
    const lines: string[] = [];

    lines.push(`Organization Scan Report`);
    lines.push(`========================`);
    lines.push(`Provider: ${result.provider.toUpperCase()}`);
    lines.push(`Organization ID: ${result.organizationId}`);
    lines.push(`Total Accounts: ${result.totalAccounts}`);
    lines.push(`Scanned: ${result.scannedAccounts}`);
    lines.push(``);
    lines.push(`Summary`);
    lines.push(`-------`);
    lines.push(`Total Resources: ${result.summary.totalResources}`);
    lines.push(`Total Drift: ${result.summary.totalDrift}`);
    lines.push(``);
    lines.push(`Top Drifted Accounts`);
    lines.push(`-------------------`);

    const topAccounts = Object.entries(result.summary.driftByAccount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [accountId, driftCount] of topAccounts) {
      const accountInfo = result.accounts.find(a => a.account.id === accountId);
      const accountName = accountInfo?.account.name || accountId;
      lines.push(`  ${accountName}: ${driftCount} drifts`);
    }

    return lines.join('\n');
  }
}
