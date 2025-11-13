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
  hasDrift: boolean;
  driftedProperties: DriftedProperty[];
  detectedAt: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
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
