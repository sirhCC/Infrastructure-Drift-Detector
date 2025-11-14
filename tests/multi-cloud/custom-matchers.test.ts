import { CustomResourceMatcher } from '../../src/multi-cloud/custom-matchers';

describe('CustomResourceMatcher', () => {
  let matcher: CustomResourceMatcher;

  beforeEach(() => {
    matcher = new CustomResourceMatcher();
  });

  describe('initialization', () => {
    it('should create a custom resource matcher instance', () => {
      expect(matcher).toBeDefined();
      expect(matcher).toBeInstanceOf(CustomResourceMatcher);
    });

    it('should have a registerMatcher method', () => {
      expect(typeof matcher.registerMatcher).toBe('function');
    });

    it('should have a matchResource method', () => {
      expect(typeof matcher.matchResource).toBe('function');
    });

    it('should initialize with default matchers', () => {
      const matchers = matcher.getAllMatchers();
      expect(matchers.length).toBeGreaterThan(0);
    });
  });
});
