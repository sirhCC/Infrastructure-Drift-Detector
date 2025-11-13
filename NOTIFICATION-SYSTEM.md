# Notification System - Implementation Summary

## Overview
Comprehensive notification system that sends drift detection alerts to multiple channels including Slack, Email (SMTP), Microsoft Teams, Discord, and custom webhooks.

## Completed Features

### 1. Notification Channels (5 integrations)

#### Slack
- Webhook integration with custom formatting
- Channel, username, and emoji customization
- Colored attachments based on severity
- Top drifted resources summary

#### Email (SMTP)
- Full HTML and plain text email support
- Configurable SMTP settings
- Support for multiple recipients (to, cc)
- Beautiful HTML email template with severity badges
- Resource summaries and detailed breakdowns

#### Microsoft Teams
- Incoming webhook integration
- MessageCard format with themed colors
- Fact-based presentation
- Activity tracking with timestamps

#### Discord
- Webhook integration with embeds
- Custom username and avatar
- Color-coded embeds by severity
- Timestamp tracking

#### Custom Webhook
- Generic HTTP webhook support
- Multiple authentication methods:
  - Bearer token
  - Basic authentication
  - API key (custom header)
- Custom headers support
- Configurable HTTP method (POST/PUT)

### 2. Notification Manager

**Class**: `NotificationManager`

**Key Features**:
- Multi-channel notification dispatch
- Automatic severity counting
- Drift percentage calculation
- Filter support:
  - Severity filter (only notify for specific severities)
  - Minimum drift percentage threshold
  - New drift only (filter out ongoing drift)
- Channel success/failure tracking
- Test notification support

**Methods**:
- `notify()` - Send notifications to all enabled channels
- `testChannel()` - Test specific notification channel

### 3. Configuration Integration

Updated configuration types to support:
- Per-channel configuration
- Severity-based filtering
- Drift percentage thresholds
- New drift detection
- Multiple notification channels simultaneously

**Configuration Location**: 
- YAML/JSON config files
- Environment variables (via ConfigLoader)

### 4. CLI Integration

Integrated with `drift-detector scan` command:
- Automatically sends notifications after scan completion
- Shows notification status (succeeded/failed)
- Error reporting for failed notifications
- Scan metadata included (scanId, duration, etc.)

### 5. Examples & Documentation

**Files Created**:
- `src/example-notifications.ts` - Code examples for all channels
- `examples/config/notifications.md` - Complete configuration guide

**Documentation Includes**:
- Setup instructions for each channel
- Configuration examples (YAML/JSON)
- Environment variable setup
- Multiple channel configuration
- Filter configuration
- Testing notifications
- Complete payload structure

## File Structure

```
src/
├── notifications/
│   ├── types.ts              # Notification type definitions
│   ├── index.ts              # NotificationManager (orchestrator)
│   ├── slack.ts              # Slack webhook notifier
│   ├── email.ts              # Email (SMTP) notifier
│   ├── teams.ts              # Microsoft Teams notifier
│   ├── discord.ts            # Discord webhook notifier
│   └── webhook.ts            # Custom webhook notifier
├── example-notifications.ts  # Usage examples
└── config/
    └── types.ts              # Updated with notification config

examples/
└── config/
    └── notifications.md      # Complete documentation
```

## Configuration Example

```yaml
notifications:
  enabled: true
  
  channels:
    slack:
      webhookUrl: "https://hooks.slack.com/services/..."
      channel: "#infrastructure-alerts"
      username: "Drift Detector"
      iconEmoji: ":warning:"
    
    email:
      smtp:
        host: "smtp.gmail.com"
        port: 587
        secure: false
        auth:
          user: "alerts@company.com"
          pass: "app-password"
      from: "drift-detector@company.com"
      to:
        - "devops-team@company.com"
    
    teams:
      webhookUrl: "https://outlook.office.com/webhook/..."
    
    discord:
      webhookUrl: "https://discord.com/api/webhooks/..."
  
  filters:
    severityFilter: ["high", "critical"]
    minDriftPercentage: 5
    onlyOnNewDrift: true
```

## Usage

### Via Configuration File

```bash
drift-detector scan --config drift-detector.yml
```

### Programmatic Usage

```typescript
import { NotificationManager } from './notifications';

const notificationManager = new NotificationManager({
  enabled: true,
  channels: [
    {
      type: 'slack',
      enabled: true,
      config: {
        webhookUrl: 'https://hooks.slack.com/services/...',
        channel: '#alerts',
      },
    },
  ],
  severityFilter: ['high', 'critical'],
});

const results = await notificationManager.notify(driftResults, {
  provider: 'aws',
  region: 'us-east-1',
  totalResources: 50,
});
```

## Notification Payload Structure

All channels receive a standardized payload:

```typescript
{
  timestamp: Date,
  provider: string,
  region?: string,
  totalResources: number,
  driftedResources: number,
  driftPercentage: number,
  severityCounts: {
    critical: number,
    high: number,
    medium: number,
    low: number,
  },
  driftResults: DriftResult[],
  scanDuration?: number,
  scanId?: string,
}
```

## Dependencies Added

- `nodemailer@^6.9.7` - SMTP email support
- `@types/nodemailer@^6.4.14` - TypeScript types

## Testing

Test individual channels:

```typescript
const manager = new NotificationManager(config);
const success = await manager.testChannel('slack');
```

## Error Handling

- Each channel handles errors independently
- Failed notifications don't block other channels
- Detailed error messages returned in results
- CLI displays success/failure counts

## Security Considerations

- Webhook URLs should be stored as environment variables
- Email credentials use app passwords, not account passwords
- API keys support custom header names
- Authentication tokens never logged

## Roadmap Item Status

**Item #6: Notification System** - ✅ COMPLETE

- [x] Slack webhook integration
- [x] Email notifications (SMTP)
- [x] Microsoft Teams webhooks
- [x] Discord webhooks
- [x] Custom webhook support
- [x] Notification filtering by severity

## Future Enhancements (Optional)

- Rate limiting for high-frequency scans
- Notification templates/customization
- Notification scheduling/quiet hours
- Retry logic with exponential backoff
- PagerDuty integration
- SMS notifications via Twilio
- Notification aggregation (batch alerts)
