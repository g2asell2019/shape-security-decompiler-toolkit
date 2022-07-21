"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntermediateRepresentationLifter = void 0;
const crypto_1 = __importDefault(require("crypto"));
class IntermediateRepresentationLifter {
    constructor(stackTrace) {
        this.functionTraces = stackTrace;
        this.blockMap = new Map();
    }
    getHash(obj) {
        return crypto_1.default.createHash("md5").update(JSON.stringify(obj)).digest("hex");
    }
    removeDuplicates(mapOfTraces) {
        mapOfTraces.forEach((traces, key) => {
            const seenHashes = [];
            const uniqueTraces = [];
            traces.forEach((trace, index) => {
                const hash = this.getHash(trace);
                if (!seenHashes.includes(hash)) {
                    uniqueTraces.push(trace);
                    seenHashes.push(hash);
                }
            });
            mapOfTraces.set(key, uniqueTraces);
        });
    }
    getBlockMap(traces) {
        var blockMap = new Map();
        traces.forEach((trace, index) => {
            var currentBlock = {
                opcodes: [],
            };
            blockMap.set("_main", [currentBlock]);
            function enterNewBlock(microOp, offset) {
                const pc = microOp.args[0].value;
                const opc = microOp.args[1].value;
                const key = `${pc}_${opc}_${offset}`;
                currentBlock = {
                    opcodes: [],
                };
                const block = blockMap.get(key);
                if (block != undefined) {
                    block.push(currentBlock);
                }
                else {
                    blockMap.set(key, [currentBlock]);
                }
            }
            function appendOpcodeIntoBlock(microOp, offset) {
                currentBlock.opcodes.push({
                    offset: offset,
                    microOp: microOp,
                });
                if (microOp.instruction == "JMP") {
                    enterNewBlock(microOp, offset);
                }
            }
            trace.forEach((opcode) => {
                if (opcode.microOps) {
                    opcode.microOps.forEach((microOp) => {
                        appendOpcodeIntoBlock(microOp, opcode.offset);
                        if (microOp.instruction == "IF_BRANCH") {
                            if (microOp.args.length == 2 &&
                                microOp.args[1].value[microOp.args[1].value.length - 1]
                                    .instruction == "JMP") {
                                enterNewBlock(microOp.args[1].value[microOp.args[1].value.length - 1], opcode.offset);
                                return;
                            }
                            else {
                                return;
                                throw "UNHANDLED_IF_BRANCH";
                            }
                        }
                    });
                }
            });
        });
        return blockMap;
    }
    getAssociatedElseStatement(offset, block) {
        for (var i = 0; i < block.opcodes.length; i++) {
            const opcode = block.opcodes[i];
            if (opcode.offset == offset && opcode.microOp.instruction == "ELSE_BRANCH") {
                return block.opcodes.slice(i + 1);
            }
        }
        console.log(JSON.stringify(block));
        throw "ELSE_ERROR";
    }
    isIfJmp(microOp) {
        return (microOp.instruction == "IF_BRANCH" && microOp.args[1].value[0].instruction == "JMP");
    }
    combineIfElseBlocks(block$0, block$1) {
        const conjoinedBlock = {
            opcodes: []
        };
        const length = block$0.opcodes.length > block$1.opcodes.length ? block$0.opcodes.length : block$1.opcodes.length;
        for (var i = 0; i < length; i++) {
            if (block$0.opcodes[i] && block$1.opcodes[i] && block$0.opcodes[i].offset == block$1.opcodes[i].offset) {
                if (this.isIfJmp(block$0.opcodes[i].microOp)) {
                    const opcode = block$0.opcodes[i];
                    const elseStatements = this.getAssociatedElseStatement(opcode.offset, block$1);
                    const ifElseMicroOp = {
                        offset: opcode.offset,
                        microOp: {
                            instruction: "IF_ELSE_BRANCH",
                            args: [
                                opcode.microOp.args[0],
                                opcode.microOp.args[1],
                                {
                                    "type": "body",
                                    "value": elseStatements.map(labeledMicroOp => labeledMicroOp.microOp)
                                }
                            ]
                        }
                    };
                    conjoinedBlock.opcodes.push(ifElseMicroOp);
                    return conjoinedBlock;
                }
                if (this.isIfJmp(block$1.opcodes[i].microOp)) {
                    const opcode = block$1.opcodes[i];
                    const elseStatements = this.getAssociatedElseStatement(opcode.offset, block$0);
                    const ifElseMicroOp = {
                        offset: opcode.offset,
                        microOp: {
                            instruction: "IF_ELSE_BRANCH",
                            args: [
                                opcode.microOp.args[0],
                                opcode.microOp.args[1],
                                {
                                    "type": "body",
                                    "value": elseStatements.map(labeledMicroOp => labeledMicroOp.microOp)
                                }
                            ]
                        }
                    };
                    conjoinedBlock.opcodes.push(ifElseMicroOp);
                    return conjoinedBlock;
                }
                conjoinedBlock.opcodes.push(block$0.opcodes[i]);
            }
            else {
                // console.log("UNKNOWN", JSON.stringify(block$1))
                return {
                    opcodes: []
                };
            }
        }
        return {
            opcodes: []
        };
    }
    // combineBlockPaths will combine the if else paths between blocks
    combineBlockPaths(blockMap) {
        blockMap.forEach((blocks, key) => {
            switch (blocks.length) {
                case 1:
                    // 1 length means this block only has 1 version
                    return;
                case 2:
                    const block$0 = blocks[0];
                    const block$1 = blocks[1];
                    var conjoined = this.combineIfElseBlocks(block$0, block$1);
                    if (conjoined.opcodes.length > 0) {
                        blocks[0] = conjoined;
                        blocks.pop();
                    }
                    return;
                case 3:
                    return;
                default:
                    return;
                    throw "UNHANDLED_BLOCK_LENGTH";
            }
        });
    }
    // removeDeadBlocks will identify blocks that only have 1 JMP opcode in it so we can just replace all references
    identifyDeadBlocks(blockMap) {
        blockMap.forEach((blocks, key) => {
            if (blocks.length == 1 && key != "_main" && blocks[0].opcodes.length == 1 && blocks[0].opcodes[0].microOp.instruction == "JMP") {
                console.log(key);
            }
        });
    }
    cleanUpJmps(blockMap) {
        blockMap.forEach((blocks, key) => {
        });
    }
    getIntermediateRepresentation() {
        const ir = {
            functions: new Map(),
        };
        this.functionTraces.forEach((traces, key) => {
            const functionRepresentation = {
                blocks: new Map(),
            };
            const blockMap = this.getBlockMap(traces);
            this.removeDuplicates(blockMap);
            this.combineBlockPaths(blockMap);
            this.identifyDeadBlocks(blockMap);
            blockMap.forEach((blocks, key) => {
                blocks.forEach((block, index) => {
                    if (index >= 1) {
                        functionRepresentation.blocks.set(key + `$${index}`, block);
                    }
                    else {
                        functionRepresentation.blocks.set(key, block);
                    }
                });
            });
            console.log(functionRepresentation);
            ir.functions.set(key, functionRepresentation);
        });
        return ir;
    }
    lift() {
        // this.functionTraces = this.removeDuplicates(this.functionTraces);
        return this.getIntermediateRepresentation();
        //this.liftFunctionTraceIntoIR();
    }
}
exports.IntermediateRepresentationLifter = IntermediateRepresentationLifter;
