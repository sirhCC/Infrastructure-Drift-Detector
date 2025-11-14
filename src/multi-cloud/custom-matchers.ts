import { DetectedResource } from '../types';

export interface CustomMatcher {
  id: string;
  name: string;
  description?: string;
  provider?: 'aws' | 'azure' | 'gcp' | 'all';
  resourceType?: string;
  match: (resource: DetectedResource) => boolean;
  priority?: number;
}

export interface PropertyMatcher {
  path: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'regex' | 'greaterThan' | 'lessThan' | 'exists' | 'notExists';
  value?: any;
}

export interface CompositeMatcherRule {
  matchers: PropertyMatcher[];
  mode: 'all' | 'any' | 'none';
}

export interface MatchResult {
  matched: boolean;
  matcherIds: string[];
  reasons: string[];
}

/**
 * Custom Resource Matchers
 * Flexible pattern matching for resources
 */
export class CustomResourceMatcher {
  private matchers: Map<string, CustomMatcher>;

  constructor() {
    this.matchers = new Map();
    this.initializeDefaultMatchers();
  }

  /**
   * Register a custom matcher
   */
  registerMatcher(matcher: CustomMatcher): void {
    this.matchers.set(matcher.id, matcher);
  }

  /**
   * Remove a matcher
   */
  removeMatcher(id: string): boolean {
    return this.matchers.delete(id);
  }

  /**
   * Get all matchers
   */
  getAllMatchers(): CustomMatcher[] {
    return Array.from(this.matchers.values());
  }

  /**
   * Match resource against all matchers
   */
  matchResource(resource: DetectedResource): MatchResult {
    const matcherIds: string[] = [];
    const reasons: string[] = [];

    // Sort matchers by priority
    const sortedMatchers = Array.from(this.matchers.values()).sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    for (const matcher of sortedMatchers) {
      // Filter by provider
      if (matcher.provider && matcher.provider !== 'all') {
        const provider = this.detectProvider(resource.resourceType);
        if (provider !== matcher.provider) continue;
      }

      // Filter by resource type
      if (matcher.resourceType && matcher.resourceType !== resource.resourceType) {
        continue;
      }

      // Apply matcher
      try {
        if (matcher.match(resource)) {
          matcherIds.push(matcher.id);
          reasons.push(matcher.name);
        }
      } catch (error: any) {
        console.error(`Error applying matcher ${matcher.id}:`, error.message);
      }
    }

    return {
      matched: matcherIds.length > 0,
      matcherIds,
      reasons,
    };
  }

  /**
   * Create property-based matcher
   */
  createPropertyMatcher(
    id: string,
    name: string,
    rules: PropertyMatcher[],
    mode: 'all' | 'any' = 'all'
  ): CustomMatcher {
    return {
      id,
      name,
      match: (resource: DetectedResource) => {
        const state = resource.actualState || resource.expectedState || {};

        if (mode === 'all') {
          return rules.every(rule => this.matchProperty(state, rule));
        } else {
          return rules.some(rule => this.matchProperty(state, rule));
        }
      },
    };
  }

  /**
   * Create composite matcher
   */
  createCompositeMatcher(
    id: string,
    name: string,
    rule: CompositeMatcherRule
  ): CustomMatcher {
    return {
      id,
      name,
      match: (resource: DetectedResource) => {
        const state = resource.actualState || resource.expectedState || {};

        const results = rule.matchers.map(matcher => this.matchProperty(state, matcher));

        switch (rule.mode) {
          case 'all':
            return results.every(r => r);
          case 'any':
            return results.some(r => r);
          case 'none':
            return !results.some(r => r);
          default:
            return false;
        }
      },
    };
  }

  /**
   * Match a property against rules
   */
  private matchProperty(state: any, matcher: PropertyMatcher): boolean {
    const value = this.getNestedProperty(state, matcher.path);

    switch (matcher.operator) {
      case 'exists':
        return value !== undefined && value !== null;

      case 'notExists':
        return value === undefined || value === null;

      case 'equals':
        return value === matcher.value;

      case 'notEquals':
        return value !== matcher.value;

      case 'contains':
        if (typeof value === 'string') {
          return value.includes(matcher.value);
        }
        if (Array.isArray(value)) {
          return value.includes(matcher.value);
        }
        return false;

      case 'regex':
        if (typeof value !== 'string') return false;
        const regex = new RegExp(matcher.value);
        return regex.test(value);

      case 'greaterThan':
        return typeof value === 'number' && value > matcher.value;

      case 'lessThan':
        return typeof value === 'number' && value < matcher.value;

      default:
        return false;
    }
  }

