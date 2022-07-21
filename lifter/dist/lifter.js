"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavascriptLifter = void 0;
const fs_1 = __importDefault(require("fs"));
const babel = __importStar(require("@babel/core"));
const parser_1 = require("@babel/parser");
const generator_1 = __importDefault(require("@babel/generator"));
class JavascriptLifter {
    constructor(rep) {
        // this.stackTrace = stackTrace
        this.ast = (0, parser_1.parse)(`const globalObj = {}`);
        this.contexts = [
            {
                label: "_main",
                parentBody: this.ast.program.body,
                stack: new Map(),
                statements: this.ast.program.body,
                registers: new Map()
            },
        ];
        this.ir = rep;
        this.instructionLengthAssertion = new Map([
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
    getRawValue(arg) {
        if (arg.type != "raw") {
            console.log(arg);
            throw "INVALID_ARG_NOT_RAW";
        }
        return arg.value;
    }
    appendStatement(statement) {
        this.contexts[0].statements.push(statement);
    }
    getNodeFromValue(value) {
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
                    let elements = [];
                    for (var v in value) {
                        elements.push(this.getNodeFromValue(v));
                    }
                    return babel.types.arrayExpression(elements);
                }
                else if (value.constructor == Object) {
                    return babel.types.objectExpression([]);
                }
            case "boolean":
                return babel.types.booleanLiteral(value);
            default:
                console.log(typeof value);
        }
        throw "UNHANDLED_NODE_TYPE";
    }
    translateArgumentIntoAST(arg) {
        switch (arg.type) {
            case "apply":
                var obj = this.translateArgumentIntoAST(arg.args[0]);
                var arg1 = this.translateArgumentIntoAST(arg.args[1]);
                var arg2 = this.translateArgumentIntoAST(arg.args[2]);
                return babel.types.callExpression(babel.types.memberExpression(obj, babel.types.identifier("apply")), [arg1, arg2]);
            case "newExpression":
                var args = [];
                arg.args.slice(1).forEach((arg) => {
                    args.push(this.translateArgumentIntoAST(arg));
                });
                return babel.types.newExpression(this.translateArgumentIntoAST(arg.args[0]), args);
            case "getGlobalEmptyObj":
                return babel.types.memberExpression(babel.types.identifier("globalObj"), this.translateArgumentIntoAST(arg.args[0]), true);
            case "binaryExpression":
                return babel.types.binaryExpression(this.getRawValue(arg.args[0]), this.translateArgumentIntoAST(arg.args[1]), this.translateArgumentIntoAST(arg.args[2]));
            case "register":
                return babel.types.identifier(`r${arg.value}`);
            case "stack":
                return babel.types.identifier(`s${arg.value}`);
            case "raw":
                return this.getNodeFromValue(arg.value);
            case "getProperty":
                return babel.types.memberExpression(this.translateArgumentIntoAST(arg.args[0]), this.translateArgumentIntoAST(arg.args[1]), true);
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
                return babel.types.unaryExpression(this.getRawValue(arg.args[0]), this.translateArgumentIntoAST(arg.args[1]));
            case "newOpcodeFunction":
                return babel.types.identifier(`fn_${this.getRawValue(arg.args[0])}_${this.getRawValue(arg.args[1])}`);
            case "function":
                return babel.types.identifier(`f${arg.value}`);
            case "fnCall":
                var args = [];
                arg.args.slice(1).forEach((arg, index) => {
                    args.push(this.translateArgumentIntoAST(arg));
                });
                return babel.types.callExpression(this.translateArgumentIntoAST(arg.args[0]), args);
            default:
                console.log(arg.type);
                fs_1.default.writeFileSync("output.js", (0, generator_1.default)(this.ast).code);
                throw "UNKNOWN";
        }
    }
    isStackVariableInitalized(dst) {
        return this.contexts[0].stack.get(dst) != undefined;
    }
    isRegisterVariableInitalized(dst) {
        return this.contexts[0].registers.get(dst) != undefined;
    }
    translateSetInstruction(op) {
        const dst = this.getRawValue(op.args[0]);
        const value = this.translateArgumentIntoAST(op.args[1]);
        const variableName = `r${dst}`;
        if (!this.isRegisterVariableInitalized(dst)) {
            this.contexts[0].registers.set(dst, true);
            this.contexts[0].parentBody.unshift(babel.types.variableDeclaration("var", [
                babel.types.variableDeclarator(babel.types.identifier(variableName), babel.types.nullLiteral()),
            ]));
        }
        this.appendStatement(babel.types.expressionStatement(babel.types.assignmentExpression("=", babel.types.identifier(variableName), value)));
    }
    translatePushInstruction(op) {
        const dst = this.getRawValue(op.args[0]);
        const value = this.translateArgumentIntoAST(op.args[1]);
        const variableName = `s${dst}`;
        if (!this.isStackVariableInitalized(dst)) {
            this.contexts[0].stack.set(dst, true);
            this.contexts[0].parentBody.unshift(babel.types.variableDeclaration("var", [
                babel.types.variableDeclarator(babel.types.identifier(variableName), babel.types.nullLiteral()),
            ]));
        }
        this.appendStatement(babel.types.expressionStatement(babel.types.assignmentExpression("=", babel.types.identifier(variableName), value)));
    }
    translateDefineProperty(op) {
        this.appendStatement(babel.types.expressionStatement(babel.types.callExpression(babel.types.memberExpression(babel.types.identifier("Object"), babel.types.identifier("defineProperty")), [
            this.translateArgumentIntoAST(op.args[0]),
            this.translateArgumentIntoAST(op.args[1]),
            babel.types.objectExpression([
                babel.types.objectProperty(babel.types.identifier("writable"), babel.types.booleanLiteral(true)),
                babel.types.objectProperty(babel.types.identifier("configurable"), babel.types.booleanLiteral(true)),
                babel.types.objectProperty(babel.types.identifier("enumerable"), babel.types.booleanLiteral(true)),
                babel.types.objectProperty(babel.types.identifier("value"), this.translateArgumentIntoAST(op.args[2])),
            ]),
        ])));
    }
    translateCallExpression(op) {
        const dst = this.getRawValue(op.args[0]);
        var fn = babel.types.nullLiteral();
        if (op.args[1].type == "raw") {
            fn = babel.types.identifier(op.args[1].value);
        }
        else {
            fn = this.translateArgumentIntoAST(op.args[1]);
        }
        const fnCallArgs = [];
        op.args.slice(2).forEach((arg) => {
            fnCallArgs.push(this.translateArgumentIntoAST(arg));
        });
        this.appendStatement(babel.types.variableDeclaration("var", [
            babel.types.variableDeclarator(babel.types.identifier(`f${dst}`), babel.types.callExpression(fn, fnCallArgs)),
        ]));
    }
    translateSetGlobalObject(op) {
        const key = this.translateArgumentIntoAST(op.args[0]);
        const val = this.translateArgumentIntoAST(op.args[1]);
        this.appendStatement(babel.types.expressionStatement(babel.types.assignmentExpression("=", babel.types.memberExpression(babel.types.identifier("globalObj"), key, true), val)));
    }
    translateJMP(op) {
        this.appendStatement(babel.types.expressionStatement(babel.types.callExpression(babel.types.identifier(`block_${this.getRawValue(op.args[0])}_${this.getRawValue(op.args[1])}_${this.getRawValue(op.args[2])}`), [])));
    }
    translateIfElse(op) {
        const cond = this.translateArgumentIntoAST(op.args[0]);
        const consequentMicroOps = op.args[1].value;
        const consequent = [];
        const consequentContext = {
            label: this.contexts[0].label,
            stack: this.contexts[0].stack,
            statements: consequent,
            registers: this.contexts[0].registers,
            parentBody: this.contexts[0].parentBody
        };
        this.contexts.unshift(consequentContext);
        consequentMicroOps.forEach((m) => {
            this.translateMicroOp(m);
        });
        this.contexts.shift();
        const alternateMicroOps = op.args[2].value;
        const alternate = [];
        const alternateContext = {
            label: this.contexts[0].label,
            stack: this.contexts[0].stack,
            statements: alternate,
            registers: this.contexts[0].registers,
            parentBody: this.contexts[0].parentBody
        };
        this.contexts.unshift(alternateContext);
        alternateMicroOps.forEach((m) => {
            this.translateMicroOp(m.microOp);
        });
        this.contexts.shift();
        this.appendStatement(babel.types.ifStatement(cond, babel.types.blockStatement(consequent), babel.types.blockStatement(alternate)));
    }
    translateIf(op) {
        const cond = this.translateArgumentIntoAST(op.args[0]);
        const microOps = op.args[1].value;
        const consequent = [];
        const context = {
            label: this.contexts[0].label,
            stack: this.contexts[0].stack,
            statements: consequent,
            registers: this.contexts[0].registers,
            parentBody: this.contexts[0].parentBody
        };
        this.contexts.unshift(context);
        microOps.forEach((microOp) => {
            this.translateMicroOp(microOp);
        });
        this.contexts.shift();
        this.appendStatement(babel.types.ifStatement(cond, babel.types.blockStatement(consequent)));
    }
    createNewFunctionContext(name, inheritedStack, inheritedLabel, inheritedRegisters, parentBody) {
        const stack = inheritedStack ? inheritedStack : new Map();
        const statements = [];
        const parent = parentBody ? parentBody : statements;
        const label = inheritedLabel ? inheritedLabel : name;
        const registers = inheritedRegisters ? inheritedRegisters : new Map();
        const context = {
            label: label,
            stack: stack,
            statements: statements,
            registers: registers,
            parentBody: parent
        };
        this.contexts[0].statements.push(babel.types.functionDeclaration(babel.types.identifier(name), [], babel.types.blockStatement(context.statements)));
        return context;
    }
    translateFunctionRepresentation(fn, name) {
        const parentContext = this.createNewFunctionContext(name);
        this.contexts.unshift(parentContext);
        fn.blocks.forEach((block, key) => {
            if (block.isDeadBlock) {
                return;
            }
            if (key == "_main") {
                if (block.opcodes == undefined) {
                    return;
                }
                block.opcodes.forEach((microOp) => {
                    this.translateMicroOp(microOp.microOp);
                });
            }
            else {
                const context = this.createNewFunctionContext(`block_${key.replace(":", "_")}`, parentContext.stack, parentContext.label, parentContext.registers, parentContext.statements);
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
    translateMicroOp(microOp) {
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
    lift() {
        // this.cleanExecutionTrace()
        this.ir.functions.forEach((func, name) => {
            this.translateFunctionRepresentation(func, `fn_${name.replace(":", "_")}`);
        });
        return this.ast;
        //fs.writeFileSync("output_fn.js", generate(this.ast).code);
        // fs.writeFileSync(`output.js`, generate(this.ast).code)
    }
}
exports.JavascriptLifter = JavascriptLifter;
