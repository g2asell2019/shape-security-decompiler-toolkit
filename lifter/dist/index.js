"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const parser_1 = require("@babel/parser");
const cleaner_1 = require("./cleaner");
/*
var functionTraces: {[key: string]: FunctionTrace[]}  = JSON.parse(fs.readFileSync('input/vm_call_stack.json').toString())

const functionTraceMap = new Map<string, FunctionTrace[]>()

Object.keys(functionTraces).forEach((key)=> {
    const traces = functionTraces[key]
    functionTraceMap.set(key, traces)

})


var irLifter = new IntermediateRepresentationLifter(functionTraceMap)

var ir = irLifter.lift()


var jsLifter = new JavascriptLifter(ir)
var outputAst = jsLifter.lift()
fs.writeFileSync('output_fn.js', generate(outputAst).code)
*/
const ast = (0, parser_1.parse)(fs_1.default.readFileSync('input/fn_test.js').toString());
var cleaner = new cleaner_1.JavascriptBeautifier(ast);
cleaner.clean();
