import https from 'https';
import http from 'http';
import { URL } from 'url';
import { NotificationPayload, TeamsConfig } from './types';

export class TeamsNotifier {
  constructor(private config: TeamsConfig) {}

  async send(payload: NotificationPayload): Promise<void> {
    const message = this.formatMessage(payload);
    return this.sendWebhook(message);
  }

  private formatMessage(payload: NotificationPayload): any {
    const { driftedResources, totalResources, driftPercentage, severityCounts } = payload;
    
    let themeColor = '28a745'; // green
    if (severityCounts.critical > 0) {
      themeColor = 'dc3545'; // red
    } else if (severityCounts.high > 0) {
      themeColor = 'fd7e14'; // orange
    } else if (severityCounts.medium > 0) {
      themeColor = 'ffc107'; // yellow
    }

    const facts: any[] = [
      {
        name: 'Provider',
        value: `${payload.provider}${payload.region ? ` (${payload.region})` : ''}`,
      },
      {
        name: 'Resources with Drift',
        value: `${driftedResources} of ${totalResources} (${driftPercentage.toFixed(1)}%)`,
      },
    ];

    const severityLines: string[] = [];
    if (severityCounts.critical > 0) severityLines.push(`🔴 Critical: ${severityCounts.critical}`);
    if (severityCounts.high > 0) severityLines.push(`🟠 High: ${severityCounts.high}`);
    if (severityCounts.medium > 0) severityLines.push(`🟡 Medium: ${severityCounts.medium}`);
    if (severityCounts.low > 0) severityLines.push(`🟢 Low: ${severityCounts.low}`);

    if (severityLines.length > 0) {
      facts.push({
        name: 'Severity Breakdown',
        value: severityLines.join('  \n'),
      });
    }

    // Add top drifted resources
    const topDrifted = payload.driftResults
      .filter(r => r.hasDrift)
      .slice(0, 5)
      .map(r => `• ${r.resourceName} (${r.driftedProperties.length} properties)`)
      .join('  \n');

    if (topDrifted) {
      facts.push({
        name: 'Top Drifted Resources',
        value: topDrifted,
      });
    }

    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor,
      title: '⚠️ Infrastructure Drift Detected',
      summary: `Drift detected in ${driftedResources} resources`,
      sections: [
        {
          activityTitle: 'Drift Detection Scan Complete',
          activitySubtitle: payload.timestamp.toISOString(),
          facts,
        },
      ],
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
            reject(new Error(`Teams webhook failed with status ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to send Teams notification: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }
}
