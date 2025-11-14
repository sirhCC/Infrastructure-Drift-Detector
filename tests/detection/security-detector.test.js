"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const security_detector_1 = require("../src/detection/security-detector");
describe('SecurityDetector', () => {
    let detector;
    beforeEach(() => {
        detector = new security_detector_1.SecurityDetector();
    });
    describe('initialization', () => {
        it('should create a security detector instance', () => {
            expect(detector).toBeDefined();
            expect(detector).toBeInstanceOf(security_detector_1.SecurityDetector);
        });
        it('should have a detectViolations method', () => {
            expect(typeof detector.detectViolations).toBe('function');
        });
        it('should have an addPolicy method', () => {
            expect(typeof detector.addPolicy).toBe('function');
        });
    });
    describe('detectViolations', () => {
        it('should return empty array for empty input', async () => {
            const result = await detector.detectViolations([]);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });
    });
});
