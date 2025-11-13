import { GCPClient } from './client';
import { Resource, ResourceType } from '../../types';

/**
 * Scan GCP VPC Networks
 */
export class GCPVPCScanner {
  constructor(private client: GCPClient) {}

  async scan(): Promise<Resource[]> {
    const resources: Resource[] = [];
    const compute = this.client.getComputeClient();

    try {
      const [networks] = await compute.getNetworks();

      for (const network of networks) {
        const metadata = network.metadata;

        const resource: Resource = {
          id: metadata.id?.toString() || metadata.selfLink || '',
          type: 'network',
          name: metadata.name || '',
          provider: 'gcp',
          properties: {
            autoCreateSubnetworks: metadata.autoCreateSubnetworks,
            creationTimestamp: metadata.creationTimestamp,
            description: metadata.description,
            routingConfig: metadata.routingConfig,
            mtu: metadata.mtu,
            subnetworks: metadata.subnetworks,
            peerings: metadata.peerings,
          },
        };

        resources.push(resource);
      }

      console.log(`✓ Scanned ${resources.length} GCP VPC Networks`);
      return resources;
    } catch (error) {
      console.error('Error scanning GCP VPC Networks:', error);
      throw error;
    }
  }

  /**
   * Scan GCP Subnetworks
   */
  async scanSubnets(region?: string): Promise<Resource[]> {
    const resources: Resource[] = [];
    const compute = this.client.getComputeClient();

    try {
      let subnets;

      if (region) {
        const regionObj = compute.region(region);
        const [subnetworks] = await regionObj.getSubnetworks();
        subnets = subnetworks;
      } else {
        const [subnetworks] = await compute.getSubnetworks();
        subnets = subnetworks;
      }

      for (const subnet of subnets) {
        const metadata = subnet.metadata;

        const resource: Resource = {
          id: metadata.id?.toString() || metadata.selfLink || '',
          type: 'subnet' as ResourceType,
          name: metadata.name || '',
          provider: 'gcp',
          properties: {
            network: metadata.network,
            ipCidrRange: metadata.ipCidrRange,
            region: metadata.region,
            gatewayAddress: metadata.gatewayAddress,
            privateIpGoogleAccess: metadata.privateIpGoogleAccess,
            secondaryIpRanges: metadata.secondaryIpRanges,
            creationTimestamp: metadata.creationTimestamp,
            enableFlowLogs: metadata.enableFlowLogs,
            logConfig: metadata.logConfig,
            purpose: metadata.purpose,
            role: metadata.role,
          },
        };

        resources.push(resource);
      }

      console.log(`✓ Scanned ${resources.length} GCP Subnetworks`);
      return resources;
    } catch (error) {
      console.error('Error scanning GCP Subnetworks:', error);
      throw error;
    }
  }
}
