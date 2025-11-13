import { EC2Client } from '@aws-sdk/client-ec2';
import { S3Client } from '@aws-sdk/client-s3';
import { RDSClient } from '@aws-sdk/client-rds';

/**
 * AWS Client Configuration
 */
export interface AWSConfig {
  region?: string;
  profile?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

/**
 * Factory for creating AWS service clients
 */
export class AWSClientFactory {
  private config: AWSConfig;

  constructor(config: AWSConfig = {}) {
    this.config = {
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      ...config
    };
  }

  /**
   * Create EC2 client
   */
  createEC2Client(): EC2Client {
    return new EC2Client({
      region: this.config.region,
      credentials: this.getCredentials()
    });
  }

  /**
   * Create S3 client
   */
  createS3Client(): S3Client {
    return new S3Client({
      region: this.config.region,
      credentials: this.getCredentials()
    });
  }

  /**
   * Create RDS client
   */
  createRDSClient(): RDSClient {
    return new RDSClient({
      region: this.config.region,
      credentials: this.getCredentials()
    });
  }

  private getCredentials() {
    if (this.config.accessKeyId && this.config.secretAccessKey) {
      return {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        sessionToken: this.config.sessionToken
      };
    }
    // Will use default credential chain (env vars, profile, IAM role)
    return undefined;
  }
}
