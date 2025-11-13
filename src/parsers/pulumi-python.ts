import { promises as fs } from 'fs';
import * as path from 'path';
import {
  PulumiResource,
  PulumiParseResult,
  PulumiLanguage,
  PulumiParserOptions,
  PulumiProject,
  PulumiStackConfig,
} from './pulumi-types';

/**
 * Parser for Pulumi Python programs
 * 
 * Analyzes Python-based Pulumi programs to extract resource definitions.
 * Uses regex pattern matching to identify Pulumi resource instantiations.
 */
export class PulumiPythonParser {
  /**
   * Parse a Pulumi Python program
   */
  async parse(options: PulumiParserOptions): Promise<PulumiParseResult> {
    const result: PulumiParseResult = {
      language: PulumiLanguage.Python,
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

      // Find and parse the main Python file
      const mainFile = await this.findMainFile(options.projectDir, result.project);
      if (mainFile) {
        const resources = await this.parsePythonFile(
          mainFile,
          options,
          result.stackConfig
        );
        result.resources.push(...resources);
      } else {
        result.errors.push('Could not find main Python program file');
      }
    } catch (error) {
      result.errors.push(
        `Failed to parse Pulumi Python project: ${error instanceof Error ? error.message : String(error)}`
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
   * Find the main Python file
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
    const candidates = ['__main__.py', 'main.py', 'src/__main__.py', 'app.py'];
    for (const candidate of candidates) {
      const filePath = path.join(projectDir, candidate);
      if (await this.fileExists(filePath)) {
        return filePath;
      }
    }

    return null;
  }

  /**
   * Parse a Python file for Pulumi resources
   */
  private async parsePythonFile(
    filePath: string,
    options: PulumiParserOptions,
    stackConfig?: PulumiStackConfig
  ): Promise<PulumiResource[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const resources: PulumiResource[] = [];

    // Extract imports to understand resource types
    const imports = this.extractImports(content);

    // Match resource instantiation patterns
    // Pattern: variable_name = aws.ec2.Instance("name", ...)
    // or: aws.ec2.Instance("name", ...)
    const resourcePattern = /(?:(\w+)\s*=\s*)?(\w+)\.(\w+)\.(\w+)\s*\(\s*["']([^"']+)["']\s*,?\s*([\s\S]*?)\)/g;

    let match;
    while ((match = resourcePattern.exec(content)) !== null) {
      const [fullMatch, varName, provider, module, resourceClass, resourceName, argsStr] = match;

      try {
        // Build resource type (e.g., aws:ec2/instance:Instance)
        const type = `${provider}:${module}/${resourceClass.toLowerCase()}:${resourceClass}`;

        // Parse arguments
        const properties = this.extractPythonArguments(argsStr, stackConfig, options.configValues);

        // Extract options (from opts parameter)
        const resourceOptions = this.extractPythonOptions(argsStr);

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
        console.warn(`Failed to parse Python resource at ${filePath}:${match.index}`, error);
      }
    }

    return resources;
  }

  /**
   * Extract import statements
   */
  private extractImports(content: string): Map<string, string> {
    const imports = new Map<string, string>();
    
    // Match: import pulumi_aws as aws
    const importAsPattern = /import\s+(pulumi_\w+)\s+as\s+(\w+)/g;
    let match;
    
    while ((match = importAsPattern.exec(content)) !== null) {
      const [, module, alias] = match;
      imports.set(alias, module);
    }

    // Match: from pulumi_aws import ec2
    const fromImportPattern = /from\s+(pulumi_\w+)\s+import\s+([\w,\s]+)/g;
    while ((match = fromImportPattern.exec(content)) !== null) {
      const [, module, items] = match;
      items.split(',').forEach((item) => {
        imports.set(item.trim(), module);
      });
    }

    return imports;
  }

  /**
   * Extract Python function arguments
   */
  private extractPythonArguments(
    argsStr: string,
    stackConfig?: PulumiStackConfig,
    configValues?: Record<string, string>
  ): Record<string, any> {
    const properties: Record<string, any> = {};

    try {
      // Remove opts parameter if present
      let cleaned = argsStr.replace(/opts\s*=\s*[^,)]+/g, '');

      // Match keyword arguments: key=value
      const kwargPattern = /(\w+)\s*=\s*([^,]+?)(?:,|$)/g;
      let match;

      while ((match = kwargPattern.exec(cleaned)) !== null) {
        const [, key, value] = match;
        properties[key] = this.parsePythonValue(value.trim(), stackConfig, configValues);
      }
    } catch (error) {
      // Return empty properties on parse error
    }

    return properties;
  }

  /**
   * Parse a Python value
   */
  private parsePythonValue(
    value: string,
    stackConfig?: PulumiStackConfig,
    configValues?: Record<string, string>
  ): any {
    // String literals (single or double quotes)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Numbers
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Booleans
    if (value === 'True') return true;
    if (value === 'False') return false;
    if (value === 'None') return null;

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

      if (configValues && configKey in configValues) {
        return configValues[configKey];
      }
    }

    // Lists: [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value.slice(1, -1).split(',').map((item) => item.trim());
      return items.map((item) => this.parsePythonValue(item, stackConfig, configValues));
    }

    // Dicts: {"key": "value"}
    if (value.startsWith('{') && value.endsWith('}')) {
      // Simplified dict parsing
      return value;
    }

    // Return as-is for complex expressions
    return value;
  }

  /**
   * Extract resource options from opts parameter
   */
  private extractPythonOptions(argsStr: string): any {
    const options: any = {};

    try {
      // Match opts=pulumi.ResourceOptions(...)
      const optsMatch = argsStr.match(/opts\s*=\s*pulumi\.ResourceOptions\s*\(([\s\S]*?)\)/);
      if (optsMatch) {
        const optsStr = optsMatch[1];

        // Extract protect
        const protectMatch = optsStr.match(/protect\s*=\s*(True|False)/);
        if (protectMatch) {
          options.protect = protectMatch[1] === 'True';
        }

        // Extract depends_on
        const dependsMatch = optsStr.match(/depends_on\s*=\s*\[(.*?)\]/);
        if (dependsMatch) {
          options.dependsOn = dependsMatch[1]
            .split(',')
            .map((dep) => dep.trim())
            .filter((dep) => dep.length > 0);
        }

        // Extract ignore_changes
        const ignoreMatch = optsStr.match(/ignore_changes\s*=\s*\[(.*?)\]/);
        if (ignoreMatch) {
          options.ignoreChanges = ignoreMatch[1]
            .split(',')
            .map((prop) => prop.trim().replace(/['"]/g, ''))
            .filter((prop) => prop.length > 0);
        }
      }
    } catch (error) {
      // Return empty options on parse error
    }

    return Object.keys(options).length > 0 ? options : undefined;
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
