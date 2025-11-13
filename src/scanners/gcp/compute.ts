import { GCPClient } from './client';
import { Resource, ResourceType } from '../../types';

/**
 * Scan GCP Compute Engine instances
 */
export class GCPComputeScanner {
  constructor(private client: GCPClient) {}

  async scan(zone?: string): Promise<Resource[]> {
    const resources: Resource[] = [];
    const compute = this.client.getComputeClient();

    try {
      let instances;

      if (zone) {
        // Scan specific zone
        const zoneObj = compute.zone(zone);
        const [vms] = await zoneObj.getVMs();
        instances = vms;
      } else {
        // Scan all zones
        const [vms] = await compute.getVMs();
        instances = vms;
      }

      for (const vm of instances) {
        const metadata = vm.metadata;

        const resource: Resource = {
          id: metadata.id?.toString() || metadata.selfLink || '',
          type: 'compute',
          name: metadata.name || '',
          provider: 'gcp',
          properties: {
            zone: metadata.zone,
            machineType: metadata.machineType,
            status: metadata.status,
            cpuPlatform: metadata.cpuPlatform,
            creationTimestamp: metadata.creationTimestamp,
            disks: metadata.disks?.map((disk: any) => ({
              deviceName: disk.deviceName,
              type: disk.type,
              mode: disk.mode,
              source: disk.source,
              boot: disk.boot,
              autoDelete: disk.autoDelete,
            })),
            networkInterfaces: metadata.networkInterfaces?.map((nic: any) => ({
              name: nic.name,
              network: nic.network,
              subnetwork: nic.subnetwork,
              networkIP: nic.networkIP,
              accessConfigs: nic.accessConfigs,
            })),
            tags: metadata.tags,
            labels: metadata.labels,
            scheduling: metadata.scheduling,
            serviceAccounts: metadata.serviceAccounts,
            canIpForward: metadata.canIpForward,
            deletionProtection: metadata.deletionProtection,
          },
        };

        resources.push(resource);
      }

      console.log(`✓ Scanned ${resources.length} GCP Compute instances`);
      return resources;
    } catch (error) {
      console.error('Error scanning GCP Compute instances:', error);
      throw error;
    }
  }
}
