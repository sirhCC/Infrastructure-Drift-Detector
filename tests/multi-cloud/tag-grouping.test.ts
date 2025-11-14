import { TagBasedGrouping } from '../../src/multi-cloud/tag-grouping';

describe('TagBasedGrouping', () => {
  let grouping: TagBasedGrouping;

  beforeEach(() => {
    grouping = new TagBasedGrouping();
  });

  describe('initialization', () => {
    it('should create a tag-based grouping instance', () => {
      expect(grouping).toBeDefined();
      expect(grouping).toBeInstanceOf(TagBasedGrouping);
    });

    it('should have a groupByTag method', () => {
      expect(typeof grouping.groupByTag).toBe('function');
    });

    it('should have a filterByTags method', () => {
      expect(typeof grouping.filterByTags).toBe('function');
    });

    it('should have a validateTagCompliance method', () => {
      expect(typeof grouping.validateTagCompliance).toBe('function');
    });
  });

  describe('groupByTag', () => {
    it('should return empty map for empty input', () => {
      const result = grouping.groupByTag([], 'Environment');
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });
});
