import { promises as fs } from 'fs';
import * as crypto from 'crypto';
import {
  TerraformState,
  StateParseResult,
  StateFileOptions,
  StateResource,
  StateComparisonResult,
  StateDifference,
  PropertyDifference,
} from './types';
import { Resource } from '../types';

/**
 * Parser for Terraform state files
 * Handles local and encrypted state files
 */
export class TerraformStateParser {
  /**
   * Parse a Terraform state file
   */
  async parseStateFile(options: StateFileOptions): Promise<StateParseResult> {
    const result: StateParseResult = {
      state: {} as TerraformState,
      source: '',
      wasEncrypted: false,
      errors: [],
    };

    try {
      if (!options.localPath) {
        throw new Error('Local state file path is required');
      }

      result.source = options.localPath;

      // Read state file
      let content = await fs.readFile(options.localPath, 'utf-8');

      // Check if encrypted
      if (this.isEncrypted(content)) {
        if (!options.encryptionKey) {
          throw new Error('State file is encrypted but no encryption key provided');
        }
        content = this.decrypt(content, options.encryptionKey);
        result.wasEncrypted = true;
      }

      // Parse JSON
      result.state = JSON.parse(content) as TerraformState;

      // Validate state format
      if (!result.state.version || !result.state.terraform_version) {
        throw new Error('Invalid Terraform state format');
      }

      // Handle workspace if specified
      if (options.workspace && options.workspace !== 'default') {
        // Workspace-specific state handling could go here
        // For now, we just note it
      }
    } catch (error) {
      result.errors.push(
        `Failed to parse state file: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return result;
  }

  /**
   * Extract resources from Terraform state
   */
  extractResources(state: TerraformState): Resource[] {
    const resources: Resource[] = [];

    for (const stateResource of state.resources) {
      // Skip data sources (mode === 'data')
      if (stateResource.mode !== 'managed') {
        continue;
      }

      // Process each instance (for count/for_each)
      for (const instance of stateResource.instances) {
        const resource = this.convertStateResourceToResource(
          stateResource,
          instance.attributes,
          instance.index_key
        );
        if (resource) {
          resources.push(resource);
        }
      }
    }

    return resources;
  }

  /**
   * Convert state resource to common Resource format
   */
  private convertStateResourceToResource(
    stateResource: StateResource,
    attributes: Record<string, any>,
    indexKey?: number | string
  ): Resource | null {
    try {
      // Parse provider (format: provider["registry.terraform.io/hashicorp/aws"])
      const provider = this.parseProvider(stateResource.provider);

      // Parse resource type to determine category
      const resourceType = this.parseResourceType(stateResource.type);

      // Build resource name with index if present
      let resourceName = stateResource.name;
      if (indexKey !== undefined) {
        resourceName = `${stateResource.name}[${indexKey}]`;
      }

      // Get resource ID from attributes
      const resourceId = attributes.id || `${stateResource.type}.${resourceName}`;

      return {
        id: resourceId,
        type: resourceType,
        provider,
        name: resourceName,
        properties: attributes,
        tags: attributes.tags || attributes.Tags,
      };
    } catch (error) {
      console.warn(`Failed to convert state resource: ${stateResource.type}.${stateResource.name}`, error);
      return null;
    }
  }

  /**
   * Parse provider string to extract cloud provider
   */
  private parseProvider(providerString: string): 'aws' | 'azure' | 'gcp' {
    const lower = providerString.toLowerCase();

    if (lower.includes('aws')) return 'aws';
    if (lower.includes('azure') || lower.includes('azurerm')) return 'azure';
    if (lower.includes('gcp') || lower.includes('google')) return 'gcp';

    return 'aws'; // Default fallback
  }

  /**
   * Parse resource type to determine category
   */
  private parseResourceType(
    type: string
  ): 'compute' | 'storage' | 'network' | 'database' | 'security' {
    const lower = type.toLowerCase();

    // Compute
    if (
      lower.includes('instance') ||
      lower.includes('virtual_machine') ||
      lower.includes('vm') ||
      lower.includes('compute')
    ) {
      return 'compute';
    }

    // Storage
    if (
      lower.includes('bucket') ||
      lower.includes('storage') ||
      lower.includes('blob') ||
      lower.includes('s3')
    ) {
      return 'storage';
    }

    // Network
    if (
      lower.includes('vpc') ||
      lower.includes('network') ||
      lower.includes('subnet') ||
      lower.includes('security_group') ||
      lower.includes('firewall')
    ) {
      return 'network';
    }

    // Database
    if (
      lower.includes('db') ||
      lower.includes('database') ||
      lower.includes('rds') ||
      lower.includes('sql')
    ) {
      return 'database';
    }

    // Security
    if (
      lower.includes('iam') ||
      lower.includes('role') ||
      lower.includes('policy') ||
      lower.includes('key') ||
      lower.includes('secret')
    ) {
      return 'security';
    }

    return 'compute'; // Default fallback
  }

  /**
   * Compare state resources with IaC resources
   */
  compareStateWithIaC(
    stateResources: Resource[],
    iacResources: Resource[]
  ): StateComparisonResult {
    const result: StateComparisonResult = {
      onlyInState: [],
      onlyInIaC: [],
      differences: [],
      matching: [],
    };

    // Create maps for efficient lookup
    const stateMap = new Map<string, Resource>();
    const iacMap = new Map<string, Resource>();

    for (const res of stateResources) {
      stateMap.set(res.id, res);
    }

    for (const res of iacResources) {
      iacMap.set(res.id, res);
    }

    // Find resources only in state
    for (const [id, stateRes] of stateMap) {
      if (!iacMap.has(id)) {
        // Convert back to StateResource format for consistency
        result.onlyInState.push(this.resourceToStateResource(stateRes));
      }
    }

    // Find resources only in IaC
    for (const [id] of iacMap) {
      if (!stateMap.has(id)) {
        result.onlyInIaC.push(id);
      }
    }

    // Compare resources that exist in both
    for (const [id, iacRes] of iacMap) {
      const stateRes = stateMap.get(id);
      if (stateRes) {
        const differences = this.compareResourceProperties(stateRes, iacRes);
        if (differences.length > 0) {
          result.differences.push({
            resourceId: id,
            resourceType: iacRes.type,
            resourceName: iacRes.name,
            propertyDifferences: differences,
          });
        } else {
          result.matching.push(id);
        }
      }
    }

    return result;
  }

  /**
   * Compare properties between state and IaC resources
   */
  private compareResourceProperties(
    stateRes: Resource,
    iacRes: Resource
  ): PropertyDifference[] {
    const differences: PropertyDifference[] = [];
    const allKeys = new Set([
      ...Object.keys(stateRes.properties),
      ...Object.keys(iacRes.properties),
    ]);

    // Properties to ignore (computed/generated by cloud provider)
    const ignoreProps = new Set([
      'id',
      'arn',
      'created_time',
      'updated_time',
      'last_modified',
      'creation_date',
      'owner_id',
      'vpc_id', // Often computed
      'availability_zone', // Often assigned
    ]);

    for (const key of allKeys) {
      if (ignoreProps.has(key)) continue;

      const stateValue = stateRes.properties[key];
      const iacValue = iacRes.properties[key];

      // Skip if values are equal
      if (JSON.stringify(stateValue) === JSON.stringify(iacValue)) {
        continue;
      }

      // Check if this is a computed attribute (exists in state but not IaC)
      const isComputed = stateValue !== undefined && iacValue === undefined;

      differences.push({
        path: key,
        stateValue,
        iacValue,
        isComputed,
      });
    }

    return differences;
  }

  /**
   * Convert Resource to StateResource format
   */
  private resourceToStateResource(resource: Resource): StateResource {
    return {
      mode: 'managed',
      type: `${resource.provider}_${resource.type}`,
      name: resource.name,
      provider: `provider["registry.terraform.io/hashicorp/${resource.provider}"]`,
      instances: [
        {
          schema_version: 0,
          attributes: resource.properties,
          dependencies: [],
        },
      ],
    };
  }

  /**
   * Check if state content is encrypted
   */
  private isEncrypted(content: string): boolean {
    try {
      // Try to parse as JSON
      JSON.parse(content);
      return false;
    } catch {
      // If it's not valid JSON, it might be encrypted
      // Check for common encryption markers
      return (
        content.startsWith('-----BEGIN') ||
        content.includes('ENCRYPTED') ||
        !content.trim().startsWith('{')
      );
    }
  }

  /**
   * Decrypt state file content
   * Note: This is a simplified implementation
   * In production, use proper encryption libraries
   */
  private decrypt(encryptedContent: string, key: string): string {
    try {
      // This is a placeholder for actual decryption
      // Terraform doesn't encrypt state by default, but backends can
      const algorithm = 'aes-256-cbc';
      const keyBuffer = crypto.scryptSync(key, 'salt', 32);
      const iv = Buffer.alloc(16, 0);

      const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
      let decrypted = decipher.update(encryptedContent, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt state file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get state file information without parsing full content
   */
  async getStateInfo(filePath: string): Promise<{
    version: number;
    terraformVersion: string;
    serial: number;
    resourceCount: number;
  } | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const state = JSON.parse(content) as TerraformState;

      return {
        version: state.version,
        terraformVersion: state.terraform_version,
        serial: state.serial,
        resourceCount: state.resources?.length || 0,
      };
    } catch (error) {
      return null;
    }
  }
}
