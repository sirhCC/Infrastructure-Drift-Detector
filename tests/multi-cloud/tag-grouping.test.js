"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tag_grouping_1 = require("../src/multi-cloud/tag-grouping");
describe('TagBasedGrouping', () => {
    let grouping;
    beforeEach(() => {
        grouping = new tag_grouping_1.TagBasedGrouping();
    });
    describe('initialization', () => {
        it('should create a tag-based grouping instance', () => {
            expect(grouping).toBeDefined();
            expect(grouping).toBeInstanceOf(tag_grouping_1.TagBasedGrouping);
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
