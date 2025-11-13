# Auto-Remediation Quick Reference

## Commands

### Dry-Run (Safe Preview)
```bash
drift-detector remediate
```

### Apply Changes
```bash
drift-detector remediate --no-dry-run
```

### Auto-Approve Safe Changes
```bash
drift-detector remediate --no-dry-run --auto-approve
```

### Target Specific Resources
```bash
drift-detector remediate --include web_server --exclude database
```

### With Custom Configuration
```bash
drift-detector remediate --config prod.yml --terraform-dir ./terraform
```

## Severity Levels

| Level | Risk | Examples | Auto-Approve? |
|-------|------|----------|---------------|
| Safe | ✅ None | Tags, labels | Yes |
| Low Risk | 🟢 Minimal | Descriptions, names | Optional |
| Medium Risk | 🟡 Moderate | Policies, encryption | No |
| High Risk | 🔴 High | Security groups, networking | No |
| Critical | ⚠️ Severe | Deletions, major changes | No |

## Strategies

| Strategy | Description | Example |
|----------|-------------|---------|
| Terraform Update | Update IaC code | Modify .tf files |
| Terraform Apply | Apply to infrastructure | Run `terraform apply` |
| Manual | Requires human action | Secrets, certificates |

## Configuration (drift-detector.yml)

```yaml
remediation:
  enabled: true
  dryRun: true
  autoApproveForSeverity:
    - safe
  rollbackOnError: true
  terraform:
    workingDirectory: ./terraform
  execution:
    maxConcurrent: 3
  filters:
    allowDestructive: false
```

## Programmatic Usage

```typescript
import { RemediationEngine } from 'infrastructure-drift-detector';

const engine = new RemediationEngine({
  dryRun: false,
  autoApprove: true,
  rollbackOnError: true
});

const plan = await engine.createPlan(driftResults, 'scan-123');
const results = await engine.executePlan(plan);
```

## Safety Features

- ✅ Dry-run by default
- ✅ Approval for risky changes
- ✅ Automatic state backup
- ✅ Rollback on failure
- ✅ Resource filtering
- ✅ Comprehensive logging

## Common Workflows

### 1. Safe Remediation
```bash
# Step 1: Scan
drift-detector scan --terraform ./terraform

# Step 2: Preview
drift-detector remediate --dry-run

# Step 3: Apply safe only
drift-detector remediate --no-dry-run --auto-approve
```

### 2. Full Remediation
```bash
# Preview
drift-detector remediate --dry-run

# Apply (with confirmation)
drift-detector remediate --no-dry-run
```

### 3. Targeted Remediation
```bash
# Specific resource
drift-detector remediate --include aws_instance.web --no-dry-run

# Exclude sensitive resources
drift-detector remediate --exclude *_database --no-dry-run
```

## Logs

Location: `./remediation-logs/remediation-YYYY-MM-DD.json`

View logs:
```bash
cat remediation-logs/remediation-$(date +%Y-%m-%d).json | jq
```

## Troubleshooting

### Terraform not found
```bash
drift-detector remediate --terraform-bin /usr/local/bin/terraform
```

### Rollback failed
```bash
terraform state push .terraform-backup/state-*.tfstate
```

### Too many actions
```bash
drift-detector remediate --max-actions 10
```

## See Also

- [AUTO-REMEDIATION.md](./AUTO-REMEDIATION.md) - Full documentation
- [ROADMAP.md](./ROADMAP.md) - Feature roadmap
- [CLI-USAGE.md](./CLI-USAGE.md) - All CLI commands
