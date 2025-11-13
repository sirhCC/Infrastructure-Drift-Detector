import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  BackendConfig,
  S3BackendConfig,
  AzureBackendConfig,
  GCSBackendConfig,
  TerraformState,
} from './types';

/**
 * Base interface for remote state backends
 */
export interface RemoteStateBackend {
  /**
   * Fetch state from remote backend
   */
  fetchState(): Promise<TerraformState>;

  /**
   * Check if state exists
   */
  exists(): Promise<boolean>;
}

/**
 * S3 backend for Terraform remote state
 */
export class S3Backend implements RemoteStateBackend {
  private config: S3BackendConfig;
  private client: S3Client;

  constructor(config: S3BackendConfig) {
    this.config = config;
    this.client = new S3Client({
      region: config.region,
      ...(config.profile && { profile: config.profile }),
    });
  }

  async fetchState(): Promise<TerraformState> {
    try {
      const key = this.config.workspace_key_prefix
        ? `${this.config.workspace_key_prefix}/${this.config.key}`
        : this.config.key;

      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('Empty response from S3');
      }

      const content = await this.streamToString(response.Body as any);
      return JSON.parse(content) as TerraformState;
    } catch (error) {
      throw new Error(
        `Failed to fetch state from S3: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async exists(): Promise<boolean> {
    try {
      await this.fetchState();
      return true;
    } catch {
      return false;
    }
  }

  private async streamToString(stream: ReadableStream): Promise<string> {
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const buffer = Buffer.concat(chunks);
      return buffer.toString('utf-8');
    } finally {
      reader.releaseLock();
    }
  }
}

/**
 * Azure Blob Storage backend
 */
export class AzureBackend implements RemoteStateBackend {
  private config: AzureBackendConfig;

  constructor(config: AzureBackendConfig) {
    this.config = config;
  }

  async fetchState(): Promise<TerraformState> {
    try {
      // Note: Requires @azure/storage-blob package
      // This is a placeholder implementation
      throw new Error('Azure backend not yet fully implemented. Install @azure/storage-blob package.');

      // Implementation would look like:
      // const { BlobServiceClient } = require('@azure/storage-blob');
      // const connectionString = `DefaultEndpointsProtocol=https;AccountName=${this.config.storage_account_name};...`;
      // const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      // const containerClient = blobServiceClient.getContainerClient(this.config.container_name);
      // const blobClient = containerClient.getBlobClient(this.config.key);
      // const downloadResponse = await blobClient.download();
      // const content = await streamToString(downloadResponse.readableStreamBody);
      // return JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to fetch state from Azure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async exists(): Promise<boolean> {
    try {
      await this.fetchState();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Google Cloud Storage backend
 */
export class GCSBackend implements RemoteStateBackend {
  private config: GCSBackendConfig;

  constructor(config: GCSBackendConfig) {
    this.config = config;
  }

  async fetchState(): Promise<TerraformState> {
    try {
      // Note: Requires @google-cloud/storage package
      // This is a placeholder implementation
      throw new Error('GCS backend not yet fully implemented. Install @google-cloud/storage package.');

      // Implementation would look like:
      // const { Storage } = require('@google-cloud/storage');
      // const storage = new Storage({
      //   keyFilename: this.config.credentials,
      // });
      // const bucket = storage.bucket(this.config.bucket);
      // const file = bucket.file(this.config.prefix || 'default.tfstate');
      // const [content] = await file.download();
      // return JSON.parse(content.toString());
    } catch (error) {
      throw new Error(
        `Failed to fetch state from GCS: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async exists(): Promise<boolean> {
    try {
      await this.fetchState();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Local file backend
 */
export class LocalBackend implements RemoteStateBackend {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async fetchState(): Promise<TerraformState> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as TerraformState;
    } catch (error) {
      throw new Error(
        `Failed to read local state file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Factory for creating remote state backends
 */
export class RemoteStateBackendFactory {
  /**
   * Create a backend instance from configuration
   */
  static createBackend(config: BackendConfig): RemoteStateBackend {
    switch (config.type) {
      case 's3':
        return new S3Backend(config.config as S3BackendConfig);
      case 'azurerm':
        return new AzureBackend(config.config as AzureBackendConfig);
      case 'gcs':
        return new GCSBackend(config.config as GCSBackendConfig);
      case 'local':
        const localPath = (config.config as any).path || 'terraform.tfstate';
        return new LocalBackend(localPath);
      default:
        throw new Error(`Unsupported backend type: ${config.type}`);
    }
  }

  /**
   * Create backend from Terraform backend configuration block
   */
  static createFromTerraformConfig(terraformDir: string): RemoteStateBackend | null {
    try {
      // Try to find and parse backend configuration from Terraform files
      // This would require parsing .tf files for backend {} blocks
      // For now, return null and require explicit configuration
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Auto-detect backend from common locations
   */
  static async autoDetect(projectDir: string): Promise<RemoteStateBackend | null> {
    // Check for local state file
    const localStatePath = path.join(projectDir, 'terraform.tfstate');
    try {
      await fs.access(localStatePath);
      return new LocalBackend(localStatePath);
    } catch {
      // No local state found
    }

    // Check for .terraform directory with backend config
    const backendConfigPath = path.join(projectDir, '.terraform', 'terraform.tfstate');
    try {
      await fs.access(backendConfigPath);
      return new LocalBackend(backendConfigPath);
    } catch {
      // No backend config found
    }

    return null;
  }
}
