/**
 * Remediation Logger
 * Handles logging for remediation operations
 */

import { RemediationLogEntry, RemediationStats } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class RemediationLogger {
  private logDir: string;
  private logs: RemediationLogEntry[] = [];

  constructor(logDir?: string) {
    this.logDir = logDir || path.join(process.cwd(), 'remediation-logs');
  }

  /**
   * Log an entry
   */
  async log(entry: RemediationLogEntry): Promise<void> {
    this.logs.push(entry);

    // Console output
    const timestamp = entry.timestamp.toISOString();
    const level = this.formatLevel(entry.level);
    const context = entry.actionId
      ? `[Plan: ${entry.planId.slice(0, 8)} | Action: ${entry.actionId.slice(0, 8)}]`
      : `[Plan: ${entry.planId.slice(0, 8)}]`;

    console.log(`${timestamp} ${level} ${context} ${entry.message}`);

    // Write to file
    await this.writeToFile(entry);
  }

  /**
   * Get all logs
   */
  getLogs(): RemediationLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs for a specific plan
   */
  getLogsByPlan(planId: string): RemediationLogEntry[] {
    return this.logs.filter(log => log.planId === planId);
  }

  /**
   * Get logs for a specific action
   */
  getLogsByAction(actionId: string): RemediationLogEntry[] {
    return this.logs.filter(log => log.actionId === actionId);
  }

  /**
   * Calculate statistics from logs
   */
  async getStatistics(): Promise<RemediationStats> {
    // Load all log files
    const allLogs = await this.loadAllLogs();

    const plans = new Set(allLogs.map(log => log.planId)).size;
    const actions = new Set(allLogs.map(log => log.actionId)).size;

    const successLogs = allLogs.filter(log => log.level === 'success');
    const errorLogs = allLogs.filter(log => log.level === 'error');

    // Calculate average duration
    const durationLogs = allLogs.filter(log =>
      log.metadata?.duration !== undefined
    );
    const avgDuration = durationLogs.length > 0
      ? durationLogs.reduce((sum, log) => sum + (log.metadata?.duration || 0), 0) / durationLogs.length
      : 0;

    // Find most common failures
    const errorMessages = errorLogs
      .map(log => log.message)
      .filter(msg => msg.includes('Failed:'));

    const errorCounts = new Map<string, number>();
    for (const msg of errorMessages) {
      const count = errorCounts.get(msg) || 0;
      errorCounts.set(msg, count + 1);
    }

    const mostCommonFailures = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalPlans: plans,
      totalActions: actions,
      successfulActions: successLogs.length,
      failedActions: errorLogs.length,
      rolledBackActions: allLogs.filter(log =>
        log.message.includes('Rollback successful')
      ).length,
      averageDuration: avgDuration,
      mostCommonFailures
    };
  }

  /**
   * Export logs to file
   */
  async exportLogs(filePath: string): Promise<void> {
    const allLogs = await this.loadAllLogs();
    await fs.writeFile(filePath, JSON.stringify(allLogs, null, 2), 'utf-8');
  }

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    this.logs = [];
    try {
      const files = await fs.readdir(this.logDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.logDir, file));
        }
      }
    } catch (error) {
      // Directory might not exist
    }
  }

  /**
   * Write log entry to file
   */
  private async writeToFile(entry: RemediationLogEntry): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });

      const date = entry.timestamp.toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `remediation-${date}.json`);

      // Read existing logs
      let existingLogs: RemediationLogEntry[] = [];
      try {
        const content = await fs.readFile(logFile, 'utf-8');
        existingLogs = JSON.parse(content);
      } catch {
        // File doesn't exist yet
      }

      // Append new log
      existingLogs.push(entry);

      // Write back
      await fs.writeFile(logFile, JSON.stringify(existingLogs, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  /**
   * Load all logs from files
   */
  private async loadAllLogs(): Promise<RemediationLogEntry[]> {
    const allLogs: RemediationLogEntry[] = [];

    try {
      const files = await fs.readdir(this.logDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.logDir, file), 'utf-8');
          const logs = JSON.parse(content);
          allLogs.push(...logs);
        }
      }
    } catch (error) {
      // Directory might not exist
    }

    return allLogs;
  }

  /**
   * Format log level with colors
   */
  private formatLevel(level: string): string {
    const colors: Record<string, string> = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m'    // Red
    };
    const reset = '\x1b[0m';

    const color = colors[level] || '';
    return `${color}${level.toUpperCase().padEnd(7)}${reset}`;
  }
}
