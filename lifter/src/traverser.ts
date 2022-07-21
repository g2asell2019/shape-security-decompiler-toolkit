import traverse from "@babel/traverse";

interface Rule {
  preserve: boolean;
  update: boolean;
  replaceKnownIdentifiers: boolean;
  saveVariable: boolean;
}

export class BlockStatementTraverser {
  blocksMap: Map<string, babel.types.FunctionDeclaration>;
  visited: string[];
  variableMap: Map<string, babel.types.Expression>;

  constructor(
    blocksMap: Map<string, babel.types.FunctionDeclaration>,
    variableMap: Map<string, babel.types.Expression>,
    visited: string[]
  ) {
    this.blocksMap = blocksMap;
    this.variableMap = variableMap;
    this.visited = visited;
  }
  private isStackVariable(name: string) {
    return name.length == 2 && name[0] == "s";
  }
  private isRegisterVaraible(name: string) {
    return name.length == 2 && name[0] == "r";
  }

  private replaceKnownIdentifiers(
    node: babel.types.Expression,
    path: babel.NodePath<babel.types.Statement>
  ) {
    traverse(
      node,
      {
        Identifier: (childrenPath) => {
          if (this.variableMap.has(childrenPath.node.name)) {
            const value = this.variableMap.get(childrenPath.node.name);
            if (value) {
              // console.log(`REPLACED ${path.node.name} WITH ${generate(value).code}`);
              childrenPath.replaceWith(value);
              childrenPath.skip();
            }
          }
        },
      },
      path.scope
    );
  }

  public reduceBlockStatement(
    node: babel.types.BlockStatement,
    path: babel.NodePath<babel.types.FunctionDeclaration>
  ) {
    const body: babel.types.Statement[] = [];
    node.body.forEach((node) => {
      if (
        node.type == "ExpressionStatement" &&
        node.expression.type == "CallExpression" &&
        node.expression.callee.type == "Identifier" &&
        node.expression.callee.name.includes("block_")
      ) {
        const name = node.expression.callee.name;
        if (this.visited.includes(name)) {
          console.log("ALREADY SEEN", name);
          return;
        }

        const blockFunction = this.blocksMap.get(name);
        if (!blockFunction) {
          throw "NOT_FOUND_NAME";
        }
        this.visited.push(name);
        this.reduceBlockStatement(blockFunction.body, path);

        if (this.blocksMap.has(name+"$1")) {
          const version$1BlockFunction = this.blocksMap.get(name+"$1");
          if (version$1BlockFunction) {
            this.reduceBlockStatement(version$1BlockFunction.body, path);

          }

          const version$2BlockFunction = this.blocksMap.get(name+"$2");
          if (version$2BlockFunction) {
            this.reduceBlockStatement(version$2BlockFunction.body, path);

          }
          
          
        }



        // const statements
        body.push(node);
      } else if (
        node.type == "ExpressionStatement" &&
        node.expression.type == "AssignmentExpression" &&
        node.expression.left.type == "Identifier"
      ) {
        const transformationRules: Map<string, Rule> = new Map<string, Rule>([
          [
            "ArrayExpression",
            {
              preserve: true,
              update: false,
              replaceKnownIdentifiers: false,
              saveVariable: true,
            },
          ],
          [
            "ObjectExpression",
            {
              preserve: true,
              update: false,
              replaceKnownIdentifiers: false,
              saveVariable: true,
            },
          ],
          [
            "NullLiteral",
            {
              preserve: false,
              update: true,
              replaceKnownIdentifiers: false,
              saveVariable: false,
            },
          ],
          [
            "NewExpression",
            {
              preserve: true,
              update: false,
              replaceKnownIdentifiers: true,
              saveVariable: true,
            },
          ],
          [
            "CallExpression",
            {
              preserve: true,
              update: false,
              replaceKnownIdentifiers: true,
              saveVariable: true,
            },
          ],
          [
            "MemberExpression",
            {
              preserve: false,
              update: true,
              replaceKnownIdentifiers: true,
              saveVariable: false,
            },
          ],
          [
            "BinaryExpression",
            {
              preserve: false,
              update: true,
              replaceKnownIdentifiers: true,
              saveVariable: false,
            },
          ],
          [
            "UnaryExpression",
            {
              preserve: false,
              update: true,
              replaceKnownIdentifiers: true,
              saveVariable: false,
            },
          ],
          [
            "BooleanLiteral",
            {
              preserve: false,
              update: true,
              replaceKnownIdentifiers: false,
              saveVariable: false,
            },
          ],
          [
            "StringLiteral",
            {
              preserve: false,
              update: true,
              replaceKnownIdentifiers: false,
              saveVariable: false,
            },
          ],
          [
            "NumericLiteral",
            {
              preserve: false,
              update: true,
              replaceKnownIdentifiers: false,
              saveVariable: false,
            },
          ],
        ]);
        if (node.expression.right.type == "Identifier") {
          if (this.isStackVariable(node.expression.left.name)) {
            if (this.variableMap.has(node.expression.right.name)) {
              const val = this.variableMap.get(node.expression.right.name);
              if (val) {
                this.variableMap.set(node.expression.left.name, val);
              }
              return;
            } else {
              this.variableMap.set(
                node.expression.left.name,
                node.expression.right
              );
            } 
          } else if (this.isRegisterVaraible(node.expression.left.name)) {
            if (this.variableMap.has(node.expression.right.name)) {
              const val = this.variableMap.get(node.expression.right.name)
              if (val) {
                node.expression.right = val
              }
              
            }
            body.push(node);
          } else {
            body.push(node);
          }

          return;
        }
        const rule = transformationRules.get(node.expression.right.type);
        if (!rule) {
          console.log(node.expression.type);
          throw "UNKNOWN_EXPRESSION";
        }
        if (rule.replaceKnownIdentifiers) {
          // we try to simplify the expression
          this.replaceKnownIdentifiers(node.expression.right, path);
        }
        if (rule.update) {
          // we update the value in the map
          this.variableMap.set(
            node.expression.left.name,
            node.expression.right
          );
        }
        if (rule.saveVariable) {
          this.variableMap.delete(node.expression.left.name);
        }

        if (rule.preserve) {
          // we don't delete the node

          body.push(node);
        }
        return;
      } else if (
        node.type == "ExpressionStatement" &&
        node.expression.type == "CallExpression" &&
        node.expression.callee.type == "MemberExpression" &&
        node.expression.callee.property.type == "Identifier" &&
        node.expression.callee.property.name == "defineProperty"
      ) {
        this.replaceKnownIdentifiers(node.expression, path);
        body.push(node);
      } else if (
        node.type == "IfStatement" &&
        node.consequent.type == "BlockStatement"
      ) {
        this.reduceBlockStatement(node.consequent, path);

        if (node.alternate && node.alternate.type == "BlockStatement") {
          const traverser = new BlockStatementTraverser(
            this.blocksMap,
            new Map(this.variableMap),
            this.visited
          );
          traverser.reduceBlockStatement(node.alternate, path);
          console.log("EXPLORING ALTERNATE PATH");
        }

        body.push(node);
      } else {
        body.push(node);
      }
    });

    // console.log(body.length)
    node.body = body;
  }
}
