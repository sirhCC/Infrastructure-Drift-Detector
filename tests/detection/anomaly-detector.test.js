"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const anomaly_detector_1 = require("../src/detection/anomaly-detector");
describe('AnomalyDetector', () => {
    let detector;
    beforeEach(() => {
        detector = new anomaly_detector_1.AnomalyDetector();
    });
    describe('initialization', () => {
        it('should create an anomaly detector instance', () => {
            expect(detector).toBeDefined();
            expect(detector).toBeInstanceOf(anomaly_detector_1.AnomalyDetector);
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
