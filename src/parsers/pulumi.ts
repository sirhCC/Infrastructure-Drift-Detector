import { promises as fs } from 'fs';
import * as path from 'path';
import {
  PulumiResource,
  PulumiStackExport,
  PulumiStackResource,
  ParsedURN,
  PulumiParserOptions,
  PulumiParseResult,
  PulumiLanguage,
} from './pulumi-types';
import { PulumiTypeScriptParser } from './pulumi-typescript';
import { PulumiPythonParser } from './pulumi-python';
import { PulumiYAMLParser } from './pulumi-yaml';

/**
 * Main Pulumi parser that orchestrates different language parsers
 * and handles Pulumi stack exports
 */
export class PulumiParser {
  private typescriptParser: PulumiTypeScriptParser;
  private pythonParser: PulumiPythonParser;
  private yamlParser: PulumiYAMLParser;

  constructor() {
    this.typescriptParser = new PulumiTypeScriptParser();
    this.pythonParser = new PulumiPythonParser();
    this.yamlParser = new PulumiYAMLParser();
  }

  /**
   * Parse a Pulumi project
   * Automatically detects the language and uses the appropriate parser
   */
  async parse(options: PulumiParserOptions): Promise<PulumiParseResult> {
    // Detect project language
    const language = await this.detectLanguage(options.projectDir);

    // Use appropriate parser
    let result: PulumiParseResult;
    switch (language) {
      case PulumiLanguage.TypeScript:
        result = await this.typescriptParser.parse(options);
        break;
      case PulumiLanguage.Python:
        result = await this.pythonParser.parse(options);
        break;
      case PulumiLanguage.YAML:
        result = await this.yamlParser.parse(options);
        break;
      default:
        result = {
          language: PulumiLanguage.TypeScript,
          resources: [],
          errors: [`Unsupported Pulumi language: ${language}`],
          filePath: options.projectDir,
        };
    }

    // Parse stack export if requested
    if (options.includeStackExport) {
      try {
        const stackResources = await this.parseStackExport(options);
        // Merge with parsed resources (stack export is the "actual" state)
        result.resources = this.mergeWithStackExport(result.resources, stackResources);
      } catch (error) {
        result.errors.push(
          `Failed to parse stack export: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return result;
  }

  /**
   * Detect the Pulumi project language
   */
  private async detectLanguage(projectDir: string): Promise<PulumiLanguage> {
    try {
      const projectPath = path.join(projectDir, 'Pulumi.yaml');
      const content = await fs.readFile(projectPath, 'utf-8');

      // Check for runtime field
      const runtimeMatch = content.match(/runtime:\s*(\w+)/);
      if (runtimeMatch) {
        const runtime = runtimeMatch[1];
        switch (runtime) {
          case 'nodejs':
            return PulumiLanguage.TypeScript;
          case 'python':
            return PulumiLanguage.Python;
          case 'yaml':
            return PulumiLanguage.YAML;
          case 'go':
            return PulumiLanguage.Go;
          case 'dotnet':
            return PulumiLanguage.CSharp;
          default:
            return PulumiLanguage.TypeScript;
        }
      }

      // Check for resources section (indicates YAML)
      if (content.includes('resources:')) {
        return PulumiLanguage.YAML;
      }
    } catch (error) {
      // Default to TypeScript
    }

    return PulumiLanguage.TypeScript;
  }

  /**
   * Parse Pulumi stack export JSON
   */
  async parseStackExport(options: PulumiParserOptions): Promise<PulumiStackResource[]> {
    let stackExportPath: string;

    if (options.stackExportPath) {
      stackExportPath = options.stackExportPath;
    } else {
      // Try to find stack export in common locations
      const stackName = options.stackName || 'dev';
      const candidates = [
        path.join(options.projectDir, `stack-export-${stackName}.json`),
        path.join(options.projectDir, 'stack-export.json'),
        path.join(options.projectDir, `.pulumi/stacks/${stackName}.json`),
      ];

      stackExportPath = '';
      for (const candidate of candidates) {
        if (await this.fileExists(candidate)) {
          stackExportPath = candidate;
          break;
        }
      }

      if (!stackExportPath) {
        throw new Error('Stack export file not found. Run: pulumi stack export --file stack-export.json');
      }
    }

    // Load and parse stack export
    const content = await fs.readFile(stackExportPath, 'utf-8');
    const stackExport: PulumiStackExport = JSON.parse(content);

    if (!stackExport.deployment || !stackExport.deployment.resources) {
      throw new Error('Invalid stack export format');
    }

    return stackExport.deployment.resources;
  }

  /**
   * Merge IaC resources with stack export resources
   */
  private mergeWithStackExport(
    iacResources: PulumiResource[],
    stackResources: PulumiStackResource[]
  ): PulumiResource[] {
    const merged: PulumiResource[] = [];

    // Create a map of stack resources by name
    const stackMap = new Map<string, PulumiStackResource>();
    for (const stackRes of stackResources) {
      const parsed = this.parseURN(stackRes.urn);
      if (parsed) {
        stackMap.set(parsed.name, stackRes);
      }
    }

    // Merge IaC resources with their stack counterparts
    for (const iacRes of iacResources) {
      const stackRes = stackMap.get(iacRes.name);
      
      if (stackRes) {
        // Merge properties (use stack outputs as actual state)
        merged.push({
          ...iacRes,
          properties: {
            ...iacRes.properties,
            // Add actual state from stack
            __actual: stackRes.outputs || stackRes.inputs,
            __cloudId: stackRes.id,
          },
        });
        stackMap.delete(iacRes.name);
      } else {
        // Resource in IaC but not in stack (not deployed)
        merged.push(iacRes);
      }
    }

    // Add remaining stack resources (deployed but not in IaC)
    for (const [name, stackRes] of stackMap) {
      const parsed = this.parseURN(stackRes.urn);
      if (parsed && stackRes.custom) {
        merged.push({
          type: stackRes.type,
          name,
          properties: stackRes.outputs || stackRes.inputs || {},
          location: {
            file: 'stack-export',
          },
        });
      }
    }

    return merged;
  }

  /**
   * Parse Pulumi URN into components
   * URN format: urn:pulumi:stack::project::type::name
   */
  parseURN(urn: string): ParsedURN | null {
    try {
      const parts = urn.split('::');
      if (parts.length < 4) {
        return null;
      }

      const [urnPrefix, stack, project, ...rest] = parts;
      
      // Extract stack from urn:pulumi:stack
      const stackName = stack;
      
      // Type and name are in the remaining parts
      // Format: type$parentType::name or just type::name
      let type: string;
      let name: string;
      let parentType: string | undefined;

      if (rest.length === 2) {
        type = rest[0];
        name = rest[1];
      } else if (rest.length === 1) {
        // Combined type::name
        const combined = rest[0];
        const lastDoubleColon = combined.lastIndexOf('::');
        if (lastDoubleColon > -1) {
          type = combined.substring(0, lastDoubleColon);
          name = combined.substring(lastDoubleColon + 2);
        } else {
          type = combined;
          name = combined;
        }
      } else {
        return null;
      }

      // Check for parent type (format: type$parentType)
      if (type.includes('$')) {
        const typeParts = type.split('$');
        type = typeParts[0];
        parentType = typeParts[1];
      }

      return {
        urn,
        stack: stackName,
        project,
        type,
        name,
        parentType,
      };
    } catch (error) {
      return null;
    }
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
