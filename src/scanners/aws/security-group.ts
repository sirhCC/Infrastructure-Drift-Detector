import { 
  EC2Client, 
  DescribeSecurityGroupsCommand,
  SecurityGroup
} from '@aws-sdk/client-ec2';
import { Resource } from '../../types';

/**
 * Security Group Scanner
 */
export class SecurityGroupScanner {
  private client: EC2Client;

  constructor(client: EC2Client) {
    this.client = client;
  }

  /**
   * Scan all Security Groups
   */
  async scan(): Promise<Resource[]> {
    const resources: Resource[] = [];
    let nextToken: string | undefined;

    try {
      do {
        const command = new DescribeSecurityGroupsCommand({
          NextToken: nextToken,
          MaxResults: 100
        });

        const response = await this.client.send(command);

        if (response.SecurityGroups) {
          for (const sg of response.SecurityGroups) {
            resources.push(this.mapSecurityGroup(sg));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);

      return resources;
    } catch (error) {
      console.error('Error scanning Security Groups:', error);
      throw error;
    }
  }

  /**
   * Map AWS Security Group to Resource type
   */
  private mapSecurityGroup(sg: SecurityGroup): Resource {
    const tags: Record<string, string> = {};
    
    if (sg.Tags) {
      for (const tag of sg.Tags) {
        if (tag.Key && tag.Value) {
          tags[tag.Key] = tag.Value;
        }
      }
    }

    // Map ingress rules
    const ingressRules = sg.IpPermissions?.map(rule => ({
      from_port: rule.FromPort,
      to_port: rule.ToPort,
      protocol: rule.IpProtocol,
      cidr_blocks: rule.IpRanges?.map(r => r.CidrIp),
      ipv6_cidr_blocks: rule.Ipv6Ranges?.map(r => r.CidrIpv6),
      source_security_groups: rule.UserIdGroupPairs?.map(p => p.GroupId),
      description: rule.IpRanges?.[0]?.Description || rule.Ipv6Ranges?.[0]?.Description
    })) || [];

    // Map egress rules
    const egressRules = sg.IpPermissionsEgress?.map(rule => ({
      from_port: rule.FromPort,
      to_port: rule.ToPort,
      protocol: rule.IpProtocol,
      cidr_blocks: rule.IpRanges?.map(r => r.CidrIp),
      ipv6_cidr_blocks: rule.Ipv6Ranges?.map(r => r.CidrIpv6),
      destination_security_groups: rule.UserIdGroupPairs?.map(p => p.GroupId),
      description: rule.IpRanges?.[0]?.Description || rule.Ipv6Ranges?.[0]?.Description
    })) || [];

    return {
      id: `aws_security_group.${tags.Name || sg.GroupName || sg.GroupId || 'unknown'}`,
      type: 'security',
      provider: 'aws',
      name: tags.Name || sg.GroupName || sg.GroupId || 'unknown',
      properties: {
        group_id: sg.GroupId,
        group_name: sg.GroupName,
        description: sg.Description,
        vpc_id: sg.VpcId,
        ingress: ingressRules,
        egress: egressRules
      },
      tags
    };
  }
}
