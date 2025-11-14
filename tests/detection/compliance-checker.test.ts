import { ComplianceChecker } from '../../src/detection/compliance-checker';

describe('ComplianceChecker', () => {
  let checker: ComplianceChecker;

  beforeEach(() => {
    checker = new ComplianceChecker();
  });

  describe('initialization', () => {
    it('should create a compliance checker instance', () => {
      expect(checker).toBeDefined();
      expect(checker).toBeInstanceOf(ComplianceChecker);
    });

    it('should have a checkCompliance method', () => {
      expect(typeof checker.checkCompliance).toBe('function');
    });
  });

  describe('checkCompliance', () => {
    it('should return a compliance report for empty input', async () => {
      const result = await checker.checkCompliance([], 'CIS');
      expect(result).toBeDefined();
      expect(result.framework).toBe('CIS');
      expect(result.violations).toHaveLength(0);
    });
  });
});
