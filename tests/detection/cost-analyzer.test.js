"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cost_analyzer_1 = require("../src/detection/cost-analyzer");
describe('CostAnalyzer', () => {
    let analyzer;
    beforeEach(() => {
        analyzer = new cost_analyzer_1.CostAnalyzer();
    });
    describe('initialization', () => {
        it('should create a cost analyzer instance', () => {
            expect(analyzer).toBeDefined();
            expect(analyzer).toBeInstanceOf(cost_analyzer_1.CostAnalyzer);
        });
        it('should have an analyzeCostImpact method', () => {
            expect(typeof analyzer.analyzeCostImpact).toBe('function');
        });
    });
    describe('analyzeCostImpact', () => {
        it('should return empty array for empty input', async () => {
            const result = await analyzer.analyzeCostImpact([]);
            expect(result).toBeDefined();
            expect(result.resources).toHaveLength(0);
        });
    });
});
