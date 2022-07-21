import {
  FunctionRepresentation,
  Opcode,
  Context,
  Instruction,
  MicroOp,
  Argument,
  Block,
  FunctionTrace,
  IntermediateRepresentation,
  LabeledMicroOpcode,
} from "./types";

import crypto from "crypto";
import fs from "fs";

export class IntermediateRepresentationLifter {
  functionTraces: Map<string, FunctionTrace[]>;
  blockMap: Map<string, Block[]>;

  constructor(stackTrace: Map<string, FunctionTrace[]>) {
    this.functionTraces = stackTrace;
    this.blockMap = new Map<string, Block[]>();
  }

  private getHash(obj: any) {
    return crypto.createHash("md5").update(JSON.stringify(obj)).digest("hex");
  }

  private removeDuplicates(mapOfTraces: Map<string, any[]>) {
    mapOfTraces.forEach((traces, key) => {
      const seenHashes: string[] = [];
      const uniqueTraces: any[] = [];

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
  private getBlockMap(traces: FunctionTrace[]): Map<string, Block[]> {
    var blockMap = new Map<string, Block[]>();

    traces.forEach((trace, index) => {
      var currentBlock: Block = {
        opcodes: [],
        isDeadBlock: false,
      };
    
      blockMap.set("_main", [currentBlock]);


      function enterNewBlock(microOp: MicroOp, offset: number) {
        const pc = microOp.args[0].value;
        const opc = microOp.args[1].value;
        microOp.args[2] = {
          "type": "raw",
          "value": offset
        }

        const key = `${pc}_${opc}_${offset}`;

        currentBlock = {
          opcodes: [],
          isDeadBlock: false,
        };

        const block = blockMap.get(key);


        if (block != undefined) {
          block.push(currentBlock);
        } else {
          blockMap.set(key, [currentBlock]);
        }
      }
      function appendOpcodeIntoBlock(microOp: MicroOp, offset: number) {
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
              if (
                microOp.args.length == 2 &&
                microOp.args[1].value[microOp.args[1].value.length - 1]
                  .instruction == "JMP"
              ) {
                enterNewBlock(
                  microOp.args[1].value[microOp.args[1].value.length - 1],
                  opcode.offset
                );
                return;
              } else {
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

  private getAssociatedElseStatement(offset: number, block: Block): LabeledMicroOpcode[] {

    for (var i=0;i<block.opcodes.length;i++) {
      const opcode = block.opcodes[i]
      if (opcode.offset == offset && opcode.microOp.instruction == "ELSE_BRANCH") {
        return block.opcodes.slice(i+1)
      }
    }
    
    throw "ELSE_ERROR"
  
  }
  private isIfJmp(microOp: MicroOp): boolean {
    return (microOp.instruction == "IF_BRANCH" && microOp.args[1].value[0].instruction == "JMP")

      

  }

  private combineIfElseBlocks(block$0: Block, block$1: Block): Block {
    const conjoinedBlock: Block = {
      opcodes: [],
      isDeadBlock: false,
    }

    const length = block$0.opcodes.length > block$1.opcodes.length ? block$0.opcodes.length : block$1.opcodes.length

    for (var i=0;i<length;i++) {
      if (block$0.opcodes[i] &&  block$1.opcodes[i] && block$0.opcodes[i].offset == block$1.opcodes[i].offset) {
 
      

        if (this.isIfJmp(block$0.opcodes[i].microOp)) {
          const opcode = block$0.opcodes[i]
          const elseStatements = this.getAssociatedElseStatement(opcode.offset, block$1)
          const ifElseMicroOp: LabeledMicroOpcode = {
            offset: opcode.offset,
            microOp: {
              instruction: "IF_ELSE_BRANCH",
              args: [
                opcode.microOp.args[0],
                opcode.microOp.args[1],
                {
                  "type": "body",
                  "value": elseStatements
                }
              ]
            }
          }
          conjoinedBlock.opcodes.push(ifElseMicroOp)
          return conjoinedBlock
  
  
        } 
        if (this.isIfJmp(block$1.opcodes[i].microOp)) {
          const opcode = block$1.opcodes[i]
          const elseStatements = this.getAssociatedElseStatement(opcode.offset, block$0)
          const ifElseMicroOp: LabeledMicroOpcode = {
            offset: opcode.offset,
            microOp: {
              instruction: "IF_ELSE_BRANCH",
              args: [
                opcode.microOp.args[0],
                opcode.microOp.args[1],
                {
                  "type": "body",
                  "value": elseStatements
                }
              ]
            }
          }
          conjoinedBlock.opcodes.push(ifElseMicroOp)
          return conjoinedBlock
  
  
        }
        conjoinedBlock.opcodes.push(block$0.opcodes[i])
        
      } else {
        // console.log("UNKNOWN", JSON.stringify(block$1))
        return {
          opcodes: [],
          isDeadBlock: false,
        }
      }
    }
   
    


 
    
    return {
      opcodes: [],
      isDeadBlock: false,
    }
  }

  // combineBlockPaths will combine the if else paths between blocks
  private combineBlockPaths(blockMap: Map<string, Block[]>) {
    blockMap.forEach((blocks, key) => {
      
      switch (blocks.length) {
        case 1:
          // 1 length means this block only has 1 version
          return
        case 2:
          const block$0 = blocks[0]
          const block$1 = blocks[1]
          var conjoined = this.combineIfElseBlocks(block$0, block$1)
          if (conjoined.opcodes.length > 0) {
          
            blocks[0] = conjoined
            blocks.pop()
          }
       
         
       
          return
        case 3:
          return
        
        default:
          return
          throw "UNHANDLED_BLOCK_LENGTH"
      }

    });
  }
  // removeDeadBlocks will identify blocks that only have 1 JMP opcode in it so we can just replace all references
  private identifyDeadBlocks(blockMap: Map<string, Block[]>) {
    blockMap.forEach((blocks, key) => {
      
      if (blocks.length == 1 && key != "_main" && blocks[0].opcodes.length == 1 && blocks[0].opcodes[0].microOp.instruction == "JMP") {
        // console.log(key)
        blocks[0].isDeadBlock = true
      }
    })
  }
  
  private getBlock(blockMap: Map<string, Block[]>, microOp: MicroOp, offset: number): Block {
    const pc = microOp.args[0].value;
    const opc = microOp.args[1].value;
    const blocks = blockMap.get(`${pc}_${opc}_${offset}`)
    if (blocks) {
      return blocks[0]
    } 
    throw "BLOCK_NOT_FOUND"
  }
  private replaceProxyJmps(blockMap: Map<string, Block[]>, opcode: LabeledMicroOpcode) {
    if (opcode.microOp.instruction == "JMP") {
      const block = this.getBlock(blockMap, opcode.microOp, opcode.offset)
     


      if (block.isDeadBlock) {
        console.log(`FOUND JMP TO DEAD BLOCK, REDIRECTING: ${opcode.offset} -> ${block.opcodes[0].offset}`)

        opcode.offset = block.opcodes[0].offset
        opcode.microOp = block.opcodes[0].microOp
      }

    }
  }
  private reduceProxyJmps(blockMap: Map<string, Block[]>) {
    

    blockMap.forEach((blocks, key) => {
      blocks.forEach((block)=> {
        block.opcodes.forEach((opcode)=> {
            if (opcode.microOp) {
              
              if (opcode.microOp.instruction == "IF_BRANCH") {
                opcode.microOp.args[1].value.forEach((microOp: MicroOp)=> {
                  
                  this.replaceProxyJmps(blockMap, {
                    offset: opcode.offset,
                    microOp: microOp
                  })
                })

                
              } else if (opcode.microOp.instruction == "IF_ELSE_BRANCH") {
                opcode.microOp.args[1].value.forEach((microOp: MicroOp)=> {
                  
                  this.replaceProxyJmps(blockMap, {
                    offset: opcode.offset,
                    microOp: microOp
                  })
                })
                opcode.microOp.args[2].value.forEach((labeledMicroOp: LabeledMicroOpcode)=> {
                 
                  this.replaceProxyJmps(blockMap, labeledMicroOp)
                })
              } else {
                this.replaceProxyJmps(blockMap, opcode)
              }
  
              
            }
            


        })
      })
    })
  }


  private getIntermediateRepresentation(): IntermediateRepresentation {
    const ir: IntermediateRepresentation = {
      functions: new Map<string, FunctionRepresentation>(),
    };
    this.functionTraces.forEach((traces, key) => {
      const functionRepresentation: FunctionRepresentation = {
        blocks: new Map<string, Block>(),
      };
      const blockMap = this.getBlockMap(traces);
      this.removeDuplicates(blockMap);
      this.combineBlockPaths(blockMap)
      // this.identifyDeadBlocks(blockMap)
      // this.reduceProxyJmps(blockMap)

      blockMap.forEach((blocks, key) => {
        blocks.forEach((block, index) => {
          if (index >= 1) {
            functionRepresentation.blocks.set(key + `$${index}`, block);
          } else {
            functionRepresentation.blocks.set(key, block);
          }
          
          
        });
      });
    
      ir.functions.set(key, functionRepresentation);
    });

    return ir;
  }




  public lift(): IntermediateRepresentation {
    // this.functionTraces = this.removeDuplicates(this.functionTraces);

    return this.getIntermediateRepresentation();
    //this.liftFunctionTraceIntoIR();
  }
}
