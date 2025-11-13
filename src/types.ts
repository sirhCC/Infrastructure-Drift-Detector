/**
 * Core types for Infrastructure Drift Detection
 */

export type CloudProvider = 'aws' | 'azure' | 'gcp';

export type ResourceType = 
  | 'compute' 
  | 'storage' 
  | 'network' 
  | 'database' 
  | 'security';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Resource {
  id: string;
  type: ResourceType;
  provider: CloudProvider;
  name: string;
  properties: Record<string, any>;
  tags?: Record<string, string>;
}

export interface DriftResult {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  hasDrift: boolean;
  driftedProperties: DriftedProperty[];
  changes?: DriftedProperty[];
  detectedAt: Date;
  timestamp?: string;
  severity: Severity;
  actualState?: Record<string, any>;
  expectedState?: Record<string, any>;
}

export interface ScanResult {
  timestamp: string;
  drifts: DriftResult[];
  summary: {
    total: number;
    drifted: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface DetectedResource {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  hasDrift: boolean;
  severity?: Severity;
  changes?: DriftedProperty[];
  actualState?: Record<string, any>;
  expectedState?: Record<string, any>;
}

export interface DriftedProperty {
  propertyPath: string;
  expectedValue: any;
  actualValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

export interface IaCDefinition {
  provider: CloudProvider;
  resources: Resource[];
  source: 'terraform' | 'pulumi';
  filePath: string;
}

export interface DetectorConfig {
  providers: CloudProvider[];
  scanInterval?: number; // in minutes
  ignoreProperties?: string[];
  autoRemediate?: boolean;
}
