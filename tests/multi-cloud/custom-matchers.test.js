"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const custom_matchers_1 = require("../src/multi-cloud/custom-matchers");
describe('CustomResourceMatcher', () => {
    let matcher;
    beforeEach(() => {
        matcher = new custom_matchers_1.CustomResourceMatcher();
    });
    describe('initialization', () => {
        it('should create a custom resource matcher instance', () => {
            expect(matcher).toBeDefined();
            expect(matcher).toBeInstanceOf(custom_matchers_1.CustomResourceMatcher);
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
