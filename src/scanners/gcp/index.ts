import { GCPClient, GCPClientConfig } from './client';
import { GCPComputeScanner } from './compute';
import { GCPStorageScanner } from './storage';
import { GCPVPCScanner } from './vpc';
import { Resource } from '../../types';

export interface GCPScannerConfig extends GCPClientConfig {
  zones?: string[];
  regions?: string[];
  resourceTypes?: string[];
}

/**
 * Main GCP scanner that coordinates all GCP resource scanners
 */
export class GCPScanner {
  private client: GCPClient;
  private computeScanner: GCPComputeScanner;
  private storageScanner: GCPStorageScanner;
  private vpcScanner: GCPVPCScanner;

  constructor(private config: GCPScannerConfig) {
    this.client = new GCPClient(config);
    this.computeScanner = new GCPComputeScanner(this.client);
    this.storageScanner = new GCPStorageScanner(this.client);
    this.vpcScanner = new GCPVPCScanner(this.client);
  }

  /**
   * Scan all configured GCP resources
   */
  async scanAll(): Promise<Resource[]> {
    const allResources: Resource[] = [];

    console.log(`\n🔍 Scanning GCP project: ${this.config.projectId}\n`);

    const scanners = [
      { name: 'Compute Instances', fn: () => this.scanComputeInstances() },
      { name: 'Storage Buckets', fn: () => this.scanStorageBuckets() },
      { name: 'VPC Networks', fn: () => this.scanVPCNetworks() },
      { name: 'Subnetworks', fn: () => this.scanSubnetworks() },
    ];

    for (const scanner of scanners) {
      if (this.shouldScanType(scanner.name)) {
        try {
          const resources = await scanner.fn();
          allResources.push(...resources);
        } catch (error) {
          console.error(`✗ Failed to scan ${scanner.name}:`, error);
        }
      }
    }

    console.log(`\n✅ Total GCP resources scanned: ${allResources.length}\n`);
    return allResources;
  }

  /**
   * Scan Compute Engine instances
   */
  async scanComputeInstances(): Promise<Resource[]> {
    const resources: Resource[] = [];

    if (this.config.zones && this.config.zones.length > 0) {
      for (const zone of this.config.zones) {
        const zoneResources = await this.computeScanner.scan(zone);
        resources.push(...zoneResources);
      }
    } else {
      const allResources = await this.computeScanner.scan();
      resources.push(...allResources);
    }

    return resources;
  }

  /**
   * Scan Cloud Storage buckets
   */
  async scanStorageBuckets(): Promise<Resource[]> {
    return this.storageScanner.scan();
  }

  /**
   * Scan VPC Networks
   */
  async scanVPCNetworks(): Promise<Resource[]> {
    return this.vpcScanner.scan();
  }

  /**
   * Scan Subnetworks
   */
  async scanSubnetworks(): Promise<Resource[]> {
    const resources: Resource[] = [];

    if (this.config.regions && this.config.regions.length > 0) {
      for (const region of this.config.regions) {
        const regionResources = await this.vpcScanner.scanSubnets(region);
        resources.push(...regionResources);
      }
    } else {
      const allResources = await this.vpcScanner.scanSubnets();
      resources.push(...allResources);
    }

    return resources;
  }

  /**
   * Check if a resource type should be scanned
   */
  private shouldScanType(type: string): boolean {
    if (!this.config.resourceTypes || this.config.resourceTypes.length === 0) {
      return true;
    }
    return this.config.resourceTypes.includes(type.toLowerCase());
  }
}

export * from './client';
export * from './compute';
export * from './storage';
export * from './vpc';
