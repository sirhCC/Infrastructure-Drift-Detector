import { NotificationManager } from './notifications';
import { DriftResult } from './types';

/**
 * Example: Using the Notification System
 */

async function exampleSlackNotification() {
  // Configure Slack notifications
  const notificationManager = new NotificationManager({
    enabled: true,
    channels: [
      {
        type: 'slack',
        enabled: true,
        config: {
          webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
          channel: '#infrastructure-alerts',
          username: 'Drift Detector Bot',
          iconEmoji: ':warning:',
        },
      },
    ],
    severityFilter: ['high', 'critical'], // Only notify for high/critical
    minDriftPercentage: 5, // Only notify if drift >= 5%
  });

  // Example drift results
  const driftResults: DriftResult[] = [
    {
      resourceId: 'i-1234567890abcdef0',
      resourceName: 'web-server-prod',
      hasDrift: true,
      driftedProperties: [
        {
          propertyPath: 'instance_type',
          expectedValue: 't3.medium',
          actualValue: 't3.large',
          changeType: 'modified',
        },
      ],
      detectedAt: new Date(),
      severity: 'high',
    },
  ];

  // Send notification
  const results = await notificationManager.notify(driftResults, {
    provider: 'aws',
    region: 'us-east-1',
    totalResources: 10,
    scanDuration: 5000,
    scanId: 'scan-123',
  });

  console.log('Notification results:', results);
}

async function exampleEmailNotification() {
  // Configure email notifications
  const notificationManager = new NotificationManager({
    enabled: true,
    channels: [
      {
        type: 'email',
        enabled: true,
        config: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: 'your-email@gmail.com',
            pass: 'your-app-password',
          },
          from: 'drift-detector@company.com',
          to: ['devops-team@company.com', 'infrastructure@company.com'],
          cc: ['manager@company.com'],
          subject: '[Infrastructure] Drift Detected',
        },
      },
    ],
  });

  const driftResults: DriftResult[] = [
    {
      resourceId: 'bucket-production-data',
      resourceName: 'production-data-bucket',
      hasDrift: true,
      driftedProperties: [
        {
          propertyPath: 'versioning.enabled',
          expectedValue: true,
          actualValue: false,
          changeType: 'modified',
        },
      ],
      detectedAt: new Date(),
      severity: 'critical',
    },
  ];

  await notificationManager.notify(driftResults, {
    provider: 'aws',
    region: 'us-east-1',
    totalResources: 25,
  });
}

async function exampleMultipleChannels() {
  // Configure multiple notification channels
  const notificationManager = new NotificationManager({
    enabled: true,
    channels: [
      {
        type: 'slack',
        enabled: true,
        config: {
          webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
          channel: '#infrastructure',
        },
      },
      {
        type: 'teams',
        enabled: true,
        config: {
          webhookUrl: 'https://outlook.office.com/webhook/YOUR/WEBHOOK/URL',
        },
      },
      {
        type: 'discord',
        enabled: true,
        config: {
          webhookUrl: 'https://discord.com/api/webhooks/YOUR/WEBHOOK/URL',
          username: 'Infrastructure Monitor',
          avatarUrl: 'https://example.com/avatar.png',
        },
      },
      {
        type: 'webhook',
        enabled: true,
        config: {
          url: 'https://api.yourcompany.com/drift-alerts',
          method: 'POST',
          headers: {
            'X-Custom-Header': 'value',
          },
          authentication: {
            type: 'bearer',
            token: 'your-api-token',
          },
        },
      },
    ],
    severityFilter: ['critical'], // Only critical alerts
  });

  const driftResults: DriftResult[] = [
    {
      resourceId: 'sg-0123456789',
      resourceName: 'production-security-group',
      hasDrift: true,
      driftedProperties: [
        {
          propertyPath: 'ingress[0].cidr_blocks',
          expectedValue: ['10.0.0.0/8'],
          actualValue: ['0.0.0.0/0'],
          changeType: 'modified',
        },
      ],
      detectedAt: new Date(),
      severity: 'critical',
    },
  ];

  const results = await notificationManager.notify(driftResults, {
    provider: 'aws',
    region: 'us-east-1',
    totalResources: 50,
  });

  // Check which channels succeeded
  results.forEach(result => {
    if (result.success) {
      console.log(`✓ Sent to ${result.channel}`);
    } else {
      console.log(`✗ Failed to send to ${result.channel}: ${result.error}`);
    }
  });
}

async function exampleTestNotification() {
  // Test a notification channel
  const notificationManager = new NotificationManager({
    enabled: true,
    channels: [
      {
        type: 'slack',
        enabled: true,
        config: {
          webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
        },
      },
    ],
  });

  try {
    const success = await notificationManager.testChannel('slack');
    console.log('Test notification sent successfully:', success);
  } catch (error) {
    console.error('Test notification failed:', error);
  }
}

// Run examples
if (require.main === module) {
  console.log('Notification System Examples\n');
  
  // Uncomment to run specific examples:
  // exampleSlackNotification();
  // exampleEmailNotification();
  // exampleMultipleChannels();
  // exampleTestNotification();
}

export {
  exampleSlackNotification,
  exampleEmailNotification,
  exampleMultipleChannels,
  exampleTestNotification,
};
