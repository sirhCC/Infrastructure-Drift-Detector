<div align="center">

# 🔍 Infrastructure Drift Detector

### *Keep your cloud infrastructure in sync with your IaC definitions*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%20%7C%2020-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Progress](https://img.shields.io/badge/Progress-56%25-orange?style=flat-square)](ROADMAP.md)

**Monitor • Detect • Remediate** configuration drift across AWS, Azure, and GCP

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Roadmap](#-roadmap)

</div>

---

## 🎯 Overview

**Infrastructure Drift Detector** helps you maintain infrastructure consistency by comparing your actual cloud resources against Infrastructure-as-Code (IaC) definitions. Prevent security vulnerabilities and operational issues caused by configuration drift.

### Why Drift Detection Matters

- 🛡️ **Security**: Detect unauthorized changes before they become vulnerabilities
- 📊 **Compliance**: Ensure infrastructure matches approved configurations
- 🔄 **Automation**: Auto-remediate drift with approval workflows and rollback
- 📈 **Visibility**: Track drift history and patterns over time

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🌥️ Multi-Cloud & IaC Support
- **Cloud Providers**: AWS, Azure, GCP
- **Terraform**: Full HCL parsing with modules
- **Pulumi**: TypeScript, Python, YAML
- **State Files**: Local & remote (S3, Azure, GCS)

### 🎯 Intelligent Detection
- **Property-Level Drift**: Track exact changes
- **Severity Classification**: Low/Medium/High/Critical
- **Three-Way Comparison**: IaC ↔ State ↔ Cloud
- **Custom Ignore Rules**: Filter noise

</td>
<td width="50%">

### 🤖 Automation & Remediation
- **Auto-Fix**: Apply corrections automatically
- **Approval Workflows**: Multi-reviewer support
- **Rollback**: Automatic failure recovery
- **Scheduled Scans**: Watch mode for monitoring

### 📊 Reporting & Notifications
- **Formats**: HTML, CSV, JSON, Markdown
- **History**: Store and query past scans
- **Alerts**: Slack, Teams, Discord, Email, Webhooks
- **Rich CLI**: 8+ commands for all workflows

</td>
</tr>
</table>

---

## 📦 Installation

```bash
npm install
npm run build
```

---

## 🚀 Quick Start

### 1️⃣ Scan for Drift (Terraform)

```bash
drift-detector scan --terraform ./terraform --config drift-detector.yml
```

### 2️⃣ Scan with State File

```bash
# Local state
drift-detector scan --config config.json --state terraform.tfstate

# S3 remote state
drift-detector scan --config config.json \
  --state-backend s3 \
  --state-bucket my-bucket \
  --state-key terraform.tfstate
```

### 3️⃣ Pulumi Projects

```bash
drift-detector pulumi --dir ./pulumi-project --stack dev
```

### 4️⃣ Auto-Remediate Drift

```bash
# Preview changes (dry-run)
drift-detector remediate --dry-run

# Apply fixes
drift-detector remediate --no-dry-run --auto-approve
```

---

## 💻 CLI Commands

| Command | Description |
|---------|-------------|
| `scan` | Scan infrastructure for drift |
| `compare` | Compare two scan results |
| `report` | Generate drift reports (HTML/CSV/JSON/Markdown) |
| `history` | View and query scan history |
| `watch` | Continuous monitoring mode |
| `remediate` | Auto-fix detected drift |
| `pulumi` | Scan Pulumi projects |

**Full CLI documentation**: [CLI-USAGE.md](./CLI-USAGE.md)

---

## 🔧 Usage Example

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

// Compare with actual cloud state
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

---

## 🏗️ Project Structure

```text
src/
├── cli/              # CLI commands and output
├── config/           # Configuration system
├── detector.ts       # Core drift detection engine
├── notifications/    # Alert integrations
├── parsers/          # IaC parsers (Terraform, Pulumi)
├── reporting/        # History and report generation
├── scanners/         # Cloud provider scanners (AWS)
├── state/            # Terraform state management
└── types.ts          # TypeScript definitions
```

---

## 📖 Documentation

| Guide | Description |
|-------|-------------|
| [🎨 Pulumi Support](./PULUMI-SUPPORT.md) | TypeScript, Python, YAML integration |
| [🤖 Auto-Remediation](./AUTO-REMEDIATION.md) | Automated drift fixing workflows |
| [📢 Notifications](./NOTIFICATION-SYSTEM.md) | Slack, Teams, Discord, Email setup |
| [⚙️ CLI Usage](./CLI-USAGE.md) | Complete command reference |
| [🔐 Dependabot](./.github/DEPENDABOT.md) | Automated security updates |
| [🗺️ Roadmap](./ROADMAP.md) | Feature development plan |

---

## 📊 Roadmap Progress

<div align="center">

### 🎉 **56% Complete** (9 of 16 features)

| Status | Feature | Priority |
|--------|---------|----------|
| ✅ | AWS Scanner | HIGH |
| ✅ | Enhanced Terraform Parser | HIGH |
| ✅ | Configuration System | HIGH |
| ✅ | CLI Tool | HIGH |
| ✅ | Drift Reporting & History | MEDIUM |
| ✅ | Notification System | MEDIUM |
| ✅ | Auto-Remediation Engine | MEDIUM |
| ✅ | Pulumi Support | MEDIUM |
| ✅ | State Management | MEDIUM |
| 🔜 | Web Dashboard | LOW |
| 🔜 | ML-Based Detection | LOW |
| 🔜 | CI/CD Integrations | LOW |

See [ROADMAP.md](./ROADMAP.md) for detailed progress and upcoming features.

</div>

---

## 🤝 Contributing

Contributions welcome! This project is actively developed and follows semantic versioning.

---

## 📄 License

MIT © [sirhCC](https://github.com/sirhCC)

---

<div align="center">

**Made with ❤️ for DevOps and Platform Engineers**

⭐ Star this repo if you find it helpful!

</div>

