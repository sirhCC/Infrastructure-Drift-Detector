import { GCPClient } from './client';
import { Resource, ResourceType } from '../../types';

/**
 * Scan GCP Cloud Storage buckets
 */
export class GCPStorageScanner {
  constructor(private client: GCPClient) {}

  async scan(): Promise<Resource[]> {
    const resources: Resource[] = [];
    const storage = this.client.getStorageClient();

    try {
      const [buckets] = await storage.getBuckets();

      for (const bucket of buckets) {
        const [metadata] = await bucket.getMetadata();

        const resource: Resource = {
          id: metadata.id || metadata.selfLink || '',
          type: 'storage',
          name: metadata.name || '',
          provider: 'gcp',
          properties: {
            location: metadata.location,
            locationType: metadata.locationType,
            storageClass: metadata.storageClass,
            timeCreated: metadata.timeCreated,
            updated: metadata.updated,
            versioning: metadata.versioning,
            website: metadata.website,
            cors: metadata.cors,
            lifecycle: metadata.lifecycle,
            encryption: metadata.encryption,
            billing: metadata.billing,
            retentionPolicy: metadata.retentionPolicy,
            iamConfiguration: metadata.iamConfiguration,
            labels: metadata.labels,
            defaultEventBasedHold: metadata.defaultEventBasedHold,
            publicAccessPrevention: metadata.publicAccessPrevention,
          },
        };

        resources.push(resource);
      }

      console.log(`✓ Scanned ${resources.length} GCP Storage buckets`);
      return resources;
    } catch (error) {
      console.error('Error scanning GCP Storage buckets:', error);
      throw error;
    }
  }
}
