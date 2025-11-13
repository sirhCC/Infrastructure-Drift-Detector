# Infrastructure Drift Detector

Monitor cloud infrastructure for configuration drift from IaC definitions with automated detection and remediation.

## 🎯 Overview

Infrastructure Drift Detector compares your actual cloud resources against Infrastructure-as-Code (IaC) definitions to identify configuration drift. It helps maintain infrastructure consistency and prevents configuration drift that can lead to security vulnerabilities or operational issues.

## 🚀 Features

- **Multi-Cloud Support**: AWS, Azure, and GCP
- **IaC Parsers**: Terraform and Pulumi support (TypeScript, Python, YAML)
- **Drift Detection**: Identifies added, removed, and modified properties
- **Severity Classification**: Automatic severity rating (low/medium/high/critical)
- **Auto-Remediation**: Automatically fix drift with approval workflows and rollback
- **Historical Tracking**: Store and analyze drift history over time
- **Rich CLI**: Scan, compare, report, watch, remediate, pulumi, and query history
- **Multiple Report Formats**: HTML, CSV, JSON, and Markdown
- **Notification System**: Slack, Email, Teams, Discord, and custom webhooks
- **Dependabot**: Automated dependency updates and security monitoring
- **TypeScript**: Fully typed for better developer experience

## 📦 Installation

```bash
npm install
```

## 🏗️ Project Structure

```
src/
├── index.ts              # Main entry point
├── types.ts              # Core type definitions
├── detector.ts           # Drift detection engine
└── parsers/
    └── terraform.ts      # Terraform HCL parser
```

## 🔧 Usage

### Basic Example

```typescript
import { DriftDetector, TerraformParser } from 'infrastructure-drift-detector';

// Parse Terraform files
const parser = new TerraformParser();
const iacDefinition = parser.parse('./infrastructure/main.tf');

// Create detector
const detector = new DriftDetector({
  providers: ['aws'],
  ignoreProperties: ['last_modified', 'created_at']
});

// Compare with actual state (you'll need to fetch this from your cloud provider)
const actualResources = []; // Fetch from AWS/Azure/GCP
const driftResults = detector.detectDrift(
  iacDefinition.resources,
  actualResources
);

// Review results
driftResults.forEach(result => {
  if (result.hasDrift) {
    console.log(`Drift detected in ${result.resourceName}:`);
    result.driftedProperties.forEach(prop => {
      console.log(`  ${prop.propertyPath}: ${prop.expectedValue} → ${prop.actualValue}`);
    });
  }
});
```

## 🛠️ Development

Build the project:
```bash
npm run build
```

Watch mode for development:
```bash
npm run dev
```

## 📝 Commands

### Scan for Drift
```bash
# Terraform
drift-detector scan --terraform ./terraform --config drift-detector.yml

# Pulumi
drift-detector pulumi --dir ./pulumi-project --stack dev
```

### Remediate Drift (Dry-Run)
```bash
drift-detector remediate --dry-run
```

### Remediate Drift (Apply)
```bash
drift-detector remediate --no-dry-run --auto-approve
```

### View History
```bash
drift-detector history --list
drift-detector history --stats
```

### Generate Reports
```bash
drift-detector report --format html
drift-detector report --format csv
```

## 📖 Documentation

- [Pulumi Support](./PULUMI-SUPPORT.md) - Pulumi integration guide
- [Auto-Remediation Guide](./AUTO-REMEDIATION.md) - Complete remediation documentation
- [Notification System](./NOTIFICATION-SYSTEM.md) - Setup notifications
- [CLI Usage](./CLI-USAGE.md) - All CLI commands
- [Dependabot Setup](./.github/DEPENDABOT.md) - Automated dependency updates
- [Roadmap](./ROADMAP.md) - Feature roadmap

## 🎯 Progress

**Completed Features (7/16 - 44%)**:
- ✅ AWS Scanner
- ✅ Enhanced Terraform Parser
- ✅ Configuration System
- ✅ CLI Tool
- ✅ Drift Reporting & History
- ✅ Notification System
- ✅ Auto-Remediation Engine

See [ROADMAP.md](./ROADMAP.md) for detailed progress.

## 📄 License

MIT



**sirhCC**

---

