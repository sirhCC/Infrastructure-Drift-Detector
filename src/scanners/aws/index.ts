import { Resource } from '../../types';
import { AWSClientFactory, AWSConfig } from './client';
import { EC2Scanner } from './ec2';
import { S3Scanner } from './s3';
import { VPCScanner } from './vpc';
import { SecurityGroupScanner } from './security-group';
import { RDSScanner } from './rds';

/**
 * Options for AWS scanning
 */
export interface AWSScanOptions {
  includeEC2?: boolean;
  includeS3?: boolean;
  includeVPC?: boolean;
  includeSecurityGroups?: boolean;
  includeRDS?: boolean;
}

/**
 * Main AWS Scanner - orchestrates all AWS resource scanners
 */
export class AWSScanner {
  private clientFactory: AWSClientFactory;
  private options: AWSScanOptions;

  constructor(config: AWSConfig = {}, options: AWSScanOptions = {}) {
    this.clientFactory = new AWSClientFactory(config);
    this.options = {
      includeEC2: options.includeEC2 ?? true,
      includeS3: options.includeS3 ?? true,
      includeVPC: options.includeVPC ?? true,
      includeSecurityGroups: options.includeSecurityGroups ?? true,
      includeRDS: options.includeRDS ?? true
    };
  }

  /**
   * Scan all configured AWS resources
   */
  async scan(): Promise<Resource[]> {
    const scanPromises: Promise<Resource[]>[] = [];

    console.log('Starting AWS resource scan...');

    if (this.options.includeEC2) {
      console.log('  → Scanning EC2 instances...');
      const ec2Client = this.clientFactory.createEC2Client();
      const ec2Scanner = new EC2Scanner(ec2Client);
      scanPromises.push(ec2Scanner.scan());
    }

    if (this.options.includeS3) {
      console.log('  → Scanning S3 buckets...');
      const s3Client = this.clientFactory.createS3Client();
      const s3Scanner = new S3Scanner(s3Client);
      scanPromises.push(s3Scanner.scan());
    }

    if (this.options.includeVPC) {
      console.log('  → Scanning VPCs and Subnets...');
      const ec2Client = this.clientFactory.createEC2Client();
      const vpcScanner = new VPCScanner(ec2Client);
      scanPromises.push(vpcScanner.scan());
    }

    if (this.options.includeSecurityGroups) {
      console.log('  → Scanning Security Groups...');
      const ec2Client = this.clientFactory.createEC2Client();
      const sgScanner = new SecurityGroupScanner(ec2Client);
      scanPromises.push(sgScanner.scan());
    }

    if (this.options.includeRDS) {
      console.log('  → Scanning RDS instances...');
      const rdsClient = this.clientFactory.createRDSClient();
      const rdsScanner = new RDSScanner(rdsClient);
      scanPromises.push(rdsScanner.scan());
    }

    try {
      // Run all scans in parallel
      const results = await Promise.allSettled(scanPromises);
      
      const allResources: Resource[] = [];
      let failedScans = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allResources.push(...result.value);
        } else {
          failedScans++;
          console.error(`Scan ${index} failed:`, result.reason);
        }
      });

      console.log(`\n✓ Scan complete: Found ${allResources.length} resources`);
      if (failedScans > 0) {
        console.warn(`⚠ ${failedScans} scanner(s) failed`);
      }

      return allResources;
    } catch (error) {
      console.error('Error during AWS scan:', error);
      throw error;
    }
  }

  /**
   * Scan specific resource types
   */
  async scanResourceType(type: 'ec2' | 's3' | 'vpc' | 'security-group' | 'rds'): Promise<Resource[]> {
    console.log(`Scanning ${type} resources...`);

    switch (type) {
      case 'ec2': {
        const client = this.clientFactory.createEC2Client();
        return new EC2Scanner(client).scan();
      }
      case 's3': {
        const client = this.clientFactory.createS3Client();
        return new S3Scanner(client).scan();
      }
      case 'vpc': {
        const client = this.clientFactory.createEC2Client();
        return new VPCScanner(client).scan();
      }
      case 'security-group': {
        const client = this.clientFactory.createEC2Client();
        return new SecurityGroupScanner(client).scan();
      }
      case 'rds': {
        const client = this.clientFactory.createRDSClient();
        return new RDSScanner(client).scan();
      }
      default:
        throw new Error(`Unknown resource type: ${type}`);
    }
  }
}
