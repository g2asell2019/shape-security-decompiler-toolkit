import traverse from "@babel/traverse";
import fs from "fs";
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

  clean() {
    this.traverseParentFunctions();
    fs.writeFileSync("cleaned.js", generate(this.ast).code);
  }
}
