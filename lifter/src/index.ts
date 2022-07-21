import fs from 'fs'
import { IntermediateRepresentationLifter } from './ir'
import { JavascriptLifter } from './lifter'
import { FunctionTrace } from './types'


import { parse } from "@babel/parser";
import { JavascriptBeautifier } from './cleaner';
import generate from '@babel/generator';

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

var cleaner = new JavascriptBeautifier(outputAst)

fs.writeFileSync("cleaned.js", cleaner.clean());
