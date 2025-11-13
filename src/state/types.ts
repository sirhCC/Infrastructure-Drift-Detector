/**
 * Type definitions for Terraform state management
 */

/**
 * Terraform state file structure
 */
export interface TerraformState {
  /** State format version */
  version: number;
  /** Terraform version that wrote the state */
  terraform_version: string;
  /** State serial number (increments on each change) */
  serial: number;
  /** State lineage (unique ID for the state history) */
  lineage: string;
  /** Output values */
  outputs?: Record<string, StateOutput>;
  /** Resources in state */
  resources: StateResource[];
  /** Check results (Terraform 1.5+) */
  check_results?: any[];
}

/**
 * State output value
 */
export interface StateOutput {
  /** Output value */
  value: any;
  /** Output type */
  type: string | string[];
  /** Whether output is sensitive */
  sensitive?: boolean;
}

/**
 * Resource in Terraform state
 */
export interface StateResource {
  /** Module path */
  module?: string;
  /** Resource mode (managed or data) */
  mode: 'managed' | 'data';
  /** Resource type (e.g., aws_instance) */
  type: string;
  /** Resource name */
  name: string;
  /** Provider name */
  provider: string;
  /** Resource instances */
  instances: StateInstance[];
  /** Each mode (for resources with count/for_each) */
  each?: string;
}

/**
 * Resource instance in state
 */
export interface StateInstance {
  /** Index key (for count or for_each) */
  index_key?: number | string;
  /** Schema version */
  schema_version: number;
  /** Resource attributes/properties */
  attributes: Record<string, any>;
  /** Attributes marked as sensitive */
  sensitive_attributes?: SensitiveAttribute[];
  /** Private data (opaque to users) */
  private?: string;
  /** Dependencies */
  dependencies?: string[];
  /** Create before destroy */
  create_before_destroy?: boolean;
}

/**
 * Sensitive attribute metadata
 */
export interface SensitiveAttribute {
  /** JSON path to sensitive attribute */
  path?: string[];
  /** Nested sensitive attributes */
  nested?: SensitiveAttribute[];
}

/**
 * Backend configuration for remote state
 */
export interface BackendConfig {
  /** Backend type (s3, azurerm, gcs, etc.) */
  type: 's3' | 'azurerm' | 'gcs' | 'local' | 'remote' | 'http';
  /** Backend-specific configuration */
  config: Record<string, any>;
}

/**
 * S3 backend configuration
 */
export interface S3BackendConfig {
  /** S3 bucket name */
  bucket: string;
  /** S3 key (path to state file) */
  key: string;
  /** AWS region */
  region: string;
  /** Enable encryption */
  encrypt?: boolean;
  /** KMS key ID for encryption */
  kms_key_id?: string;
  /** DynamoDB table for state locking */
  dynamodb_table?: string;
  /** AWS profile */
  profile?: string;
  /** Role ARN to assume */
  role_arn?: string;
  /** Workspace key prefix */
  workspace_key_prefix?: string;
}

/**
 * Azure backend configuration
 */
export interface AzureBackendConfig {
  /** Storage account name */
  storage_account_name: string;
  /** Container name */
  container_name: string;
  /** Blob name (state file path) */
  key: string;
  /** Resource group name */
  resource_group_name?: string;
  /** Enable encryption */
  use_microsoft_graph?: boolean;
  /** Subscription ID */
  subscription_id?: string;
  /** Tenant ID */
  tenant_id?: string;
  /** Client ID */
  client_id?: string;
  /** Client secret */
  client_secret?: string;
}

/**
 * GCS backend configuration
 */
export interface GCSBackendConfig {
  /** GCS bucket name */
  bucket: string;
  /** Object prefix/path */
  prefix?: string;
  /** Encryption key */
  encryption_key?: string;
  /** Credentials file path */
  credentials?: string;
  /** Access token */
  access_token?: string;
  /** Impersonate service account */
  impersonate_service_account?: string;
}

/**
 * Options for state file operations
 */
export interface StateFileOptions {
  /** Path to local state file */
  localPath?: string;
  /** Backend configuration for remote state */
  backend?: BackendConfig;
  /** Encryption passphrase (for encrypted states) */
  encryptionKey?: string;
  /** Workspace name */
  workspace?: string;
}

/**
 * Result of state file parsing
 */
export interface StateParseResult {
  /** Parsed state */
  state: TerraformState;
  /** Source location (local file path or remote URL) */
  source: string;
  /** Whether state was encrypted */
  wasEncrypted: boolean;
  /** Parse errors */
  errors: string[];
}

/**
 * State comparison result
 */
export interface StateComparisonResult {
  /** Resources only in state (not in IaC) */
  onlyInState: StateResource[];
  /** Resources only in IaC (not in state) */
  onlyInIaC: string[];
  /** Resources in both but with differences */
  differences: StateDifference[];
  /** Resources that match exactly */
  matching: string[];
}

/**
 * Difference between state and IaC
 */
export interface StateDifference {
  /** Resource identifier */
  resourceId: string;
  /** Resource type */
  resourceType: string;
  /** Resource name */
  resourceName: string;
  /** Properties that differ */
  propertyDifferences: PropertyDifference[];
}

/**
 * Property difference detail
 */
export interface PropertyDifference {
  /** Property path */
  path: string;
  /** Value in state */
  stateValue: any;
  /** Value in IaC */
  iacValue: any;
  /** Whether this is a computed attribute */
  isComputed: boolean;
}

/**
 * State lock information
 */
export interface StateLock {
  /** Lock ID */
  ID: string;
  /** Operation being performed */
  Operation: string;
  /** Information about who holds the lock */
  Info: string;
  /** Who created the lock */
  Who: string;
  /** Terraform version */
  Version: string;
  /** When lock was created */
  Created: string;
  /** Lock path */
  Path: string;
}
