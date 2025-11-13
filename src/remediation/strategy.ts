/**
 * Remediation Strategy Generator
 * Analyzes drift and generates appropriate remediation strategies
 */

import { DriftResult, DriftedProperty, ResourceType } from '../types';
import {
  RemediationAction,
  RemediationStrategy,
  RemediationSeverity,
  RemediationStatus
} from './types';
import { v4 as uuidv4 } from 'uuid';

export class RemediationStrategyGenerator {
  /**
   * Generate remediation actions for drift results
   */
  generateActions(driftResults: DriftResult[]): RemediationAction[] {
    const actions: RemediationAction[] = [];

    for (const drift of driftResults) {
      if (!drift.hasDrift) continue;

      for (const propertyDrift of drift.driftedProperties) {
        const action = this.createAction(drift, propertyDrift);
        if (action) {
          actions.push(action);
        }
      }
    }

    return actions;
  }

  /**
   * Create a remediation action for a single property drift
   */
  private createAction(
    drift: DriftResult,
    propertyDrift: DriftedProperty
  ): RemediationAction | null {
    const strategy = this.determineStrategy(drift, propertyDrift);
    const severity = this.determineSeverity(drift, propertyDrift);

    if (strategy === RemediationStrategy.IGNORE) {
      return null;
    }

    // Try to infer resource type from resource name or default to 'compute'
    const resourceType = this.inferResourceType(drift.resourceName);

    return {
      id: uuidv4(),
      driftId: drift.resourceId,
      resourceName: drift.resourceName,
      resourceType,
      propertyPath: propertyDrift.propertyPath,
      strategy,
      severity,
      currentValue: propertyDrift.actualValue,
      desiredValue: propertyDrift.expectedValue,
      description: this.generateDescription(drift, propertyDrift, strategy),
      requiresApproval: this.requiresApproval(severity),
      status: RemediationStatus.PENDING,
      createdAt: new Date()
    };
  }

  /**
   * Infer resource type from resource name
   */
  private inferResourceType(resourceName: string): string {
    const lowerName = resourceName.toLowerCase();
    if (lowerName.includes('ec2') || lowerName.includes('instance')) return 'compute';
    if (lowerName.includes('s3') || lowerName.includes('bucket')) return 'storage';
    if (lowerName.includes('vpc') || lowerName.includes('subnet') || lowerName.includes('sg')) return 'network';
    if (lowerName.includes('rds') || lowerName.includes('db')) return 'database';
    if (lowerName.includes('iam') || lowerName.includes('role')) return 'security';
    return 'compute';
  }

  /**
   * Determine the best remediation strategy
   */
  private determineStrategy(
    drift: DriftResult,
    propertyDrift: DriftedProperty
  ): RemediationStrategy {
    const { propertyPath } = propertyDrift;
    const resourceType = this.inferResourceType(drift.resourceName);

    // Properties that should update Terraform code
    if (this.shouldUpdateTerraform(propertyPath, resourceType)) {
      return RemediationStrategy.TERRAFORM_UPDATE;
    }

    // Properties that should apply directly to infrastructure
    if (this.canApplyDirectly(propertyPath, resourceType)) {
      return RemediationStrategy.TERRAFORM_APPLY;
    }

    // Properties that require manual intervention
    if (this.requiresManualIntervention(propertyPath, resourceType)) {
      return RemediationStrategy.MANUAL;
    }

    // Default to terraform apply
    return RemediationStrategy.TERRAFORM_APPLY;
  }

  /**
   * Determine severity of remediation
   */
  private determineSeverity(
    drift: DriftResult,
    propertyDrift: DriftedProperty
  ): RemediationSeverity {
    const { propertyPath, changeType } = propertyDrift;

    // Critical: Deletions or major changes
    if (propertyPath.includes('delete') || changeType === 'removed') {
      return RemediationSeverity.CRITICAL;
    }

    // High risk: Security, networking, or instance changes
    if (
      propertyPath.includes('security_group') ||
      propertyPath.includes('ingress') ||
      propertyPath.includes('egress') ||
      propertyPath.includes('instance_type') ||
      propertyPath.includes('subnet') ||
      propertyPath.includes('vpc')
    ) {
      return RemediationSeverity.HIGH_RISK;
    }

    // Medium risk: Configuration changes
    if (
      propertyPath.includes('policy') ||
      propertyPath.includes('role') ||
      propertyPath.includes('permission') ||
      propertyPath.includes('encryption')
    ) {
      return RemediationSeverity.MEDIUM_RISK;
    }

    // Low risk: Metadata changes
    if (
      propertyPath.includes('description') ||
      propertyPath.includes('name') ||
      propertyPath.includes('monitoring')
    ) {
      return RemediationSeverity.LOW_RISK;
    }

    // Safe: Tags and labels
    if (propertyPath.includes('tag') || propertyPath.includes('label')) {
      return RemediationSeverity.SAFE;
    }

    // Default to medium risk
    return RemediationSeverity.MEDIUM_RISK;
  }

  /**
   * Check if property should update Terraform code
   */
  private shouldUpdateTerraform(propertyPath: string, resourceType: string): boolean {
    // Read-only properties that drift naturally
    const readOnlyPatterns = [
      'arn',
      'id',
      'created_at',
      'updated_at',
      'last_modified',
      'creation_date',
      'state',
      'status'
    ];

    return !readOnlyPatterns.some(pattern => propertyPath.toLowerCase().includes(pattern));
  }

  /**
   * Check if property can be applied directly
   */
  private canApplyDirectly(propertyPath: string, resourceType: string): boolean {
    // Most properties can be applied via terraform apply
    return true;
  }

  /**
   * Check if property requires manual intervention
   */
  private requiresManualIntervention(propertyPath: string, resourceType: string): boolean {
    const manualPatterns = [
      'password',
      'secret',
      'private_key',
      'certificate'
    ];

    return manualPatterns.some(pattern => propertyPath.toLowerCase().includes(pattern));
  }

  /**
   * Check if action requires approval
   */
  private requiresApproval(severity: RemediationSeverity): boolean {
    return severity !== RemediationSeverity.SAFE;
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(
    drift: DriftResult,
    propertyDrift: DriftedProperty,
    strategy: RemediationStrategy
  ): string {
    const action = strategy === RemediationStrategy.TERRAFORM_UPDATE
      ? 'Update Terraform configuration'
      : strategy === RemediationStrategy.TERRAFORM_APPLY
      ? 'Apply infrastructure change'
      : 'Manual intervention required';

    return `${action}: ${drift.resourceName}.${propertyDrift.propertyPath} from ${this.formatValue(propertyDrift.actualValue)} to ${this.formatValue(propertyDrift.expectedValue)}`;
  }

  /**
   * Format value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
