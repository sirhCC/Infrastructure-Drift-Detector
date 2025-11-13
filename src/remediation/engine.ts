/**
 * Remediation Engine - Core Logic
 * Handles drift remediation with dry-run, approval, and rollback
 */

import { DriftResult } from '../types';
import {
  RemediationPlan,
  RemediationAction,
  RemediationResult,
  RemediationConfig,
  RemediationStatus,
  RemediationSeverity,
  RemediationStrategy,
  ApprovalRequest
} from './types';
import { RemediationStrategyGenerator } from './strategy';
import { TerraformExecutor } from './terraform';
import { RemediationLogger } from './logger';
import { v4 as uuidv4 } from 'uuid';

export class RemediationEngine {
  private strategyGenerator: RemediationStrategyGenerator;
  private terraformExecutor: TerraformExecutor;
  private logger: RemediationLogger;
  private config: RemediationConfig;
  private pendingApprovals: Map<string, ApprovalRequest>;

  constructor(config: Partial<RemediationConfig> = {}) {
    this.config = {
      dryRun: config.dryRun ?? true,
      autoApprove: config.autoApprove ?? false,
      requireApprovalFor: config.requireApprovalFor ?? [
        RemediationSeverity.LOW_RISK,
        RemediationSeverity.MEDIUM_RISK,
        RemediationSeverity.HIGH_RISK,
        RemediationSeverity.CRITICAL
      ],
      maxConcurrent: config.maxConcurrent ?? 1,
      continueOnError: config.continueOnError ?? false,
      rollbackOnError: config.rollbackOnError ?? true,
      verboseLogging: config.verboseLogging ?? true,
      destructiveActionsAllowed: config.destructiveActionsAllowed ?? false,
      backupBeforeChange: config.backupBeforeChange ?? true,
      ...config
    };

    this.strategyGenerator = new RemediationStrategyGenerator();
    this.terraformExecutor = new TerraformExecutor({
      terraformPath: config.terraformPath,
      workDir: config.terraformWorkDir,
      varFile: config.terraformVarFile
    });
    this.logger = new RemediationLogger(config.logDir);
    this.pendingApprovals = new Map();
  }

  /**
   * Create a remediation plan from drift results
   */
  async createPlan(
    driftResults: DriftResult[],
    scanId: string
  ): Promise<RemediationPlan> {
    const actions = this.strategyGenerator.generateActions(driftResults);

    // Filter actions based on config
    const filteredActions = this.filterActions(actions);

    // Calculate statistics
    const safeActions = filteredActions.filter(
      a => a.severity === RemediationSeverity.SAFE
    ).length;
    const requiresApproval = filteredActions.filter(
      a => a.requiresApproval && !this.config.autoApprove
    ).length;
    const criticalActions = filteredActions.filter(
      a => a.severity === RemediationSeverity.CRITICAL
    ).length;

    // Determine execution order (safe actions first)
    const executionOrder = this.sortActionsByPriority(filteredActions);

    const plan: RemediationPlan = {
      id: uuidv4(),
      scanId,
      createdAt: new Date(),
      actions: filteredActions,
      totalActions: filteredActions.length,
      safeActions,
      requiresApproval,
      criticalActions,
      dryRun: this.config.dryRun,
      autoApprove: this.config.autoApprove,
      executionOrder,
      status: RemediationStatus.PENDING,
      successCount: 0,
      failureCount: 0
    };

    await this.logger.log({
      timestamp: new Date(),
      planId: plan.id,
      actionId: '',
      level: 'info',
      message: `Created remediation plan with ${plan.totalActions} actions`
    });

    return plan;
  }

  /**
   * Execute a remediation plan
   */
  async executePlan(plan: RemediationPlan): Promise<RemediationResult[]> {
    const results: RemediationResult[] = [];

    plan.status = RemediationStatus.IN_PROGRESS;
    plan.startedAt = new Date();

    await this.logger.log({
      timestamp: new Date(),
      planId: plan.id,
      actionId: '',
      level: 'info',
      message: `Starting plan execution (dry-run: ${plan.dryRun})`
    });

    // Execute actions in order
    for (const actionId of plan.executionOrder) {
      const action = plan.actions.find(a => a.id === actionId);
      if (!action) continue;

      // Check if approval is needed
      if (action.requiresApproval && !this.config.autoApprove) {
        const approved = await this.requestApproval(action);
        if (!approved) {
          action.status = RemediationStatus.CANCELLED;
          await this.logger.log({
            timestamp: new Date(),
            planId: plan.id,
            actionId: action.id,
            level: 'warn',
            message: `Action cancelled: approval denied`
          });
          continue;
        }
      }

      // Execute action
      const result = await this.executeAction(plan, action);
      results.push(result);

      if (result.success) {
        plan.successCount++;
      } else {
        plan.failureCount++;

        // Handle failure
        if (!this.config.continueOnError) {
          await this.logger.log({
            timestamp: new Date(),
            planId: plan.id,
            actionId: action.id,
            level: 'error',
            message: `Stopping execution due to failure: ${result.error}`
          });
          break;
        }
      }
    }

    plan.status = plan.failureCount === 0
      ? RemediationStatus.COMPLETED
      : RemediationStatus.FAILED;
    plan.completedAt = new Date();

    await this.logger.log({
      timestamp: new Date(),
      planId: plan.id,
      actionId: '',
      level: plan.status === RemediationStatus.COMPLETED ? 'success' : 'error',
      message: `Plan completed: ${plan.successCount} succeeded, ${plan.failureCount} failed`
    });

    return results;
  }

