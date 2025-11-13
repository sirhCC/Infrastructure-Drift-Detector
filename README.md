# Infrastructure Drift Detector

Monitor cloud infrastructure for configuration drift from IaC definitions with automated detection and remediation.

## 🎯 Overview

Infrastructure Drift Detector compares your actual cloud resources against Infrastructure-as-Code (IaC) definitions to identify configuration drift. It helps maintain infrastructure consistency and prevents configuration drift that can lead to security vulnerabilities or operational issues.

## 🚀 Features

- **Multi-Cloud Support**: AWS, Azure, and GCP
- **IaC Parser**: Terraform support (Pulumi coming soon)
- **Drift Detection**: Identifies added, removed, and modified properties
- **Severity Classification**: Automatic severity rating (low/medium/high/critical)
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

## 📝 Roadmap

- [ ] AWS resource scanner integration
- [ ] Azure resource scanner integration
- [ ] GCP resource scanner integration
- [ ] Auto-remediation engine
- [ ] Notification system (Slack, email, webhooks)
- [ ] Web dashboard
- [ ] CLI tool
- [ ] Pulumi parser
- [ ] Drift history tracking

## 📄 License

MIT

## 👤 Author

**sirhCC**

---

Built with TypeScript and ❤️
