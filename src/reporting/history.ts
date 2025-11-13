import * as fs from 'fs';
import * as path from 'path';
import { DriftResult } from '../types';

/**
 * Drift scan record
 */
export interface DriftScanRecord {
  id: string;
  timestamp: Date;
  provider: string;
  region?: string;
  totalResources: number;
  driftedResources: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  results: DriftResult[];
  metadata?: {
    terraformPath?: string;
    configFile?: string;
    scanDuration?: number;
  };
}

/**
 * Drift history statistics
 */
export interface DriftStatistics {
  totalScans: number;
  firstScan: Date;
  lastScan: Date;
  averageDriftPercentage: number;
  mostDriftedResources: Array<{
    resourceId: string;
    driftCount: number;
  }>;
  driftTrend: Array<{
    date: Date;
    driftCount: number;
  }>;
}

/**
 * Drift history storage manager
 * Uses JSON file storage for cross-platform compatibility
 */
export class DriftHistoryStore {
  private storageDir: string;
  private historyFile: string;
  private history: DriftScanRecord[] = [];

  constructor(storageDir: string = './drift-history') {
    this.storageDir = storageDir;
    this.historyFile = path.join(storageDir, 'history.json');
    this.ensureStorageDirectory();
    this.loadHistory();
  }

  /**
   * Ensure storage directory exists
   */
  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Load history from file
   */
  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const content = fs.readFileSync(this.historyFile, 'utf-8');
        const data = JSON.parse(content);
        
        // Convert date strings back to Date objects
        this.history = data.map((record: any) => ({
          ...record,
          timestamp: new Date(record.timestamp),
          results: record.results.map((r: any) => ({
            ...r,
            detectedAt: new Date(r.detectedAt)
          }))
        }));
      }
    } catch (error) {
      console.error('Failed to load drift history:', error);
      this.history = [];
    }
  }

  /**
   * Save history to file
   */
  private saveHistory(): void {
    try {
      const content = JSON.stringify(this.history, null, 2);
      fs.writeFileSync(this.historyFile, content, 'utf-8');
    } catch (error) {
      console.error('Failed to save drift history:', error);
    }
  }

  /**
   * Add a drift scan record
   */
  addScan(scan: Omit<DriftScanRecord, 'id' | 'timestamp'>): string {
    const record: DriftScanRecord = {
      id: this.generateId(),
      timestamp: new Date(),
      ...scan
    };

    this.history.push(record);
    this.saveHistory();

    // Keep only last 1000 scans to prevent unlimited growth
    if (this.history.length > 1000) {
      this.history = this.history.slice(-1000);
      this.saveHistory();
    }

    return record.id;
  }

  /**
   * Get all scan records
   */
  getAllScans(): DriftScanRecord[] {
    return [...this.history];
  }

  /**
   * Get scan by ID
   */
  getScanById(id: string): DriftScanRecord | undefined {
    return this.history.find(record => record.id === id);
  }

  /**
   * Get recent scans
   */
  getRecentScans(limit: number = 10): DriftScanRecord[] {
    return this.history.slice(-limit).reverse();
  }

  /**
   * Get scans within date range
   */
  getScansByDateRange(startDate: Date, endDate: Date): DriftScanRecord[] {
    return this.history.filter(record => 
      record.timestamp >= startDate && record.timestamp <= endDate
    );
  }

  /**
   * Get scans for specific provider
   */
  getScansByProvider(provider: string): DriftScanRecord[] {
    return this.history.filter(record => record.provider === provider);
  }

  /**
   * Calculate statistics
   */
  getStatistics(): DriftStatistics | null {
    if (this.history.length === 0) {
      return null;
    }

    const sortedHistory = [...this.history].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Calculate average drift percentage
    const totalDriftPercentage = this.history.reduce((sum, record) => {
      const percentage = record.totalResources > 0
        ? (record.driftedResources / record.totalResources) * 100
        : 0;
      return sum + percentage;
    }, 0);

    // Track drift per resource
    const resourceDriftCount = new Map<string, number>();
    this.history.forEach(record => {
      record.results.forEach(result => {
        if (result.hasDrift) {
          const count = resourceDriftCount.get(result.resourceId) || 0;
          resourceDriftCount.set(result.resourceId, count + 1);
        }
      });
    });

    // Get most drifted resources
    const mostDrifted = Array.from(resourceDriftCount.entries())
      .map(([resourceId, driftCount]) => ({ resourceId, driftCount }))
      .sort((a, b) => b.driftCount - a.driftCount)
      .slice(0, 10);

    // Calculate trend (daily aggregation)
    const trendMap = new Map<string, number>();
    this.history.forEach(record => {
      const dateKey = record.timestamp.toISOString().split('T')[0];
      const existing = trendMap.get(dateKey) || 0;
      trendMap.set(dateKey, Math.max(existing, record.driftedResources));
    });

    const driftTrend = Array.from(trendMap.entries())
      .map(([date, driftCount]) => ({
        date: new Date(date),
        driftCount
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      totalScans: this.history.length,
      firstScan: sortedHistory[0].timestamp,
      lastScan: sortedHistory[sortedHistory.length - 1].timestamp,
      averageDriftPercentage: totalDriftPercentage / this.history.length,
      mostDriftedResources: mostDrifted,
      driftTrend
    };
  }

  /**
   * Compare current scan with previous scan
   */
  compareWithPrevious(currentResults: DriftResult[]): {
    new: DriftResult[];
    fixed: DriftResult[];
    ongoing: DriftResult[];
  } | null {
    if (this.history.length === 0) {
      return null;
    }

    const previousScan = this.history[this.history.length - 1];
    const previousDriftIds = new Set(
      previousScan.results
        .filter(r => r.hasDrift)
        .map(r => r.resourceId)
    );

    const currentDriftIds = new Set(
      currentResults
        .filter(r => r.hasDrift)
        .map(r => r.resourceId)
    );

    const newDrift = currentResults.filter(
      r => r.hasDrift && !previousDriftIds.has(r.resourceId)
    );

    const fixedDrift = previousScan.results.filter(
      r => r.hasDrift && !currentDriftIds.has(r.resourceId)
    );

    const ongoingDrift = currentResults.filter(
      r => r.hasDrift && previousDriftIds.has(r.resourceId)
    );

    return {
      new: newDrift,
      fixed: fixedDrift,
      ongoing: ongoingDrift
    };
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  /**
   * Export history to JSON file
   */
  exportToFile(filePath: string): void {
    const content = JSON.stringify(this.history, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Import history from JSON file
   */
  importFromFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    this.history = data.map((record: any) => ({
      ...record,
      timestamp: new Date(record.timestamp),
      results: record.results.map((r: any) => ({
        ...r,
        detectedAt: new Date(r.detectedAt)
      }))
    }));
    
    this.saveHistory();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
