import { DetectedResource } from '../types';

export interface CrossCloudResource {
  id: string;
  name: string;
  type: string;
  provider: 'aws' | 'azure' | 'gcp';
  region: string;
  properties: Record<string, any>;
  normalizedType: string;
  cost?: number;
}

export interface CrossCloudComparison {
  resourceType: string;
  providers: {
    aws?: CrossCloudResource[];
    azure?: CrossCloudResource[];
    gcp?: CrossCloudResource[];
  };
  totalCount: number;
  similarities: ResourceSimilarity[];
  recommendations: string[];
}

export interface ResourceSimilarity {
  resources: CrossCloudResource[];
  similarityScore: number;
  matchingProperties: string[];
  differences: PropertyDifference[];
}

export interface PropertyDifference {
  property: string;
  values: Record<string, any>;
}

/**
 * Cross-Cloud Resource Comparison
 * Compare similar resources across AWS, Azure, and GCP
 */
export class CrossCloudComparator {
  private typeMapping: Map<string, string>;

  constructor() {
    this.typeMapping = this.initializeTypeMapping();
  }

  /**
   * Compare resources across cloud providers
   */
  async compareResources(
    resources: DetectedResource[]
  ): Promise<CrossCloudComparison[]> {
    // Group by normalized type
    const grouped = this.groupByNormalizedType(resources);
    const comparisons: CrossCloudComparison[] = [];

    for (const [normalizedType, typeResources] of grouped) {
      const comparison = this.compareResourceGroup(normalizedType, typeResources);
      comparisons.push(comparison);
    }

    return comparisons;
  }

  /**
   * Group resources by normalized type
   */
  private groupByNormalizedType(
    resources: DetectedResource[]
  ): Map<string, CrossCloudResource[]> {
    const grouped = new Map<string, CrossCloudResource[]>();

    for (const resource of resources) {
      const normalized = this.normalizeResource(resource);
      const normalizedType = normalized.normalizedType;

      if (!grouped.has(normalizedType)) {
        grouped.set(normalizedType, []);
      }

      grouped.get(normalizedType)!.push(normalized);
    }

    return grouped;
  }

  /**
   * Normalize resource to common format
   */
  private normalizeResource(resource: DetectedResource): CrossCloudResource {
    const provider = this.detectProvider(resource.resourceType);
    const normalizedType = this.getNormalizedType(resource.resourceType);

    return {
      id: resource.resourceId,
      name: resource.resourceName,
      type: resource.resourceType,
      provider,
      region: this.extractRegion(resource),
      properties: resource.actualState || resource.expectedState || {},
      normalizedType,
    };
  }

  /**
   * Compare a group of resources
   */
  private compareResourceGroup(
    normalizedType: string,
    resources: CrossCloudResource[]
  ): CrossCloudComparison {
    const providers: CrossCloudComparison['providers'] = {};
    let totalCount = 0;

    for (const resource of resources) {
      if (!providers[resource.provider]) {
        providers[resource.provider] = [];
      }
      providers[resource.provider]!.push(resource);
      totalCount++;
    }

    const similarities = this.findSimilarResources(resources);
    const recommendations = this.generateRecommendations(normalizedType, providers);

    return {
      resourceType: normalizedType,
      providers,
      totalCount,
      similarities,
      recommendations,
    };
  }

