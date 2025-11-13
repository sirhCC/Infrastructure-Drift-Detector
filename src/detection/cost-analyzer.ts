import { DetectedResource, DriftResult } from '../types';

export interface CostImpact {
  resourceId: string;
  resourceType: string;
  currentMonthlyCost: number;
  driftCostImpact: number; // Positive = cost increase, Negative = cost decrease
  potentialMonthlyCost: number;
  currency: string;
  impactPercentage: number;
  costFactors: CostFactor[];
  recommendation: string;
}

export interface CostFactor {
  factor: string;
  currentValue: any;
  driftedValue: any;
  costDelta: number;
  description: string;
}

export interface CostAnalysisConfig {
  currency: string;
  region: string;
  pricing: PricingData;
}

export interface PricingData {
  aws?: AWSPricing;
  azure?: AzurePricing;
  gcp?: GCPPricing;
}

interface AWSPricing {
  ec2: Record<string, number>; // instance_type -> hourly_cost
  s3: { storage: number; requests: number };
  rds: Record<string, number>;
  ebs: Record<string, number>;
}

interface AzurePricing {
  vm: Record<string, number>;
  storage: { standard: number; premium: number };
}

interface GCPPricing {
  compute: Record<string, number>;
  storage: number;
}

/**
 * Cost Impact Analysis
 * Analyzes the financial impact of infrastructure drift
 */
export class CostAnalyzer {
  private config: CostAnalysisConfig;

  constructor(config?: Partial<CostAnalysisConfig>) {
    this.config = {
      currency: config?.currency || 'USD',
      region: config?.region || 'us-east-1',
      pricing: config?.pricing || this.getDefaultPricing(),
    };
  }

  /**
   * Analyze cost impact of drift
   */
  async analyzeCostImpact(resources: DetectedResource[]): Promise<CostImpact[]> {
    const impacts: CostImpact[] = [];

    for (const resource of resources) {
      if (!resource.hasDrift) continue;

      const impact = this.calculateResourceCostImpact(resource);
      if (impact) {
        impacts.push(impact);
      }
    }

    return impacts.sort((a, b) => Math.abs(b.driftCostImpact) - Math.abs(a.driftCostImpact));
  }

  /**
   * Calculate cost impact for a single resource
   */
  private calculateResourceCostImpact(resource: DetectedResource): CostImpact | null {
    const { resourceType, actualState, expectedState } = resource;

    if (!actualState || !expectedState) return null;

    let costFactors: CostFactor[] = [];
    let currentCost = 0;
    let driftCost = 0;

    switch (resourceType) {
      case 'aws_instance':
        ({ costFactors, currentCost, driftCost } = this.analyzeEC2Cost(actualState, expectedState));
        break;
      case 'aws_s3_bucket':
        ({ costFactors, currentCost, driftCost } = this.analyzeS3Cost(actualState, expectedState));
        break;
      case 'aws_db_instance':
        ({ costFactors, currentCost, driftCost } = this.analyzeRDSCost(actualState, expectedState));
        break;
      case 'aws_ebs_volume':
        ({ costFactors, currentCost, driftCost } = this.analyzeEBSCost(actualState, expectedState));
        break;
      case 'azurerm_virtual_machine':
      case 'azurerm_linux_virtual_machine':
      case 'azurerm_windows_virtual_machine':
        ({ costFactors, currentCost, driftCost } = this.analyzeAzureVMCost(actualState, expectedState));
        break;
      case 'google_compute_instance':
        ({ costFactors, currentCost, driftCost } = this.analyzeGCPComputeCost(actualState, expectedState));
        break;
      default:
        return null;
    }

    if (costFactors.length === 0) return null;

    const potentialCost = currentCost + driftCost;
    const impactPercentage = currentCost > 0 ? (driftCost / currentCost) * 100 : 0;

    return {
      resourceId: resource.resourceId,
      resourceType,
      currentMonthlyCost: currentCost,
      driftCostImpact: driftCost,
      potentialMonthlyCost: potentialCost,
      currency: this.config.currency,
      impactPercentage,
      costFactors,
      recommendation: this.generateRecommendation(driftCost, costFactors),
    };
  }

