import { AzureClient } from './client';
import { Resource, ResourceType } from '../../types';

/**
 * Scan Azure Storage Accounts
 */
export class AzureStorageScanner {
  constructor(private client: AzureClient) {}

  async scan(resourceGroup?: string): Promise<Resource[]> {
    const resources: Resource[] = [];
    const storageClient = this.client.getStorageClient();

    try {
      let accounts;

      if (resourceGroup) {
        // Scan specific resource group
        accounts = storageClient.storageAccounts.listByResourceGroup(resourceGroup);
      } else {
        // Scan all resource groups
        accounts = storageClient.storageAccounts.list();
      }

      for await (const account of accounts) {
        if (!account.name || !account.id) continue;

        const resource: Resource = {
          id: account.id,
          type: 'storage',
          name: account.name,
          provider: 'azure',
          properties: {
            location: account.location,
            kind: account.kind,
            sku: account.sku,
            accessTier: account.accessTier,
            provisioningState: account.provisioningState,
            primaryLocation: account.primaryLocation,
            secondaryLocation: account.secondaryLocation,
            statusOfPrimary: account.statusOfPrimary,
            statusOfSecondary: account.statusOfSecondary,
            creationTime: account.creationTime,
            encryption: {
              services: account.encryption?.services,
              keySource: account.encryption?.keySource,
            },
            networkRuleSet: {
              defaultAction: account.networkRuleSet?.defaultAction,
              bypass: account.networkRuleSet?.bypass,
              virtualNetworkRules: account.networkRuleSet?.virtualNetworkRules?.map(
                (rule) => rule.virtualNetworkResourceId
              ),
              ipRules: account.networkRuleSet?.ipRules,
            },
            supportsHttpsTrafficOnly: account.enableHttpsTrafficOnly,
            allowBlobPublicAccess: account.allowBlobPublicAccess,
            minimumTlsVersion: account.minimumTlsVersion,
            tags: account.tags,
            resourceGroup: this.extractResourceGroup(account.id),
          },
        };

        resources.push(resource);
      }

      console.log(`✓ Scanned ${resources.length} Azure Storage Accounts`);
      return resources;
    } catch (error) {
      console.error('Error scanning Azure Storage Accounts:', error);
      throw error;
    }
  }

  private extractResourceGroup(resourceId?: string): string | undefined {
    if (!resourceId) return undefined;
    const match = resourceId.match(/resourceGroups\/([^\/]+)/);
    return match ? match[1] : undefined;
  }
}
