import https from 'https';
import http from 'http';
import { URL } from 'url';
import { NotificationPayload, WebhookConfig } from './types';

export class WebhookNotifier {
  constructor(private config: WebhookConfig) {}

  async send(payload: NotificationPayload): Promise<void> {
    const data = JSON.stringify(payload);
    return this.sendWebhook(data);
  }

  private sendWebhook(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.url);
      const method = this.config.method || 'POST';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data).toString(),
        ...this.config.headers,
      };

      // Add authentication headers
      if (this.config.authentication) {
        const auth = this.config.authentication;
        
        if (auth.type === 'bearer' && auth.token) {
          headers['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'basic' && auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        } else if (auth.type === 'api-key' && auth.token && auth.headerName) {
          headers[auth.headerName] = auth.token;
        }
      }

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
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
            reject(new Error(`Webhook request failed with status ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to send webhook notification: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }
}
