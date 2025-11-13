import { promises as fs } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  PulumiResource,
  PulumiParseResult,
  PulumiLanguage,
  PulumiParserOptions,
  PulumiProject,
  PulumiStackConfig,
} from './pulumi-types';

/**
 * Parser for Pulumi YAML programs
 * 
 * Analyzes YAML-based Pulumi programs to extract resource definitions.
 * Pulumi YAML is a simpler, declarative format for defining infrastructure.
 */
export class PulumiYAMLParser {
  /**
   * Parse a Pulumi YAML program
   */
  async parse(options: PulumiParserOptions): Promise<PulumiParseResult> {
    const result: PulumiParseResult = {
      language: PulumiLanguage.YAML,
      resources: [],
      errors: [],
      filePath: options.projectDir,
    };

    try {
      // Load Pulumi.yaml project file
      result.project = await this.loadProject(options.projectDir);

      // Load stack configuration if provided
      if (options.stackName) {
        result.stackConfig = await this.loadStackConfig(
          options.projectDir,
          options.stackName
        );
      }

      // Parse the main Pulumi.yaml file (which contains resources)
      const resources = await this.parseYAMLProgram(
        options.projectDir,
        options,
        result.stackConfig
      );
      result.resources.push(...resources);
    } catch (error) {
      result.errors.push(
        `Failed to parse Pulumi YAML project: ${error instanceof Error ? error.message : String(error)}`
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
      return yaml.load(content) as PulumiProject;
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
      return yaml.load(content) as PulumiStackConfig;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Parse Pulumi YAML program
   */
  private async parseYAMLProgram(
    projectDir: string,
    options: PulumiParserOptions,
    stackConfig?: PulumiStackConfig
  ): Promise<PulumiResource[]> {
    const resources: PulumiResource[] = [];

    try {
      const projectPath = path.join(projectDir, 'Pulumi.yaml');
      const content = await fs.readFile(projectPath, 'utf-8');
      const doc = yaml.load(content) as any;

      // Check for resources section
      if (!doc.resources) {
        return resources;
      }

      // Parse each resource definition
      for (const [resourceName, resourceDef] of Object.entries(doc.resources)) {
        if (typeof resourceDef !== 'object' || resourceDef === null) {
          continue;
        }

        const def = resourceDef as any;

        // Extract resource type
        const type = def.type;
        if (!type) {
          continue;
        }

        // Extract properties
        let properties = def.properties || {};

        // Resolve configuration variables if enabled
        if (options.resolveConfig && stackConfig) {
          properties = this.resolveConfigReferences(
            properties,
            stackConfig,
            options.configValues
          );
        }

        // Extract options
        const resourceOptions = this.extractResourceOptions(def.options);

        resources.push({
          type,
          name: resourceName,
          properties,
          options: resourceOptions,
          location: {
            file: projectPath,
          },
        });
      }

      // Parse variables section for potential resource references
      if (doc.variables) {
        for (const [varName, varDef] of Object.entries(doc.variables)) {
          // Variables might contain embedded resources
          // This is an advanced feature, basic implementation here
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse YAML program: ${error instanceof Error ? error.message : String(error)}`);
    }

    return resources;
  }

  /**
   * Resolve configuration variable references in properties
   */
  private resolveConfigReferences(
    obj: any,
    stackConfig: PulumiStackConfig,
    configValues?: Record<string, string>
  ): any {
    if (typeof obj !== 'object' || obj === null) {
      // Check for string interpolation: ${config.key}
      if (typeof obj === 'string') {
        return this.resolveStringInterpolation(obj, stackConfig, configValues);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveConfigReferences(item, stackConfig, configValues));
    }

    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Special fn::invoke syntax for Pulumi functions
      if (key === 'fn::invoke') {
        resolved[key] = value;
        continue;
      }

      resolved[key] = this.resolveConfigReferences(value, stackConfig, configValues);
    }

    return resolved;
  }

  /**
   * Resolve string interpolation ${config.key} or ${var.name}
   */
  private resolveStringInterpolation(
    str: string,
    stackConfig: PulumiStackConfig,
    configValues?: Record<string, string>
  ): string {
    // Match ${config.key} patterns
    return str.replace(/\$\{config\.(\w+)\}/g, (match, configKey) => {
      const configValue = stackConfig.config[configKey];

      if (typeof configValue === 'string') {
        return configValue;
      } else if (configValue && typeof configValue === 'object' && 'value' in configValue) {
        return (configValue as any).value || match;
      }

      if (configValues && configKey in configValues) {
        return configValues[configKey];
      }

      return match; // Keep original if not found
    });
  }

  /**
   * Extract resource options from YAML options section
   */
  private extractResourceOptions(optionsObj: any): any {
    if (!optionsObj || typeof optionsObj !== 'object') {
      return undefined;
    }

    const options: any = {};

    if ('protect' in optionsObj) {
      options.protect = Boolean(optionsObj.protect);
    }

    if ('dependsOn' in optionsObj) {
      if (Array.isArray(optionsObj.dependsOn)) {
        options.dependsOn = optionsObj.dependsOn;
      } else {
        options.dependsOn = [optionsObj.dependsOn];
      }
    }

    if ('ignoreChanges' in optionsObj) {
      if (Array.isArray(optionsObj.ignoreChanges)) {
        options.ignoreChanges = optionsObj.ignoreChanges;
      } else {
        options.ignoreChanges = [optionsObj.ignoreChanges];
      }
    }

    if ('deleteBeforeReplace' in optionsObj) {
      options.deleteBeforeReplace = Boolean(optionsObj.deleteBeforeReplace);
    }

    if ('retainOnDelete' in optionsObj) {
      options.retainOnDelete = Boolean(optionsObj.retainOnDelete);
    }

    if ('provider' in optionsObj) {
      options.provider = optionsObj.provider;
    }

    if ('parent' in optionsObj) {
      options.parent = optionsObj.parent;
    }

    return Object.keys(options).length > 0 ? options : undefined;
  }
}
