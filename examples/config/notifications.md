# Notification Configuration Examples

## Slack Webhook

```yaml
notifications:
  enabled: true
  channels:
    slack:
      webhookUrl: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
      channel: "#infrastructure-alerts"
      username: "Drift Detector"
      iconEmoji: ":warning:"
  filters:
    severityFilter: ["high", "critical"]
    minDriftPercentage: 5
```

To get a Slack webhook URL:
1. Go to https://api.slack.com/apps
2. Create a new app or select existing
3. Enable "Incoming Webhooks"
4. Add webhook to workspace
5. Copy the webhook URL

---

## Email (SMTP)

```yaml
notifications:
  enabled: true
  channels:
    email:
      smtp:
        host: "smtp.gmail.com"
        port: 587
        secure: false
        auth:
          user: "your-email@gmail.com"
          pass: "your-app-password"
      from: "drift-detector@company.com"
      to:
        - "devops-team@company.com"
        - "infrastructure@company.com"
      cc:
        - "manager@company.com"
      subject: "[Infrastructure] Drift Detected"
```

For Gmail:
1. Enable 2FA on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password instead of your regular password

For Office 365:
```yaml
smtp:
  host: "smtp.office365.com"
  port: 587
  secure: false
```

---

## Microsoft Teams

```yaml
notifications:
  enabled: true
  channels:
    teams:
      webhookUrl: "https://outlook.office.com/webhook/YOUR/WEBHOOK/URL"
  filters:
    severityFilter: ["critical"]
```

To get a Teams webhook:
1. Open Microsoft Teams
2. Navigate to the channel
3. Click "..." → "Connectors"
4. Find "Incoming Webhook" and configure
5. Copy the webhook URL

---

## Discord

```yaml
notifications:
  enabled: true
  channels:
    discord:
      webhookUrl: "https://discord.com/api/webhooks/YOUR/WEBHOOK/URL"
      username: "Infrastructure Monitor"
      avatarUrl: "https://example.com/avatar.png"
```

To create a Discord webhook:
1. Open Discord server settings
2. Go to "Integrations" → "Webhooks"
3. Click "New Webhook"
4. Customize name and channel
5. Copy webhook URL

---

## Custom Webhook

### Bearer Token Authentication

```yaml
notifications:
  enabled: true
  channels:
    webhook:
      url: "https://api.yourcompany.com/drift-alerts"
      method: "POST"
      headers:
        Content-Type: "application/json"
        X-Custom-Header: "value"
      authentication:
        type: "bearer"
        token: "your-api-token"
```

### Basic Authentication

```yaml
notifications:
  enabled: true
  channels:
    webhook:
      url: "https://api.yourcompany.com/alerts"
      authentication:
        type: "basic"
        username: "api-user"
        password: "api-password"
```

### API Key Authentication

```yaml
notifications:
  enabled: true
  channels:
    webhook:
      url: "https://api.yourcompany.com/webhooks"
      authentication:
        type: "api-key"
        headerName: "X-API-Key"
        token: "your-api-key-here"
```

---

## Multiple Channels

```yaml
notifications:
  enabled: true
  channels:
    slack:
      webhookUrl: "https://hooks.slack.com/services/..."
      channel: "#critical-alerts"
    
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
        - "team@company.com"
    
    teams:
      webhookUrl: "https://outlook.office.com/webhook/..."
    
    discord:
      webhookUrl: "https://discord.com/api/webhooks/..."
  
  filters:
    severityFilter: ["high", "critical"]
    minDriftPercentage: 10
    onlyOnNewDrift: true
```

---

## Notification Filters

### Severity Filter

Only notify for specific severity levels:

```yaml
filters:
  severityFilter: ["high", "critical"]  # Only high and critical
```

### Minimum Drift Percentage

Only notify if drift percentage exceeds threshold:

```yaml
filters:
  minDriftPercentage: 5  # Only if >= 5% of resources have drift
```

### New Drift Only

Only notify when new drift is detected (not ongoing):

```yaml
filters:
  onlyOnNewDrift: true
```

### Combined Filters

```yaml
filters:
  severityFilter: ["critical"]
  minDriftPercentage: 1
  onlyOnNewDrift: true
  resources:
    - "production-*"
    - "critical-*"
```

---

## Environment Variables

You can also configure notifications via environment variables:

```bash
# Slack
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
export SLACK_CHANNEL="#infrastructure"
export SLACK_USERNAME="Drift Detector"

# Email
export EMAIL_HOST="smtp.gmail.com"
export EMAIL_PORT="587"
export EMAIL_USER="your-email@gmail.com"
export EMAIL_PASS="your-app-password"
export EMAIL_FROM="drift-detector@company.com"
export EMAIL_TO="team@company.com,alerts@company.com"

# Teams
export TEAMS_WEBHOOK_URL="https://outlook.office.com/webhook/..."

# Discord
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

---

## Testing Notifications

Test your notification configuration before running a scan:

```bash
# Test specific channel
drift-detector test-notification --channel slack

# Test all configured channels
drift-detector test-notification --all
```

---

## Notification Payload

The notification payload sent to all channels includes:

```json
{
  "timestamp": "2025-11-13T10:30:00Z",
  "provider": "aws",
  "region": "us-east-1",
  "totalResources": 50,
  "driftedResources": 5,
  "driftPercentage": 10.0,
  "severityCounts": {
    "critical": 1,
    "high": 2,
    "medium": 1,
    "low": 1
  },
  "driftResults": [
    {
      "resourceId": "i-1234567890abcdef0",
      "resourceName": "web-server-prod",
      "hasDrift": true,
      "severity": "high",
      "driftedProperties": [
        {
          "propertyPath": "instance_type",
          "expectedValue": "t3.medium",
          "actualValue": "t3.large",
          "changeType": "modified"
        }
      ],
      "detectedAt": "2025-11-13T10:30:00Z"
    }
  ],
  "scanDuration": 5000,
  "scanId": "scan-20251113-103000"
}
```

---

## Complete Configuration Example

```yaml
# drift-detector.yml
notifications:
  enabled: true
  
  channels:
    # Slack for immediate team alerts
    slack:
      webhookUrl: "${SLACK_WEBHOOK_URL}"
      channel: "#infrastructure-drift"
      username: "Drift Detector"
      iconEmoji: ":warning:"
    
    # Email for management reports
    email:
      smtp:
        host: "${EMAIL_HOST}"
        port: 587
        secure: false
        auth:
          user: "${EMAIL_USER}"
          pass: "${EMAIL_PASS}"
      from: "drift-detector@company.com"
      to:
        - "devops@company.com"
        - "infrastructure-team@company.com"
      cc:
        - "engineering-manager@company.com"
      subject: "[Drift Alert] Infrastructure Configuration Drift Detected"
    
    # Teams for cross-team coordination
    teams:
      webhookUrl: "${TEAMS_WEBHOOK_URL}"
    
    # Custom webhook for integration with internal systems
    webhook:
      url: "https://internal-api.company.com/drift-webhooks"
      method: "POST"
      headers:
        X-Source: "drift-detector"
      authentication:
        type: "bearer"
        token: "${INTERNAL_API_TOKEN}"
  
  filters:
    # Only critical and high severity
    severityFilter: ["high", "critical"]
    
    # Only if >= 5% drift
    minDriftPercentage: 5
    
    # Alert on new drift, not ongoing
    onlyOnNewDrift: true
```

Usage:
```bash
drift-detector scan --config drift-detector.yml
```
