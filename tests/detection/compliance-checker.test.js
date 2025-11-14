"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compliance_checker_1 = require("../src/detection/compliance-checker");
describe('ComplianceChecker', () => {
    let checker;
    beforeEach(() => {
        checker = new compliance_checker_1.ComplianceChecker();
    });
    describe('initialization', () => {
        it('should create a compliance checker instance', () => {
            expect(checker).toBeDefined();
            expect(checker).toBeInstanceOf(compliance_checker_1.ComplianceChecker);
        });
        it('should have a checkCompliance method', () => {
            expect(typeof checker.checkCompliance).toBe('function');
        });
    });
    describe('checkCompliance', () => {
        it('should return a compliance report for empty input', async () => {
            const result = await checker.checkCompliance([]);
            expect(result).toBeDefined();
            expect(result.totalResources).toBe(0);
            expect(result.totalViolations).toBe(0);
        });
    });
});
