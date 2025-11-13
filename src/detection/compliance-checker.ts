import { DetectedResource } from '../types';

export interface ComplianceViolation {
  resourceId: string;
  resourceType: string;
  framework: string;
  controlId: string;
  controlName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
  references: string[];
}

export interface ComplianceControl {
  id: string;
  framework: string;
  name: string;
  description: string;
  resourceTypes: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (resource: DetectedResource) => boolean;
  remediation: string;
  references: string[];
}

export interface ComplianceReport {
  framework: string;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  complianceScore: number; // 0-100
  violations: ComplianceViolation[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Compliance Checker
 * Validates infrastructure against compliance frameworks (CIS, PCI-DSS, etc.)
 */
export class ComplianceChecker {
  private controls: Map<string, ComplianceControl[]>;

  constructor() {
    this.controls = new Map();
    this.initializeCISControls();
    this.initializePCIDSSControls();
  }

  /**
   * Check compliance for a specific framework
   */
  async checkCompliance(
    resources: DetectedResource[],
    framework: 'CIS' | 'PCI-DSS' | 'HIPAA' | 'SOC2'
  ): Promise<ComplianceReport> {
    const controls = this.controls.get(framework) || [];
    const violations: ComplianceViolation[] = [];
    let passedControls = 0;

    for (const control of controls) {
      const applicableResources = resources.filter(r =>
        control.resourceTypes.includes('*') || control.resourceTypes.includes(r.resourceType)
      );

      for (const resource of applicableResources) {
        const passed = control.check(resource);
        
        if (!passed) {
          violations.push({
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            framework,
            controlId: control.id,
            controlName: control.name,
            severity: control.severity,
            description: control.description,
            remediation: control.remediation,
            references: control.references,
          });
        } else {
          passedControls++;
        }
      }
    }

    const summary = {
      critical: violations.filter(v => v.severity === 'critical').length,
      high: violations.filter(v => v.severity === 'high').length,
      medium: violations.filter(v => v.severity === 'medium').length,
      low: violations.filter(v => v.severity === 'low').length,
    };

    const totalChecks = passedControls + violations.length;
    const complianceScore = totalChecks > 0 ? (passedControls / totalChecks) * 100 : 0;

    return {
      framework,
      totalControls: controls.length,
      passedControls,
      failedControls: violations.length,
      complianceScore,
      violations,
      summary,
    };
  }

  /**
   * Initialize CIS AWS Foundations Benchmark controls
   */
  private initializeCISControls(): void {
    const cisControls: ComplianceControl[] = [
      {
        id: 'CIS-2.1.1',
        framework: 'CIS',
        name: 'Ensure S3 Bucket Encryption is Enabled',
        description: 'S3 buckets should have encryption enabled by default',
        resourceTypes: ['aws_s3_bucket'],
        severity: 'high',
        check: (resource) => {
          const encryption = resource.actualState?.encryption || resource.expectedState?.encryption;
          return encryption && encryption.enabled === true;
        },
        remediation: 'Enable default encryption for S3 bucket using AES256 or AWS-KMS',
        references: [
          'https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html',
          'CIS AWS Foundations Benchmark v1.4.0 - Control 2.1.1',
        ],
      },

      {
        id: 'CIS-2.1.5',
        framework: 'CIS',
        name: 'Ensure S3 Buckets are Not Publicly Accessible',
        description: 'S3 buckets should not allow public read or write access',
        resourceTypes: ['aws_s3_bucket'],
        severity: 'critical',
        check: (resource) => {
          const acl = resource.actualState?.acl || resource.expectedState?.acl;
          return acl !== 'public-read' && acl !== 'public-read-write';
        },
        remediation: 'Set bucket ACL to private and use bucket policies for controlled access',
        references: [
          'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html',
          'CIS AWS Foundations Benchmark v1.4.0 - Control 2.1.5',
        ],
      },

      {
        id: 'CIS-4.1',
        framework: 'CIS',
        name: 'Ensure No Security Groups Allow Ingress from 0.0.0.0/0 to Port 22',
        description: 'Security groups should not allow unrestricted SSH access',
        resourceTypes: ['aws_security_group'],
        severity: 'critical',
        check: (resource) => {
          const ingress = resource.actualState?.ingress || resource.expectedState?.ingress || [];
          
          for (const rule of ingress) {
            if (
              rule.from_port === 22 &&
              rule.to_port === 22 &&
              (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.ipv6_cidr_blocks?.includes('::/0'))
            ) {
              return false;
            }
          }
          return true;
        },
        remediation: 'Restrict SSH access to specific IP ranges or use AWS Systems Manager Session Manager',
        references: [
          'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.html',
          'CIS AWS Foundations Benchmark v1.4.0 - Control 4.1',
        ],
      },

      {
        id: 'CIS-4.2',
        framework: 'CIS',
        name: 'Ensure No Security Groups Allow Ingress from 0.0.0.0/0 to Port 3389',
        description: 'Security groups should not allow unrestricted RDP access',
        resourceTypes: ['aws_security_group'],
        severity: 'critical',
        check: (resource) => {
          const ingress = resource.actualState?.ingress || resource.expectedState?.ingress || [];
          
          for (const rule of ingress) {
            if (
              rule.from_port === 3389 &&
              rule.to_port === 3389 &&
              (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.ipv6_cidr_blocks?.includes('::/0'))
            ) {
              return false;
            }
          }
          return true;
        },
        remediation: 'Restrict RDP access to specific IP ranges or use VPN/bastion host',
        references: [
          'https://docs.aws.amazon.com/AWSEC2/latest/WindowsGuide/authorizing-access-to-an-instance.html',
          'CIS AWS Foundations Benchmark v1.4.0 - Control 4.2',
        ],
      },

      {
        id: 'CIS-5.1',
        framework: 'CIS',
        name: 'Ensure RDS Instances are Not Publicly Accessible',
        description: 'RDS instances should not be publicly accessible',
        resourceTypes: ['aws_db_instance'],
        severity: 'critical',
        check: (resource) => {
          const publicAccess = resource.actualState?.publicly_accessible ?? resource.expectedState?.publicly_accessible;
          return publicAccess !== true;
        },
        remediation: 'Set publicly_accessible to false and access database through VPN or bastion host',
        references: [
          'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html',
          'CIS AWS Foundations Benchmark v1.4.0 - Control 5.1',
        ],
      },

      {
        id: 'CIS-5.3',
        framework: 'CIS',
        name: 'Ensure RDS Instances Have Encryption at Rest Enabled',
        description: 'RDS instances should have storage encryption enabled',
        resourceTypes: ['aws_db_instance'],
        severity: 'high',
        check: (resource) => {
          const encrypted = resource.actualState?.storage_encrypted ?? resource.expectedState?.storage_encrypted;
          return encrypted === true;
        },
        remediation: 'Enable storage encryption (requires database recreation)',
        references: [
          'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html',
          'CIS AWS Foundations Benchmark v1.4.0 - Control 5.3',
        ],
      },

      {
        id: 'CIS-AZURE-6.1',
        framework: 'CIS',
        name: 'Ensure Storage Accounts Secure Transfer is Enabled',
        description: 'Azure storage accounts should require secure transfer (HTTPS)',
        resourceTypes: ['azurerm_storage_account'],
        severity: 'high',
        check: (resource) => {
          const httpsOnly = resource.actualState?.enable_https_traffic_only ?? resource.expectedState?.enable_https_traffic_only;
          return httpsOnly === true;
        },
        remediation: 'Set enable_https_traffic_only to true',
        references: [
          'https://docs.microsoft.com/en-us/azure/storage/common/storage-require-secure-transfer',
          'CIS Microsoft Azure Foundations Benchmark - Control 6.1',
        ],
      },
    ];

    this.controls.set('CIS', cisControls);
  }

  /**
   * Initialize PCI-DSS controls
   */
  private initializePCIDSSControls(): void {
    const pciControls: ComplianceControl[] = [
      {
        id: 'PCI-1.2.1',
        framework: 'PCI-DSS',
        name: 'Restrict Inbound Traffic to Necessary Ports',
        description: 'Security groups should only allow necessary inbound traffic',
        resourceTypes: ['aws_security_group'],
        severity: 'high',
        check: (resource) => {
          const ingress = resource.actualState?.ingress || resource.expectedState?.ingress || [];
          
          // Check for overly permissive rules
          for (const rule of ingress) {
            if (
              rule.from_port === 0 &&
              rule.to_port === 65535 &&
              (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.ipv6_cidr_blocks?.includes('::/0'))
            ) {
              return false;
            }
          }
          return true;
        },
        remediation: 'Only allow specific ports and protocols required for business functions',
        references: [
          'PCI DSS v3.2.1 - Requirement 1.2.1',
          'https://www.pcisecuritystandards.org/documents/PCI_DSS_v3-2-1.pdf',
        ],
      },

      {
        id: 'PCI-2.3',
        framework: 'PCI-DSS',
        name: 'Encrypt All Non-Console Administrative Access',
        description: 'Administrative access should use encrypted connections',
        resourceTypes: ['aws_security_group'],
        severity: 'critical',
        check: (resource) => {
          const ingress = resource.actualState?.ingress || resource.expectedState?.ingress || [];
          
          // Check for unencrypted admin ports (telnet, HTTP)
          for (const rule of ingress) {
            if (
              (rule.from_port === 23 || rule.from_port === 80) &&
              (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.ipv6_cidr_blocks?.includes('::/0'))
            ) {
              return false;
            }
          }
          return true;
        },
        remediation: 'Use SSH (22) and HTTPS (443) instead of Telnet (23) and HTTP (80) for administrative access',
        references: [
          'PCI DSS v3.2.1 - Requirement 2.3',
        ],
      },

      {
        id: 'PCI-3.4',
        framework: 'PCI-DSS',
        name: 'Ensure Cardholder Data is Encrypted',
        description: 'Storage containing cardholder data must be encrypted',
        resourceTypes: ['aws_s3_bucket', 'aws_db_instance', 'aws_ebs_volume'],
        severity: 'critical',
        check: (resource) => {
          if (resource.resourceType === 'aws_s3_bucket') {
            const encryption = resource.actualState?.encryption || resource.expectedState?.encryption;
            return encryption && encryption.enabled === true;
          }
          
          if (resource.resourceType === 'aws_db_instance') {
            const encrypted = resource.actualState?.storage_encrypted ?? resource.expectedState?.storage_encrypted;
            return encrypted === true;
          }
          
          if (resource.resourceType === 'aws_ebs_volume') {
            const encrypted = resource.actualState?.encrypted ?? resource.expectedState?.encrypted;
            return encrypted === true;
          }
          
          return true;
        },
        remediation: 'Enable encryption at rest for all storage resources that may contain cardholder data',
        references: [
          'PCI DSS v3.2.1 - Requirement 3.4',
        ],
      },

      {
        id: 'PCI-8.2.1',
        framework: 'PCI-DSS',
        name: 'Use Strong Cryptography for Authentication',
        description: 'Systems should use strong cryptography and security protocols',
        resourceTypes: ['azurerm_storage_account'],
        severity: 'high',
        check: (resource) => {
          const minTls = resource.actualState?.min_tls_version || resource.expectedState?.min_tls_version;
          // Ensure TLS 1.2 or higher
          return minTls === 'TLS1_2' || minTls === 'TLS1_3';
        },
        remediation: 'Set minimum TLS version to 1.2 or higher',
        references: [
          'PCI DSS v3.2.1 - Requirement 8.2.1',
        ],
      },

      {
        id: 'PCI-10.5.3',
        framework: 'PCI-DSS',
        name: 'Ensure Database Backups are Encrypted',
        description: 'Database backups must be encrypted',
        resourceTypes: ['aws_db_instance'],
        severity: 'high',
        check: (resource) => {
          const encrypted = resource.actualState?.storage_encrypted ?? resource.expectedState?.storage_encrypted;
          // Encrypted instances automatically encrypt backups
          return encrypted === true;
        },
        remediation: 'Enable storage encryption to ensure backups are also encrypted',
        references: [
          'PCI DSS v3.2.1 - Requirement 10.5.3',
        ],
      },
    ];

    this.controls.set('PCI-DSS', pciControls);
  }

  /**
   * Get all supported frameworks
   */
  getSupportedFrameworks(): string[] {
    return Array.from(this.controls.keys());
  }

  /**
   * Get controls for a specific framework
   */
  getFrameworkControls(framework: string): ComplianceControl[] {
    return this.controls.get(framework) || [];
  }

  /**
   * Add custom compliance control
   */
  addControl(framework: string, control: ComplianceControl): void {
    const existing = this.controls.get(framework) || [];
    existing.push(control);
    this.controls.set(framework, existing);
  }

  /**
   * Generate compliance summary across all frameworks
   */
  async generateComplianceSummary(resources: DetectedResource[]): Promise<Map<string, ComplianceReport>> {
    const summary = new Map<string, ComplianceReport>();

    for (const framework of this.controls.keys()) {
      const report = await this.checkCompliance(resources, framework as any);
      summary.set(framework, report);
    }

    return summary;
  }
}
