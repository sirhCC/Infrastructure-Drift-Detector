import { DriftResult, Severity } from '../types';

export type NotificationChannel = 'slack' | 'email' | 'teams' | 'discord' | 'webhook';

export interface NotificationConfig {
  enabled: boolean;
  channels: NotificationChannelConfig[];
  severityFilter?: Severity[]; // Only notify for these severities
  minDriftPercentage?: number; // Only notify if drift >= this percentage
  onlyOnNewDrift?: boolean; // Only notify when new drift is detected
}

export interface NotificationChannelConfig {
  type: NotificationChannel;
  enabled: boolean;
  config: SlackConfig | EmailConfig | TeamsConfig | DiscordConfig | WebhookConfig;
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string[];
  cc?: string[];
  subject?: string;
}

export interface TeamsConfig {
  webhookUrl: string;
}

export interface DiscordConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
}

export interface WebhookConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    headerName?: string; // for api-key
  };
}

export interface NotificationPayload {
  timestamp: Date;
  provider: string;
  region?: string;
  totalResources: number;
  driftedResources: number;
  driftPercentage: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  driftResults: DriftResult[];
  scanDuration?: number;
  scanId?: string;
}

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
  timestamp: Date;
}
