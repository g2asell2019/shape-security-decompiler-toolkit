import traverse from "@babel/traverse";
import fs from "fs";
import * as babel from "@babel/core";
import { parse } from "@babel/parser";
import generate from "@babel/generator";

import {
  FunctionRepresentation,
  Opcode,
  Context,
  Instruction,
  MicroOp,
  Argument,
  Block,
  IntermediateRepresentation,
  LabeledMicroOpcode,
} from "./types";

export class JavascriptLifter {
  // stackTrace: {[key: string]: Opcode[][]}

  ir: IntermediateRepresentation;
  ast: babel.types.File;
  contexts: Context[];

  // registers just keeps track of initalized register indexes, registers is globally shared
  // registers: Map<number, boolean>;
  instructionLengthAssertion: Map<Instruction, number>;

  constructor(rep: IntermediateRepresentation) {
    // this.stackTrace = stackTrace
    this.ast = parse(`const globalObj = {}`);
    this.contexts = [
      {
        label: "_main",
        parentBody: this.ast.program.body,
        stack: new Map<number, boolean>(),
        statements: this.ast.program.body,
        registers: new Map<number, boolean>()
      },
    ];
    
    this.ir = rep;
    this.instructionLengthAssertion = new Map<Instruction, number>([
      ["PUSH", 2],
      ["SET", 2],
      ["DEFINE_PROPERTY", 3],
      ["SET_GLOBAL_EMPTY_OBJECT", 2],
      ["SAVE_CALL_FUNCTION", -1],
      ["JMP", 3],
      ["IF_BRANCH", 2],
      ["ELSE_BRANCH", 1],
      ["IF_ELSE_BRANCH", 3],
    ]);
  }

  private getRawValue(arg: Argument) {
    if (arg.type != "raw") {
      console.log(arg);
      throw "INVALID_ARG_NOT_RAW";
    }

    return arg.value;
  }
  private appendStatement(statement: babel.types.Statement) {
    this.contexts[0].statements.push(statement);
  }
  private getNodeFromValue(value: any): babel.types.Expression {
    if (value == null) {
      return babel.types.nullLiteral();
    }
    switch (typeof value) {
      case "undefined":
        return babel.types.nullLiteral();
      case "string":
        if (value == "window") {
          return babel.types.identifier("window");
        }
        return babel.types.stringLiteral(value);
      case "number":
        return babel.types.numericLiteral(value);
      case "object":
        if (Array.isArray(value)) {
          let elements: babel.types.Expression[] = [];

          for (var v in value) {
            elements.push(this.getNodeFromValue(v));
          }

          return babel.types.arrayExpression(elements);
        } else if (value.constructor == Object) {
          return babel.types.objectExpression([]);
        }

      case "boolean":
        return babel.types.booleanLiteral(value);

      default:
        console.log(typeof value);
    }
    throw "UNHANDLED_NODE_TYPE";
  }

