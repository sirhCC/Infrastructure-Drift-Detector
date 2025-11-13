# Pulumi Support

The Infrastructure Drift Detector now supports Pulumi projects in addition to Terraform!

## Overview

Pulumi is a modern Infrastructure as Code platform that allows you to define cloud infrastructure using familiar programming languages like TypeScript, Python, Go, and YAML.

This drift detector can:
- Parse Pulumi programs in **TypeScript**, **Python**, and **YAML**
- Extract resource definitions from your code
- Compare against actual cloud state
- Detect configuration drift
- Support Pulumi stack exports for accurate state comparison

## Supported Languages

### ✅ TypeScript / JavaScript
```typescript
import * as aws from "@pulumi/aws";

const bucket = new aws.s3.Bucket("my-bucket", {
    acl: "private",
    tags: {
        Environment: "production"
    }
});
```

### ✅ Python
```python
import pulumi_aws as aws

bucket = aws.s3.Bucket("my-bucket",
    acl="private",
    tags={
        "Environment": "production"
    }
)
```

### ✅ YAML
```yaml
resources:
  my-bucket:
    type: aws:s3/bucket:Bucket
    properties:
      acl: private
      tags:
        Environment: production
```

## Usage

### Basic Scan

Scan a Pulumi project for drift:

```bash
drift-detector pulumi --dir ./my-pulumi-project --stack dev
```

### With Stack Export

For the most accurate drift detection, use a stack export:

```bash
# First, export your stack state
cd my-pulumi-project
pulumi stack export --file stack-export.json

# Then run drift detection
drift-detector pulumi --dir . --stack dev --export stack-export.json
```

### Options

```bash
drift-detector pulumi [options]

Options:
  -d, --dir <directory>     Pulumi project directory (default: current directory)
  -s, --stack <name>        Stack name: dev, prod, etc. (default: "dev")
  -e, --export <file>       Path to stack export JSON file
  --include-export          Include stack export in analysis
  -p, --provider <provider> Cloud provider: aws, azure, gcp (default: "aws")
  -r, --region <region>     AWS region (default: "us-east-1")
  --profile <profile>       AWS profile name
  -o, --output <format>     Output format: json, table, summary (default: "table")
  -h, --help                Display help
```

## CLI Commands

### Scan Command
```bash
# Scan current directory
drift-detector pulumi

# Scan specific directory and stack
drift-detector pulumi -d ./infra -s production

# Use specific AWS profile
drift-detector pulumi --profile prod-account --region us-west-2

# JSON output
drift-detector pulumi -o json > drift-report.json
```

## How It Works

### 1. Project Parsing

The detector automatically detects your Pulumi project language by reading `Pulumi.yaml`:

```yaml
name: my-infrastructure
runtime: nodejs  # or python, yaml, go, dotnet
description: Production infrastructure
```

### 2. Resource Extraction

**TypeScript/JavaScript**: Uses regex pattern matching to identify resource instantiations:
```typescript
new aws.ec2.Instance("web-server", {...})
new aws.s3.Bucket("data-bucket", {...})
```

**Python**: Parses Python syntax for resource declarations:
```python
web_server = aws.ec2.Instance("web-server", ...)
data_bucket = aws.s3.Bucket("data-bucket", ...)
```

**YAML**: Parses the declarative YAML format:
```yaml
resources:
  web-server:
    type: aws:ec2/instance:Instance
    properties: {...}
```

### 3. Stack Export (Recommended)

Stack exports provide the actual deployed state:

```bash
pulumi stack export --file stack-export.json
```

This JSON file contains:
- All deployed resources
- Current resource properties (outputs)
- Resource URNs and IDs
- Dependency graph

### 4. Cloud Scanning

The detector scans your actual cloud provider (AWS, Azure, GCP) to get the current resource state.

### 5. Drift Analysis

Compares:
- **Expected**: Resources defined in your Pulumi code
- **Actual**: Resources in your cloud account
- **Stack State**: Resources in Pulumi's state (if using export)

## Configuration Variables

Pulumi configuration values are automatically resolved:

**Pulumi.<stack>.yaml:**
```yaml
config:
  aws:region: us-west-2
  myapp:instanceType: t3.micro
```

**TypeScript:**
```typescript
const config = new pulumi.Config();
const instanceType = config.require("instanceType");

new aws.ec2.Instance("server", {
    instanceType: instanceType,  // Resolves to "t3.micro"
    ...
});
```

## Resource Mapping

The detector maps Pulumi resource types to our common format:

