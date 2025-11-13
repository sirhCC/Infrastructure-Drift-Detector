# Auto-Remediation Engine

Automatically fix infrastructure drift with approval workflows, rollback capabilities, and comprehensive logging.

## Overview

The Auto-Remediation Engine analyzes detected drift and generates actionable remediation plans. It supports:

- **Dry-run mode** - Preview changes before applying
- **Approval workflow** - Require human approval for risky changes
- **Automatic rollback** - Revert failed changes automatically
- **Terraform integration** - Generate and apply Terraform changes
- **Severity-based filtering** - Auto-approve safe changes only
- **Comprehensive logging** - Track all remediation actions

## Quick Start

### 1. Basic Remediation (Dry-Run)

```bash
# Preview remediation for most recent scan
drift-detector remediate --dry-run

# Remediate specific scan
drift-detector remediate --scan-id abc123 --dry-run
```

### 2. Apply Changes

```bash
# Actually apply changes (requires confirmation)
drift-detector remediate --no-dry-run

# Auto-approve safe changes only
drift-detector remediate --no-dry-run --auto-approve
```

### 3. Advanced Options

```bash
# Remediate specific resources
drift-detector remediate \
  --no-dry-run \
  --include web_server \
  --exclude database \
  --max-concurrent 3

# Auto-approve all (dangerous!)
drift-detector remediate \
  --no-dry-run \
  --auto-approve-all
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--scan-id <id>` | Scan ID to remediate | Most recent |
| `--dry-run` | Preview only, don't apply | `true` |
| `--no-dry-run` | Actually apply changes | - |
| `--auto-approve` | Auto-approve safe actions | `false` |
| `--auto-approve-all` | Auto-approve ALL (dangerous!) | `false` |
| `--terraform-dir <path>` | Terraform working directory | `.` |
| `--terraform-bin <path>` | Path to terraform binary | `terraform` |
| `--max-concurrent <n>` | Max parallel remediations | `1` |
| `--continue-on-error` | Continue if action fails | `false` |
| `--no-rollback` | Disable automatic rollback | - |
| `--include <resources...>` | Only remediate these | All |
| `--exclude <resources...>` | Skip these resources | None |
| `--log-dir <path>` | Remediation log directory | `./remediation-logs` |

## Configuration

Add to your `drift-detector.yml`:

```yaml
remediation:
  enabled: true
  dryRun: true                    # Safe by default
  requireApproval: true
  autoApproveForSeverity:
    - safe                        # Only auto-approve tag changes
  backupState: true
  rollbackOnError: true
  
  terraform:
    binaryPath: /usr/local/bin/terraform
    workingDirectory: ./terraform
    varFile: prod.tfvars
  
  execution:
    maxConcurrent: 3
    continueOnError: false
    timeout: 600                  # seconds
  
  filters:
    includeResources:
      - aws_instance.web_*
      - aws_s3_bucket.*
    excludeResources:
      - "*_database"
    maxActionsPerRun: 50
    allowDestructive: false       # Prevent deletions
  
  logging:
    directory: ./remediation-logs
    verbose: true
```

## Remediation Strategies

### Terraform Update
Updates Terraform code to match actual state:

```hcl
# Before
resource "aws_instance" "web" {
  tags = {
    Environment = "dev"
  }
}

# After (automatic update)
resource "aws_instance" "web" {
  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"  # Added
  }
}
```

### Terraform Apply
Applies infrastructure changes via `terraform apply`:

```bash
# Generated commands
terraform plan -target=aws_instance.web
terraform apply -auto-approve -target=aws_instance.web
```

### Manual Intervention
Some changes require manual review:

- Secrets and passwords
- Certificate updates
- Major version upgrades

## Severity Levels

The engine classifies changes by risk:

### Safe ✅
- Tag updates
- Label changes
- Safe to auto-approve

### Low Risk 🟢
- Description updates
- Name changes
- Monitoring settings

### Medium Risk 🟡
- IAM policies
- Encryption settings
- Configuration changes

### High Risk 🔴
- Security groups
- Network changes
- Instance type changes

### Critical ⚠️
- Resource deletions
- Major reconfigurations
- Data-loss risks

## Approval Workflow

### Interactive Approval

```bash
# Start remediation
drift-detector remediate --no-dry-run

# System prompts for approval
> Found 10 actions: 3 safe, 5 require approval, 2 critical
> Proceed with remediation? (yes/no): yes
```

### Programmatic Approval

```typescript
import { RemediationEngine } from 'infrastructure-drift-detector';

const engine = new RemediationEngine({ 
  autoApprove: false 
});

const plan = await engine.createPlan(driftResults, 'scan-123');

// Review actions
const criticalActions = plan.actions.filter(
  a => a.severity === 'critical'
);

// Approve individually
for (const action of criticalActions) {
  if (shouldApprove(action)) {
    await engine.approveAction(action.id, 'admin@example.com');
  }
}

// Execute with approvals
await engine.executePlan(plan);
```

## Rollback

Automatic rollback on failure:

```bash
# Rollback enabled by default
drift-detector remediate --no-dry-run

# Output:
> ✓ aws_instance.web.tags
> ✗ aws_instance.web.instance_type (Failed: Invalid instance type)
> ↶ Rolled back aws_instance.web (restored from backup)
```

### Rollback Process

1. **Backup** - State backed up before change
2. **Apply** - Change attempted
3. **Failure** - Error detected
4. **Restore** - State restored from backup

Backups stored in `.terraform-backup/`:

