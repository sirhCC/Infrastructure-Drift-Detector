import { AzureClient } from './client';
import { Resource, ResourceType } from '../../types';

/**
 * Scan Azure Virtual Machines
 */
export class AzureVMScanner {
  constructor(private client: AzureClient) {}

  async scan(resourceGroup?: string): Promise<Resource[]> {
    const resources: Resource[] = [];
    const computeClient = this.client.getComputeClient();

    try {
      let vms;
      
      if (resourceGroup) {
        // Scan specific resource group
        vms = computeClient.virtualMachines.list(resourceGroup);
      } else {
        // Scan all resource groups
        vms = computeClient.virtualMachines.listAll();
      }

      for await (const vm of vms) {
        if (!vm.name || !vm.id) continue;

        const resource: Resource = {
          id: vm.id,
          type: 'compute',
          name: vm.name,
          provider: 'azure',
          properties: {
            location: vm.location,
            vmSize: vm.hardwareProfile?.vmSize,
            osType: vm.storageProfile?.osDisk?.osType,
            osDiskName: vm.storageProfile?.osDisk?.name,
            imageReference: vm.storageProfile?.imageReference,
            networkInterfaces: vm.networkProfile?.networkInterfaces?.map(
              (nic) => nic.id
            ),
            provisioningState: vm.provisioningState,
            vmId: vm.vmId,
            tags: vm.tags,
            zones: vm.zones,
            priority: vm.priority,
            licenseType: vm.licenseType,
            resourceGroup: this.extractResourceGroup(vm.id),
          },
        };

        resources.push(resource);
      }

      console.log(`✓ Scanned ${resources.length} Azure VMs`);
      return resources;
    } catch (error) {
      console.error('Error scanning Azure VMs:', error);
      throw error;
    }
  }

  private extractResourceGroup(resourceId?: string): string | undefined {
    if (!resourceId) return undefined;
    const match = resourceId.match(/resourceGroups\/([^\/]+)/);
    return match ? match[1] : undefined;
  }
}
