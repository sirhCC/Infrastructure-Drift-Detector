import { AzureClient, AzureClientConfig } from './client';
import { AzureVMScanner } from './vm';
import { AzureStorageScanner } from './storage';
import { AzureVNetScanner } from './vnet';
import { AzureResourceGroupScanner } from './resource-group';
import { Resource } from '../../types';

export interface AzureScannerConfig extends AzureClientConfig {
  resourceGroups?: string[];
  resourceTypes?: string[];
}

/**
 * Main Azure scanner that coordinates all Azure resource scanners
 */
export class AzureScanner {
  private client: AzureClient;
  private vmScanner: AzureVMScanner;
  private storageScanner: AzureStorageScanner;
  private vnetScanner: AzureVNetScanner;
  private resourceGroupScanner: AzureResourceGroupScanner;

  constructor(private config: AzureScannerConfig) {
    this.client = new AzureClient(config);
    this.vmScanner = new AzureVMScanner(this.client);
    this.storageScanner = new AzureStorageScanner(this.client);
    this.vnetScanner = new AzureVNetScanner(this.client);
    this.resourceGroupScanner = new AzureResourceGroupScanner(this.client);
  }

  /**
   * Scan all configured Azure resources
   */
  async scanAll(): Promise<Resource[]> {
    const allResources: Resource[] = [];

    console.log(`\n🔍 Scanning Azure subscription: ${this.config.subscriptionId}\n`);

    const scanners = [
      { name: 'Resource Groups', fn: () => this.scanResourceGroups() },
      { name: 'Virtual Machines', fn: () => this.scanVirtualMachines() },
      { name: 'Storage Accounts', fn: () => this.scanStorageAccounts() },
      { name: 'Virtual Networks', fn: () => this.scanVirtualNetworks() },
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

    console.log(`\n✅ Total Azure resources scanned: ${allResources.length}\n`);
    return allResources;
  }

  /**
   * Scan Resource Groups
   */
  async scanResourceGroups(): Promise<Resource[]> {
    if (this.config.resourceGroups && this.config.resourceGroups.length > 0) {
      console.log(`Scanning specific resource groups: ${this.config.resourceGroups.join(', ')}`);
    }
    return this.resourceGroupScanner.scan();
  }

  /**
   * Scan Virtual Machines
   */
  async scanVirtualMachines(): Promise<Resource[]> {
    const resources: Resource[] = [];

    if (this.config.resourceGroups && this.config.resourceGroups.length > 0) {
      for (const rg of this.config.resourceGroups) {
        const rgResources = await this.vmScanner.scan(rg);
        resources.push(...rgResources);
      }
    } else {
      const allResources = await this.vmScanner.scan();
      resources.push(...allResources);
    }

    return resources;
  }

  /**
   * Scan Storage Accounts
   */
  async scanStorageAccounts(): Promise<Resource[]> {
    const resources: Resource[] = [];

    if (this.config.resourceGroups && this.config.resourceGroups.length > 0) {
      for (const rg of this.config.resourceGroups) {
        const rgResources = await this.storageScanner.scan(rg);
        resources.push(...rgResources);
      }
    } else {
      const allResources = await this.storageScanner.scan();
      resources.push(...allResources);
    }

    return resources;
  }

  /**
   * Scan Virtual Networks
   */
  async scanVirtualNetworks(): Promise<Resource[]> {
    const resources: Resource[] = [];

    if (this.config.resourceGroups && this.config.resourceGroups.length > 0) {
      for (const rg of this.config.resourceGroups) {
        const rgResources = await this.vnetScanner.scan(rg);
        resources.push(...rgResources);
      }
    } else {
      const allResources = await this.vnetScanner.scan();
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
export * from './vm';
export * from './storage';
export * from './vnet';
export * from './resource-group';
