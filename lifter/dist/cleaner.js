"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavascriptBeautifier = void 0;
const traverse_1 = __importDefault(require("@babel/traverse"));
const fs_1 = __importDefault(require("fs"));
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
    clean() {
        this.traverseParentFunctions();
        fs_1.default.writeFileSync("cleaned.js", (0, generator_1.default)(this.ast).code);
    }
}
exports.JavascriptBeautifier = JavascriptBeautifier;
