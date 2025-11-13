# CLI Usage Guide

## Installation

```bash
npm install -g infrastructure-drift-detector
```

Or run locally:
```bash
npm run build
node dist/cli/index.js
```

## Commands

### `drift-detector scan`

Scan infrastructure and detect configuration drift.

**Options:**
- `-c, --config <path>` - Path to configuration file
- `-p, --provider <provider>` - Cloud provider (aws, azure, gcp)
- `-r, --region <region>` - Cloud provider region
- `-t, --terraform <path>` - Path to Terraform directory or file
- `--format <format>` - Output format (text, json)
- `--severity <level>` - Minimum severity to report (low, medium, high, critical)
- `--no-history` - Skip saving scan results to history
- `--history-dir <path>` - Directory for storing drift history (default: ./drift-history)
- `--show-comparison` - Show comparison with previous scan

**Examples:**

```bash
# Basic scan with default settings
drift-detector scan

# Scan with custom Terraform path
drift-detector scan --terraform ./infrastructure

# Scan specific region
drift-detector scan --region us-west-2

# Output as JSON
drift-detector scan --format json

# Only show high and critical drift
drift-detector scan --severity high

# Use custom configuration file
drift-detector scan --config ./my-config.yml

# Compare with previous scan
drift-detector scan --show-comparison

# Don't save to history
drift-detector scan --no-history

# Use custom history directory
drift-detector scan --history-dir /path/to/history
```

---

### `drift-detector compare`

Compare two infrastructure states.

**Usage:**
```bash
drift-detector compare <source> [target]
```

**Options:**
- `-p, --provider <provider>` - Cloud provider for target
- `-r, --region <region>` - Cloud provider region
- `--format <format>` - Output format (text, json)
- `--ignore <properties...>` - Properties to ignore

**Examples:**

```bash
# Compare two Terraform directories
drift-detector compare ./infrastructure-old ./infrastructure-new

# Compare two state files
drift-detector compare state-before.json state-after.json

# Ignore specific properties
drift-detector compare ./infra1 ./infra2 --ignore last_modified created_at
```

---

### `drift-detector report`

Generate drift detection reports.

**Usage:**
```bash
drift-detector report [input]
```

**Options:**
- `-f, --format <format>` - Output format (html, csv, markdown)
- `-o, --output <path>` - Output file path
- `--title <title>` - Report title

**Examples:**

```bash
# Generate HTML report
drift-detector report drift-results.json --format html --output report.html

# Generate CSV report
drift-detector report drift-results.json --format csv --output report.csv

# Generate Markdown report
drift-detector report drift-results.json --format markdown

# Custom title
drift-detector report results.json --title "Production Drift Report"
```

---

### `drift-detector watch`

Continuously monitor infrastructure for drift.

**Options:**
- `-c, --config <path>` - Path to configuration file
- `-i, --interval <minutes>` - Scan interval in minutes (default: 60)
- `-p, --provider <provider>` - Cloud provider
- `-t, --terraform <path>` - Path to Terraform directory
- `--severity <level>` - Minimum severity to report

**Examples:**

```bash
# Watch with default interval (60 minutes)
drift-detector watch

# Watch with custom interval
drift-detector watch --interval 30

# Watch specific terraform directory
drift-detector watch --terraform ./prod-infrastructure

# Only alert on critical and high severity
drift-detector watch --severity high --interval 15
```

---

### `drift-detector history`

View and analyze drift detection history.

**Options:**
- `--dir <path>` - Directory for drift history (default: ./drift-history)
- `--list` - List recent scans
- `--stats` - Show statistics
- `--scan <id>` - Show details for specific scan
- `--limit <number>` - Number of scans to show (default: 10)
- `--provider <provider>` - Filter by provider
- `--export <path>` - Export history to JSON file
- `--clear` - Clear all history

**Examples:**

```bash
# List recent scans
drift-detector history --list

# Show statistics
drift-detector history --stats

# View specific scan details
drift-detector history --scan scan_1234567890_abcdef

# Limit results
drift-detector history --list --limit 5

# Filter by provider
drift-detector history --provider aws

# Export history
drift-detector history --export backup.json

# Use custom history directory
drift-detector history --dir /path/to/history --stats
```

---

### `drift-detector init`

Initialize a new drift detector configuration.

**Options:**
- `-f, --format <format>` - Configuration format (yaml, json)

**Examples:**

```bash
# Initialize with YAML config
drift-detector init

# Initialize with JSON config
drift-detector init --format json
```

---

## Workflow Examples

### Daily Drift Monitoring

```bash
# 1. Initialize configuration
drift-detector init

# 2. Edit drift-detector.yml with your settings

# 3. Run initial scan
drift-detector scan --terraform ./infrastructure

# 4. Start continuous monitoring
drift-detector watch --interval 360  # Every 6 hours
```

### CI/CD Integration

```bash
# In your CI/CD pipeline
drift-detector scan \
  --terraform ./terraform \
  --format json \
  --severity medium \
  > drift-results.json

# Generate report
drift-detector report drift-results.json \
  --format html \
  --output drift-report.html

# Fail build if critical drift found
if [ $? -ne 0 ]; then
  echo "Critical drift detected!"
  exit 1
fi
```

### Compare Before/After Changes

```bash
# Before applying changes
drift-detector scan --format json > before.json

# Apply your infrastructure changes
terraform apply

# After applying changes
drift-detector scan --format json > after.json

# Compare
drift-detector compare before.json after.json
```

---

## Exit Codes

- `0` - Success, no drift detected
- `1` - Drift detected or command failed

---

## Configuration File

See `examples/config/drift-detector.yml` for a complete configuration example.

Key sections:
- `providers` - Cloud provider settings
- `terraform` - Terraform configuration
- `scan` - Scanning behavior
- `drift` - Drift detection rules
- `notifications` - Alert configuration
- `reporting` - Report settings

---

## Tips

1. **Use configuration files** for consistent settings across teams
2. **Set severity thresholds** to reduce noise (e.g., `--severity medium`)
3. **Ignore transient properties** like timestamps and status fields
4. **Schedule regular scans** using `watch` mode or cron jobs
5. **Generate reports** for auditing and compliance
6. **Integrate with CI/CD** to catch drift early

---

## Troubleshooting

**"Configuration validation failed"**
- Ensure at least one provider is enabled
- Check that required credentials are set

**"Failed to parse Terraform configuration"**
- Verify the Terraform path exists
- Ensure .tf files are valid HCL syntax

**"Scan failed"**
- Check cloud provider credentials
- Verify network connectivity
- Ensure proper IAM permissions

---

For more information, see the main README.md