  /**
   * Analyze EC2 instance cost
   */
  private analyzeEC2Cost(actual: any, expected: any) {
    const costFactors: CostFactor[] = [];
    let currentCost = 0;
    let driftCost = 0;

    const actualType = actual.instance_type;
    const expectedType = expected.instance_type;
    const pricing = this.config.pricing.aws?.ec2 || {};

    if (actualType !== expectedType) {
      const actualHourly = pricing[actualType] || 0.10; // Default fallback
      const expectedHourly = pricing[expectedType] || 0.10;
      const monthlyCost = (actualHourly - expectedHourly) * 730; // hours per month

      costFactors.push({
        factor: 'Instance Type',
        currentValue: actualType,
        driftedValue: expectedType,
        costDelta: monthlyCost,
        description: `Instance type changed from ${expectedType} to ${actualType}`,
      });

      currentCost = actualHourly * 730;
      driftCost = monthlyCost;
    }

    // Check EBS volumes
    if (actual.ebs_block_device || expected.ebs_block_device) {
      const actualVolumes = actual.ebs_block_device || [];
      const expectedVolumes = expected.ebs_block_device || [];
      
      const actualSize = actualVolumes.reduce((sum: number, v: any) => sum + (v.volume_size || 0), 0);
      const expectedSize = expectedVolumes.reduce((sum: number, v: any) => sum + (v.volume_size || 0), 0);

      if (actualSize !== expectedSize) {
        const costPerGB = 0.10; // gp3 pricing
        const sizeDrift = (actualSize - expectedSize) * costPerGB;

        costFactors.push({
          factor: 'EBS Volume Size',
          currentValue: `${actualSize} GB`,
          driftedValue: `${expectedSize} GB`,
          costDelta: sizeDrift,
          description: `EBS storage changed by ${actualSize - expectedSize} GB`,
        });

        driftCost += sizeDrift;
      }
    }

    return { costFactors, currentCost, driftCost };
  }

  /**
   * Analyze S3 bucket cost
   */
  private analyzeS3Cost(actual: any, expected: any) {
    const costFactors: CostFactor[] = [];
    let currentCost = 0;
    let driftCost = 0;

    // Storage class change
    if (actual.storage_class !== expected.storage_class) {
      const storageCosts: Record<string, number> = {
        STANDARD: 0.023,
        INTELLIGENT_TIERING: 0.023,
        STANDARD_IA: 0.0125,
        ONEZONE_IA: 0.01,
        GLACIER: 0.004,
        DEEP_ARCHIVE: 0.00099,
      };

      const actualCost = storageCosts[actual.storage_class] || 0.023;
      const expectedCost = storageCosts[expected.storage_class] || 0.023;
      
      // Assuming 100GB as baseline
      const monthlyCost = (actualCost - expectedCost) * 100;

      costFactors.push({
        factor: 'Storage Class',
        currentValue: actual.storage_class,
        driftedValue: expected.storage_class,
        costDelta: monthlyCost,
        description: `Storage class changed from ${expected.storage_class} to ${actual.storage_class}`,
      });

      driftCost = monthlyCost;
    }

    // Versioning impact
    if (actual.versioning !== expected.versioning) {
      const versioningEnabled = actual.versioning?.enabled || false;
      const expectedVersioning = expected.versioning?.enabled || false;

      if (versioningEnabled !== expectedVersioning) {
        const impactCost = versioningEnabled ? 10 : -10; // Rough estimate

        costFactors.push({
          factor: 'Versioning',
          currentValue: versioningEnabled,
          driftedValue: expectedVersioning,
          costDelta: impactCost,
          description: `Versioning ${versioningEnabled ? 'enabled' : 'disabled'}`,
        });

        driftCost += impactCost;
      }
    }

    return { costFactors, currentCost, driftCost };
  }

