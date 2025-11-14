import { DetectedResource } from '../types';

export interface TagFilter {
  key: string;
  value?: string | string[];
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'exists' | 'notExists';
}

export interface TagGroup {
  name: string;
  filters: TagFilter[];
  matchMode: 'all' | 'any';
}

export interface TagBasedScanResult {
  groupName: string;
  resources: DetectedResource[];
  totalCount: number;
  driftCount: number;
  tags: Record<string, Set<string>>;
}

/**
 * Tag-Based Resource Grouping
 * Filter and group resources by tags
 */
export class TagBasedGrouping {
  /**
   * Group resources by tag key
   */
  groupByTag(resources: DetectedResource[], tagKey: string): Map<string, DetectedResource[]> {
    const groups = new Map<string, DetectedResource[]>();

    for (const resource of resources) {
      const tags = this.extractTags(resource);
      const tagValue = tags[tagKey];

      if (tagValue) {
        if (!groups.has(tagValue)) {
          groups.set(tagValue, []);
        }
        groups.get(tagValue)!.push(resource);
      } else {
        // Resources without the tag
        if (!groups.has('__untagged__')) {
          groups.set('__untagged__', []);
        }
        groups.get('__untagged__')!.push(resource);
      }
    }

    return groups;
  }

  /**
   * Filter resources by tag filters
   */
  filterByTags(resources: DetectedResource[], filters: TagFilter[]): DetectedResource[] {
    return resources.filter(resource => {
      const tags = this.extractTags(resource);
      return filters.every(filter => this.matchesFilter(tags, filter));
    });
  }

  /**
   * Apply tag groups to resources
   */
  applyTagGroups(resources: DetectedResource[], groups: TagGroup[]): TagBasedScanResult[] {
    const results: TagBasedScanResult[] = [];

    for (const group of groups) {
      const matchedResources = this.matchTagGroup(resources, group);
      const tags = this.collectTags(matchedResources);

      results.push({
        groupName: group.name,
        resources: matchedResources,
        totalCount: matchedResources.length,
        driftCount: matchedResources.filter(r => r.hasDrift).length,
        tags,
      });
    }

    return results;
  }

  /**
   * Match resources against a tag group
   */
  private matchTagGroup(resources: DetectedResource[], group: TagGroup): DetectedResource[] {
    return resources.filter(resource => {
      const tags = this.extractTags(resource);

      if (group.matchMode === 'all') {
        return group.filters.every(filter => this.matchesFilter(tags, filter));
      } else {
        return group.filters.some(filter => this.matchesFilter(tags, filter));
      }
    });
  }

  /**
   * Check if tags match a filter
   */
  private matchesFilter(tags: Record<string, string>, filter: TagFilter): boolean {
    const tagValue = tags[filter.key];
    const operator = filter.operator || 'equals';

    switch (operator) {
      case 'exists':
        return tagValue !== undefined;

      case 'notExists':
        return tagValue === undefined;

      case 'equals':
        if (Array.isArray(filter.value)) {
          return filter.value.includes(tagValue);
        }
        return tagValue === filter.value;

      case 'contains':
        if (!tagValue) return false;
        if (Array.isArray(filter.value)) {
          return filter.value.some(v => tagValue.includes(v));
        }
        return filter.value ? tagValue.includes(filter.value) : false;

      case 'startsWith':
        if (!tagValue || !filter.value) return false;
        if (Array.isArray(filter.value)) {
          return filter.value.some(v => tagValue.startsWith(v));
        }
        return tagValue.startsWith(filter.value);

      case 'endsWith':
        if (!tagValue || !filter.value) return false;
        if (Array.isArray(filter.value)) {
          return filter.value.some(v => tagValue.endsWith(v));
        }
        return tagValue.endsWith(filter.value);

      default:
        return false;
    }
  }

  /**
   * Extract tags from resource
   */
  private extractTags(resource: DetectedResource): Record<string, string> {
    const state = resource.actualState || resource.expectedState || {};

    // Try common tag locations
    if (state.tags) {
      return this.normalizeTags(state.tags);
    }

    if (state.Tags) {
      return this.normalizeTags(state.Tags);
    }

    if (state.tag) {
      return this.normalizeTags(state.tag);
    }

    if (state.labels) {
      return this.normalizeTags(state.labels);
    }

    return {};
  }

  /**
   * Normalize tags to consistent format
   */
  private normalizeTags(tags: any): Record<string, string> {
    if (!tags) return {};

    // Handle array of tag objects [{Key: 'x', Value: 'y'}]
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

    // Handle object {key: value}
    if (typeof tags === 'object') {
      return tags;
    }

    return {};
  }

  /**
   * Collect all unique tags from resources
   */
  private collectTags(resources: DetectedResource[]): Record<string, Set<string>> {
    const collected: Record<string, Set<string>> = {};

    for (const resource of resources) {
      const tags = this.extractTags(resource);

      for (const [key, value] of Object.entries(tags)) {
        if (!collected[key]) {
          collected[key] = new Set();
        }
        collected[key].add(value);
      }
    }

    return collected;
  }

  /**
   * Generate tag report
   */
  generateTagReport(resources: DetectedResource[]): string {
    const lines: string[] = [];
    const tagStats = new Map<string, Map<string, number>>();

    // Collect tag statistics
    for (const resource of resources) {
      const tags = this.extractTags(resource);

      for (const [key, value] of Object.entries(tags)) {
        if (!tagStats.has(key)) {
          tagStats.set(key, new Map());
        }
        const valueMap = tagStats.get(key)!;
        valueMap.set(value, (valueMap.get(value) || 0) + 1);
      }
    }

    lines.push(`Tag Report`);
    lines.push(`==========`);
    lines.push(`Total Resources: ${resources.length}`);
    lines.push(`Unique Tags: ${tagStats.size}`);
    lines.push(``);

    for (const [key, valueMap] of tagStats) {
      lines.push(`Tag: ${key}`);
      lines.push(`  Unique Values: ${valueMap.size}`);
      lines.push(`  Distribution:`);

      const sorted = Array.from(valueMap.entries()).sort((a, b) => b[1] - a[1]);

      for (const [value, count] of sorted.slice(0, 10)) {
        lines.push(`    ${value}: ${count} resources`);
      }

      lines.push(``);
    }

    return lines.join('\n');
  }

  /**
   * Find untagged resources
   */
  findUntagged(resources: DetectedResource[], requiredTags: string[]): DetectedResource[] {
    return resources.filter(resource => {
      const tags = this.extractTags(resource);
      return requiredTags.some(requiredTag => !tags[requiredTag]);
    });
  }

  /**
   * Validate tag compliance
   */
  validateTagCompliance(
    resources: DetectedResource[],
    requiredTags: string[]
  ): {
    compliant: DetectedResource[];
    nonCompliant: DetectedResource[];
    complianceRate: number;
  } {
    const compliant: DetectedResource[] = [];
    const nonCompliant: DetectedResource[] = [];

    for (const resource of resources) {
      const tags = this.extractTags(resource);
      const hasAllRequiredTags = requiredTags.every(tag => tags[tag]);

      if (hasAllRequiredTags) {
        compliant.push(resource);
      } else {
        nonCompliant.push(resource);
      }
    }

    const complianceRate = resources.length > 0 ? compliant.length / resources.length : 0;

    return {
      compliant,
      nonCompliant,
      complianceRate,
    };
  }
}
