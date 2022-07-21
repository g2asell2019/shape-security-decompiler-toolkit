"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const ir_1 = require("./ir");
const lifter_1 = require("./lifter");
const cleaner_1 = require("./cleaner");
var functionTraces = JSON.parse(fs_1.default.readFileSync('input/vm_call_stack.json').toString());
const functionTraceMap = new Map();
Object.keys(functionTraces).forEach((key) => {
    const traces = functionTraces[key];
    functionTraceMap.set(key, traces);
});
var irLifter = new ir_1.IntermediateRepresentationLifter(functionTraceMap);
var ir = irLifter.lift();
var jsLifter = new lifter_1.JavascriptLifter(ir);
var outputAst = jsLifter.lift();
var cleaner = new cleaner_1.JavascriptBeautifier(outputAst);
fs_1.default.writeFileSync("cleaned.js", cleaner.clean());
