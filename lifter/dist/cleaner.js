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
exports.JavascriptBeautifier = void 0;
const traverse_1 = __importDefault(require("@babel/traverse"));
const babel = __importStar(require("@babel/core"));
const generator_1 = __importDefault(require("@babel/generator"));
const traverser_1 = require("./traverser");
class JavascriptBeautifier {
    constructor(ast) {
        this.ast = ast;
        this.variableMap = new Map();
        this.blockNodes = new Map();
    }
    isParentFunction(name) {
        return name.includes("fn_");
    }
    traverseParentFunctions() {
        (0, traverse_1.default)(this.ast, {
            FunctionDeclaration: (path) => {
                if (path.node.id && this.isParentFunction(path.node.id.name)) {
                    path.traverse({
                        FunctionDeclaration: (path) => {
                            if (path.node.id) {
                                this.blockNodes.set(path.node.id.name, path.node);
                            }
                        },
                    });
                    const traverser = new traverser_1.BlockStatementTraverser(this.blockNodes, new Map(this.variableMap), []);
                    traverser.reduceBlockStatement(path.node.body, path);
                }
            },
        });
    }
    removeEmptyBlocks() {
        (0, traverse_1.default)(this.ast, {
            FunctionDeclaration: (path) => {
                if (path.node.id && this.isParentFunction(path.node.id.name)) {
                    const redirectMap = new Map();
                    path.traverse({
                        FunctionDeclaration: (path) => {
                            if (path.node.id && path.node.body.body.length == 1) {
                                const node = path.node.body.body[0];
                                if (node.type == "ExpressionStatement" &&
                                    node.expression.type == "CallExpression" &&
                                    node.expression.callee.type == "Identifier" &&
                                    node.expression.callee.name.includes("block_")) {
                                    redirectMap.set(path.node.id.name, node.expression.callee.name);
                                    path.remove();
                                    path.skip();
                                }
                            }
                        },
                    });
                    path.traverse({
                        CallExpression: (path) => {
                            if (path.node.callee.type == "Identifier" && redirectMap.has(path.node.callee.name)) {
                                const redirectedPath = redirectMap.get(path.node.callee.name);
                                if (redirectedPath) {
                                    path.replaceWith(babel.types.identifier(redirectedPath));
                                }
                            }
                        }
                    });
                }
            },
        });
    }
    clean() {
        this.traverseParentFunctions();
        this.removeEmptyBlocks();
        return (0, generator_1.default)(this.ast).code;
    }
}
exports.JavascriptBeautifier = JavascriptBeautifier;
