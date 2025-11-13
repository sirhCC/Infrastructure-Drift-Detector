import { promises as fs } from 'fs';
import * as path from 'path';
import {
  PulumiResource,
  PulumiParseResult,
  PulumiLanguage,
  PulumiParserOptions,
  PulumiProject,
  PulumiStackConfig,
  SourceLocation,
} from './pulumi-types';

/**
 * Parser for Pulumi TypeScript programs
 * 
 * Analyzes TypeScript-based Pulumi programs to extract resource definitions.
 * Uses static analysis and pattern matching to identify Pulumi resource declarations.
 */
export class PulumiTypeScriptParser {
  /**
   * Parse a Pulumi TypeScript program
   */
  async parse(options: PulumiParserOptions): Promise<PulumiParseResult> {
    const result: PulumiParseResult = {
      language: PulumiLanguage.TypeScript,
      resources: [],
      errors: [],
      filePath: options.projectDir,
    };

    try {
      // Load Pulumi.yaml project file
      result.project = await this.loadProject(options.projectDir);

      // Load stack configuration if stack name provided
      if (options.stackName) {
        result.stackConfig = await this.loadStackConfig(
          options.projectDir,
          options.stackName
        );
      }

      // Find and parse the main program file
      const mainFile = await this.findMainFile(options.projectDir, result.project);
      if (mainFile) {
        const resources = await this.parseTypeScriptFile(
          mainFile,
          options,
          result.stackConfig
        );
        result.resources.push(...resources);
      } else {
        result.errors.push('Could not find main TypeScript program file');
      }
    } catch (error) {
      result.errors.push(
        `Failed to parse Pulumi TypeScript project: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return result;
  }

  /**
   * Load Pulumi.yaml project configuration
   */
  private async loadProject(projectDir: string): Promise<PulumiProject | undefined> {
    try {
      const projectPath = path.join(projectDir, 'Pulumi.yaml');
      const content = await fs.readFile(projectPath, 'utf-8');
      return this.parseYAML(content) as PulumiProject;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Load Pulumi.<stack>.yaml stack configuration
   */
  private async loadStackConfig(
    projectDir: string,
    stackName: string
  ): Promise<PulumiStackConfig | undefined> {
    try {
      const configPath = path.join(projectDir, `Pulumi.${stackName}.yaml`);
      const content = await fs.readFile(configPath, 'utf-8');
      return this.parseYAML(content) as PulumiStackConfig;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Find the main TypeScript file
   */
  private async findMainFile(
    projectDir: string,
    project?: PulumiProject
  ): Promise<string | null> {
    // Check if main is specified in project
    if (project?.main) {
      const mainPath = path.join(projectDir, project.main);
      if (await this.fileExists(mainPath)) {
        return mainPath;
      }
    }

    // Try common entry points
    const candidates = ['index.ts', 'main.ts', 'src/index.ts', 'src/main.ts'];
    for (const candidate of candidates) {
      const filePath = path.join(projectDir, candidate);
      if (await this.fileExists(filePath)) {
        return filePath;
      }
    }

    return null;
  }

  /**
   * Parse a TypeScript file for Pulumi resources
   */
  private async parseTypeScriptFile(
    filePath: string,
    options: PulumiParserOptions,
    stackConfig?: PulumiStackConfig
  ): Promise<PulumiResource[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const resources: PulumiResource[] = [];

    // Parse resources using regex patterns
    // Match patterns like: new aws.ec2.Instance("myInstance", { ... })
    const resourcePattern = /new\s+([\w.]+)\s*\(\s*["']([^"']+)["']\s*,\s*({[\s\S]*?})\s*(?:,\s*({[\s\S]*?}))?\s*\)/g;

    let match;
    while ((match = resourcePattern.exec(content)) !== null) {
      const [fullMatch, resourceType, resourceName, propertiesStr, optionsStr] = match;
      
      try {
        // Extract resource type (e.g., aws.ec2.Instance -> aws:ec2/instance:Instance)
        const type = this.normalizeResourceType(resourceType);
        
        // Parse properties (basic extraction)
        const properties = this.extractProperties(propertiesStr, stackConfig, options.configValues);
        
        // Parse options if provided
        const resourceOptions = optionsStr
          ? this.extractOptions(optionsStr)
          : undefined;

        // Calculate line number
        const line = this.getLineNumber(content, match.index);

        resources.push({
          type,
          name: resourceName,
          properties,
          options: resourceOptions,
          location: {
            file: filePath,
            line,
          },
        });
      } catch (error) {
        // Skip malformed resources
        console.warn(`Failed to parse resource at ${filePath}:${match.index}`, error);
      }
    }

    return resources;
  }

  /**
   * Normalize resource type to Pulumi URN format
   * Example: aws.ec2.Instance -> aws:ec2/instance:Instance
   */
  private normalizeResourceType(type: string): string {
    const parts = type.split('.');
    if (parts.length < 3) {
      return type; // Return as-is if can't parse
    }

    const provider = parts[0]; // aws, azure, gcp
    const module = parts[1]; // ec2, storage, compute
    const resource = parts[2]; // Instance, Bucket, etc.

    // Convert to Pulumi type format
    return `${provider}:${module}/${resource.toLowerCase()}:${resource}`;
  }

  /**
   * Extract properties from object literal string
   */
  private extractProperties(
    propertiesStr: string,
    stackConfig?: PulumiStackConfig,
    configValues?: Record<string, string>
  ): Record<string, any> {
    try {
      // Remove outer braces
      let cleaned = propertiesStr.trim();
      if (cleaned.startsWith('{')) {
        cleaned = cleaned.substring(1);
      }
      if (cleaned.endsWith('}')) {
        cleaned = cleaned.substring(0, cleaned.length - 1);
      }

      const properties: Record<string, any> = {};
      
      // Basic property extraction (key: value pairs)
      const propPattern = /([\w]+)\s*:\s*([^,]+?)(?:,|$)/g;
      let match;
      
      while ((match = propPattern.exec(cleaned)) !== null) {
        const [, key, value] = match;
        properties[key] = this.parseValue(value.trim(), stackConfig, configValues);
      }

      return properties;
    } catch (error) {
      return {};
    }
  }

  /**
   * Parse a value (string, number, boolean, config reference)
   */
  private parseValue(
    value: string,
    stackConfig?: PulumiStackConfig,
    configValues?: Record<string, string>
  ): any {
    // String literals
    if (value.startsWith('"') || value.startsWith("'")) {
      return value.slice(1, -1);
    }

    // Numbers
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Booleans
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Config references: config.get("key") or config.require("key")
    const configMatch = value.match(/config\.(get|require)\s*\(\s*["']([^"']+)["']\s*\)/);
    if (configMatch && stackConfig) {
      const configKey = configMatch[2];
      const configValue = stackConfig.config[configKey];
      
      if (typeof configValue === 'string') {
        return configValue;
      } else if (configValue && 'value' in configValue) {
        return configValue.value;
      }
      
      // Check provided config values
      if (configValues && configKey in configValues) {
        return configValues[configKey];
      }
    }

    // Return as-is for complex expressions
    return value;
  }

  /**
   * Extract resource options
   */
  private extractOptions(optionsStr: string): any {
    try {
      // Basic options extraction
      const options: any = {};
      
      if (optionsStr.includes('protect:')) {
        const match = optionsStr.match(/protect\s*:\s*(true|false)/);
        if (match) {
          options.protect = match[1] === 'true';
        }
      }

      if (optionsStr.includes('dependsOn:')) {
        // Extract dependsOn array
        const match = optionsStr.match(/dependsOn\s*:\s*\[(.*?)\]/);
        if (match) {
          options.dependsOn = match[1]
            .split(',')
            .map((dep) => dep.trim())
            .filter((dep) => dep.length > 0);
        }
      }

      return options;
    } catch (error) {
      return {};
    }
  }

  /**
   * Get line number from content and index
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Parse YAML content (simple implementation)
   */
  private parseYAML(content: string): any {
    // This is a simplified YAML parser
    // In production, use a proper YAML library like 'js-yaml'
    const result: any = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        result[key] = value.trim();
      }
    }
    
    return result;
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
