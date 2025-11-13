import { Resource, IaCDefinition, CloudProvider } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Basic Terraform HCL parser
 * Parses .tf files to extract resource definitions
 */
export class TerraformParser {
  
  /**
   * Parse a Terraform file and extract resource definitions
   */
  parse(filePath: string): IaCDefinition {
    const content = fs.readFileSync(filePath, 'utf-8');
    const resources = this.extractResources(content);
    const provider = this.detectProvider(content);

    return {
      provider,
      resources,
      source: 'terraform',
      filePath
    };
  }

  /**
   * Parse multiple Terraform files from a directory
   */
  parseDirectory(dirPath: string): IaCDefinition[] {
    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.tf'))
      .map(file => path.join(dirPath, file));

    return files.map(file => this.parse(file));
  }

  private extractResources(content: string): Resource[] {
    const resources: Resource[] = [];
    
    // Simple regex to match resource blocks
    // Format: resource "provider_type" "name" { ... }
    const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{([^}]+)\}/g;
    
    let match;
    while ((match = resourceRegex.exec(content)) !== null) {
      const [, type, name, body] = match;
      
      resources.push({
        id: `${type}.${name}`,
        type: this.mapResourceType(type),
        provider: this.getProviderFromType(type),
        name,
        properties: this.parseProperties(body),
        tags: this.extractTags(body)
      });
    }

    return resources;
  }

  private parseProperties(body: string): Record<string, any> {
    const properties: Record<string, any> = {};
    
    // Simple key-value extraction
    const propertyRegex = /(\w+)\s*=\s*"([^"]*)"/g;
    let match;
    
    while ((match = propertyRegex.exec(body)) !== null) {
      const [, key, value] = match;
      properties[key] = value;
    }

    return properties;
  }

  private extractTags(body: string): Record<string, string> | undefined {
    const tagsMatch = body.match(/tags\s*=\s*\{([^}]+)\}/);
    if (!tagsMatch) return undefined;

    const tags: Record<string, string> = {};
    const tagContent = tagsMatch[1];
    const tagRegex = /(\w+)\s*=\s*"([^"]*)"/g;
    
    let match;
    while ((match = tagRegex.exec(tagContent)) !== null) {
      const [, key, value] = match;
      tags[key] = value;
    }

    return Object.keys(tags).length > 0 ? tags : undefined;
  }

  private detectProvider(content: string): CloudProvider {
    if (content.includes('aws_')) return 'aws';
    if (content.includes('azurerm_')) return 'azure';
    if (content.includes('google_')) return 'gcp';
    return 'aws'; // default
  }

  private getProviderFromType(type: string): CloudProvider {
    if (type.startsWith('aws_')) return 'aws';
    if (type.startsWith('azurerm_')) return 'azure';
    if (type.startsWith('google_')) return 'gcp';
    return 'aws';
  }

  private mapResourceType(tfType: string): Resource['type'] {
    if (tfType.includes('instance') || tfType.includes('vm')) return 'compute';
    if (tfType.includes('bucket') || tfType.includes('storage')) return 'storage';
    if (tfType.includes('vpc') || tfType.includes('network')) return 'network';
    if (tfType.includes('db') || tfType.includes('database')) return 'database';
    if (tfType.includes('security') || tfType.includes('iam')) return 'security';
    return 'compute';
  }
}
