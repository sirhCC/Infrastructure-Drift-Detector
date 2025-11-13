import https from 'https';
import http from 'http';
import { URL } from 'url';
import { NotificationPayload, DiscordConfig } from './types';

export class DiscordNotifier {
  constructor(private config: DiscordConfig) {}

  async send(payload: NotificationPayload): Promise<void> {
    const message = this.formatMessage(payload);
    return this.sendWebhook(message);
  }

  private formatMessage(payload: NotificationPayload): any {
    const { driftedResources, totalResources, driftPercentage, severityCounts } = payload;
    
    let color = 5763719; // green
    if (severityCounts.critical > 0) {
      color = 15548997; // red
    } else if (severityCounts.high > 0) {
      color = 16753920; // orange
    } else if (severityCounts.medium > 0) {
      color = 16776960; // yellow
    }

    const fields: any[] = [
      {
        name: 'Provider',
        value: `${payload.provider}${payload.region ? ` (${payload.region})` : ''}`,
        inline: true,
      },
      {
        name: 'Resources with Drift',
        value: `${driftedResources} of ${totalResources} (${driftPercentage.toFixed(1)}%)`,
        inline: true,
      },
    ];

    const severityLines: string[] = [];
    if (severityCounts.critical > 0) severityLines.push(`🔴 Critical: ${severityCounts.critical}`);
    if (severityCounts.high > 0) severityLines.push(`🟠 High: ${severityCounts.high}`);
    if (severityCounts.medium > 0) severityLines.push(`🟡 Medium: ${severityCounts.medium}`);
    if (severityCounts.low > 0) severityLines.push(`🟢 Low: ${severityCounts.low}`);

    if (severityLines.length > 0) {
      fields.push({
        name: 'Severity Breakdown',
        value: severityLines.join('\n'),
        inline: false,
      });
    }

    // Add top drifted resources
    const topDrifted = payload.driftResults
      .filter(r => r.hasDrift)
      .slice(0, 5)
      .map(r => `• ${r.resourceName} (${r.driftedProperties.length} properties)`)
      .join('\n');

    if (topDrifted) {
      fields.push({
        name: 'Top Drifted Resources',
        value: topDrifted,
        inline: false,
      });
    }

    const discordPayload: any = {
      username: this.config.username || 'Drift Detector',
      embeds: [
        {
          title: '⚠️ Infrastructure Drift Detected',
          color,
          fields,
          timestamp: payload.timestamp.toISOString(),
          footer: {
            text: 'Infrastructure Drift Detector',
          },
        },
      ],
    };

    if (this.config.avatarUrl) {
      discordPayload.avatar_url = this.config.avatarUrl;
    }

    return discordPayload;
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
            reject(new Error(`Discord webhook failed with status ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to send Discord notification: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }
}
