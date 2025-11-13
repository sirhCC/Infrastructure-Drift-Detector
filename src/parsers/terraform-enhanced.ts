import { Resource, IaCDefinition, CloudProvider } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { ModuleParser, TerraformModule } from './module-parser';

/**
 * Enhanced Terraform HCL parser with support for:
 * - Nested blocks (ingress/egress, etc.)
 * - Variables and locals
 * - Count and for_each
 * - Modules
 * - Data sources
 */
export class TerraformParser {
  private variables: Map<string, any> = new Map();
  private locals: Map<string, any> = new Map();
  private modules: TerraformModule[] = [];
  
  /**
   * Parse a Terraform file and extract resource definitions
   */
  parse(filePath: string): IaCDefinition {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Parse variables, locals, and modules first
    this.extractVariables(content);
    this.extractLocals(content);
    this.modules = ModuleParser.extractModules(content);
    
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
   * Get parsed modules
   */
  getModules(): TerraformModule[] {
    return this.modules;
  }

  /**
   * Parse multiple Terraform files from a directory
   */
  parseDirectory(dirPath: string): IaCDefinition[] {
    // Reset variables and locals for new directory
    this.variables.clear();
    this.locals.clear();

    const files = fs.readdirSync(dirPath)
      .filter((file: string) => file.endsWith('.tf'))
      .map((file: string) => path.join(dirPath, file));

    // First pass: collect all variables and locals
    files.forEach((file: string) => {
      const content = fs.readFileSync(file, 'utf-8');
      this.extractVariables(content);
      this.extractLocals(content);
    });

    // Second pass: parse resources with variable context
    return files.map((file: string) => this.parse(file));
  }

  /**
   * Extract variable declarations
   */
  private extractVariables(content: string): void {
    const variableRegex = /variable\s+"([^"]+)"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      const [, name, body] = match;
      const defaultMatch = body.match(/default\s*=\s*"([^"]*)"/);
      
      if (defaultMatch) {
        this.variables.set(name, defaultMatch[1]);
      } else {
        this.variables.set(name, null);
      }
    }
  }

  /**
   * Extract local values
   */
  private extractLocals(content: string): void {
    const localsRegex = /locals\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    const match = localsRegex.exec(content);
    
    if (match) {
      const body = match[1];
      const localRegex = /(\w+)\s*=\s*"([^"]*)"/g;
      let localMatch;
      
      while ((localMatch = localRegex.exec(body)) !== null) {
        const [, name, value] = localMatch;
        this.locals.set(name, value);
      }
    }
  }

  /**
   * Extract all resources including data sources
   */
  private extractResources(content: string): Resource[] {
    const resources: Resource[] = [];
    
    // Match resource blocks with nested content
    const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{([\s\S]*?)\n\}/g;
    
    let match;
    while ((match = resourceRegex.exec(content)) !== null) {
      const [, type, name, body] = match;
      
      // Check for count or for_each
      const count = this.extractCount(body);
      const forEach = this.extractForEach(body);
      
      if (count > 1) {
        // Create multiple resources for count
        for (let i = 0; i < count; i++) {
          resources.push(this.createResource(type, `${name}[${i}]`, body, i));
        }
      } else if (forEach) {
        // Create resources for each item in for_each
        forEach.forEach((value: any, key: string) => {
          resources.push(this.createResource(type, `${name}["${key}"]`, body, undefined, key));
        });
      } else {
        resources.push(this.createResource(type, name, body));
      }
    }

    // Also extract data sources
    const dataResources = this.extractDataSources(content);
    resources.push(...dataResources);

    return resources;
  }

  /**
   * Create a resource object
   */
  private createResource(
    type: string, 
    name: string, 
    body: string, 
    countIndex?: number,
    forEachKey?: string
  ): Resource {
    return {
      id: `${type}.${name}`,
      type: this.mapResourceType(type),
      provider: this.getProviderFromType(type),
      name,
      properties: this.parseProperties(body, countIndex, forEachKey),
      tags: this.extractTags(body)
    };
  }

  /**
   * Extract count meta-argument
   */
  private extractCount(body: string): number {
    const countMatch = body.match(/count\s*=\s*(\d+)/);
    return countMatch ? parseInt(countMatch[1], 10) : 1;
  }

  /**
   * Extract for_each meta-argument
   */
  private extractForEach(body: string): Map<string, any> | null {
    const forEachMatch = body.match(/for_each\s*=\s*\{([^}]+)\}/);
    if (!forEachMatch) return null;

    const items = new Map<string, any>();
    const content = forEachMatch[1];
    const itemRegex = /(\w+)\s*=\s*"([^"]*)"/g;
    let match;

    while ((match = itemRegex.exec(content)) !== null) {
      const [, key, value] = match;
      items.set(key, value);
    }

    return items.size > 0 ? items : null;
  }

  /**
   * Extract data sources
   */
  private extractDataSources(content: string): Resource[] {
    const resources: Resource[] = [];
    const dataRegex = /data\s+"([^"]+)"\s+"([^"]+)"\s*\{([\s\S]*?)\n\}/g;
    
    let match;
    while ((match = dataRegex.exec(content)) !== null) {
      const [, type, name, body] = match;
      
      resources.push({
        id: `data.${type}.${name}`,
        type: this.mapResourceType(type),
        provider: this.getProviderFromType(type),
        name: `data.${name}`,
        properties: this.parseProperties(body),
        tags: this.extractTags(body)
      });
    }

    return resources;
  }

  /**
   * Parse properties with nested blocks support
   */
  private parseProperties(
    body: string, 
    countIndex?: number, 
    forEachKey?: string
  ): Record<string, any> {
    const properties: Record<string, any> = {};
    
    // Parse simple key-value pairs (quoted strings)
    const stringRegex = /(\w+)\s*=\s*"([^"]*)"/g;
    let match;
    
    while ((match = stringRegex.exec(body)) !== null) {
      const [, key, value] = match;
      properties[key] = this.resolveValue(value, countIndex, forEachKey);
    }

    // Parse numbers
    const numberRegex = /(\w+)\s*=\s*(\d+(?:\.\d+)?)\s/g;
    while ((match = numberRegex.exec(body)) !== null) {
      const [, key, value] = match;
      properties[key] = parseFloat(value);
    }

    // Parse booleans
    const boolRegex = /(\w+)\s*=\s*(true|false)\s/g;
    while ((match = boolRegex.exec(body)) !== null) {
      const [, key, value] = match;
      properties[key] = value === 'true';
    }

    // Parse lists
    const listRegex = /(\w+)\s*=\s*\[(.*?)\]/g;
    while ((match = listRegex.exec(body)) !== null) {
      const [, key, value] = match;
      properties[key] = value.split(',')
        .map((v: string) => v.trim().replace(/"/g, ''))
        .filter((v: string) => v.length > 0);
    }

    // Parse nested blocks (ingress, egress, etc.)
    const nestedBlocks = this.parseNestedBlocks(body);
    Object.assign(properties, nestedBlocks);

    return properties;
  }

  /**
   * Parse nested blocks like ingress, egress, etc.
   */
  private parseNestedBlocks(body: string): Record<string, any> {
    const blocks: Record<string, any> = {};
    
    // Match nested blocks: block_name { ... }
    const blockRegex = /(\w+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let match;
    
    const nestedBlockNames = ['ingress', 'egress', 'ebs_block_device', 'root_block_device', 'network_interface'];
    
    while ((match = blockRegex.exec(body)) !== null) {
      const [, blockName, blockBody] = match;
      
      if (nestedBlockNames.includes(blockName)) {
        if (!blocks[blockName]) {
          blocks[blockName] = [];
        }
        
        const blockProps = this.parseProperties(blockBody);
        blocks[blockName].push(blockProps);
      }
    }

    return blocks;
  }

  /**
   * Resolve variable references
   */
  private resolveValue(value: string, countIndex?: number, forEachKey?: string): any {
    // Replace var.* references
    const varRegex = /\$\{var\.(\w+)\}/g;
    let resolved = value.replace(varRegex, (_, varName) => {
      return this.variables.get(varName) || `var.${varName}`;
    });

    // Replace local.* references
    const localRegex = /\$\{local\.(\w+)\}/g;
    resolved = resolved.replace(localRegex, (_, localName) => {
      return this.locals.get(localName) || `local.${localName}`;
    });

    // Replace count.index
    if (countIndex !== undefined) {
      resolved = resolved.replace(/\$\{count\.index\}/g, countIndex.toString());
    }

    // Replace each.key and each.value
    if (forEachKey !== undefined) {
      resolved = resolved.replace(/\$\{each\.key\}/g, forEachKey);
      resolved = resolved.replace(/\$\{each\.value\}/g, forEachKey);
    }

    return resolved;
  }

  /**
   * Extract tags with variable support
   */
  private extractTags(body: string): Record<string, string> | undefined {
    const tagsMatch = body.match(/tags\s*=\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
    if (!tagsMatch) return undefined;

    const tags: Record<string, string> = {};
    const tagContent = tagsMatch[1];
    const tagRegex = /(\w+)\s*=\s*"([^"]*)"/g;
    
    let match;
    while ((match = tagRegex.exec(tagContent)) !== null) {
      const [, key, value] = match;
      tags[key] = this.resolveValue(value);
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
    if (tfType.includes('vpc') || tfType.includes('network') || tfType.includes('subnet')) return 'network';
    if (tfType.includes('db') || tfType.includes('database')) return 'database';
    if (tfType.includes('security') || tfType.includes('iam')) return 'security';
    return 'compute';
  }
}
