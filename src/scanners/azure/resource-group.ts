import { AzureClient } from './client';
import { Resource, ResourceType } from '../../types';

/**
 * Scan Azure Resource Groups
 */
export class AzureResourceGroupScanner {
  constructor(private client: AzureClient) {}

  async scan(): Promise<Resource[]> {
    const resources: Resource[] = [];
    const resourceClient = this.client.getResourceClient();

    try {
      const resourceGroups = resourceClient.resourceGroups.list();

      for await (const rg of resourceGroups) {
        if (!rg.name || !rg.id) continue;

        const resource: Resource = {
          id: rg.id,
          type: 'resource_group' as ResourceType,
          name: rg.name,
          provider: 'azure',
          properties: {
            location: rg.location,
            provisioningState: rg.properties?.provisioningState,
            tags: rg.tags,
            managedBy: rg.managedBy,
          },
        };

        resources.push(resource);
      }

      console.log(`✓ Scanned ${resources.length} Azure Resource Groups`);
      return resources;
    } catch (error) {
      console.error('Error scanning Azure Resource Groups:', error);
      throw error;
    }
  }
}
