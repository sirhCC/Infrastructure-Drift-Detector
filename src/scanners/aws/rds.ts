import { 
  RDSClient, 
  DescribeDBInstancesCommand,
  DBInstance
} from '@aws-sdk/client-rds';
import { Resource } from '../../types';

/**
 * RDS Database Scanner
 */
export class RDSScanner {
  private client: RDSClient;

  constructor(client: RDSClient) {
    this.client = client;
  }

  /**
   * Scan all RDS instances
   */
  async scan(): Promise<Resource[]> {
    const resources: Resource[] = [];
    let marker: string | undefined;

    try {
      do {
        const command = new DescribeDBInstancesCommand({
          Marker: marker,
          MaxRecords: 100
        });

        const response = await this.client.send(command);

        if (response.DBInstances) {
          for (const instance of response.DBInstances) {
            resources.push(this.mapDBInstance(instance));
          }
        }

        marker = response.Marker;
      } while (marker);

      return resources;
    } catch (error) {
      console.error('Error scanning RDS instances:', error);
      throw error;
    }
  }

  /**
   * Map AWS RDS Instance to Resource type
   */
  private mapDBInstance(instance: DBInstance): Resource {
    const tags: Record<string, string> = {};
    
    if (instance.TagList) {
      for (const tag of instance.TagList) {
        if (tag.Key && tag.Value) {
          tags[tag.Key] = tag.Value;
        }
      }
    }

    return {
      id: `aws_db_instance.${instance.DBInstanceIdentifier || 'unknown'}`,
      type: 'database',
      provider: 'aws',
      name: instance.DBInstanceIdentifier || 'unknown',
      properties: {
        db_instance_identifier: instance.DBInstanceIdentifier,
        db_instance_class: instance.DBInstanceClass,
        engine: instance.Engine,
        engine_version: instance.EngineVersion,
        allocated_storage: instance.AllocatedStorage,
        storage_type: instance.StorageType,
        storage_encrypted: instance.StorageEncrypted,
        multi_az: instance.MultiAZ,
        availability_zone: instance.AvailabilityZone,
        publicly_accessible: instance.PubliclyAccessible,
        vpc_id: instance.DBSubnetGroup?.VpcId,
        subnet_group: instance.DBSubnetGroup?.DBSubnetGroupName,
        security_groups: instance.VpcSecurityGroups?.map(sg => sg.VpcSecurityGroupId),
        backup_retention_period: instance.BackupRetentionPeriod,
        preferred_backup_window: instance.PreferredBackupWindow,
        preferred_maintenance_window: instance.PreferredMaintenanceWindow,
        auto_minor_version_upgrade: instance.AutoMinorVersionUpgrade,
        deletion_protection: instance.DeletionProtection,
        status: instance.DBInstanceStatus,
        endpoint: instance.Endpoint?.Address,
        port: instance.Endpoint?.Port
      },
      tags
    };
  }
}
