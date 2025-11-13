import https from 'https';
import http from 'http';
import { URL } from 'url';
import { NotificationPayload, SlackConfig } from './types';

export class SlackNotifier {
  constructor(private config: SlackConfig) {}

  async send(payload: NotificationPayload): Promise<void> {
    const message = this.formatMessage(payload);
    
    const slackPayload = {
      channel: this.config.channel,
      username: this.config.username || 'Drift Detector',
      icon_emoji: this.config.iconEmoji || ':warning:',
      attachments: [message],
    };

    return this.sendWebhook(slackPayload);
  }

  private formatMessage(payload: NotificationPayload): any {
    const { driftedResources, totalResources, driftPercentage, severityCounts } = payload;
    
    let color = 'good';
    if (severityCounts.critical > 0) {
      color = 'danger';
    } else if (severityCounts.high > 0) {
      color = 'warning';
    }

    const fields: any[] = [
      {
        title: 'Drift Detected',
        value: `${driftedResources} of ${totalResources} resources (${driftPercentage.toFixed(1)}%)`,
        short: true,
      },
      {
        title: 'Provider',
        value: `${payload.provider}${payload.region ? ` (${payload.region})` : ''}`,
        short: true,
      },
    ];

    if (severityCounts.critical > 0 || severityCounts.high > 0 || severityCounts.medium > 0 || severityCounts.low > 0) {
      fields.push({
        title: 'Severity Breakdown',
        value: [
          severityCounts.critical > 0 ? `🔴 Critical: ${severityCounts.critical}` : null,
          severityCounts.high > 0 ? `🟠 High: ${severityCounts.high}` : null,
          severityCounts.medium > 0 ? `🟡 Medium: ${severityCounts.medium}` : null,
          severityCounts.low > 0 ? `🟢 Low: ${severityCounts.low}` : null,
        ].filter(Boolean).join('\n'),
        short: false,
      });
    }

    // Add top drifted resources
    const topDrifted = payload.driftResults
      .filter(r => r.hasDrift)
      .slice(0, 5)
      .map(r => `• ${r.resourceName} (${r.driftedProperties?.length || 0} properties)`)
      .join('\n');

    if (topDrifted) {
      fields.push({
        title: 'Top Drifted Resources',
        value: topDrifted,
        short: false,
      });
    }

    return {
      color,
      title: '⚠️ Infrastructure Drift Detected',
      fields,
      footer: 'Infrastructure Drift Detector',
      ts: Math.floor(payload.timestamp.getTime() / 1000),
    };
  }

  private sendWebhook(payload: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.webhookUrl);
      const data = JSON.stringify(payload);

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      };

      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Slack webhook failed with status ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to send Slack notification: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }
}