  /**
   * Execute a single remediation action
   */
  private async executeAction(
    plan: RemediationPlan,
    action: RemediationAction
  ): Promise<RemediationResult> {
    const startTime = Date.now();
    action.status = RemediationStatus.IN_PROGRESS;
    action.executedAt = new Date();

    await this.logger.log({
      timestamp: new Date(),
      planId: plan.id,
      actionId: action.id,
      level: 'info',
      message: `Executing: ${action.description}`
    });

    try {
      let output: string = '';

      if (plan.dryRun) {
        // Dry-run mode: just preview
        output = await this.previewAction(action);
        action.terraformPlan = output;
      } else {
        // Execute based on strategy
        switch (action.strategy) {
          case RemediationStrategy.TERRAFORM_APPLY:
            output = await this.terraformExecutor.apply(action);
            break;

          case RemediationStrategy.TERRAFORM_UPDATE:
            output = await this.terraformExecutor.updateCode(action);
            break;

          case RemediationStrategy.MANUAL:
            output = 'Manual intervention required';
            break;

          default:
            throw new Error(`Unknown strategy: ${action.strategy}`);
        }
      }

      action.status = RemediationStatus.COMPLETED;
      action.completedAt = new Date();

      const duration = Date.now() - startTime;

      await this.logger.log({
        timestamp: new Date(),
        planId: plan.id,
        actionId: action.id,
        level: 'success',
        message: `Completed in ${duration}ms`
      });

      return {
        planId: plan.id,
        action,
        success: true,
        duration,
        output
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      action.status = RemediationStatus.FAILED;
      action.error = errorMessage;

      await this.logger.log({
        timestamp: new Date(),
        planId: plan.id,
        actionId: action.id,
        level: 'error',
        message: `Failed: ${errorMessage}`
      });

      // Attempt rollback if configured
      if (this.config.rollbackOnError && action.rollbackData) {
        await this.rollbackAction(plan, action);
      }

      return {
        planId: plan.id,
        action,
        success: false,
        duration: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Preview what an action would do (dry-run)
   */
  private async previewAction(action: RemediationAction): Promise<string> {
    return this.terraformExecutor.plan(action);
  }

  /**
   * Rollback a failed action
   */
  private async rollbackAction(
    plan: RemediationPlan,
    action: RemediationAction
  ): Promise<void> {
    await this.logger.log({
      timestamp: new Date(),
      planId: plan.id,
      actionId: action.id,
      level: 'warn',
      message: 'Attempting rollback...'
    });

    try {
      await this.terraformExecutor.rollback(action);
      action.status = RemediationStatus.ROLLED_BACK;

      await this.logger.log({
        timestamp: new Date(),
        planId: plan.id,
        actionId: action.id,
        level: 'success',
        message: 'Rollback successful'
      });
    } catch (error) {
      await this.logger.log({
        timestamp: new Date(),
        planId: plan.id,
        actionId: action.id,
        level: 'error',
        message: `Rollback failed: ${error}`
      });
    }
  }

  /**
   * Request approval for an action
   */
  private async requestApproval(action: RemediationAction): Promise<boolean> {
    const request: ApprovalRequest = {
      action,
      requestedAt: new Date(),
      requester: 'system'
    };

    if (this.config.approvalTimeout) {
      request.expiresAt = new Date(Date.now() + this.config.approvalTimeout * 1000);
    }

    this.pendingApprovals.set(action.id, request);

    await this.logger.log({
      timestamp: new Date(),
      planId: '',
      actionId: action.id,
      level: 'info',
      message: `Approval required for ${action.severity} action: ${action.description}`
    });

    // In a real implementation, this would wait for user input
    // For now, auto-deny actions that require approval
    return false;
  }

  /**
   * Approve an action
   */
  async approveAction(actionId: string, approver: string): Promise<boolean> {
    const request = this.pendingApprovals.get(actionId);
    if (!request) return false;

    request.approved = true;
    request.approvedBy = approver;
    request.approvedAt = new Date();

    await this.logger.log({
      timestamp: new Date(),
      planId: '',
      actionId,
      level: 'info',
      message: `Action approved by ${approver}`
    });

    return true;
  }

  /**
   * Filter actions based on configuration
   */
  private filterActions(actions: RemediationAction[]): RemediationAction[] {
    return actions.filter(action => {
      // Filter by include/exclude patterns
      if (this.config.includeResources) {
        const included = this.config.includeResources.some(pattern =>
          action.resourceName.includes(pattern)
        );
        if (!included) return false;
      }

      if (this.config.excludeResources) {
        const excluded = this.config.excludeResources.some(pattern =>
          action.resourceName.includes(pattern)
        );
        if (excluded) return false;
      }

      // Filter destructive actions
      if (!this.config.destructiveActionsAllowed) {
        if (action.severity === RemediationSeverity.CRITICAL) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort actions by priority (safe first, then by severity)
   */
  private sortActionsByPriority(actions: RemediationAction[]): string[] {
    const severityOrder = {
      [RemediationSeverity.SAFE]: 0,
      [RemediationSeverity.LOW_RISK]: 1,
      [RemediationSeverity.MEDIUM_RISK]: 2,
      [RemediationSeverity.HIGH_RISK]: 3,
      [RemediationSeverity.CRITICAL]: 4
    };

    return actions
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .map(a => a.id);
  }

  /**
   * Get configuration
   */
  getConfig(): RemediationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RemediationConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
