import { EC2Client, DescribeInstancesCommand, Instance } from '@aws-sdk/client-ec2';
import { Resource } from '../../types';

/**
 * EC2 Instance Scanner
 */
export class EC2Scanner {
  private client: EC2Client;

  constructor(client: EC2Client) {
    this.client = client;
  }

  /**
   * Scan all EC2 instances in the region
   */
  async scan(): Promise<Resource[]> {
    const resources: Resource[] = [];
    let nextToken: string | undefined;

    try {
      do {
        const command = new DescribeInstancesCommand({
          NextToken: nextToken,
          MaxResults: 100
        });

        const response = await this.client.send(command);

        if (response.Reservations) {
          for (const reservation of response.Reservations) {
            if (reservation.Instances) {
              for (const instance of reservation.Instances) {
                resources.push(this.mapInstance(instance));
              }
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);

      return resources;
    } catch (error) {
      console.error('Error scanning EC2 instances:', error);
      throw error;
    }
  }

  /**
   * Map AWS EC2 Instance to Resource type
   */
  private mapInstance(instance: Instance): Resource {
    const tags: Record<string, string> = {};
    
    if (instance.Tags) {
      for (const tag of instance.Tags) {
        if (tag.Key && tag.Value) {
          tags[tag.Key] = tag.Value;
        }
      }
    }

    return {
      id: `aws_instance.${tags.Name || instance.InstanceId || 'unknown'}`,
      type: 'compute',
      provider: 'aws',
      name: tags.Name || instance.InstanceId || 'unknown',
      properties: {
        instance_id: instance.InstanceId,
        instance_type: instance.InstanceType,
        ami: instance.ImageId,
        availability_zone: instance.Placement?.AvailabilityZone,
        subnet_id: instance.SubnetId,
        vpc_id: instance.VpcId,
        private_ip: instance.PrivateIpAddress,
        public_ip: instance.PublicIpAddress,
        state: instance.State?.Name,
        key_name: instance.KeyName,
        security_groups: instance.SecurityGroups?.map(sg => sg.GroupId),
        monitoring: instance.Monitoring?.State,
        iam_instance_profile: instance.IamInstanceProfile?.Arn,
        ebs_optimized: instance.EbsOptimized,
        root_device_type: instance.RootDeviceType,
        launch_time: instance.LaunchTime?.toISOString()
      },
      tags
    };
  }
}
