import { Resource, CloudProvider, ResourceType, IaCDefinition } from '../types';
import { PulumiResource, PulumiParserOptions } from './pulumi-types';
import { PulumiParser } from './pulumi';

/**
 * Adapter to convert Pulumi resources to common Resource format
 */
export class PulumiAdapter {
  private parser: PulumiParser;

  constructor() {
    this.parser = new PulumiParser();
  }

  /**
   * Parse Pulumi project and convert to IaC definition
   */
  async parseToIaCDefinition(options: PulumiParserOptions): Promise<IaCDefinition> {
    const parseResult = await this.parser.parse(options);

    if (parseResult.errors.length > 0) {
      console.warn('Pulumi parsing errors:', parseResult.errors);
    }

    const resources = parseResult.resources.map((pulumiRes) =>
      this.convertToResource(pulumiRes)
    );

    // Detect primary provider from resources
    const provider = this.detectProvider(parseResult.resources);

    return {
      provider,
      resources,
      source: 'pulumi',
      filePath: parseResult.filePath,
    };
  }

  /**
   * Convert Pulumi resource to common Resource format
   */
  private convertToResource(pulumiRes: PulumiResource): Resource {
    // Extract provider and resource info from type
    // Format: aws:ec2/instance:Instance or azure:compute/virtualMachine:VirtualMachine
    const typeInfo = this.parseResourceType(pulumiRes.type);

    return {
      id: this.generateResourceId(pulumiRes),
      type: typeInfo.resourceType,
      provider: typeInfo.provider,
      name: pulumiRes.name,
      properties: pulumiRes.properties,
      tags: this.extractTags(pulumiRes.properties),
    };
  }

  /**
   * Parse Pulumi resource type string
   */
  private parseResourceType(type: string): {
    provider: CloudProvider;
    resourceType: ResourceType;
    module: string;
    resource: string;
  } {
    // Parse format: provider:module/resource:ResourceClass
    const match = type.match(/^(\w+):(\w+)\/(\w+):(\w+)$/);

    if (!match) {
      // Fallback for non-standard format
      return {
        provider: 'aws',
        resourceType: 'compute',
        module: 'unknown',
        resource: type,
      };
    }

    const [, provider, module, resource, resourceClass] = match;

    return {
      provider: this.mapProvider(provider),
      resourceType: this.mapResourceType(module, resource),
      module,
      resource: resourceClass,
    };
  }

  /**
   * Map Pulumi provider name to CloudProvider
   */
  private mapProvider(pulumiProvider: string): CloudProvider {
    switch (pulumiProvider.toLowerCase()) {
      case 'aws':
        return 'aws';
      case 'azure':
      case 'azure-native':
        return 'azure';
      case 'gcp':
      case 'gcloud':
        return 'gcp';
      default:
        return 'aws'; // Default fallback
    }
  }

  /**
   * Map Pulumi module/resource to ResourceType
   */
  private mapResourceType(module: string, resource: string): ResourceType {
    const combined = `${module}/${resource}`.toLowerCase();

    // Compute resources
    if (
      combined.includes('ec2/instance') ||
      combined.includes('compute/virtualmachine') ||
      combined.includes('compute/instance')
    ) {
      return 'compute';
    }

    // Storage resources
    if (
      combined.includes('s3/bucket') ||
      combined.includes('storage/') ||
      combined.includes('blob')
    ) {
      return 'storage';
    }

    // Network resources
    if (
      combined.includes('vpc') ||
      combined.includes('network') ||
      combined.includes('subnet') ||
      combined.includes('securitygroup')
    ) {
      return 'network';
    }

    // Database resources
    if (
      combined.includes('rds/') ||
      combined.includes('database') ||
      combined.includes('sql')
    ) {
      return 'database';
    }

    // Security resources
    if (
      combined.includes('iam') ||
      combined.includes('key') ||
      combined.includes('secret') ||
      combined.includes('certificate')
    ) {
      return 'security';
    }

    // Default to compute
    return 'compute';
  }

  /**
   * Generate resource ID from Pulumi resource
   */
  private generateResourceId(pulumiRes: PulumiResource): string {
    // If cloud ID is available (from stack export)
    if (pulumiRes.properties.__cloudId) {
      return pulumiRes.properties.__cloudId;
    }

    // Generate deterministic ID from type and name
    return `${pulumiRes.type}::${pulumiRes.name}`;
  }

  /**
   * Extract tags from properties
   */
  private extractTags(properties: Record<string, any>): Record<string, string> | undefined {
    // Check common tag property names
    const tagKeys = ['tags', 'Tags', 'resourceTags', 'labels'];

    for (const key of tagKeys) {
      if (properties[key] && typeof properties[key] === 'object') {
        return properties[key] as Record<string, string>;
      }
    }

    return undefined;
  }

  /**
   * Detect primary cloud provider from resources
   */
  private detectProvider(resources: PulumiResource[]): CloudProvider {
    if (resources.length === 0) {
      return 'aws';
    }

    // Count providers
    const providerCounts = new Map<CloudProvider, number>();

    for (const res of resources) {
      const typeInfo = this.parseResourceType(res.type);
      const count = providerCounts.get(typeInfo.provider) || 0;
      providerCounts.set(typeInfo.provider, count + 1);
    }

    // Return most common provider
    let maxCount = 0;
    let primaryProvider: CloudProvider = 'aws';

    for (const [provider, count] of providerCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryProvider = provider;
      }
    }

    return primaryProvider;
  }
}
