"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cross_cloud_comparator_1 = require("../src/multi-cloud/cross-cloud-comparator");
describe('CrossCloudComparator', () => {
    let comparator;
    beforeEach(() => {
        comparator = new cross_cloud_comparator_1.CrossCloudComparator();
    });
    describe('initialization', () => {
        it('should create a cross-cloud comparator instance', () => {
            expect(comparator).toBeDefined();
            expect(comparator).toBeInstanceOf(cross_cloud_comparator_1.CrossCloudComparator);
        });
        it('should have a compareResources method', () => {
            expect(typeof comparator.compareResources).toBe('function');
        });
    });
    describe('compareResources', () => {
        it('should return empty array for empty input', async () => {
            const result = await comparator.compareResources([]);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });
    });
});
