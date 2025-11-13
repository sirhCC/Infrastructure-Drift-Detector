/**
 * Type definitions for Pulumi infrastructure parsing
 */

/**
 * Supported Pulumi program languages
 */
export enum PulumiLanguage {
  TypeScript = 'typescript',
  Python = 'python',
  YAML = 'yaml',
  Go = 'go',
  CSharp = 'csharp',
  Java = 'java',
}

/**
 * Pulumi resource definition from IaC code
 */
export interface PulumiResource {
  /** Resource type (e.g., 'aws:ec2/instance:Instance') */
  type: string;
  /** Resource name/identifier */
  name: string;
  /** Resource properties/configuration */
  properties: Record<string, any>;
  /** Resource options (protect, dependsOn, etc.) */
  options?: PulumiResourceOptions;
  /** Parent resource URN if nested */
  parent?: string;
  /** Provider configuration */
  provider?: string;
  /** Original source location */
  location?: SourceLocation;
}

/**
 * Pulumi resource options
 */
export interface PulumiResourceOptions {
  /** Protect resource from deletion */
  protect?: boolean;
  /** Dependencies on other resources */
  dependsOn?: string[];
  /** Ignore changes to specific properties */
  ignoreChanges?: string[];
  /** Custom timeouts */
  customTimeouts?: {
    create?: string;
    update?: string;
    delete?: string;
  };
  /** Additional secrets */
  additionalSecretOutputs?: string[];
  /** Aliases for resource migration */
  aliases?: string[];
  /** Delete before replace */
  deleteBeforeReplace?: boolean;
  /** Import existing resource */
  import?: string;
  /** Replace on changes */
  replaceOnChanges?: string[];
  /** Retain on delete */
  retainOnDelete?: boolean;
  /** Version constraint */
  version?: string;
}

/**
 * Source location in code
 */
export interface SourceLocation {
  /** File path */
  file: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
}

/**
 * Pulumi stack export (from pulumi stack export)
 */
export interface PulumiStackExport {
  /** Stack version */
  version: number;
  /** Deployment information */
  deployment: PulumiDeployment;
}

/**
 * Pulumi deployment state
 */
export interface PulumiDeployment {
  /** Manifest of providers and plugins */
  manifest?: {
    time: string;
    magic: string;
    version: string;
  };
  /** Resources in the stack */
  resources: PulumiStackResource[];
  /** Pending operations */
  pending_operations?: any[];
}

/**
 * Resource from Pulumi stack state
 */
export interface PulumiStackResource {
  /** Resource URN (Uniform Resource Name) */
  urn: string;
  /** Resource type */
  type: string;
  /** Custom resource flag */
  custom?: boolean;
  /** Resource ID (cloud provider ID) */
  id?: string;
  /** Resource inputs */
  inputs?: Record<string, any>;
  /** Resource outputs */
  outputs?: Record<string, any>;
  /** Parent URN */
  parent?: string;
  /** Dependencies */
  dependencies?: string[];
  /** Provider URN */
  provider?: string;
  /** Property dependencies */
  propertyDependencies?: Record<string, string[]>;
  /** Protected flag */
  protect?: boolean;
  /** External flag (imported resource) */
  external?: boolean;
  /** Pending replacement */
  pendingReplacement?: boolean;
}

/**
 * Parsed Pulumi project configuration
 */
export interface PulumiProject {
  /** Project name */
  name: string;
  /** Runtime (nodejs, python, yaml, etc.) */
  runtime: string;
  /** Runtime options */
  runtimeOptions?: Record<string, any>;
  /** Project description */
  description?: string;
  /** Main entry point */
  main?: string;
  /** Backend configuration */
  backend?: {
    url?: string;
  };
}

/**
 * Pulumi stack configuration (Pulumi.<stack>.yaml)
 */
export interface PulumiStackConfig {
  /** Configuration values */
  config: Record<string, string | PulumiConfigValue>;
  /** Encrypted configuration keys */
  encryptedKey?: string;
}

/**
 * Configuration value with encryption metadata
 */
export interface PulumiConfigValue {
  /** Raw value */
  value?: string;
  /** Secure (encrypted) value */
  secure?: string;
}

/**
 * Result of parsing Pulumi IaC
 */
export interface PulumiParseResult {
  /** Detected language */
  language: PulumiLanguage;
  /** Project configuration */
  project?: PulumiProject;
  /** Stack configuration */
  stackConfig?: PulumiStackConfig;
  /** Parsed resources */
  resources: PulumiResource[];
  /** Parsing errors */
  errors: string[];
  /** File path */
  filePath: string;
}

/**
 * Options for Pulumi parser
 */
export interface PulumiParserOptions {
  /** Project directory */
  projectDir: string;
  /** Stack name (default, dev, prod, etc.) */
  stackName?: string;
  /** Include stack export */
  includeStackExport?: boolean;
  /** Stack export file path */
  stackExportPath?: string;
  /** Resolve configuration variables */
  resolveConfig?: boolean;
  /** Configuration values to use */
  configValues?: Record<string, string>;
}

/**
 * URN parser result
 */
export interface ParsedURN {
  /** Full URN */
  urn: string;
  /** Stack name */
  stack: string;
  /** Project name */
  project: string;
  /** Parent type (if nested) */
  parentType?: string;
  /** Resource type */
  type: string;
  /** Resource name */
  name: string;
}