  /**
   * Get nested property value
   */
  private getNestedProperty(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Detect provider from resource type
   */
  private detectProvider(resourceType: string): 'aws' | 'azure' | 'gcp' {
    if (resourceType.startsWith('aws_')) return 'aws';
    if (resourceType.startsWith('azurerm_')) return 'azure';
    if (resourceType.startsWith('google_')) return 'gcp';
    return 'aws';
  }

  /**
   * Initialize default matchers
   */
  private initializeDefaultMatchers(): void {
    // Production resources
    this.registerMatcher({
      id: 'production',
      name: 'Production Resources',
      match: (resource: DetectedResource) => {
        const state = resource.actualState || resource.expectedState || {};
        const tags = this.extractTags(state);

        return (
          tags.Environment === 'production' ||
          tags.environment === 'production' ||
          tags.Env === 'prod' ||
          tags.env === 'prod'
        );
      },
      priority: 10,
    });

    // Critical resources
    this.registerMatcher({
      id: 'critical',
      name: 'Critical Resources',
      match: (resource: DetectedResource) => {
        const state = resource.actualState || resource.expectedState || {};
        const tags = this.extractTags(state);

        return (
          tags.Criticality === 'high' ||
          tags.criticality === 'high' ||
          tags.Tier === 'critical' ||
          tags.tier === 'critical'
        );
      },
      priority: 10,
    });

    // Public-facing resources
    this.registerMatcher({
      id: 'public',
      name: 'Public-Facing Resources',
      match: (resource: DetectedResource) => {
        const state = resource.actualState || resource.expectedState || {};

        // Check for public access indicators
        return (
          state.public === true ||
          state.public_access === true ||
          state.publicly_accessible === true ||
          state.public_network_access_enabled === true ||
          (Array.isArray(state.ingress_rules) &&
            state.ingress_rules.some((rule: any) => rule.cidr_blocks?.includes('0.0.0.0/0')))
        );
      },
      priority: 8,
    });

    // High-cost resources
    this.registerMatcher({
      id: 'high-cost',
      name: 'High-Cost Resources',
      match: (resource: DetectedResource) => {
        const highCostTypes = [
          'aws_db_instance',
          'aws_rds_cluster',
          'azurerm_sql_database',
          'google_sql_database_instance',
          'aws_instance',
          'azurerm_virtual_machine',
          'google_compute_instance',
        ];

        return highCostTypes.includes(resource.resourceType);
      },
      priority: 5,
    });

    // Unencrypted resources
    this.registerMatcher({
      id: 'unencrypted',
      name: 'Unencrypted Resources',
      match: (resource: DetectedResource) => {
        const state = resource.actualState || resource.expectedState || {};

        return (
          state.encryption === false ||
          state.encrypted === false ||
          state.encryption_enabled === false ||
          state.enable_encryption === false ||
          (state.server_side_encryption_configuration === undefined &&
            resource.resourceType === 'aws_s3_bucket')
        );
      },
      priority: 7,
    });

    // Resources without tags
    this.registerMatcher({
      id: 'untagged',
      name: 'Untagged Resources',
      match: (resource: DetectedResource) => {
        const state = resource.actualState || resource.expectedState || {};
        const tags = this.extractTags(state);

        return Object.keys(tags).length === 0;
      },
      priority: 3,
    });

    // Deprecated resources
    this.registerMatcher({
      id: 'deprecated',
      name: 'Deprecated Resources',
      match: (resource: DetectedResource) => {
        const deprecatedTypes = [
          'aws_db_security_group',
          'aws_elasticache_security_group',
          'aws_redshift_security_group',
        ];

        return deprecatedTypes.includes(resource.resourceType);
      },
      priority: 6,
    });

    // Development/Test resources
    this.registerMatcher({
      id: 'dev-test',
      name: 'Development/Test Resources',
      match: (resource: DetectedResource) => {
        const state = resource.actualState || resource.expectedState || {};
        const tags = this.extractTags(state);

        return (
          tags.Environment === 'dev' ||
          tags.Environment === 'test' ||
          tags.environment === 'dev' ||
          tags.environment === 'test' ||
          tags.Env === 'dev' ||
          tags.Env === 'test'
        );
      },
      priority: 4,
    });
  }

  /**
   * Extract tags from resource state
   */
  private extractTags(state: any): Record<string, string> {
    if (!state) return {};

    // Try common tag locations
    const tags = state.tags || state.Tags || state.tag || state.labels || {};

    // Normalize array format
    if (Array.isArray(tags)) {
      const normalized: Record<string, string> = {};
      for (const tag of tags) {
        if (tag.Key && tag.Value) {
          normalized[tag.Key] = tag.Value;
        } else if (tag.key && tag.value) {
          normalized[tag.key] = tag.value;
        }
      }
      return normalized;
    }

    return tags;
  }

  /**
   * Export matchers to config
   */
  exportMatchers(): Array<{ id: string; name: string; description?: string }> {
    return Array.from(this.matchers.values()).map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
    }));
  }

  /**
   * Load matchers from config
   */
  loadMatchers(config: any[]): void {
    for (const item of config) {
      if (item.propertyRules) {
        const matcher = this.createPropertyMatcher(
          item.id,
          item.name,
          item.propertyRules,
          item.mode || 'all'
        );
        this.registerMatcher(matcher);
      }
    }
  }
}
