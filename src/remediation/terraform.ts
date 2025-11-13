/**
 * Terraform Executor
 * Handles terraform plan, apply, and code generation for remediation
 */

import { RemediationAction, RemediationStrategy } from './types';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface TerraformExecutorConfig {
  terraformPath?: string;
  workDir?: string;
  varFile?: string;
}

export class TerraformExecutor {
  private terraformPath: string;
  private workDir: string;
  private varFile?: string;

  constructor(config: TerraformExecutorConfig = {}) {
    this.terraformPath = config.terraformPath || 'terraform';
    this.workDir = config.workDir || process.cwd();
    this.varFile = config.varFile;
  }

  /**
   * Run terraform plan to preview changes
   */
  async plan(action: RemediationAction): Promise<string> {
    const args = ['plan', '-no-color'];

    if (this.varFile) {
      args.push(`-var-file=${this.varFile}`);
    }

    // Focus on specific resource
    if (action.resourceName) {
      args.push(`-target=${action.resourceName}`);
    }

    return this.executeTerraform(args);
  }

  /**
   * Apply terraform changes
   */
  async apply(action: RemediationAction): Promise<string> {
    // First, generate terraform plan
    const planOutput = await this.plan(action);

    // Save backup of current state
    await this.backupState();

    // Apply changes
    const args = ['apply', '-auto-approve', '-no-color'];

    if (this.varFile) {
      args.push(`-var-file=${this.varFile}`);
    }

    if (action.resourceName) {
      args.push(`-target=${action.resourceName}`);
    }

    const applyOutput = await this.executeTerraform(args);

    // Store rollback information
    action.rollbackData = {
      stateBackup: path.join(this.workDir, '.terraform-backup', `state-${Date.now()}.tfstate`)
    };

    return `Plan:\n${planOutput}\n\nApply:\n${applyOutput}`;
  }

  /**
   * Update Terraform code to fix drift
   */
  async updateCode(action: RemediationAction): Promise<string> {
    // Generate terraform code for the fix
    const terraformCode = this.generateTerraformCode(action);
    action.terraformCode = terraformCode;

    // Find the terraform file for this resource
    const tfFile = await this.findResourceFile(action.resourceName);

    if (!tfFile) {
      throw new Error(`Could not find terraform file for resource: ${action.resourceName}`);
    }

    // Read current file
    const currentContent = await fs.readFile(tfFile, 'utf-8');

    // Update the property in the file
    const updatedContent = await this.updatePropertyInFile(
      currentContent,
      action.resourceName,
      action.propertyPath,
      action.desiredValue
    );

    // Write back (in dry-run, we'd just return the diff)
    await fs.writeFile(tfFile, updatedContent, 'utf-8');

    return `Updated ${tfFile}:\n${terraformCode}`;
  }

  /**
   * Rollback a change using state backup
   */
  async rollback(action: RemediationAction): Promise<void> {
    if (!action.rollbackData?.stateBackup) {
      throw new Error('No rollback data available');
    }

    const backupPath = action.rollbackData.stateBackup;

    // Restore state from backup
    const args = ['state', 'push', backupPath];
    await this.executeTerraform(args);
  }

  /**
   * Execute terraform command
   */
  private async executeTerraform(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.terraformPath, args, {
        cwd: this.workDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Terraform failed: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Backup current terraform state
   */
  private async backupState(): Promise<void> {
    const backupDir = path.join(this.workDir, '.terraform-backup');
    await fs.mkdir(backupDir, { recursive: true });

    const stateFile = path.join(this.workDir, 'terraform.tfstate');
    const backupFile = path.join(backupDir, `state-${Date.now()}.tfstate`);

    try {
      await fs.copyFile(stateFile, backupFile);
    } catch (error) {
      // State file might not exist yet
      console.warn('Could not backup state file:', error);
    }
  }

  /**
   * Find terraform file containing a resource
   */
  private async findResourceFile(resourceName: string): Promise<string | null> {
    const files = await this.findTerraformFiles(this.workDir);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      if (content.includes(`"${resourceName}"`)) {
        return file;
      }
    }

    return null;
  }

  /**
   * Find all terraform files in directory
   */
  private async findTerraformFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        files.push(...await this.findTerraformFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.tf')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Update a property in terraform file content
   */
  private async updatePropertyInFile(
    content: string,
    resourceName: string,
    propertyPath: string,
    desiredValue: any
  ): Promise<string> {
    // This is a simplified implementation
    // In production, you'd use a proper HCL parser/writer

    const lines = content.split('\n');
    const resourcePattern = new RegExp(`resource\\s+"[^"]+"\\s+"${resourceName}"`);
    let inResource = false;
    let braceCount = 0;
    let updatedLines = [...lines];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (resourcePattern.test(line)) {
        inResource = true;
      }

      if (inResource) {
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        // Check if this line contains our property
        const propertyName = propertyPath.split('.').pop() || propertyPath;
        if (line.includes(propertyName)) {
          const indent = line.match(/^\s*/)?.[0] || '';
          updatedLines[i] = `${indent}${propertyName} = ${this.formatTerraformValue(desiredValue)}`;
        }

        if (braceCount === 0 && inResource) {
          inResource = false;
        }
      }
    }

    return updatedLines.join('\n');
  }

  /**
   * Generate terraform code for a remediation
   */
  private generateTerraformCode(action: RemediationAction): string {
    const propertyName = action.propertyPath.split('.').pop() || action.propertyPath;
    const value = this.formatTerraformValue(action.desiredValue);

    return `# Remediation for ${action.resourceName}
# Property: ${action.propertyPath}
# Change: ${action.currentValue} -> ${action.desiredValue}

resource "aws_..." "${action.resourceName}" {
  # ... other properties ...
  ${propertyName} = ${value}
}`;
  }

  /**
   * Format a value for terraform syntax
   */
  private formatTerraformValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map(v => this.formatTerraformValue(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      const formatted = entries.map(([k, v]) => `${k} = ${this.formatTerraformValue(v)}`).join('\n  ');
      return `{\n  ${formatted}\n}`;
    }
    return String(value);
  }
}
