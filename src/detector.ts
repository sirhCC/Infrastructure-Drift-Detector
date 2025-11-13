import { DriftResult, Resource, DetectorConfig } from './types';

/**
 * Core Drift Detection Engine
 */
export class DriftDetector {
  private config: DetectorConfig;

  constructor(config: DetectorConfig) {
    this.config = config;
  }

  /**
   * Compare expected resources with actual cloud state
   */
  detectDrift(expected: Resource[], actual: Resource[]): DriftResult[] {
    const results: DriftResult[] = [];

    for (const expectedResource of expected) {
      const actualResource = actual.find(r => r.id === expectedResource.id);

      if (!actualResource) {
        // Resource missing in actual state
        results.push(this.createMissingResourceResult(expectedResource));
        continue;
      }

      const driftedProps = this.compareProperties(
        expectedResource.properties,
        actualResource.properties
      );

      if (driftedProps.length > 0) {
        results.push({
          resourceId: expectedResource.id,
          resourceName: expectedResource.name,
          resourceType: expectedResource.type,
          hasDrift: true,
          driftedProperties: driftedProps,
          detectedAt: new Date(),
          severity: this.calculateSeverity(driftedProps)
        });
      }
    }

    return results;
  }

  private compareProperties(
    expected: Record<string, any>,
    actual: Record<string, any>
  ) {
    const drifted = [];
    const ignoreProps = this.config.ignoreProperties || [];

    // Check for modified/removed properties
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (ignoreProps.includes(key)) continue;

      const actualValue = actual[key];

      if (actualValue === undefined) {
        drifted.push({
          propertyPath: key,
          expectedValue,
          actualValue: null,
          changeType: 'removed' as const
        });
      } else if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) {
        drifted.push({
          propertyPath: key,
          expectedValue,
          actualValue,
          changeType: 'modified' as const
        });
      }
    }

    // Check for added properties
    for (const [key, actualValue] of Object.entries(actual)) {
      if (ignoreProps.includes(key)) continue;
      
      if (expected[key] === undefined) {
        drifted.push({
          propertyPath: key,
          expectedValue: null,
          actualValue,
          changeType: 'added' as const
        });
      }
    }

    return drifted;
  }

  private createMissingResourceResult(resource: Resource): DriftResult {
    return {
      resourceId: resource.id,
      resourceName: resource.name,
      resourceType: resource.type,
      hasDrift: true,
      driftedProperties: [{
        propertyPath: '_resource',
        expectedValue: 'exists',
        actualValue: null,
        changeType: 'removed'
      }],
      detectedAt: new Date(),
      severity: 'critical'
    };
  }

  private calculateSeverity(driftedProps: any[]): DriftResult['severity'] {
    const count = driftedProps.length;
    const hasRemovals = driftedProps.some(p => p.changeType === 'removed');

    if (hasRemovals) return 'critical';
    if (count >= 5) return 'high';
    if (count >= 3) return 'medium';
    return 'low';
  }
}
