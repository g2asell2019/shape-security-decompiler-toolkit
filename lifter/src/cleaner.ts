import traverse from "@babel/traverse";
import fs from "fs";
import * as babel from "@babel/core";
import generate from "@babel/generator";
import { BlockStatementTraverser } from "./traverser";

interface Item {
  node: babel.types.BlockStatement
  path: babel.NodePath<babel.types.FunctionDeclaration>
}

export class JavascriptBeautifier {
  ast: babel.types.File;
  variableMap: Map<string, babel.types.Expression>;
  blockNodes: Map<string, babel.types.FunctionDeclaration>;

  constructor(ast: babel.types.File) {
    this.ast = ast;
    this.variableMap = new Map<string, babel.types.Expression>();
    this.blockNodes = new Map<string, babel.types.FunctionDeclaration>();
  }

 

  private isParentFunction(name: string) {
    return name.includes("fn_");
  }
  private traverseParentFunctions() {
  


    traverse(this.ast, {
      FunctionDeclaration: (path) => {
        if (path.node.id && this.isParentFunction(path.node.id.name)) {
          path.traverse({
            FunctionDeclaration: (path) => {
              if (path.node.id) {
                this.blockNodes.set(path.node.id.name, path.node);
              }
            },
          });
          const traverser = new BlockStatementTraverser(this.blockNodes, new Map(this.variableMap), [])
          traverser.reduceBlockStatement(path.node.body, path);
        
          
        }
      },
    });
   

  }
  
  private removeEmptyBlocks() {
    
    traverse(this.ast, {
      FunctionDeclaration: (path) => {
        if (path.node.id && this.isParentFunction(path.node.id.name)) {
          const redirectMap: Map<string, string> = new Map<string, string>()

          path.traverse({
            FunctionDeclaration: (path) => {
              if (path.node.id && path.node.body.body.length == 1) {
                const node = path.node.body.body[0]
                if (node.type == "ExpressionStatement" &&
                    node.expression.type == "CallExpression" &&
                    node.expression.callee.type == "Identifier" &&
                    node.expression.callee.name.includes("block_")) {
                    
                    redirectMap.set(path.node.id.name, node.expression.callee.name)

                    path.remove()
                    path.skip()
                }
              }
            },
          });
          path.traverse({
            CallExpression: (path) => {
              if (path.node.callee.type == "Identifier" && redirectMap.has(path.node.callee.name)) {
                const redirectedPath = redirectMap.get(path.node.callee.name)
                if (redirectedPath) {
                  path.replaceWith(babel.types.callExpression(babel.types.identifier(redirectedPath), []))
                }
               
              }
            }
          })
        
          
        }
      },
    });
    
  }

  clean(): string {
    this.traverseParentFunctions();
    this.removeEmptyBlocks();
    return generate(this.ast).code
  }
}
