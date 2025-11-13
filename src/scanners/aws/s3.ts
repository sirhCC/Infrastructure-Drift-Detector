import { 
  S3Client, 
  ListBucketsCommand, 
  GetBucketLocationCommand,
  GetBucketVersioningCommand,
  GetBucketEncryptionCommand,
  GetBucketTaggingCommand
} from '@aws-sdk/client-s3';
import { Resource } from '../../types';

/**
 * S3 Bucket Scanner
 */
export class S3Scanner {
  private client: S3Client;

  constructor(client: S3Client) {
    this.client = client;
  }

  /**
   * Scan all S3 buckets
   */
  async scan(): Promise<Resource[]> {
    const resources: Resource[] = [];

    try {
      const command = new ListBucketsCommand({});
      const response = await this.client.send(command);

      if (response.Buckets) {
        // Fetch details for each bucket in parallel
        const bucketPromises = response.Buckets.map(bucket => 
          this.getBucketDetails(bucket.Name!)
        );
        
        const buckets = await Promise.all(bucketPromises);
        resources.push(...buckets.filter(b => b !== null) as Resource[]);
      }

      return resources;
    } catch (error) {
      console.error('Error scanning S3 buckets:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a bucket
   */
  private async getBucketDetails(bucketName: string): Promise<Resource | null> {
    try {
      const [location, versioning, encryption, tags] = await Promise.allSettled([
        this.getBucketLocation(bucketName),
        this.getBucketVersioning(bucketName),
        this.getBucketEncryption(bucketName),
        this.getBucketTags(bucketName)
      ]);

      return {
        id: `aws_s3_bucket.${bucketName}`,
        type: 'storage',
        provider: 'aws',
        name: bucketName,
        properties: {
          bucket: bucketName,
          region: location.status === 'fulfilled' ? location.value : 'us-east-1',
          versioning_enabled: versioning.status === 'fulfilled' ? versioning.value : false,
          encryption_enabled: encryption.status === 'fulfilled' ? encryption.value : false,
          encryption_algorithm: encryption.status === 'fulfilled' && encryption.value ? 'AES256' : undefined
        },
        tags: tags.status === 'fulfilled' ? tags.value : undefined
      };
    } catch (error) {
      console.error(`Error getting details for bucket ${bucketName}:`, error);
      return null;
    }
  }

  private async getBucketLocation(bucketName: string): Promise<string> {
    try {
      const command = new GetBucketLocationCommand({ Bucket: bucketName });
      const response = await this.client.send(command);
      return response.LocationConstraint || 'us-east-1';
    } catch {
      return 'us-east-1';
    }
  }

  private async getBucketVersioning(bucketName: string): Promise<boolean> {
    try {
      const command = new GetBucketVersioningCommand({ Bucket: bucketName });
      const response = await this.client.send(command);
      return response.Status === 'Enabled';
    } catch {
      return false;
    }
  }

  private async getBucketEncryption(bucketName: string): Promise<boolean> {
    try {
      const command = new GetBucketEncryptionCommand({ Bucket: bucketName });
      const response = await this.client.send(command);
      return !!response.ServerSideEncryptionConfiguration;
    } catch {
      return false;
    }
  }

  private async getBucketTags(bucketName: string): Promise<Record<string, string> | undefined> {
    try {
      const command = new GetBucketTaggingCommand({ Bucket: bucketName });
      const response = await this.client.send(command);
      
      if (response.TagSet) {
        const tags: Record<string, string> = {};
        for (const tag of response.TagSet) {
          if (tag.Key && tag.Value) {
            tags[tag.Key] = tag.Value;
          }
        }
        return Object.keys(tags).length > 0 ? tags : undefined;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
}
