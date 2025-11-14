import { AnomalyDetector } from '../../src/detection/anomaly-detector';

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector();
  });

  describe('initialization', () => {
    it('should create an anomaly detector instance', () => {
      expect(detector).toBeDefined();
      expect(detector).toBeInstanceOf(AnomalyDetector);
    });

    it('should have a detectAnomalies method', () => {
      expect(typeof detector.detectAnomalies).toBe('function');
    });

    it('should have a predictDriftLikelihood method', () => {
      expect(typeof detector.predictDriftLikelihood).toBe('function');
    });
  });

  describe('detectAnomalies', () => {
    it('should return empty array for empty scan history', async () => {
      const result = await detector.detectAnomalies([], []);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});