  /**
   * Analyze RDS instance cost
   */
  private analyzeRDSCost(actual: any, expected: any) {
    const costFactors: CostFactor[] = [];
    let currentCost = 0;
    let driftCost = 0;

    // Instance class change
    if (actual.instance_class !== expected.instance_class) {
      const pricing = this.config.pricing.aws?.rds || {};
      const actualHourly = pricing[actual.instance_class] || 0.20;
      const expectedHourly = pricing[expected.instance_class] || 0.20;
      const monthlyCost = (actualHourly - expectedHourly) * 730;

      costFactors.push({
        factor: 'Instance Class',
        currentValue: actual.instance_class,
        driftedValue: expected.instance_class,
        costDelta: monthlyCost,
        description: `Instance class changed from ${expected.instance_class} to ${actual.instance_class}`,
      });

      currentCost = actualHourly * 730;
      driftCost = monthlyCost;
    }

    // Storage size change
    if (actual.allocated_storage !== expected.allocated_storage) {
      const costPerGB = 0.115; // gp2 pricing
      const sizeDrift = (actual.allocated_storage - expected.allocated_storage) * costPerGB;

      costFactors.push({
        factor: 'Storage Size',
        currentValue: `${actual.allocated_storage} GB`,
        driftedValue: `${expected.allocated_storage} GB`,
        costDelta: sizeDrift,
        description: `Storage changed by ${actual.allocated_storage - expected.allocated_storage} GB`,
      });

      driftCost += sizeDrift;
    }

    // Multi-AZ change
    if (actual.multi_az !== expected.multi_az) {
      const multiAZCost = currentCost > 0 ? currentCost : 100; // Double the cost if enabled

      costFactors.push({
        factor: 'Multi-AZ',
        currentValue: actual.multi_az,
        driftedValue: expected.multi_az,
        costDelta: actual.multi_az ? multiAZCost : -multiAZCost,
        description: `Multi-AZ deployment ${actual.multi_az ? 'enabled' : 'disabled'}`,
      });

      driftCost += actual.multi_az ? multiAZCost : -multiAZCost;
    }

    return { costFactors, currentCost, driftCost };
  }

  /**
   * Analyze EBS volume cost
   */
  private analyzeEBSCost(actual: any, expected: any) {
    const costFactors: CostFactor[] = [];
    let currentCost = 0;
    let driftCost = 0;

    // Volume type change
    if (actual.type !== expected.type) {
      const volumeCosts: Record<string, number> = {
        gp3: 0.08,
        gp2: 0.10,
        io1: 0.125,
        io2: 0.125,
        st1: 0.045,
        sc1: 0.015,
      };

      const actualCost = volumeCosts[actual.type] || 0.10;
      const expectedCost = volumeCosts[expected.type] || 0.10;
      const size = actual.size || expected.size || 100;
      const monthlyCost = (actualCost - expectedCost) * size;

      costFactors.push({
        factor: 'Volume Type',
        currentValue: actual.type,
        driftedValue: expected.type,
        costDelta: monthlyCost,
        description: `Volume type changed from ${expected.type} to ${actual.type}`,
      });

      driftCost = monthlyCost;
    }

    // Size change
    if (actual.size !== expected.size) {
      const costPerGB = 0.08; // gp3 default
      const sizeDrift = (actual.size - expected.size) * costPerGB;

      costFactors.push({
        factor: 'Volume Size',
        currentValue: `${actual.size} GB`,
        driftedValue: `${expected.size} GB`,
        costDelta: sizeDrift,
        description: `Volume size changed by ${actual.size - expected.size} GB`,
      });

      driftCost += sizeDrift;
    }

    return { costFactors, currentCost, driftCost };
  }

  /**
   * Analyze Azure VM cost
   */
  private analyzeAzureVMCost(actual: any, expected: any) {
    const costFactors: CostFactor[] = [];
    let currentCost = 0;
    let driftCost = 0;

    if (actual.vm_size !== expected.vm_size) {
      const pricing = this.config.pricing.azure?.vm || {};
      const actualHourly = pricing[actual.vm_size] || 0.15;
      const expectedHourly = pricing[expected.vm_size] || 0.15;
      const monthlyCost = (actualHourly - expectedHourly) * 730;

      costFactors.push({
        factor: 'VM Size',
        currentValue: actual.vm_size,
        driftedValue: expected.vm_size,
        costDelta: monthlyCost,
        description: `VM size changed from ${expected.vm_size} to ${actual.vm_size}`,
      });

      currentCost = actualHourly * 730;
      driftCost = monthlyCost;
    }

    return { costFactors, currentCost, driftCost };
  }

