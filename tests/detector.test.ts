import { DriftDetector } from '../src/detector';
import { TerraformParser } from '../src/parsers/terraform-enhanced';

describe('DriftDetector', () => {
  let detector: DriftDetector;
  let parser: TerraformParser;

  beforeEach(() => {
    parser = new TerraformParser();
    detector = new DriftDetector({
      providers: ['aws', 'azure', 'gcp']
    });
  });

  describe('initialization', () => {
    it('should create a drift detector instance', () => {
      expect(detector).toBeDefined();
      expect(detector).toBeInstanceOf(DriftDetector);
    });

    it('should have a detectDrift method', () => {
      expect(typeof detector.detectDrift).toBe('function');
    });
  });
});
