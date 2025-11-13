import { DetectedResource } from '../types';

export interface SecurityViolation {
  resourceId: string;
  resourceType: string;
  violationType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
  references: string[];
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  resourceTypes: string[];
  check: (resource: DetectedResource) => SecurityViolation | null;
}

/**
 * Security Policy Violation Detector
 * Detects common security misconfigurations and policy violations
 */
export class SecurityDetector {
  private policies: SecurityPolicy[];

  constructor() {
    this.policies = this.initializeDefaultPolicies();
  }

  /**
   * Scan resources for security violations
   */
  async detectViolations(resources: DetectedResource[]): Promise<SecurityViolation[]> {
    const violations: SecurityViolation[] = [];

    for (const resource of resources) {
      const applicablePolicies = this.policies.filter(p =>
        p.resourceTypes.includes('*') || p.resourceTypes.includes(resource.resourceType)
      );

      for (const policy of applicablePolicies) {
        const violation = policy.check(resource);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    return violations;
  }

  /**
   * Add custom security policy
   */
  addPolicy(policy: SecurityPolicy): void {
    this.policies.push(policy);
  }

  /**
   * Initialize default security policies
   */
  private initializeDefaultPolicies(): SecurityPolicy[] {
    return [
      // S3 Bucket Policies
      {
        id: 'S3_PUBLIC_READ',
        name: 'S3 Bucket Public Read Access',
        description: 'S3 bucket allows public read access',
        resourceTypes: ['aws_s3_bucket'],
        check: (resource) => {
          const acl = resource.actualState?.acl || resource.expectedState?.acl;
          if (acl === 'public-read' || acl === 'public-read-write') {
            return {
              resourceId: resource.resourceId,
              resourceType: resource.resourceType,
              violationType: 'PUBLIC_ACCESS',
              severity: 'critical',
              description: `S3 bucket has public ${acl} access`,
              remediation: 'Set ACL to private and use bucket policies for controlled access',
              references: [
                'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html',
              ],
            };
          }
          return null;
        },
      },

      {
        id: 'S3_NO_ENCRYPTION',
        name: 'S3 Bucket Encryption Disabled',
        description: 'S3 bucket does not have encryption enabled',
        resourceTypes: ['aws_s3_bucket'],
        check: (resource) => {
          const encryption = resource.actualState?.encryption || resource.expectedState?.encryption;
          if (!encryption || encryption.enabled === false) {
            return {
              resourceId: resource.resourceId,
              resourceType: resource.resourceType,
              violationType: 'NO_ENCRYPTION',
              severity: 'high',
              description: 'S3 bucket does not have server-side encryption enabled',
              remediation: 'Enable AES256 or AWS KMS encryption for the bucket',
              references: [
                'https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html',
              ],
            };
          }
          return null;
        },
      },

      // Security Group Policies
      {
        id: 'SG_OPEN_SSH',
        name: 'Security Group Open SSH',
        description: 'Security group allows SSH from anywhere',
        resourceTypes: ['aws_security_group'],
        check: (resource) => {
          const ingress = resource.actualState?.ingress || resource.expectedState?.ingress || [];
          
          for (const rule of ingress) {
            if (
              rule.from_port === 22 &&
              rule.to_port === 22 &&
              (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.ipv6_cidr_blocks?.includes('::/0'))
            ) {
              return {
                resourceId: resource.resourceId,
                resourceType: resource.resourceType,
                violationType: 'OPEN_SSH',
                severity: 'critical',
                description: 'Security group allows SSH (port 22) from 0.0.0.0/0',
                remediation: 'Restrict SSH access to specific IP ranges or use AWS Systems Manager Session Manager',
                references: [
                  'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.html',
                ],
              };
            }
          }
          return null;
        },
      },

      {
        id: 'SG_OPEN_RDP',
        name: 'Security Group Open RDP',
        description: 'Security group allows RDP from anywhere',
        resourceTypes: ['aws_security_group'],
        check: (resource) => {
          const ingress = resource.actualState?.ingress || resource.expectedState?.ingress || [];
          
          for (const rule of ingress) {
            if (
              rule.from_port === 3389 &&
              rule.to_port === 3389 &&
              (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.ipv6_cidr_blocks?.includes('::/0'))
            ) {
              return {
                resourceId: resource.resourceId,
                resourceType: resource.resourceType,
                violationType: 'OPEN_RDP',
                severity: 'critical',
                description: 'Security group allows RDP (port 3389) from 0.0.0.0/0',
                remediation: 'Restrict RDP access to specific IP ranges or use VPN/bastion host',
                references: [
                  'https://docs.aws.amazon.com/AWSEC2/latest/WindowsGuide/authorizing-access-to-an-instance.html',
                ],
              };
            }
          }
          return null;
        },
      },

      {
        id: 'SG_ALLOW_ALL',
        name: 'Security Group Allows All Traffic',
        description: 'Security group allows all traffic from anywhere',
        resourceTypes: ['aws_security_group'],
        check: (resource) => {
          const ingress = resource.actualState?.ingress || resource.expectedState?.ingress || [];
          
          for (const rule of ingress) {
            if (
              rule.from_port === 0 &&
              rule.to_port === 65535 &&
              rule.protocol === '-1' &&
              (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.ipv6_cidr_blocks?.includes('::/0'))
            ) {
              return {
                resourceId: resource.resourceId,
                resourceType: resource.resourceType,
                violationType: 'ALLOW_ALL',
                severity: 'critical',
                description: 'Security group allows all traffic from 0.0.0.0/0',
                remediation: 'Implement principle of least privilege - only allow required ports and protocols',
                references: [
                  'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html',
                ],
              };
            }
          }
          return null;
        },
      },

      // EC2 Instance Policies
      {
        id: 'EC2_NO_IMDSv2',
        name: 'EC2 Instance Not Using IMDSv2',
        description: 'EC2 instance metadata service not enforcing IMDSv2',
        resourceTypes: ['aws_instance'],
        check: (resource) => {
          const metadataOptions = resource.actualState?.metadata_options || resource.expectedState?.metadata_options;
          
          if (!metadataOptions || metadataOptions.http_tokens !== 'required') {
            return {
              resourceId: resource.resourceId,
              resourceType: resource.resourceType,
              violationType: 'IMDS_V1',
              severity: 'medium',
              description: 'EC2 instance allows IMDSv1 which is vulnerable to SSRF attacks',
              remediation: 'Enforce IMDSv2 by setting http_tokens to "required"',
              references: [
                'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html',
              ],
            };
          }
          return null;
        },
      },

      // RDS Policies
      {
        id: 'RDS_PUBLIC_ACCESS',
        name: 'RDS Instance Publicly Accessible',
        description: 'RDS instance is publicly accessible',
        resourceTypes: ['aws_db_instance'],
        check: (resource) => {
          const publicAccess = resource.actualState?.publicly_accessible ?? resource.expectedState?.publicly_accessible;
          
          if (publicAccess === true) {
            return {
              resourceId: resource.resourceId,
              resourceType: resource.resourceType,
              violationType: 'PUBLIC_DATABASE',
              severity: 'critical',
              description: 'RDS instance is publicly accessible from the internet',
              remediation: 'Set publicly_accessible to false and access via VPN or bastion host',
              references: [
                'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html',
              ],
            };
          }
          return null;
        },
      },

      {
        id: 'RDS_NO_ENCRYPTION',
        name: 'RDS Instance Not Encrypted',
        description: 'RDS instance does not have encryption at rest enabled',
        resourceTypes: ['aws_db_instance'],
        check: (resource) => {
          const encrypted = resource.actualState?.storage_encrypted ?? resource.expectedState?.storage_encrypted;
          
          if (encrypted === false || encrypted === undefined) {
            return {
              resourceId: resource.resourceId,
              resourceType: resource.resourceType,
              violationType: 'NO_ENCRYPTION',
              severity: 'high',
              description: 'RDS instance does not have storage encryption enabled',
              remediation: 'Enable storage encryption (requires database recreation)',
              references: [
                'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html',
              ],
            };
          }
          return null;
        },
      },

      // Azure Storage Account Policies
      {
        id: 'AZURE_STORAGE_NO_HTTPS',
        name: 'Azure Storage Not Enforcing HTTPS',
        description: 'Azure storage account allows HTTP connections',
        resourceTypes: ['azurerm_storage_account'],
        check: (resource) => {
          const httpsOnly = resource.actualState?.enable_https_traffic_only ?? resource.expectedState?.enable_https_traffic_only;
          
          if (httpsOnly === false || httpsOnly === undefined) {
            return {
              resourceId: resource.resourceId,
              resourceType: resource.resourceType,
              violationType: 'INSECURE_TRANSPORT',
              severity: 'high',
              description: 'Storage account allows insecure HTTP connections',
              remediation: 'Set enable_https_traffic_only to true',
              references: [
                'https://docs.microsoft.com/en-us/azure/storage/common/storage-require-secure-transfer',
              ],
            };
          }
          return null;
        },
      },

      // GCP Storage Bucket Policies
      {
        id: 'GCP_STORAGE_PUBLIC',
        name: 'GCP Storage Bucket Public Access',
        description: 'GCP storage bucket allows public access',
        resourceTypes: ['google_storage_bucket'],
        check: (resource) => {
          const iamMembers = resource.actualState?.iam_members || resource.expectedState?.iam_members || [];
          
          for (const member of iamMembers) {
            if (member.includes('allUsers') || member.includes('allAuthenticatedUsers')) {
              return {
                resourceId: resource.resourceId,
                resourceType: resource.resourceType,
                violationType: 'PUBLIC_ACCESS',
                severity: 'critical',
                description: 'Storage bucket has public IAM bindings (allUsers or allAuthenticatedUsers)',
                remediation: 'Remove public IAM bindings and use signed URLs for temporary access',
                references: [
                  'https://cloud.google.com/storage/docs/access-control/making-data-public',
                ],
              };
            }
          }
          return null;
        },
      },
    ];
  }

  /**
   * Get policy by ID
   */
  getPolicy(id: string): SecurityPolicy | undefined {
    return this.policies.find(p => p.id === id);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): SecurityPolicy[] {
    return [...this.policies];
  }
}
