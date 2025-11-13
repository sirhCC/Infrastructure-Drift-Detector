# Infrastructure Drift Detector - Development Roadmap

## 🔴 HIGH PRIORITY (Core Functionality)

### 1. Cloud Provider Integrations
- [x] **AWS Scanner** - Fetch actual resource state from AWS ✅
  - EC2 instances, S3 buckets, VPCs, Security Groups, RDS
  - Use AWS SDK v3
  - Handle pagination and rate limiting
- [ ] **Azure Scanner** - Fetch actual resource state from Azure
  - VMs, Storage Accounts, Virtual Networks, Resource Groups
  - Use Azure SDK
- [ ] **GCP Scanner** - Fetch actual resource state from GCP
  - Compute instances, Cloud Storage, VPCs
  - Use Google Cloud SDK

### 2. Enhanced Terraform Parser
- [x] Support for nested blocks (ingress/egress rules, etc.) ✅
- [x] Handle Terraform variables and locals ✅
- [x] Parse count and for_each meta-arguments ✅
- [x] Support modules and module calls ✅
- [x] Handle data sources vs resources ✅

### 3. Configuration System
- [x] YAML/JSON config file support ✅
- [x] Environment variable configuration ✅
- [x] Credential management (AWS profiles, service principals) ✅
- [x] Scan schedule configuration ✅
- [x] Resource filtering and exclusion rules ✅

### 4. CLI Tool
- [x] `drift-detector scan` - Run drift detection ✅
- [x] `drift-detector compare` - Compare specific resources ✅
- [x] `drift-detector report` - Generate drift reports ✅
- [x] `drift-detector watch` - Continuous monitoring mode ✅
- [x] Progress indicators and colored output ✅

---

## 🟡 MEDIUM PRIORITY (Enhanced Features)

### 5. Drift Reporting
- [x] JSON output format ✅
- [x] HTML report generation ✅
- [x] CSV export for spreadsheet analysis ✅
- [x] Drift summary statistics ✅
- [x] Historical drift tracking (file-based storage) ✅
- [x] History CLI command for querying past scans ✅
- [x] Scan comparison (show new/fixed/ongoing drift) ✅
- [x] Trend analysis and statistics ✅

### 6. Notification System
- [ ] Slack webhook integration
- [ ] Email notifications (SMTP)
- [ ] Microsoft Teams webhooks
- [ ] Discord webhooks
- [ ] Custom webhook support
- [ ] Notification filtering by severity

### 7. Auto-Remediation Engine
- [ ] Dry-run mode (show what would be fixed)
- [ ] Apply fixes automatically
- [ ] Rollback capability
- [ ] Approval workflow (require confirmation)
- [ ] Remediation logging
- [ ] Support for Terraform apply/plan

### 8. Pulumi Support
- [ ] Parse Pulumi TypeScript programs
- [ ] Parse Pulumi Python programs
- [ ] Parse Pulumi YAML
- [ ] Extract resource state from Pulumi stack exports

### 9. State Management
- [ ] Support Terraform remote state (S3, Azure Blob, GCS)
- [ ] Parse terraform.tfstate files
- [ ] Compare against Terraform state vs actual cloud
- [ ] State file encryption support

---

## 🟢 LOW PRIORITY (Nice to Have)

### 10. Web Dashboard
- [ ] React/Next.js frontend
- [ ] Real-time drift visualization
- [ ] Resource dependency graph
- [ ] Historical trend charts
- [ ] Multi-project support
- [ ] User authentication

### 11. Advanced Detection
- [ ] Machine learning for anomaly detection
- [ ] Predict future drift based on patterns
- [ ] Detect security policy violations
- [ ] Cost impact analysis of drift
- [ ] Compliance checking (CIS, PCI-DSS)

### 12. Integration & Automation
- [ ] GitHub Actions workflow
- [ ] GitLab CI/CD integration
- [ ] Jenkins plugin
- [ ] Azure DevOps extension
- [ ] Terraform Cloud/Enterprise integration

### 13. Multi-Provider Features
- [ ] Cross-cloud resource comparison
- [ ] Multi-account/subscription support
- [ ] Organization-wide scanning
- [ ] Tag-based resource grouping
- [ ] Custom resource matchers

### 14. Documentation & Testing
- [ ] Unit tests for all core modules
- [ ] Integration tests with mock cloud APIs
- [ ] End-to-end testing
- [ ] API documentation
- [ ] Video tutorials
- [ ] Example configurations

### 15. Performance & Scalability
- [ ] Parallel resource scanning
- [ ] Caching layer for cloud API responses
- [ ] Incremental scanning (only changed resources)
- [ ] Database backend for large infrastructures
- [ ] Distributed scanning for multi-region

### 16. Additional IaC Tools
- [ ] CloudFormation support
- [ ] Azure ARM templates
- [ ] Google Deployment Manager
- [ ] Ansible playbook parsing
- [ ] CDK (Cloud Development Kit) support

---

## 📋 Current Status

**Completed:**
- ✅ Basic project structure
- ✅ Core type definitions
- ✅ Basic Terraform parser
- ✅ Drift detection engine
- ✅ Property comparison logic

**In Progress:**
- 🔄 None

**Next Up:**
- 🎯 AWS Scanner (Item #1)

---

## 🎯 Milestone Goals

### v0.1.0 - MVP (Minimum Viable Product)
- AWS scanner + basic Terraform parser + CLI tool

### v0.2.0 - Multi-Cloud
- Azure and GCP scanners + enhanced Terraform support

### v0.3.0 - Automation
- Auto-remediation + notification system + scheduled scanning

### v0.4.0 - Enterprise Ready
- Web dashboard + historical tracking + multi-account support

### v1.0.0 - Production Release
- Full documentation + testing + performance optimization

---

## 📊 Progress Summary

### ✅ Completed (5 of 16 items)
1. ✅ AWS Scanner (Item #1)
2. ✅ Enhanced Terraform Parser (Item #2)
3. ✅ Configuration System (Item #3)
4. ✅ CLI Tool (Item #4)
5. ✅ Drift Reporting (Item #5)

### 🚧 In Progress
- None

### 📋 Next Up
- Item #6: Notification System (Slack, Email, Teams, Discord)

### 📈 Completion Rate
- **HIGH PRIORITY**: 4/4 complete (100%) 🎉
- **MEDIUM PRIORITY**: 1/6 complete (17%)
- **LOW PRIORITY**: 0/6 complete (0%)
- **Overall**: 5/16 complete (31%)

---

**Last Updated:** November 13, 2025