  /**
   * Analyze GCP Compute instance cost
   */
  private analyzeGCPComputeCost(actual: any, expected: any) {
    const costFactors: CostFactor[] = [];
    let currentCost = 0;
    let driftCost = 0;

    if (actual.machine_type !== expected.machine_type) {
      const pricing = this.config.pricing.gcp?.compute || {};
      const actualHourly = pricing[actual.machine_type] || 0.12;
      const expectedHourly = pricing[expected.machine_type] || 0.12;
      const monthlyCost = (actualHourly - expectedHourly) * 730;

      costFactors.push({
        factor: 'Machine Type',
        currentValue: actual.machine_type,
        driftedValue: expected.machine_type,
        costDelta: monthlyCost,
        description: `Machine type changed from ${expected.machine_type} to ${actual.machine_type}`,
      });

      currentCost = actualHourly * 730;
      driftCost = monthlyCost;
    }

    return { costFactors, currentCost, driftCost };
  }

  /**
   * Generate recommendation based on cost impact
   */
  private generateRecommendation(driftCost: number, factors: CostFactor[]): string {
    if (Math.abs(driftCost) < 1) {
      return 'Minimal cost impact - monitor for trends';
    }

    if (driftCost > 0) {
      const topFactor = factors.sort((a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta))[0];
      return `Cost increase of $${driftCost.toFixed(2)}/month due to ${topFactor.factor}. Review if this change was intentional and update IaC accordingly.`;
    } else {
      return `Cost savings of $${Math.abs(driftCost).toFixed(2)}/month detected. Verify this optimization is intended and update IaC to reflect the change.`;
    }
  }

  /**
   * Get default pricing data
   */
  private getDefaultPricing(): PricingData {
    return {
      aws: {
        ec2: {
          't2.micro': 0.0116,
          't2.small': 0.023,
          't2.medium': 0.0464,
          't3.micro': 0.0104,
          't3.small': 0.0208,
          't3.medium': 0.0416,
          'm5.large': 0.096,
          'm5.xlarge': 0.192,
          'c5.large': 0.085,
        },
        s3: {
          storage: 0.023,
          requests: 0.0004,
        },
        rds: {
          'db.t3.micro': 0.017,
          'db.t3.small': 0.034,
          'db.t3.medium': 0.068,
          'db.m5.large': 0.192,
        },
        ebs: {
          gp3: 0.08,
          gp2: 0.10,
          io1: 0.125,
        },
      },
      azure: {
        vm: {
          Standard_B1s: 0.0104,
          Standard_B2s: 0.0416,
          Standard_D2s_v3: 0.096,
        },
        storage: {
          standard: 0.018,
          premium: 0.15,
        },
      },
      gcp: {
        compute: {
          'e2-micro': 0.0084,
          'e2-small': 0.0168,
          'e2-medium': 0.0336,
          'n1-standard-1': 0.0475,
        },
        storage: 0.020,
      },
    };
  }

  /**
   * Calculate total cost impact across all resources
   */
  getTotalCostImpact(impacts: CostImpact[]): {
    totalIncrease: number;
    totalDecrease: number;
    netImpact: number;
    affectedResources: number;
  } {
    let totalIncrease = 0;
    let totalDecrease = 0;

    for (const impact of impacts) {
      if (impact.driftCostImpact > 0) {
        totalIncrease += impact.driftCostImpact;
      } else {
        totalDecrease += Math.abs(impact.driftCostImpact);
      }
    }

    return {
      totalIncrease,
      totalDecrease,
      netImpact: totalIncrease - totalDecrease,
      affectedResources: impacts.length,
    };
  }
}
