import { TerraformStateParser } from './parser';
import { RemoteStateBackend, RemoteStateBackendFactory } from './backends';
import {
  TerraformState,
  StateFileOptions,
  BackendConfig,
  StateComparisonResult,
} from './types';
import { Resource, DriftResult } from '../types';
import { DriftDetector } from '../detector';

/**
 * State manager for Terraform state operations
 * Coordinates state parsing, remote backends, and drift detection
 */
export class StateManager {
  private parser: TerraformStateParser;
  private detector: DriftDetector;

  constructor(detector?: DriftDetector) {
    this.parser = new TerraformStateParser();
    this.detector = detector || new DriftDetector({ providers: ['aws', 'azure', 'gcp'] });
  }

  /**
   * Load state from local file
   */
  async loadLocalState(filePath: string, encryptionKey?: string): Promise<TerraformState> {
    const result = await this.parser.parseStateFile({
      localPath: filePath,
      encryptionKey,
    });

    if (result.errors.length > 0) {
      throw new Error(`State parsing failed: ${result.errors.join(', ')}`);
    }

    return result.state;
  }

  /**
   * Load state from remote backend
   */
  async loadRemoteState(backend: BackendConfig): Promise<TerraformState> {
    const remoteBackend = RemoteStateBackendFactory.createBackend(backend);

    const exists = await remoteBackend.exists();
    if (!exists) {
      throw new Error('Remote state does not exist');
    }

    return await remoteBackend.fetchState();
  }

  /**
   * Auto-detect and load state from project directory
   */
  async autoLoadState(projectDir: string): Promise<TerraformState | null> {
    const backend = await RemoteStateBackendFactory.autoDetect(projectDir);
    
    if (!backend) {
      return null;
    }

    try {
      return await backend.fetchState();
    } catch {
      return null;
    }
  }

  /**
   * Compare state with IaC definitions
   */
  compareStateWithIaC(state: TerraformState, iacResources: Resource[]): StateComparisonResult {
    const stateResources = this.parser.extractResources(state);
    return this.parser.compareStateWithIaC(stateResources, iacResources);
  }

  /**
   * Detect drift using state as the expected configuration
   */
  detectDriftFromState(state: TerraformState, actualResources: Resource[]): DriftResult[] {
    // Extract resources from state (these are "expected")
    const stateResources = this.parser.extractResources(state);

    // Use drift detector to compare state vs actual cloud
    return this.detector.detectDrift(stateResources, actualResources);
  }

  /**
   * Three-way comparison: IaC -> State -> Cloud
   * This shows the full picture of configuration drift
   */
  async threeWayComparison(
    iacResources: Resource[],
    state: TerraformState,
    actualResources: Resource[]
  ): Promise<{
    iacVsState: StateComparisonResult;
    stateVsCloud: DriftResult[];
    iacVsCloud: DriftResult[];
  }> {
    const stateResources = this.parser.extractResources(state);

    return {
      // IaC vs State: Shows if code matches what Terraform thinks is deployed
      iacVsState: this.parser.compareStateWithIaC(stateResources, iacResources),
      
      // State vs Cloud: Shows if cloud matches what Terraform thinks
      stateVsCloud: this.detector.detectDrift(stateResources, actualResources),
      
      // IaC vs Cloud: Shows total drift from code to reality
      iacVsCloud: this.detector.detectDrift(iacResources, actualResources),
    };
  }

  /**
   * Get state summary information
   */
  getStateSummary(state: TerraformState): {
    version: number;
    terraformVersion: string;
    serial: number;
    resourceCount: number;
    outputCount: number;
    providerCounts: Record<string, number>;
  } {
    const providerCounts: Record<string, number> = {};

    for (const resource of state.resources) {
      if (resource.mode === 'managed') {
        const provider = resource.provider.split('/').pop() || 'unknown';
        providerCounts[provider] = (providerCounts[provider] || 0) + resource.instances.length;
      }
    }

    return {
      version: state.version,
      terraformVersion: state.terraform_version,
      serial: state.serial,
      resourceCount: state.resources.filter((r) => r.mode === 'managed').length,
      outputCount: Object.keys(state.outputs || {}).length,
      providerCounts,
    };
  }

  /**
   * Extract specific resource from state by address
   */
  getResourceFromState(
    state: TerraformState,
    address: string
  ): { type: string; name: string; attributes: Record<string, any> } | null {
    // Parse address format: aws_instance.web_server or module.vpc.aws_subnet.private[0]
    const parts = address.split('.');
    
    for (const resource of state.resources) {
      if (resource.mode !== 'managed') continue;

      // Simple match: type.name
      if (parts.length === 2 && resource.type === parts[0] && resource.name === parts[1]) {
        return {
          type: resource.type,
          name: resource.name,
          attributes: resource.instances[0]?.attributes || {},
        };
      }
    }

    return null;
  }

  /**
   * Check if state needs migration (old version)
   */
  needsMigration(state: TerraformState): boolean {
    // Terraform state versions:
    // 3: Terraform 0.11 and earlier
    // 4: Terraform 0.12+
    return state.version < 4;
  }

  /**
   * Validate state integrity
   */
  validateState(state: TerraformState): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!state.version) {
      errors.push('Missing state version');
    }

    if (!state.terraform_version) {
      errors.push('Missing Terraform version');
    }

    if (!state.serial) {
      warnings.push('Missing serial number');
    }

    if (!state.lineage) {
      warnings.push('Missing lineage');
    }

    // Check resources
    if (!state.resources || state.resources.length === 0) {
      warnings.push('No resources in state');
    }

    // Check for duplicate resource addresses
    const addresses = new Set<string>();
    for (const resource of state.resources || []) {
      const address = `${resource.type}.${resource.name}`;
      if (addresses.has(address)) {
        errors.push(`Duplicate resource address: ${address}`);
      }
      addresses.add(address);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
