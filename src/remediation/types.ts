/**
 * Auto-Remediation Engine - Type Definitions
 * Handles automatic drift remediation with approval workflows and rollback
 */

import { DriftResult, DriftedProperty } from '../types';

/**
 * Remediation strategy for a specific drift
 */
export enum RemediationStrategy {
  TERRAFORM_UPDATE = 'terraform_update',    // Update Terraform code
  TERRAFORM_APPLY = 'terraform_apply',      // Apply infrastructure changes
  MANUAL = 'manual',                        // Requires manual intervention
  IGNORE = 'ignore'                         // Skip this drift
}

/**
 * Status of a remediation action
 */
export enum RemediationStatus {
  PENDING = 'pending',           // Awaiting approval
  APPROVED = 'approved',         // Approved, ready to execute
  IN_PROGRESS = 'in_progress',   // Currently executing
  COMPLETED = 'completed',       // Successfully completed
  FAILED = 'failed',             // Failed to remediate
  ROLLED_BACK = 'rolled_back',   // Rolled back after failure
  CANCELLED = 'cancelled'        // Cancelled by user
}

/**
 * Severity level for remediation actions
 */
export enum RemediationSeverity {
  SAFE = 'safe',           // Safe to auto-apply (e.g., tags)
  LOW_RISK = 'low_risk',   // Low risk (e.g., description changes)
  MEDIUM_RISK = 'medium_risk', // Medium risk (e.g., security group rules)
  HIGH_RISK = 'high_risk', // High risk (e.g., instance type changes)
  CRITICAL = 'critical'    // Critical (e.g., resource deletion)
}

/**
 * A single remediation action for a property drift
 */
export interface RemediationAction {
  id: string;
  driftId: string;
  resourceName: string;
  resourceType: string;
  propertyPath: string;
  strategy: RemediationStrategy;
  severity: RemediationSeverity;
  
  // What needs to change
  currentValue: any;
  desiredValue: any;
  
  // Terraform-specific
  terraformCode?: string;      // Generated Terraform code
  terraformPlan?: string;      // Output from terraform plan
  
  // Action details
  description: string;
  requiresApproval: boolean;
  estimatedDuration?: number;  // Seconds
  
  // Status tracking
  status: RemediationStatus;
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  
  // Results
  error?: string;
  rollbackData?: any;          // Data needed for rollback
}

/**
 * A remediation plan containing multiple actions
 */
export interface RemediationPlan {
  id: string;
  scanId: string;
  createdAt: Date;
  actions: RemediationAction[];
  
  // Summary
  totalActions: number;
  safeActions: number;          // Auto-approvable
  requiresApproval: number;     // Needs human approval
  criticalActions: number;      // High-risk actions
  
  // Execution
  dryRun: boolean;
  autoApprove: boolean;
  executionOrder: string[];     // Action IDs in execution order
  
  // Status
  status: RemediationStatus;
  startedAt?: Date;
  completedAt?: Date;
  successCount: number;
  failureCount: number;
}

/**
 * Result of a remediation execution
 */
export interface RemediationResult {
  planId: string;
  action: RemediationAction;
  success: boolean;
  duration: number;              // Milliseconds
  output?: string;               // Command output
  error?: string;
  rollbackPerformed?: boolean;
}

/**
 * Configuration for remediation engine
 */
export interface RemediationConfig {
  // Execution mode
  dryRun: boolean;               // Preview only, don't execute
  autoApprove: boolean;          // Auto-approve safe actions
  
  // Approval settings
  requireApprovalFor: RemediationSeverity[]; // Which severities need approval
  approvalTimeout?: number;      // Seconds to wait for approval
  
  // Terraform settings
  terraformPath?: string;        // Path to terraform binary
  terraformWorkDir?: string;     // Working directory for terraform
  terraformVarFile?: string;     // Variables file
  
  // Execution settings
  maxConcurrent: number;         // Max parallel remediations
  continueOnError: boolean;      // Continue if one action fails
  rollbackOnError: boolean;      // Rollback on failure
  
  // Logging
  logDir?: string;               // Directory for remediation logs
  verboseLogging: boolean;
  
  // Safety
  destructiveActionsAllowed: boolean; // Allow resource deletion
  backupBeforeChange: boolean;   // Create state backup
  
  // Filters
  includeResources?: string[];   // Only remediate these resources
  excludeResources?: string[];   // Skip these resources
  maxActionsPerRun?: number;     // Limit actions per execution
}

/**
 * Approval request for a remediation action
 */
export interface ApprovalRequest {
  action: RemediationAction;
  requestedAt: Date;
  expiresAt?: Date;
  requester: string;
  approved?: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  reason?: string;
}

/**
 * Remediation log entry
 */
export interface RemediationLogEntry {
  timestamp: Date;
  planId: string;
  actionId: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Rollback information
 */
export interface RollbackInfo {
  actionId: string;
  originalState: any;
  rollbackStrategy: 'terraform_state' | 'manual' | 'none';
  rollbackCommands?: string[];
  canRollback: boolean;
}

/**
 * Statistics for remediation execution
 */
export interface RemediationStats {
  totalPlans: number;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  rolledBackActions: number;
  averageDuration: number;        // Milliseconds
  mostCommonFailures: Array<{
    error: string;
    count: number;
  }>;
}