```
.terraform-backup/
  state-1699900000000.tfstate
  state-1699900001000.tfstate
```

## Logging

Comprehensive logging for audit and debugging:

```
remediation-logs/
  remediation-2025-11-13.json
  remediation-2025-11-14.json
```

### Log Entry Format

```json
{
  "timestamp": "2025-11-13T10:30:00Z",
  "planId": "abc123",
  "actionId": "def456",
  "level": "info",
  "message": "Executing: Update tags on aws_instance.web",
  "metadata": {
    "duration": 1234,
    "resourceName": "aws_instance.web"
  }
}
```

### Log Levels

- **info** - General information
- **success** - Successful operation
- **warn** - Warnings, rollbacks
- **error** - Failures

## Programmatic Usage

### Basic Example

```typescript
import { RemediationEngine } from 'infrastructure-drift-detector';
import { RemediationSeverity } from 'infrastructure-drift-detector';

const engine = new RemediationEngine({
  dryRun: true,
  autoApprove: false,
  requireApprovalFor: [
    RemediationSeverity.MEDIUM_RISK,
    RemediationSeverity.HIGH_RISK,
    RemediationSeverity.CRITICAL
  ],
  terraformWorkDir: './terraform',
  backupBeforeChange: true,
  rollbackOnError: true
});

// Create plan from drift results
const plan = await engine.createPlan(driftResults, 'scan-123');

console.log(`Actions: ${plan.totalActions}`);
console.log(`Safe: ${plan.safeActions}`);
console.log(`Needs approval: ${plan.requiresApproval}`);

// Execute (dry-run)
const results = await engine.executePlan(plan);

console.log(`Success: ${results.filter(r => r.success).length}`);
console.log(`Failed: ${results.filter(r => !r.success).length}`);
```

### Advanced Example

```typescript
// Configure for production
const engine = new RemediationEngine({
  dryRun: false,                   // Live mode
  autoApprove: true,               // Auto-approve safe
  requireApprovalFor: [
    RemediationSeverity.HIGH_RISK,
    RemediationSeverity.CRITICAL
  ],
  maxConcurrent: 5,                // Parallel execution
  continueOnError: true,           // Keep going
  rollbackOnError: true,           // Auto-rollback
  destructiveActionsAllowed: false,
  backupBeforeChange: true,
  logDir: '/var/log/remediation',
  verboseLogging: true,
  
  // Filters
  includeResources: ['aws_instance.*'],
  excludeResources: ['*_database'],
  maxActionsPerRun: 100
});

// Update config dynamically
engine.updateConfig({
  dryRun: false,
  maxConcurrent: 10
});

// Get config
const config = engine.getConfig();
```

## Safety Features

### 1. Dry-Run by Default
All commands default to dry-run mode:

```bash
drift-detector remediate  # Safe preview
```

### 2. Backup Before Change
State automatically backed up:

```
✓ Creating state backup
✓ Applying change
✗ Change failed
↶ Restoring from backup
```

### 3. Approval for Risk
High-risk changes need approval:

```bash
> [HIGH_RISK] Change security group rules
> Approval required. Approve? (yes/no):
```

### 4. No Destructive by Default
Deletions disabled unless explicitly allowed:

```bash
drift-detector remediate --auto-approve-all  # Enables destructive
```

### 5. Resource Filtering
Limit scope of changes:

```bash
drift-detector remediate \
  --include web_server \
  --exclude database \
  --max-actions 10
```

## Best Practices

### 1. Always Dry-Run First

```bash
# Step 1: Preview
drift-detector remediate --dry-run

# Step 2: Review output

# Step 3: Apply if satisfied
drift-detector remediate --no-dry-run
```

### 2. Start with Safe Changes

```bash
# Only auto-approve tags
drift-detector remediate \
  --auto-approve \
  --include "*tags*"
```

### 3. Test on Non-Production

```bash
# Dev environment first
drift-detector remediate \
  --config dev.yml \
  --no-dry-run \
  --auto-approve

# Then production
drift-detector remediate \
  --config prod.yml \
  --no-dry-run
```

### 4. Review Logs

```bash
# Check logs after remediation
cat remediation-logs/remediation-$(date +%Y-%m-%d).json
```

### 5. Incremental Remediation

```bash
# Limit actions per run
drift-detector remediate \
  --max-actions 10 \
  --continue-on-error
```

## Troubleshooting

### Terraform Not Found

```bash
# Specify path
drift-detector remediate \
  --terraform-bin /usr/local/bin/terraform
```

### Permission Denied

```bash
# Check AWS credentials
aws sts get-caller-identity

# Check Terraform access
terraform plan
```

### Rollback Failed

```bash
# Manually restore state
terraform state push .terraform-backup/state-*.tfstate
```

### Action Stuck

```bash
# Set timeout
drift-detector remediate \
  --timeout 300
```

## Examples

See `src/example-remediation.ts` for complete examples:

```bash
npm run example:remediation
```

## Related Commands

- `drift-detector scan` - Detect drift
- `drift-detector history` - View scan history
- `drift-detector report` - Generate reports
- `drift-detector compare` - Compare resources

## API Reference

- [`RemediationEngine`](../src/remediation/engine.ts) - Main engine
- [`RemediationConfig`](../src/remediation/types.ts) - Configuration
- [`RemediationAction`](../src/remediation/types.ts) - Action definition
- [`RemediationPlan`](../src/remediation/types.ts) - Execution plan

---

**Status**: ✅ Fully Implemented (Item #7)  
**Version**: 0.3.0  
**Last Updated**: November 13, 2025
