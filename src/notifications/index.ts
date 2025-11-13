import { DriftResult, Severity } from '../types';
import { 
  NotificationConfig, 
  NotificationPayload, 
  NotificationResult,
  NotificationChannelConfig,
  SlackConfig,
  EmailConfig,
  TeamsConfig,
  DiscordConfig,
  WebhookConfig,
} from './types';
import { SlackNotifier } from './slack';
import { EmailNotifier } from './email';
import { TeamsNotifier } from './teams';
import { DiscordNotifier } from './discord';
import { WebhookNotifier } from './webhook';

export class NotificationManager {
  constructor(private config: NotificationConfig) {}

  async notify(
    driftResults: DriftResult[],
    metadata: {
      provider: string;
      region?: string;
      totalResources: number;
      scanDuration?: number;
      scanId?: string;
    }
  ): Promise<NotificationResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    const driftedResources = driftResults.filter(r => r.hasDrift);
    const driftPercentage = (driftedResources.length / metadata.totalResources) * 100;

    // Apply filters
    if (this.config.minDriftPercentage && driftPercentage < this.config.minDriftPercentage) {
      return [];
    }

    // Count severities
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    driftedResources.forEach(result => {
      severityCounts[result.severity]++;
    });

    // Apply severity filter
    if (this.config.severityFilter && this.config.severityFilter.length > 0) {
      const hasMatchingSeverity = driftedResources.some(r => 
        this.config.severityFilter!.includes(r.severity as Severity)
      );
      
      if (!hasMatchingSeverity) {
        return [];
      }
    }

    const payload: NotificationPayload = {
      timestamp: new Date(),
      provider: metadata.provider,
      region: metadata.region,
      totalResources: metadata.totalResources,
      driftedResources: driftedResources.length,
      driftPercentage,
      severityCounts,
      driftResults: driftedResources,
      scanDuration: metadata.scanDuration,
      scanId: metadata.scanId,
    };

    // Send to all enabled channels
    const results: NotificationResult[] = [];
    const enabledChannels = this.config.channels.filter(ch => ch.enabled);

    for (const channel of enabledChannels) {
      try {
        await this.sendToChannel(channel, payload);
        results.push({
          channel: channel.type,
          success: true,
          timestamp: new Date(),
        });
      } catch (error) {
        results.push({
          channel: channel.type,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  private async sendToChannel(
    channel: NotificationChannelConfig,
    payload: NotificationPayload
  ): Promise<void> {
    switch (channel.type) {
      case 'slack':
        const slackNotifier = new SlackNotifier(channel.config as SlackConfig);
        await slackNotifier.send(payload);
        break;

      case 'email':
        const emailNotifier = new EmailNotifier(channel.config as EmailConfig);
        await emailNotifier.send(payload);
        break;

      case 'teams':
        const teamsNotifier = new TeamsNotifier(channel.config as TeamsConfig);
        await teamsNotifier.send(payload);
        break;

      case 'discord':
        const discordNotifier = new DiscordNotifier(channel.config as DiscordConfig);
        await discordNotifier.send(payload);
        break;

      case 'webhook':
        const webhookNotifier = new WebhookNotifier(channel.config as WebhookConfig);
        await webhookNotifier.send(payload);
        break;

      default:
        throw new Error(`Unknown notification channel type: ${channel.type}`);
    }
  }

  async testChannel(channelType: string): Promise<boolean> {
    const channel = this.config.channels.find(ch => ch.type === channelType && ch.enabled);
    
    if (!channel) {
      throw new Error(`Channel ${channelType} not found or not enabled`);
    }

    const testPayload: NotificationPayload = {
      timestamp: new Date(),
      provider: 'test',
      region: 'test-region',
      totalResources: 10,
      driftedResources: 2,
      driftPercentage: 20,
      severityCounts: {
        critical: 1,
        high: 1,
        medium: 0,
        low: 0,
      },
      driftResults: [],
      scanId: 'test-notification',
    };

    try {
      await this.sendToChannel(channel, testPayload);
      return true;
    } catch (error) {
      throw error;
    }
  }
}