  private translateArgumentIntoAST(arg: Argument): babel.types.Expression {
    switch (arg.type) {
      case "apply":
        var obj = this.translateArgumentIntoAST(arg.args[0]);
        var arg1 = this.translateArgumentIntoAST(arg.args[1]);
        var arg2 = this.translateArgumentIntoAST(arg.args[2]);

        return babel.types.callExpression(
          babel.types.memberExpression(obj, babel.types.identifier("apply")),
          [arg1, arg2]
        );
      case "newExpression":
        var args: babel.types.Expression[] = [];
        arg.args.slice(1).forEach((arg: any) => {
          args.push(this.translateArgumentIntoAST(arg));
        });

        return babel.types.newExpression(
          this.translateArgumentIntoAST(arg.args[0]),
          args
        );
      case "getGlobalEmptyObj":
        return babel.types.memberExpression(
          babel.types.identifier("globalObj"),
          this.translateArgumentIntoAST(arg.args[0]),
          true
        );
      case "binaryExpression":
        return babel.types.binaryExpression(
          this.getRawValue(arg.args[0]),
          this.translateArgumentIntoAST(arg.args[1]),
          this.translateArgumentIntoAST(arg.args[2])
        );
      case "register":
        return babel.types.identifier(`r${arg.value}`);
      case "stack":
        return babel.types.identifier(`s${arg.value}`);
      case "raw":
        return this.getNodeFromValue(arg.value);

      case "getProperty":
        return babel.types.memberExpression(
          this.translateArgumentIntoAST(arg.args[0]),
          this.translateArgumentIntoAST(arg.args[1]),
          true
        );
      case "stackSlice":
        var start = this.getRawValue(arg.args[0]);
        var end = this.getRawValue(arg.args[1]);

        var argArray = [];

        while (start <= end) {
          argArray.push(babel.types.identifier(`s${start}`));

          start++;
        }
        return babel.types.arrayExpression(argArray);

      case "identifier":
        return babel.types.identifier(arg.value);
      case "unaryExpression":
        return babel.types.unaryExpression(
          this.getRawValue(arg.args[0]),
          this.translateArgumentIntoAST(arg.args[1])
        );
      case "newOpcodeFunction":
        return babel.types.identifier(
          `fn_${this.getRawValue(arg.args[0])}_${this.getRawValue(arg.args[1])}`
        );
      case "function":
        return babel.types.identifier(`f${arg.value}`);
      case "fnCall":
        var args: babel.types.Expression[] = [];

        arg.args.slice(1).forEach((arg: any, index: number) => {
          args.push(this.translateArgumentIntoAST(arg));
        });

        return babel.types.callExpression(
          this.translateArgumentIntoAST(arg.args[0]),
          args
        );

      default:
        console.log(arg.type);

        fs.writeFileSync("output.js", generate(this.ast).code);
        throw "UNKNOWN";
    }
  }
  private isStackVariableInitalized(dst: number) {
    return this.contexts[0].stack.get(dst) != undefined;
  }
  private isRegisterVariableInitalized(dst: number) {
    return this.contexts[0].registers.get(dst) != undefined;
  }
  private translateSetInstruction(op: MicroOp) {
    const dst = this.getRawValue(op.args[0]);
    const value = this.translateArgumentIntoAST(op.args[1]);
    const variableName = `r${dst}`;

    if (!this.isRegisterVariableInitalized(dst)) {
      this.contexts[0].registers.set(dst, true);


      this.contexts[0].parentBody.unshift(
        babel.types.variableDeclaration("var", [
          babel.types.variableDeclarator(
            babel.types.identifier(variableName),
            babel.types.nullLiteral()
          ),
        ])
      );


   
    } 
    this.appendStatement(
      babel.types.expressionStatement(
        babel.types.assignmentExpression(
          "=",
          babel.types.identifier(variableName),
          value
        )
      )
    );
    
  }
  private translatePushInstruction(op: MicroOp) {
    const dst = this.getRawValue(op.args[0]);
    const value = this.translateArgumentIntoAST(op.args[1]);
    const variableName = `s${dst}`;

    if (!this.isStackVariableInitalized(dst)) {
      this.contexts[0].stack.set(dst, true);

      this.contexts[0].parentBody.unshift(
        babel.types.variableDeclaration("var", [
          babel.types.variableDeclarator(
            babel.types.identifier(variableName),
            babel.types.nullLiteral()
          ),
        ])
      );

    } 
    this.appendStatement(
      babel.types.expressionStatement(
        babel.types.assignmentExpression(
          "=",
          babel.types.identifier(variableName),
          value
        )
      )
    );
  }

