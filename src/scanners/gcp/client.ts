const { Compute } = require('@google-cloud/compute');
import { Storage } from '@google-cloud/storage';

export interface GCPClientConfig {
  projectId: string;
  keyFilename?: string;
}

/**
 * GCP SDK client manager
 * Handles authentication and client initialization for GCP services
 */
export class GCPClient {
  private projectId: string;
  private keyFilename?: string;

  private computeClient?: any;
  private storageClient?: Storage;

  constructor(config: GCPClientConfig) {
    this.projectId = config.projectId;
    this.keyFilename = config.keyFilename;
  }

  /**
   * Get Compute Engine client
   */
  getComputeClient(): any {
    if (!this.computeClient) {
      this.computeClient = new Compute({
        projectId: this.projectId,
        keyFilename: this.keyFilename,
      });
    }
    return this.computeClient;
  }

  /**
   * Get Cloud Storage client
   */
  getStorageClient(): Storage {
    if (!this.storageClient) {
      this.storageClient = new Storage({
        projectId: this.projectId,
        keyFilename: this.keyFilename,
      });
    }
    return this.storageClient;
  }

  /**
   * Get project ID
   */
  getProjectId(): string {
    return this.projectId;
  }
}
