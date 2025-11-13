import { DetectedResource, DriftResult, ScanResult } from '../types';

export interface AnomalyScore {
  resourceId: string;
  score: number; // 0-1, where 1 is most anomalous
  reason: string;
  confidence: number;
  features: Record<string, number>;
}

export interface AnomalyDetectionConfig {
  threshold: number; // Anomaly score threshold (0-1)
  minSamples: number; // Minimum historical samples needed
  features: string[]; // Features to analyze
}

/**
 * Machine Learning-based Anomaly Detection
 * Uses statistical methods to detect unusual drift patterns
 */
export class AnomalyDetector {
  private config: AnomalyDetectionConfig;
  private historicalData: Map<string, HistoricalMetrics[]>;

  constructor(config?: Partial<AnomalyDetectionConfig>) {
    this.config = {
      threshold: config?.threshold ?? 0.7,
      minSamples: config?.minSamples ?? 10,
      features: config?.features ?? [
        'driftFrequency',
        'changeVelocity',
        'propertyVolatility',
        'severityTrend',
      ],
    };
    this.historicalData = new Map();
  }

  /**
   * Analyze resources for anomalous behavior
   */
  async detectAnomalies(
    resources: DetectedResource[],
    driftHistory: ScanResult[]
  ): Promise<AnomalyScore[]> {
    const anomalies: AnomalyScore[] = [];

    // Build historical metrics
    this.buildHistoricalMetrics(driftHistory);

    for (const resource of resources) {
      const score = this.calculateAnomalyScore(resource, driftHistory);
      
      if (score.score >= this.config.threshold) {
        anomalies.push(score);
      }
    }

    return anomalies.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate anomaly score for a single resource
   */
  private calculateAnomalyScore(
    resource: DetectedResource,
    driftHistory: ScanResult[]
  ): AnomalyScore {
    const metrics = this.getResourceMetrics(resource.resourceId, driftHistory);
    
    if (metrics.length < this.config.minSamples) {
      return {
        resourceId: resource.resourceId,
        score: 0,
        reason: 'Insufficient historical data',
        confidence: 0,
        features: {},
      };
    }

    // Calculate feature scores
    const features: Record<string, number> = {};
    
    // Feature 1: Drift frequency (how often does this resource drift?)
    features.driftFrequency = this.calculateDriftFrequency(metrics);
    
    // Feature 2: Change velocity (how quickly do changes occur?)
    features.changeVelocity = this.calculateChangeVelocity(metrics);
    
    // Feature 3: Property volatility (how many properties change?)
    features.propertyVolatility = this.calculatePropertyVolatility(metrics);
    
    // Feature 4: Severity trend (is drift getting worse?)
    features.severityTrend = this.calculateSeverityTrend(metrics);

    // Combined anomaly score using weighted average
    const weights = {
      driftFrequency: 0.3,
      changeVelocity: 0.25,
      propertyVolatility: 0.25,
      severityTrend: 0.2,
    };

    const score = Object.entries(features).reduce(
      (sum, [key, value]) => sum + value * (weights[key as keyof typeof weights] || 0),
      0
    );

    // Determine primary reason
    const maxFeature = Object.entries(features).reduce((max, entry) =>
      entry[1] > max[1] ? entry : max
    );

    const reasons: Record<string, string> = {
      driftFrequency: 'Unusually high drift frequency',
      changeVelocity: 'Rapid configuration changes',
      propertyVolatility: 'Many properties changing',
      severityTrend: 'Increasing drift severity',
    };

    return {
      resourceId: resource.resourceId,
      score,
      reason: reasons[maxFeature[0]] || 'Anomalous behavior detected',
      confidence: Math.min(metrics.length / this.config.minSamples, 1),
      features,
    };
  }

  /**
   * Calculate drift frequency score
   */
  private calculateDriftFrequency(metrics: HistoricalMetrics[]): number {
    const driftCount = metrics.filter(m => m.hasDrift).length;
    const frequency = driftCount / metrics.length;
    
    // Normalize: >50% drift rate is considered anomalous
    return Math.min(frequency / 0.5, 1);
  }

  /**
   * Calculate change velocity (changes per day)
   */
  private calculateChangeVelocity(metrics: HistoricalMetrics[]): number {
    if (metrics.length < 2) return 0;

    const changes = metrics.filter(m => m.changeCount > 0);
    const timeSpan = metrics[metrics.length - 1].timestamp - metrics[0].timestamp;
    const days = timeSpan / (1000 * 60 * 60 * 24);
    
    const velocity = changes.length / Math.max(days, 1);
    
    // Normalize: >1 change per day is anomalous
    return Math.min(velocity, 1);
  }

  /**
   * Calculate property volatility
   */
  private calculatePropertyVolatility(metrics: HistoricalMetrics[]): number {
    const avgChanges = metrics.reduce((sum, m) => sum + m.changeCount, 0) / metrics.length;
    
    // Normalize: >5 property changes is highly volatile
    return Math.min(avgChanges / 5, 1);
  }

  /**
   * Calculate severity trend
   */
  private calculateSeverityTrend(metrics: HistoricalMetrics[]): number {
    if (metrics.length < 3) return 0;

    const recentMetrics = metrics.slice(-5);
    const olderMetrics = metrics.slice(0, Math.min(5, metrics.length - 5));

    const recentSeverity = this.averageSeverity(recentMetrics);
    const olderSeverity = this.averageSeverity(olderMetrics);

    // Positive trend means severity is increasing
    const trend = recentSeverity - olderSeverity;
    
    // Normalize: +2 severity increase is significant
    return Math.max(0, Math.min(trend / 2, 1));
  }

  private averageSeverity(metrics: HistoricalMetrics[]): number {
    const severityMap: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    const sum = metrics.reduce(
      (total, m) => total + (severityMap[m.severity] || 0),
      0
    );

    return sum / metrics.length;
  }

  /**
   * Get historical metrics for a resource
   */
  private getResourceMetrics(
    resourceId: string,
    driftHistory: ScanResult[]
  ): HistoricalMetrics[] {
    const metrics: HistoricalMetrics[] = [];

    for (const scan of driftHistory) {
      const resource = scan.drifts.find(d => d.resourceId === resourceId);
      
      if (resource) {
        metrics.push({
          timestamp: new Date(scan.timestamp).getTime(),
          hasDrift: resource.hasDrift,
          changeCount: resource.changes?.length || 0,
          severity: resource.severity || 'low',
        });
      }
    }

    return metrics.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Build historical metrics cache
   */
  private buildHistoricalMetrics(driftHistory: ScanResult[]): void {
    this.historicalData.clear();

    for (const scan of driftHistory) {
      for (const drift of scan.drifts) {
        const existing = this.historicalData.get(drift.resourceId) || [];
        existing.push({
          timestamp: new Date(scan.timestamp).getTime(),
          hasDrift: drift.hasDrift,
          changeCount: drift.changes?.length || 0,
          severity: drift.severity || 'low',
        });
        this.historicalData.set(drift.resourceId, existing);
      }
    }
  }

  /**
   * Predict future drift likelihood
   */
  async predictDriftLikelihood(
    resourceId: string,
    driftHistory: ScanResult[]
  ): Promise<DriftPrediction> {
    const metrics = this.getResourceMetrics(resourceId, driftHistory);

    if (metrics.length < this.config.minSamples) {
      return {
        resourceId,
        likelihood: 0,
        confidence: 0,
        nextDriftEstimate: null,
        reason: 'Insufficient historical data',
      };
    }

    const driftFrequency = this.calculateDriftFrequency(metrics);
    const velocity = this.calculateChangeVelocity(metrics);

    // Simple prediction model based on historical patterns
    const likelihood = (driftFrequency + velocity) / 2;

    // Estimate next drift based on average interval
    const driftEvents = metrics.filter(m => m.hasDrift);
    if (driftEvents.length >= 2) {
      const intervals = [];
      for (let i = 1; i < driftEvents.length; i++) {
        intervals.push(driftEvents[i].timestamp - driftEvents[i - 1].timestamp);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const lastDrift = driftEvents[driftEvents.length - 1].timestamp;
      const nextDriftEstimate = new Date(lastDrift + avgInterval);

      return {
        resourceId,
        likelihood,
        confidence: Math.min(metrics.length / 20, 1),
        nextDriftEstimate,
        reason: `Based on ${driftEvents.length} drift events`,
      };
    }

    return {
      resourceId,
      likelihood,
      confidence: Math.min(metrics.length / 20, 1),
      nextDriftEstimate: null,
      reason: 'Predicting based on change patterns',
    };
  }
}

interface HistoricalMetrics {
  timestamp: number;
  hasDrift: boolean;
  changeCount: number;
  severity: string;
}

export interface DriftPrediction {
  resourceId: string;
  likelihood: number; // 0-1
  confidence: number; // 0-1
  nextDriftEstimate: Date | null;
  reason: string;
}