  private translateDefineProperty(op: MicroOp) {
    this.appendStatement(
      babel.types.expressionStatement(
        babel.types.callExpression(
          babel.types.memberExpression(
            babel.types.identifier("Object"),
            babel.types.identifier("defineProperty")
          ),
          [
            this.translateArgumentIntoAST(op.args[0]),
            this.translateArgumentIntoAST(op.args[1]),
            babel.types.objectExpression([
              babel.types.objectProperty(
                babel.types.identifier("writable"),
                babel.types.booleanLiteral(true)
              ),
              babel.types.objectProperty(
                babel.types.identifier("configurable"),
                babel.types.booleanLiteral(true)
              ),
              babel.types.objectProperty(
                babel.types.identifier("enumerable"),
                babel.types.booleanLiteral(true)
              ),
              babel.types.objectProperty(
                babel.types.identifier("value"),
                this.translateArgumentIntoAST(op.args[2])
              ),
            ]),
          ]
        )
      )
    );
  }
  private translateCallExpression(op: MicroOp) {
    const dst = this.getRawValue(op.args[0]);
    var fn: babel.types.Expression = babel.types.nullLiteral();
    if (op.args[1].type == "raw") {
      fn = babel.types.identifier(op.args[1].value);
    } else {
      fn = this.translateArgumentIntoAST(op.args[1]);
    }

    const fnCallArgs: babel.types.Expression[] = [];

    op.args.slice(2).forEach((arg) => {
      fnCallArgs.push(this.translateArgumentIntoAST(arg));
    });

    this.appendStatement(
      babel.types.variableDeclaration("var", [
        babel.types.variableDeclarator(
          babel.types.identifier(`f${dst}`),
          babel.types.callExpression(fn, fnCallArgs)
        ),
      ])
    );
  }
  private translateSetGlobalObject(op: MicroOp) {
    const key = this.translateArgumentIntoAST(op.args[0]);
    const val = this.translateArgumentIntoAST(op.args[1]);

    this.appendStatement(
      babel.types.expressionStatement(
        babel.types.assignmentExpression(
          "=",
          babel.types.memberExpression(
            babel.types.identifier("globalObj"),
            key,
            true
          ),
          val
        )
      )
    );
  }
  private translateJMP(op: MicroOp) {
    this.appendStatement(
      babel.types.expressionStatement(
        babel.types.callExpression(babel.types.identifier(`block_${this.getRawValue(op.args[0])}_${this.getRawValue(op.args[1])}_${this.getRawValue(op.args[2])}`), [])
      )
    );
  }

