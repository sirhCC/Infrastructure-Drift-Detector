import { 
  EC2Client, 
  DescribeVpcsCommand, 
  DescribeSubnetsCommand,
  Vpc,
  Subnet
} from '@aws-sdk/client-ec2';
import { Resource } from '../../types';

/**
 * VPC and Network Scanner
 */
export class VPCScanner {
  private client: EC2Client;

  constructor(client: EC2Client) {
    this.client = client;
  }

  /**
   * Scan all VPCs and Subnets
   */
  async scan(): Promise<Resource[]> {
    const resources: Resource[] = [];

    try {
      const vpcs = await this.scanVPCs();
      const subnets = await this.scanSubnets();
      
      resources.push(...vpcs, ...subnets);
      return resources;
    } catch (error) {
      console.error('Error scanning VPCs/Networks:', error);
      throw error;
    }
  }

  /**
   * Scan all VPCs
   */
  private async scanVPCs(): Promise<Resource[]> {
    const resources: Resource[] = [];
    let nextToken: string | undefined;

    do {
      const command = new DescribeVpcsCommand({
        NextToken: nextToken,
        MaxResults: 100
      });

      const response = await this.client.send(command);

      if (response.Vpcs) {
        for (const vpc of response.Vpcs) {
          resources.push(this.mapVPC(vpc));
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return resources;
  }

  /**
   * Scan all Subnets
   */
  private async scanSubnets(): Promise<Resource[]> {
    const resources: Resource[] = [];
    let nextToken: string | undefined;

    do {
      const command = new DescribeSubnetsCommand({
        NextToken: nextToken,
        MaxResults: 100
      });

      const response = await this.client.send(command);

      if (response.Subnets) {
        for (const subnet of response.Subnets) {
          resources.push(this.mapSubnet(subnet));
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return resources;
  }

  /**
   * Map AWS VPC to Resource type
   */
  private mapVPC(vpc: Vpc): Resource {
    const tags: Record<string, string> = {};
    
    if (vpc.Tags) {
      for (const tag of vpc.Tags) {
        if (tag.Key && tag.Value) {
          tags[tag.Key] = tag.Value;
        }
      }
    }

    return {
      id: `aws_vpc.${tags.Name || vpc.VpcId || 'unknown'}`,
      type: 'network',
      provider: 'aws',
      name: tags.Name || vpc.VpcId || 'unknown',
      properties: {
        vpc_id: vpc.VpcId,
        cidr_block: vpc.CidrBlock,
        instance_tenancy: vpc.InstanceTenancy,
        is_default: vpc.IsDefault,
        state: vpc.State
      },
      tags
    };
  }

  /**
   * Map AWS Subnet to Resource type
   */
  private mapSubnet(subnet: Subnet): Resource {
    const tags: Record<string, string> = {};
    
    if (subnet.Tags) {
      for (const tag of subnet.Tags) {
        if (tag.Key && tag.Value) {
          tags[tag.Key] = tag.Value;
        }
      }
    }

    return {
      id: `aws_subnet.${tags.Name || subnet.SubnetId || 'unknown'}`,
      type: 'network',
      provider: 'aws',
      name: tags.Name || subnet.SubnetId || 'unknown',
      properties: {
        subnet_id: subnet.SubnetId,
        vpc_id: subnet.VpcId,
        cidr_block: subnet.CidrBlock,
        availability_zone: subnet.AvailabilityZone,
        map_public_ip_on_launch: subnet.MapPublicIpOnLaunch,
        available_ip_address_count: subnet.AvailableIpAddressCount,
        state: subnet.State
      },
      tags
    };
  }
}