  /**
   * Find similar resources across providers
   */
  private findSimilarResources(
    resources: CrossCloudResource[]
  ): ResourceSimilarity[] {
    const similarities: ResourceSimilarity[] = [];

    // Compare each pair of resources
    for (let i = 0; i < resources.length; i++) {
      for (let j = i + 1; j < resources.length; j++) {
        const res1 = resources[i];
        const res2 = resources[j];

        // Only compare across different providers
        if (res1.provider === res2.provider) continue;

        const similarity = this.calculateSimilarity(res1, res2);

        if (similarity.similarityScore > 0.5) {
          similarities.push(similarity);
        }
      }
    }

    return similarities.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Calculate similarity between two resources
   */
  private calculateSimilarity(
    res1: CrossCloudResource,
    res2: CrossCloudResource
  ): ResourceSimilarity {
    const matchingProperties: string[] = [];
    const differences: PropertyDifference[] = [];

    // Get common properties to compare
    const commonProps = this.getCommonProperties(res1.normalizedType);

    for (const prop of commonProps) {
      const val1 = this.getNestedProperty(res1.properties, prop);
      const val2 = this.getNestedProperty(res2.properties, prop);

      if (this.areValuesEqual(val1, val2)) {
        matchingProperties.push(prop);
      } else if (val1 !== undefined || val2 !== undefined) {
        differences.push({
          property: prop,
          values: {
            [res1.provider]: val1,
            [res2.provider]: val2,
          },
        });
      }
    }

    const similarityScore =
      commonProps.length > 0
        ? matchingProperties.length / commonProps.length
        : 0;

    return {
      resources: [res1, res2],
      similarityScore,
      matchingProperties,
      differences,
    };
  }

  /**
   * Get common properties for a resource type
   */
  private getCommonProperties(normalizedType: string): string[] {
    const propertyMap: Record<string, string[]> = {
      compute: [
        'instance_type',
        'machine_type',
        'vm_size',
        'image',
        'os',
        'vcpus',
        'memory',
        'disk_size',
      ],
      storage: [
        'size',
        'replication',
        'encryption',
        'versioning',
        'lifecycle',
        'public_access',
      ],
      database: [
        'engine',
        'version',
        'instance_class',
        'storage',
        'multi_az',
        'backup_retention',
      ],
      network: [
        'cidr_block',
        'address_space',
        'subnets',
        'dns',
        'firewall_rules',
      ],
    };

    return propertyMap[normalizedType] || [];
  }

  /**
   * Generate recommendations for cross-cloud resources
   */
  private generateRecommendations(
    normalizedType: string,
    providers: CrossCloudComparison['providers']
  ): string[] {
    const recommendations: string[] = [];
    const providerCount = Object.keys(providers).length;

    if (providerCount > 1) {
      recommendations.push(
        `Multi-cloud detected: Consider using a unified configuration management approach`
      );

      // Check for redundancy
      const totalResources = Object.values(providers).reduce(
        (sum, resources) => sum + (resources?.length || 0),
        0
      );

      if (totalResources > providerCount) {
        recommendations.push(
          `Potential redundancy: ${totalResources} ${normalizedType} resources across ${providerCount} providers`
        );
      }
    }

    // Provider-specific recommendations
    if (providers.aws && providers.azure) {
      recommendations.push(
        `Consider using Azure Arc to manage AWS resources from Azure`
      );
    }

    if (providers.gcp && providers.aws) {
      recommendations.push(
        `Consider using Anthos or multi-cloud service mesh for unified management`
      );
    }

    return recommendations;
  }

  /**
   * Initialize type mapping for normalization
   */
  private initializeTypeMapping(): Map<string, string> {
    const mapping = new Map<string, string>();

    // Compute/VM
    mapping.set('aws_instance', 'compute');
    mapping.set('azurerm_virtual_machine', 'compute');
    mapping.set('azurerm_linux_virtual_machine', 'compute');
    mapping.set('azurerm_windows_virtual_machine', 'compute');
    mapping.set('google_compute_instance', 'compute');

    // Storage
    mapping.set('aws_s3_bucket', 'storage');
    mapping.set('azurerm_storage_account', 'storage');
    mapping.set('google_storage_bucket', 'storage');

    // Database
    mapping.set('aws_db_instance', 'database');
    mapping.set('aws_rds_cluster', 'database');
    mapping.set('azurerm_sql_database', 'database');
    mapping.set('azurerm_mysql_server', 'database');
    mapping.set('google_sql_database_instance', 'database');

    // Network
    mapping.set('aws_vpc', 'network');
    mapping.set('aws_subnet', 'network');
    mapping.set('azurerm_virtual_network', 'network');
    mapping.set('azurerm_subnet', 'network');
    mapping.set('google_compute_network', 'network');
    mapping.set('google_compute_subnetwork', 'network');

    // Security
    mapping.set('aws_security_group', 'security');
    mapping.set('azurerm_network_security_group', 'security');
    mapping.set('google_compute_firewall', 'security');

    return mapping;
  }

  /**
   * Get normalized type for a resource
   */
  private getNormalizedType(resourceType: string): string {
    return this.typeMapping.get(resourceType) || 'other';
  }

  /**
   * Detect provider from resource type
   */
  private detectProvider(resourceType: string): 'aws' | 'azure' | 'gcp' {
    if (resourceType.startsWith('aws_')) return 'aws';
    if (resourceType.startsWith('azurerm_')) return 'azure';
    if (resourceType.startsWith('google_')) return 'gcp';
    return 'aws'; // default
  }

  /**
   * Extract region from resource
   */
  private extractRegion(resource: DetectedResource): string {
    const state = resource.actualState || resource.expectedState || {};
    return state.region || state.location || state.zone || 'unknown';
  }

  /**
   * Get nested property value
   */
  private getNestedProperty(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Check if two values are equal
   */
  private areValuesEqual(val1: any, val2: any): boolean {
    if (val1 === val2) return true;
    if (val1 === undefined || val2 === undefined) return false;

    // Normalize similar values
    const normalized1 = this.normalizeValue(val1);
    const normalized2 = this.normalizeValue(val2);

    return JSON.stringify(normalized1) === JSON.stringify(normalized2);
  }

  /**
   * Normalize value for comparison
   */
  private normalizeValue(value: any): any {
    if (typeof value === 'string') {
      return value.toLowerCase().trim();
    }
    if (Array.isArray(value)) {
      return value.map(v => this.normalizeValue(v)).sort();
    }
    return value;
  }
}