  private translateIfElse(op: MicroOp) {
    const cond = this.translateArgumentIntoAST(op.args[0]);
    const consequentMicroOps: MicroOp[] = op.args[1].value;
    const consequent: babel.types.Statement[] = [];

    const consequentContext: Context = {
      label: this.contexts[0].label,
      stack: this.contexts[0].stack,
      statements: consequent,
      registers: this.contexts[0].registers,
      parentBody: this.contexts[0].parentBody
    };
    this.contexts.unshift(consequentContext);
    consequentMicroOps.forEach((m: MicroOp) => {
      this.translateMicroOp(m);
    });

    this.contexts.shift();

    const alternateMicroOps: LabeledMicroOpcode[] = op.args[2].value;
    const alternate: babel.types.Statement[] = [];

    const alternateContext: Context = {
      label: this.contexts[0].label,
      stack: this.contexts[0].stack,
      statements: alternate,
      registers: this.contexts[0].registers,
      parentBody: this.contexts[0].parentBody
    };
    this.contexts.unshift(alternateContext);
    alternateMicroOps.forEach((m: LabeledMicroOpcode) => {
  
      this.translateMicroOp(m.microOp);
    });

    this.contexts.shift();

    this.appendStatement(
      babel.types.ifStatement(
        cond,
        babel.types.blockStatement(consequent),
        babel.types.blockStatement(alternate)
      )
    );
  }
  private translateIf(op: MicroOp) {
    const cond = this.translateArgumentIntoAST(op.args[0]);
    const microOps: MicroOp[] = op.args[1].value;
    const consequent: babel.types.Statement[] = [];

    const context: Context = {
      label: this.contexts[0].label,
      stack: this.contexts[0].stack,
      statements: consequent,
      registers: this.contexts[0].registers,
      parentBody: this.contexts[0].parentBody
    };
    this.contexts.unshift(context);

    microOps.forEach((microOp: MicroOp) => {
      this.translateMicroOp(microOp);
    });

    this.contexts.shift();

    this.appendStatement(
      babel.types.ifStatement(cond, babel.types.blockStatement(consequent))
    );
  }
  private createNewFunctionContext(
    name: string,
    inheritedStack?: Map<number, boolean>,
    inheritedLabel?: string,
    inheritedRegisters?: Map<number, boolean>,
    parentBody?: babel.types.Statement[]
  ): Context {
    const stack = inheritedStack ? inheritedStack : new Map<number, boolean>();
    const statements: babel.types.Statement[] = [] 
    const parent = parentBody ? parentBody : statements
    const label = inheritedLabel ? inheritedLabel : name
    const registers = inheritedRegisters ? inheritedRegisters : new Map<number, boolean>()
    

    const context: Context = {
      label: label,
      stack: stack,
      statements: statements,
      registers: registers,
      parentBody: parent
    };
    this.contexts[0].statements.push(
      babel.types.functionDeclaration(
        babel.types.identifier(name),
        [],
        babel.types.blockStatement(context.statements)
      )
    );

    return context;
  }
  private translateFunctionRepresentation(
    fn: FunctionRepresentation,
    name: string
  ) {
    const parentContext = this.createNewFunctionContext(name);
    this.contexts.unshift(parentContext);

    fn.blocks.forEach((block, key) => {
      if (block.isDeadBlock) {
        return
      }
   
      if (key == "_main") {
        if (block.opcodes == undefined) {
          return;
        }
        block.opcodes.forEach((microOp) => {
          this.translateMicroOp(microOp.microOp);
        });
      } else {
        const context = this.createNewFunctionContext(
          `block_${key.replace(":", "_")}`,
          parentContext.stack,
          parentContext.label,
          parentContext.registers,
          parentContext.statements
        );
        this.contexts.unshift(context);

        if (block.opcodes == undefined) {
          return;
        }
        block.opcodes.forEach((labeledMicroOp) => {
          this.translateMicroOp(labeledMicroOp.microOp);
        });

        this.contexts.shift();
      }
    });
    this.contexts.shift();
  }

  // liftFunctionTrace lifts every function trace into a intermediate representation with blocks

  translateMicroOp(microOp: MicroOp) {
    var length = this.instructionLengthAssertion.get(microOp.instruction);

    if (!length) {
      console.log(microOp);
      console.log(microOp.instruction);
      throw "UNKNOWN_OPCODE";
    }
    if (length && length != -1 && length != microOp.args.length) {
      console.log(microOp);
      throw "INVALID_ARG_LENGTH";
    }

    switch (microOp.instruction) {
      case "IF_ELSE_BRANCH":
        this.translateIfElse(microOp);
        return;
      case "ELSE_BRANCH":
        // this.translateElse(microOp)
        return;
      case "IF_BRANCH":
        this.translateIf(microOp);
        return;
      case "JMP":
        this.translateJMP(microOp);
        return;
      case "PUSH":
        this.translatePushInstruction(microOp);

        return;
      case "SET":
        this.translateSetInstruction(microOp);
        return;
      case "DEFINE_PROPERTY":
        this.translateDefineProperty(microOp);
        return;
      case "SET_GLOBAL_EMPTY_OBJECT":
        this.translateSetGlobalObject(microOp);
        return;
      case "SAVE_CALL_FUNCTION":
        this.translateCallExpression(microOp);
        return;
      default:
        throw "UNKNOWN_OPCODE";
    }
  }

  lift(): babel.types.File {
    // this.cleanExecutionTrace()
    this.ir.functions.forEach((func, name) => {
      this.translateFunctionRepresentation(
        func,
        `fn_${name.replace(":", "_")}`
      );
    });
    return this.ast
    //fs.writeFileSync("output_fn.js", generate(this.ast).code);

    // fs.writeFileSync(`output.js`, generate(this.ast).code)
  }
}
