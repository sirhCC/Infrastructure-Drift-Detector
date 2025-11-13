import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AWSProviderConfig, AzureProviderConfig, GCPProviderConfig } from './types';

/**
 * Credential manager for secure credential handling
 */
export class CredentialManager {
  
  /**
   * Get AWS credentials from multiple sources
   * Priority: 1. Config, 2. Environment, 3. Credentials file, 4. IAM role
   */
  static getAWSCredentials(config?: AWSProviderConfig): {
    region?: string;
    profile?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  } {
    // 1. Check config
    if (config?.credentials?.accessKeyId && config?.credentials?.secretAccessKey) {
      return {
        region: config.region,
        accessKeyId: config.credentials.accessKeyId,
        secretAccessKey: config.credentials.secretAccessKey,
        sessionToken: config.credentials.sessionToken
      };
    }

    // 2. Check environment variables
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        region: config?.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
      };
    }

    // 3. Check AWS profile
    if (config?.credentials?.profile || process.env.AWS_PROFILE) {
      const profile = config?.credentials?.profile || process.env.AWS_PROFILE;
      const credentials = this.loadAWSProfile(profile!);
      
      if (credentials) {
        return {
          region: config?.region || credentials.region || process.env.AWS_REGION,
          profile,
          ...credentials
        };
      }
    }

    // 4. Return region only (will use IAM role or instance metadata)
    return {
      region: config?.region || process.env.AWS_REGION || 'us-east-1'
    };
  }

  /**
   * Load credentials from AWS credentials file
   */
  private static loadAWSProfile(profileName: string): any {
    try {
      const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');
      
      if (!fs.existsSync(credentialsPath)) {
        return null;
      }

      const content = fs.readFileSync(credentialsPath, 'utf-8');
      const lines = content.split('\n');
      
      let inProfile = false;
      const credentials: any = {};

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Check for profile header
        if (trimmed === `[${profileName}]`) {
          inProfile = true;
          continue;
        }
        
        // Check for next profile (exit current)
        if (trimmed.startsWith('[') && inProfile) {
          break;
        }

        // Parse credential lines
        if (inProfile && trimmed.includes('=')) {
          const [key, value] = trimmed.split('=').map(s => s.trim());
          
          if (key === 'aws_access_key_id') {
            credentials.accessKeyId = value;
          } else if (key === 'aws_secret_access_key') {
            credentials.secretAccessKey = value;
          } else if (key === 'aws_session_token') {
            credentials.sessionToken = value;
          } else if (key === 'region') {
            credentials.region = value;
          }
        }
      }

      return Object.keys(credentials).length > 0 ? credentials : null;
    } catch (error) {
      console.warn('Failed to load AWS credentials file:', error);
      return null;
    }
  }

  /**
   * Get Azure credentials
   */
  static getAzureCredentials(config?: AzureProviderConfig): {
    subscriptionId?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
  } {
    return {
      subscriptionId: config?.subscriptionId || process.env.AZURE_SUBSCRIPTION_ID,
      tenantId: config?.tenantId || process.env.AZURE_TENANT_ID,
      clientId: config?.clientId || process.env.AZURE_CLIENT_ID,
      clientSecret: config?.clientSecret || process.env.AZURE_CLIENT_SECRET
    };
  }

  /**
   * Get GCP credentials
   */
  static getGCPCredentials(config?: GCPProviderConfig): {
    projectId?: string;
    serviceAccountKey?: string;
  } {
    let serviceAccountKey = config?.serviceAccountKey;

    // Check for service account key file path
    if (!serviceAccountKey && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        serviceAccountKey = fs.readFileSync(
          process.env.GOOGLE_APPLICATION_CREDENTIALS,
          'utf-8'
        );
      } catch (error) {
        console.warn('Failed to load GCP service account key:', error);
      }
    }

    return {
      projectId: config?.projectId || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
      serviceAccountKey
    };
  }

  /**
   * Mask sensitive credential data for logging
   */
  static maskCredentials(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const masked = Array.isArray(data) ? [...data] : { ...data };
    const sensitiveKeys = [
      'password',
      'secret',
      'token',
      'key',
      'accessKey',
      'secretAccessKey',
      'sessionToken',
      'apiKey',
      'clientSecret',
      'serviceAccountKey',
      'webhookUrl'
    ];

    for (const key in masked) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        const value = masked[key];
        if (typeof value === 'string' && value.length > 0) {
          masked[key] = value.substring(0, 4) + '****' + value.substring(value.length - 4);
        }
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskCredentials(masked[key]);
      }
    }

    return masked;
  }

  /**
   * Validate that required credentials are present
   */
  static validateCredentials(
    provider: 'aws' | 'azure' | 'gcp',
    credentials: any
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    switch (provider) {
      case 'aws':
        // AWS can work with IAM roles, so credentials are optional
        if (!credentials.region) {
          missing.push('region');
        }
        break;

      case 'azure':
        if (!credentials.subscriptionId) missing.push('subscriptionId');
        if (!credentials.tenantId) missing.push('tenantId');
        if (!credentials.clientId) missing.push('clientId');
        if (!credentials.clientSecret) missing.push('clientSecret');
        break;

      case 'gcp':
        if (!credentials.projectId) missing.push('projectId');
        // Service account key is optional if using default credentials
        break;
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}
