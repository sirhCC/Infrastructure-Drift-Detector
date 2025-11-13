import { DefaultAzureCredential } from '@azure/identity';
import { ComputeManagementClient } from '@azure/arm-compute';
import { StorageManagementClient } from '@azure/arm-storage';
import { NetworkManagementClient } from '@azure/arm-network';
import { ResourceManagementClient } from '@azure/arm-resources';

export interface AzureClientConfig {
  subscriptionId: string;
  credential?: DefaultAzureCredential;
}

/**
 * Azure SDK client manager
 * Handles authentication and client initialization for Azure services
 */
export class AzureClient {
  private credential: DefaultAzureCredential;
  private subscriptionId: string;

  private computeClient?: ComputeManagementClient;
  private storageClient?: StorageManagementClient;
  private networkClient?: NetworkManagementClient;
  private resourceClient?: ResourceManagementClient;

  constructor(config: AzureClientConfig) {
    this.subscriptionId = config.subscriptionId;
    this.credential = config.credential || new DefaultAzureCredential();
  }

  /**
   * Get Compute Management client
   */
  getComputeClient(): ComputeManagementClient {
    if (!this.computeClient) {
      this.computeClient = new ComputeManagementClient(
        this.credential,
        this.subscriptionId
      );
    }
    return this.computeClient;
  }

  /**
   * Get Storage Management client
   */
  getStorageClient(): StorageManagementClient {
    if (!this.storageClient) {
      this.storageClient = new StorageManagementClient(
        this.credential,
        this.subscriptionId
      );
    }
    return this.storageClient;
  }

  /**
   * Get Network Management client
   */
  getNetworkClient(): NetworkManagementClient {
    if (!this.networkClient) {
      this.networkClient = new NetworkManagementClient(
        this.credential,
        this.subscriptionId
      );
    }
    return this.networkClient;
  }

  /**
   * Get Resource Management client
   */
  getResourceClient(): ResourceManagementClient {
    if (!this.resourceClient) {
      this.resourceClient = new ResourceManagementClient(
        this.credential,
        this.subscriptionId
      );
    }
    return this.resourceClient;
  }

  /**
   * Get subscription ID
   */
  getSubscriptionId(): string {
    return this.subscriptionId;
  }
}
