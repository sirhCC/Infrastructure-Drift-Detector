import nodemailer from 'nodemailer';
import { NotificationPayload, EmailConfig } from './types';

export class EmailNotifier {
  private transporter: nodemailer.Transporter;

  constructor(private config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  async send(payload: NotificationPayload): Promise<void> {
    const subject = this.config.subject || this.generateSubject(payload);
    const html = this.formatHtmlEmail(payload);
    const text = this.formatTextEmail(payload);

    await this.transporter.sendMail({
      from: this.config.from,
      to: this.config.to.join(', '),
      cc: this.config.cc?.join(', '),
      subject,
      text,
      html,
    });
  }

  private generateSubject(payload: NotificationPayload): string {
    const { driftedResources, severityCounts } = payload;
    
    let severity = 'Low';
    if (severityCounts.critical > 0) severity = 'Critical';
    else if (severityCounts.high > 0) severity = 'High';
    else if (severityCounts.medium > 0) severity = 'Medium';

    return `[${severity}] Infrastructure Drift Detected - ${driftedResources} Resource${driftedResources !== 1 ? 's' : ''} Affected`;
  }

  private formatTextEmail(payload: NotificationPayload): string {
    const { driftedResources, totalResources, driftPercentage, severityCounts, provider, region } = payload;

    const lines = [
      '⚠️ INFRASTRUCTURE DRIFT DETECTED',
      '',
      `Provider: ${provider}${region ? ` (${region})` : ''}`,
      `Timestamp: ${payload.timestamp.toISOString()}`,
      '',
      `Resources with Drift: ${driftedResources} of ${totalResources} (${driftPercentage.toFixed(1)}%)`,
      '',
      'SEVERITY BREAKDOWN:',
    ];

    if (severityCounts.critical > 0) lines.push(`  Critical: ${severityCounts.critical}`);
    if (severityCounts.high > 0) lines.push(`  High: ${severityCounts.high}`);
    if (severityCounts.medium > 0) lines.push(`  Medium: ${severityCounts.medium}`);
    if (severityCounts.low > 0) lines.push(`  Low: ${severityCounts.low}`);

    const topDrifted = payload.driftResults
      .filter(r => r.hasDrift)
      .slice(0, 10);

    if (topDrifted.length > 0) {
      lines.push('', 'TOP DRIFTED RESOURCES:');
      topDrifted.forEach((result, index) => {
        lines.push(`  ${index + 1}. ${result.resourceName} [${result.severity.toUpperCase()}]`);
        lines.push(`     Properties changed: ${result.driftedProperties.length}`);
      });
    }

    lines.push('', '---', 'Infrastructure Drift Detector');

    return lines.join('\n');
  }

  private formatHtmlEmail(payload: NotificationPayload): string {
    const { driftedResources, totalResources, driftPercentage, severityCounts, provider, region } = payload;

    let severityBadge = '#4caf50'; // green
    if (severityCounts.critical > 0) severityBadge = '#f44336'; // red
    else if (severityCounts.high > 0) severityBadge = '#ff9800'; // orange
    else if (severityCounts.medium > 0) severityBadge = '#ffeb3b'; // yellow

    const topDrifted = payload.driftResults
      .filter(r => r.hasDrift)
      .slice(0, 10);

    const resourceRows = topDrifted.map((result, index) => {
      const severityColors: Record<string, string> = {
        critical: '#f44336',
        high: '#ff9800',
        medium: '#ffeb3b',
        low: '#4caf50',
      };

      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${index + 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${result.resourceName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">
            <span style="background-color: ${severityColors[result.severity]}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
              ${result.severity.toUpperCase()}
            </span>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${result.driftedProperties.length}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background-color: ${severityBadge}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">⚠️ Infrastructure Drift Detected</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
          <h2 style="margin-top: 0; color: #666;">Scan Summary</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; font-weight: bold;">Provider:</td>
              <td style="padding: 8px;">${provider}${region ? ` (${region})` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Timestamp:</td>
              <td style="padding: 8px;">${payload.timestamp.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Drift Percentage:</td>
              <td style="padding: 8px;">${driftPercentage.toFixed(1)}% (${driftedResources}/${totalResources} resources)</td>
            </tr>
          </table>

          <h3 style="color: #666;">Severity Breakdown</h3>
          <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            ${severityCounts.critical > 0 ? `<span style="background-color: #f44336; color: white; padding: 8px 12px; border-radius: 4px;">Critical: ${severityCounts.critical}</span>` : ''}
            ${severityCounts.high > 0 ? `<span style="background-color: #ff9800; color: white; padding: 8px 12px; border-radius: 4px;">High: ${severityCounts.high}</span>` : ''}
            ${severityCounts.medium > 0 ? `<span style="background-color: #ffeb3b; color: #333; padding: 8px 12px; border-radius: 4px;">Medium: ${severityCounts.medium}</span>` : ''}
            ${severityCounts.low > 0 ? `<span style="background-color: #4caf50; color: white; padding: 8px 12px; border-radius: 4px;">Low: ${severityCounts.low}</span>` : ''}
          </div>

          ${topDrifted.length > 0 ? `
            <h3 style="color: #666;">Drifted Resources</h3>
            <table style="width: 100%; border-collapse: collapse; background-color: white;">
              <thead>
                <tr style="background-color: #333; color: white;">
                  <th style="padding: 10px; text-align: left;">#</th>
                  <th style="padding: 10px; text-align: left;">Resource Name</th>
                  <th style="padding: 10px; text-align: left;">Severity</th>
                  <th style="padding: 10px; text-align: left;">Properties Changed</th>
                </tr>
              </thead>
              <tbody>
                ${resourceRows}
              </tbody>
            </table>
          ` : ''}
        </div>

        <div style="background-color: #333; color: #999; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
          Infrastructure Drift Detector
        </div>
      </body>
      </html>
    `;
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      return false;
    }
  }
}
