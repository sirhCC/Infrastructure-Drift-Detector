"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const detector_1 = require("../src/detector");
const terraform_enhanced_1 = require("../src/parsers/terraform-enhanced");
describe('DriftDetector', () => {
    let detector;
    let parser;
    beforeEach(() => {
        parser = new terraform_enhanced_1.EnhancedTerraformParser();
        detector = new detector_1.DriftDetector(parser);
    });
    describe('initialization', () => {
        it('should create a drift detector instance', () => {
            expect(detector).toBeDefined();
            expect(detector).toBeInstanceOf(detector_1.DriftDetector);
        });
        it('should have a detectDrift method', () => {
            expect(typeof detector.detectDrift).toBe('function');
        });
    });
    describe('detectDrift', () => {
        it('should return an array', async () => {
            const terraformCode = `
        resource "aws_instance" "test" {
          instance_type = "t2.micro"
          ami = "ami-12345678"
        }
      `;
            const result = await detector.detectDrift(terraformCode, {});
            expect(Array.isArray(result)).toBe(true);
        });
    });
});