| Pulumi Type | Cloud Provider | Resource Type |
|-------------|---------------|---------------|
| `aws:ec2/instance:Instance` | AWS | compute |
| `aws:s3/bucket:Bucket` | AWS | storage |
| `aws:ec2/vpc:Vpc` | AWS | network |
| `aws:rds/instance:Instance` | AWS | database |
| `azure:compute/virtualMachine:VirtualMachine` | Azure | compute |
| `gcp:compute/instance:Instance` | GCP | compute |

## Examples

### Detect Drift in TypeScript Project

```bash
# Project structure:
# my-pulumi-app/
#   ├── Pulumi.yaml
#   ├── Pulumi.dev.yaml
#   ├── index.ts
#   └── package.json

drift-detector pulumi --dir ./my-pulumi-app --stack dev
```

### Detect Drift with Stack Export

```bash
# Export stack
cd my-pulumi-app
pulumi stack export --file stack-export.json

# Detect drift
drift-detector pulumi --dir . --export stack-export.json
```

### Python Project

```bash
# Project structure:
# infra/
#   ├── Pulumi.yaml
#   ├── Pulumi.prod.yaml
#   ├── __main__.py
#   └── requirements.txt

drift-detector pulumi --dir ./infra --stack prod --profile production
```

### YAML Project

```bash
# Project structure:
# simple-infra/
#   ├── Pulumi.yaml (with resources section)
#   └── Pulumi.dev.yaml

drift-detector pulumi --dir ./simple-infra --stack dev
```

## Output Formats

### Table (Default)
```
╔═══════════════════════════════════════════════════════╗
║  Pulumi Drift Detection Results                      ║
╚═══════════════════════════════════════════════════════╝

Project: /path/to/my-pulumi-project
Stack: dev
Provider: AWS

⚠ Found 2 drifted resources:

Resource: my-bucket
  ID: aws:s3/bucket:Bucket::my-bucket
  Severity: medium
  Drifted Properties: 1

    acl:
      Expected: "private"
      Actual: "public-read"
```

### JSON
```json
[
  {
    "resourceId": "aws:s3/bucket:Bucket::my-bucket",
    "resourceName": "my-bucket",
    "hasDrift": true,
    "driftedProperties": [
      {
        "propertyPath": "acl",
        "expectedValue": "private",
        "actualValue": "public-read",
        "changeType": "modified"
      }
    ],
    "detectedAt": "2025-11-13T10:30:00.000Z",
    "severity": "medium"
  }
]
```

## Limitations

### Current Limitations
- **Static Analysis**: Parses code statically (doesn't execute it)
- **Complex Expressions**: May not resolve all dynamic values
- **Go/C#/Java**: Not yet supported (planned)
- **Component Resources**: Basic support only
- **Transformations**: Not analyzed

### Workarounds
1. **Use Stack Exports**: Most accurate method
2. **Simple Configurations**: Keep resource definitions straightforward
3. **Explicit Values**: Use literals where possible

## Best Practices

1. **Always use stack exports** for production environments
2. **Keep configuration files** in version control
3. **Run drift detection** as part of CI/CD
4. **Review drift regularly** (daily or weekly)
5. **Document exceptions** for known drift

## Troubleshooting

### "Could not find main program file"
- Ensure your project has `index.ts`, `__main__.py`, or resources in `Pulumi.yaml`
- Check the `main` field in `Pulumi.yaml`

### "Stack export file not found"
- Run `pulumi stack export --file stack-export.json`
- Or specify path with `--export`

### "Invalid stack export format"
- Ensure you're using Pulumi CLI v3.0+
- Re-export: `pulumi stack export --file stack-export.json`

### "Unsupported Pulumi language"
- Currently supports: TypeScript, Python, YAML
- Go, C#, Java support coming soon

## Advanced Usage

### Programmatic API

```typescript
import { PulumiAdapter } from './parsers/pulumi-adapter';
import { DriftDetector } from './detector';

const adapter = new PulumiAdapter();
const iacDef = await adapter.parseToIaCDefinition({
  projectDir: './my-pulumi-project',
  stackName: 'dev',
  includeStackExport: true,
  stackExportPath: './stack-export.json',
});

const detector = new DriftDetector({ providers: ['aws'] });
const results = detector.detectDrift(iacDef.resources, actualResources);
```

## Contributing

To add support for more Pulumi features:

1. **parsers/pulumi-typescript.ts** - TypeScript/JavaScript parsing
2. **parsers/pulumi-python.ts** - Python parsing
3. **parsers/pulumi-yaml.ts** - YAML parsing
4. **parsers/pulumi.ts** - Main orchestrator
5. **parsers/pulumi-adapter.ts** - Resource conversion

## Related Documentation

- [Pulumi Documentation](https://www.pulumi.com/docs/)
- [Terraform Support](./TERRAFORM-PARSER.md)
- [Auto-Remediation](./AUTO-REMEDIATION.md)
- [CLI Usage](./CLI-USAGE.md)
