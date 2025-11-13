import { AzureClient } from './client';
import { Resource, ResourceType } from '../../types';

/**
 * Scan Azure Virtual Networks
 */
export class AzureVNetScanner {
  constructor(private client: AzureClient) {}

  async scan(resourceGroup?: string): Promise<Resource[]> {
    const resources: Resource[] = [];
    const networkClient = this.client.getNetworkClient();

    try {
      let vnets;

      if (resourceGroup) {
        // Scan specific resource group
        vnets = networkClient.virtualNetworks.list(resourceGroup);
      } else {
        // Scan all resource groups
        vnets = networkClient.virtualNetworks.listAll();
      }

      for await (const vnet of vnets) {
        if (!vnet.name || !vnet.id) continue;

        const resource: Resource = {
          id: vnet.id,
          type: 'network',
          name: vnet.name,
          provider: 'azure',
          properties: {
            location: vnet.location,
            addressSpace: vnet.addressSpace?.addressPrefixes,
            subnets: vnet.subnets?.map((subnet) => ({
              id: subnet.id,
              name: subnet.name,
              addressPrefix: subnet.addressPrefix,
              networkSecurityGroup: subnet.networkSecurityGroup?.id,
              routeTable: subnet.routeTable?.id,
            })),
            dhcpOptions: vnet.dhcpOptions,
            enableDdosProtection: vnet.enableDdosProtection,
            enableVmProtection: vnet.enableVmProtection,
            provisioningState: vnet.provisioningState,
            tags: vnet.tags,
            resourceGroup: this.extractResourceGroup(vnet.id),
          },
        };

        resources.push(resource);
      }

      console.log(`✓ Scanned ${resources.length} Azure Virtual Networks`);
      return resources;
    } catch (error) {
      console.error('Error scanning Azure Virtual Networks:', error);
      throw error;
    }
  }

  private extractResourceGroup(resourceId?: string): string | undefined {
    if (!resourceId) return undefined;
    const match = resourceId.match(/resourceGroups\/([^\/]+)/);
    return match ? match[1] : undefined;
  }
}
