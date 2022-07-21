import traverse from '@babel/traverse';
import fs from 'fs'
import * as babel from "@babel/core";

import generate from '@babel/generator';
import crypto from 'crypto'
import { parse } from '@babel/parser';

interface Config {
    
    arrayCounter: number
    byteCounter: number
    popCount: number
    stringCount: number
    variableCount: number
    fnCallCount: number
    newDeclCount: number
    
}


export class Labeler {
    ast: babel.types.File


    constructor(ast: babel.types.File) {
        this.ast = ast
    }

    labelVirtualMachine(): string {

        this.labelVirtualMachineEnvironment()
        this.labelOpcodeHandlers()
        this.ast.program.body.unshift(babel.types.expressionStatement(babel.types.callExpression(
            babel.types.identifier("setInterval"),
            [
                babel.types.functionExpression(
                    null,
                    [],
                    babel.types.blockStatement(
                        [
                            babel.types.variableDeclaration(
                                "var",
                                [
                                    babel.types.variableDeclarator(
                                        babel.types.identifier("a"),
                                        babel.types.callExpression(
                                            babel.types.memberExpression(
                                                babel.types.identifier("document"),
                                                babel.types.identifier("createElement")
                                            ),
                                            [
                                                babel.types.stringLiteral("a")
                                            ]
                                        )
                                    )
                                ]
                            ),
                            babel.types.variableDeclaration(
                                "var",
                                [
                                    babel.types.variableDeclarator(
                                        babel.types.identifier("file"),
                                        babel.types.newExpression(
                                            babel.types.identifier("Blob"),
                                            [
                                                babel.types.arrayExpression(
                                                    [babel.types.callExpression(
                                                        babel.types.memberExpression(
                                                            babel.types.identifier("JSON"),
                                                            babel.types.identifier("stringify")
                                                        ),
                                                        [
                                                            babel.types.identifier("stackTrace")
                                                            
                                                            
                                                        ]
                                                    )]
                                                ),
                                                babel.types.objectExpression(
                                                    [
                                                        babel.types.objectProperty(
                                                            babel.types.identifier("type"),
                                                            babel.types.stringLiteral("text/json")
                                                        )
                                                    ]
                                                ),
                                            ]
                                        )
                                    )
                                ]
                            ),
                            babel.types.expressionStatement(
                                babel.types.assignmentExpression(
                                    "=",
                                    babel.types.memberExpression(
                                        babel.types.identifier("a"),
                                        babel.types.identifier("href")
                                    ),
                                    babel.types.callExpression(
                                        babel.types.memberExpression(
                                            babel.types.identifier("URL"),
                                            babel.types.identifier("createObjectURL")
                                        ),
                                        [
                                            babel.types.identifier("file")
                                        ]
                                    )
                                )
                            ),
                            babel.types.expressionStatement(
                                babel.types.assignmentExpression(
                                    "=",
                                    babel.types.memberExpression(
                                        babel.types.identifier("a"),
                                        babel.types.identifier("download")
                                    ),
                                    babel.types.stringLiteral("vm_call_stack.json")
                                )
                            ),
                            babel.types.expressionStatement(
                                babel.types.callExpression(
                                    babel.types.memberExpression(
                                        babel.types.identifier("a"),
                                        babel.types.identifier("click")
                                    ),
                                    []
                                )
                            ),
                            babel.types.expressionStatement(
                                babel.types.callExpression(
                                    babel.types.memberExpression(
                                        babel.types.identifier("a"),
                                        babel.types.identifier("remove")
                                    ),
                                    []
                                )
                            )
                        ]
                    )
                ),
                babel.types.numericLiteral(15000)
            ]
        )))
        this.ast.program.body.unshift(babel.types.variableDeclaration(
            "var", 
            [

                babel.types.variableDeclarator(
                    babel.types.identifier("stackTrace"),
                    babel.types.objectExpression([])
                )
            ]
        ))
        
   

        // this.injectTracer()

        return generate(this.ast).code
    }

    
    private renameVariable(path: babel.NodePath < babel.types.BlockStatement | babel.types.FunctionDeclaration | babel.types.FunctionExpression > | babel.NodePath < babel.types.Statement > , node: babel.types.Statement | babel.types.MemberExpression | babel.types.Identifier, newName: string) {
        if (node.type == "VariableDeclaration") {
            if (node.declarations.length == 1) {
                var decl = node.declarations[0]
                if (decl.id.type == "Identifier") {

                    path.scope.rename(decl.id.name, newName)
                }

            }
        } else if (node.type == "FunctionDeclaration") {
            if (node.id && node.id.type == "Identifier") {

                path.scope.rename(node.id.name, newName)
            }
        } else if (node.type == "MemberExpression") {

            if (node.property && node.property.type == "Identifier") {
                path.scope.rename(node.property.name, newName)

            }
        } else if (node.type == "Identifier") {
            path.scope.rename(node.name, newName)
        }
    }
    private removeNodes(body: babel.types.Statement[] , toRemove: babel.types.Statement[]): babel.types.Statement[]  {
        return body.filter((node) => (!toRemove.includes(node)))
    }
    private replaceProxyVariable(path: babel.NodePath < babel.types.BlockStatement | babel.types.FunctionDeclaration | babel.types.FunctionExpression > , proxyIdentifierDeclarations: babel.types.Statement) {
        if (proxyIdentifierDeclarations.type == "VariableDeclaration") {

            for (let i = 0; i < proxyIdentifierDeclarations.declarations.length; i++) {
                var proxyDecl = proxyIdentifierDeclarations.declarations[i]
                if (proxyDecl.id.type == "Identifier" && proxyDecl.init) {

                    path.scope.getBinding(proxyDecl.id.name)?.referencePaths.forEach((path) => {
                        if (proxyDecl.init) {

                            path.replaceWith(proxyDecl.init)
                        }

                    })
                }


            }
        }
    }

    private labelVirtualMachineEnvironment() {

        var registersProperties: {
            [oldProperty: string]: string
        } = {}
        var vmProperties: {
            [oldProperty: string]: string
        } = {}
        var customArrProperties: {
            [oldProperty: string]: string
        } = {}

        const renameVariable = this.renameVariable
        const replaceProxyVariable = this.replaceProxyVariable
        const removeNodes = this.removeNodes

        const renameProperty = function(node: babel.types.ExpressionStatement, newProperty: string) {
            if (node.type == "ExpressionStatement" &&
                node.expression.type == "AssignmentExpression" &&
                node.expression.left.type == "MemberExpression" &&
                node.expression.left.property.type == "Identifier") {
                vmProperties[node.expression.left.property.name] = newProperty
                node.expression.left.property.name = newProperty
            }
        }

        const reduceInitVm = function(path: babel.NodePath < babel.types.FunctionDeclaration > ) {
            if (path.node.params.length == 8 && path.node.body.body.length == 7) {

                const pc = path.node.params[0]
                const oc = path.node.params[1]
                const previousRegister = path.node.params[2]
                const paramA = path.node.params[3]
                const paramB = path.node.params[4]
                const paramC = path.node.params[5]
                const paramD = path.node.params[6]
                const paramE = path.node.params[7]


                if (pc.type == "Identifier" &&
                    oc.type == "Identifier" &&
                    previousRegister.type == "Identifier" &&
                    paramA.type == "Identifier" &&
                    paramB.type == "Identifier" &&
                    paramC.type == "Identifier" &&
                    paramD.type == "Identifier" &&
                    paramE.type == "Identifier") {

                    path.scope.rename(pc.name, "programCounter")
                    path.scope.rename(oc.name, "opcodeHandlerCounter")
                    path.scope.rename(previousRegister.name, "previousRegister")
                    path.scope.rename(paramA.name, "_paramA")
                    path.scope.rename(paramB.name, "_paramB")
                    path.scope.rename(paramC.name, "_paramC")
                    path.scope.rename(paramD.name, "_paramD")
                    path.scope.rename(paramE.name, "_paramE")
                }

                const register = path.node.body.body[0]
                const isParamDUndefined = path.node.body.body[2]
                if (register.type == "VariableDeclaration") {
                    renameVariable(path, register, "registers")
                    renameVariable(path, isParamDUndefined, "isParamDUndefined")

                }

                const forLoopCopy = path.node.body.body[3]


                if (forLoopCopy.type == "ForStatement") {
                    if (forLoopCopy.init?.type == "SequenceExpression" &&
                        forLoopCopy.test &&
                        forLoopCopy.test.type == "BinaryExpression" &&
                        forLoopCopy.update?.type == "UpdateExpression" &&
                        forLoopCopy.body.type == "BlockStatement" &&
                        forLoopCopy.body.body.length == 1 &&
                        forLoopCopy.body.body[0].type == "ExpressionStatement") {
                        forLoopCopy.init = babel.types.variableDeclaration(
                            "var",
                            [
                                babel.types.variableDeclarator(
                                    babel.types.identifier("i"),
                                    babel.types.numericLiteral(0)
                                )
                            ]
                        )

                        forLoopCopy.test.left = babel.types.identifier("i")
                        forLoopCopy.test.right = babel.types.memberExpression(
                            babel.types.identifier("_paramB"),
                            babel.types.identifier("length")
                        )
                        forLoopCopy.update = babel.types.updateExpression(
                            "++",
                            babel.types.identifier("i"),
                            true,
                        )


                        forLoopCopy.body.body[0] = babel.types.expressionStatement(
                            babel.types.assignmentExpression(
                                "=",
                                babel.types.memberExpression(
                                    babel.types.memberExpression(
                                        babel.types.identifier("registers"),
                                        babel.types.identifier("reg"),
                                    ),
                                    babel.types.memberExpression(
                                        babel.types.identifier("_paramB"),
                                        babel.types.identifier("i"),
                                        true,
                                    ),
                                    true,
                                ),
                                babel.types.memberExpression(
                                    babel.types.memberExpression(
                                        babel.types.identifier("previousRegister"),
                                        babel.types.identifier("reg"),
                                    ),
                                    babel.types.memberExpression(
                                        babel.types.identifier("_paramB"),
                                        babel.types.identifier("i"),
                                        true,
                                    ),
                                    true,
                                )
                            )
                        )


                    }
                }


                const newVmCall = path.node.body.body[4]
                if (newVmCall.type == "ExpressionStatement" && newVmCall.expression.type == "AssignmentExpression" && newVmCall.expression.left.type == "Identifier") {
                    path.node.body.body[4] = babel.types.variableDeclaration(
                        "var",
                        [babel.types.variableDeclarator(
                            newVmCall.expression.left,
                            newVmCall.expression.right,
                        )]
                    )
                    path.scope.rename(newVmCall.expression.left.name, "vmContext")
                }

                path.node.body.body.splice(1, 1)


            }


        }
        const reduceTryCatchExecInstruction = function(path: babel.NodePath < babel.types.FunctionDeclaration > ) {
            if (path.node.params.length == 2 && path.node.body.body.length == 1) {
                const tryCatch = path.node.body.body[0]
                if (tryCatch.type == "TryStatement" && tryCatch.block.body[0].type == "ExpressionStatement") {
                    tryCatch.block.body[0] = babel.types.returnStatement(tryCatch.block.body[0].expression)
                    

                    if (tryCatch.handler && tryCatch.handler.param && tryCatch.handler.param.type == "Identifier") {
                        tryCatch.handler.body.body.unshift(babel.types.expressionStatement(babel.types.callExpression(
                            babel.types.memberExpression(
                                babel.types.identifier("console"),
                                babel.types.identifier("log"),
                                
                            ),
                            [
                                tryCatch.handler.param
                            ]
                        )))

                        
                    }
                } 
                

                const opcodeHandler = path.node.params[0]
                const vmContext = path.node.params[1]

                if (opcodeHandler.type == "Identifier") {
                    path.scope.rename(opcodeHandler.name, "opcodeHandler")
                }

                if (vmContext.type == "Identifier") {
                    path.scope.rename(vmContext.name, "vmContext")
                }
            }
        }
        const reduceCatchExec = function(path: babel.NodePath < babel.types.FunctionDeclaration > ) {
            if (path.node.params.length == 2) {
                const pc = path.node.params[0]
                const vmContext = path.node.params[1]


                if (vmContext.type == "Identifier") {
                    path.scope.rename(vmContext.name, "vmContext")
                }
            }
        }
        const reduceVm = function(path: babel.NodePath < babel.types.FunctionDeclaration > ) {
            if (path.node.params.length == 4 && path.node.body.body.length == 10) {
                const pc = path.node.params[0]
                const oc = path.node.params[1]
                const st = path.node.params[2]
                const wi = path.node.params[3]


                if (pc.type == "Identifier" &&
                    oc.type == "Identifier" &&
                    st.type == "Identifier" &&
                    wi.type == "Identifier") {

                    path.scope.rename(pc.name, "programCounter")
                    path.scope.rename(oc.name, "opcodeHandlerCounter")
                    path.scope.rename(st.name, "registers")
                    path.scope.rename(wi.name, "window")

                }

                const stack = path.node.body.body[0]
                const yStack = path.node.body.body[1]
                const vStack = path.node.body.body[2]

                const opcodeHandlerCounter = path.node.body.body[4]
                const programCounter = path.node.body.body[5]
                const registers = path.node.body.body[6]
                const window$1 = path.node.body.body[7]
                const window$2 = path.node.body.body[8]
                const qReg = path.node.body.body[9]

                if (stack.type == "ExpressionStatement" &&
                    yStack.type == "ExpressionStatement" &&
                    vStack.type == "ExpressionStatement" &&
                    opcodeHandlerCounter.type == "ExpressionStatement" &&
                    programCounter.type == "ExpressionStatement" &&
                    registers.type == "ExpressionStatement" &&
                    window$1.type == "ExpressionStatement" &&
                    window$2.type == "ExpressionStatement" &&
                    qReg.type == "ExpressionStatement") {

                    renameProperty(stack, "stack")
                    renameProperty(yStack, "yStack")
                    renameProperty(vStack, "vStack")
                    renameProperty(opcodeHandlerCounter, "opcodeHandlerCounter")
                    renameProperty(programCounter, "programCounter")
                    renameProperty(registers, "registers")
                    renameProperty(window$1, "window$1")
                    renameProperty(window$2, "window$2")
                    renameProperty(qReg, "reg")


                    path.node.body.body.push(babel.types.expressionStatement(
                        babel.types.assignmentExpression(
                            "=",
                            babel.types.memberExpression(
                                babel.types.thisExpression(),
                                babel.types.identifier("next")
                            ),
                            babel.types.functionExpression(
                                null,
                                [],
                                babel.types.blockStatement(
                                    [
                                        babel.types.variableDeclaration(
                                            "var",
                                            [
                                                babel.types.variableDeclarator(
                                                    babel.types.identifier("result"),
                                                    babel.types.memberExpression(
                                                        babel.types.memberExpression(
                                                            babel.types.identifier("opcodeHandlerMap"),
                                                            babel.types.memberExpression(
                                                                babel.types.thisExpression(),
                                                                babel.types.identifier("opcodeHandlerCounter"),
                                                            ),
                                                            true,
                                                        ),
                                                        babel.types.memberExpression(
                                                            babel.types.identifier("decodedBytecode"),
                                                            babel.types.updateExpression(
                                                                "++",
                                                                babel.types.memberExpression(
                                                                    babel.types.thisExpression(),
                                                                    babel.types.identifier("programCounter")
                                                                )
                                                            ),
                                                            true,
                                                        ),
                                                        true,
                                                    )
                                                )
                                            ]
                                        ),
                                        babel.types.expressionStatement(
                                            babel.types.assignmentExpression(
                                                "=",
                                                babel.types.memberExpression(
                                                    babel.types.thisExpression(),
                                                    babel.types.identifier("opcodeHandlerCounter"),

                                                ),
                                                babel.types.memberExpression(
                                                    babel.types.identifier("result"),
                                                    babel.types.numericLiteral(0),
                                                    true,
                                                ),


                                            )
                                        ),
                                        babel.types.returnStatement(
                                            babel.types.memberExpression(
                                                babel.types.identifier("result"),
                                                babel.types.numericLiteral(1),
                                                true
                                            )
                                        )
                                    ]
                                )
                            )
                        )
                    ))
                    path.node.body.body.splice(3, 1)



                }


            }
        }

        const reduceNewVmContext = function(path: babel.NodePath < babel.types.FunctionDeclaration > ) {
            if (path.node.params.length == 7 && path.node.body.body.length == 3) {
                replaceProxyVariable(path, path.node.body.body[0])


                const pc = path.node.params[0]
                const oc = path.node.params[1]
                const registers = path.node.params[2]
                const paramA = path.node.params[3]
                const paramC = path.node.params[4]
                const isParamDUndef = path.node.params[5]
                const paramD = path.node.params[6]


                if (pc.type == "Identifier" &&
                    oc.type == "Identifier" &&
                    registers.type == "Identifier" &&
                    paramA.type == "Identifier" &&
                    paramC.type == "Identifier" &&
                    isParamDUndef.type == "Identifier" &&
                    paramD.type == "Identifier") {

                    path.scope.rename(pc.name, "programCounter")
                    path.scope.rename(oc.name, "opcodeHandlerCounter")
                    path.scope.rename(registers.name, "prevRegisters")
                    path.scope.rename(paramA.name, "_paramA")
                    path.scope.rename(paramC.name, "_paramC")
                    path.scope.rename(paramD.name, "_paramD")
                    path.scope.rename(isParamDUndef.name, "isParamDUndefined")

                }


                const vmStartFn = path.node.body.body[1]
                renameVariable(path, vmStartFn, "vmStart")

                path.traverse({
                    FunctionExpression: (path) => {
                        renameVariable(path, path.node.body.body[0], "registers")
                        renameVariable(path, path.node.body.body[1], "vmContext")
                    }
                }, path.scope)
                path.node.body.body.splice(0, 1)



            }


        }
        const reduceVmStart = function(path: babel.NodePath < babel.types.FunctionDeclaration > ) {
            if (path.node.params.length == 1 && path.node.body.body.length == 2) {

                const variableDecl = path.node.body.body[0]

                
                const forLoop = path.node.body.body[1]

                if (forLoop.type == "ForStatement") {
                    const body = forLoop.body

                    if (body.type == "BlockStatement" && body.body.length == 3) {
                        const ifStatement = body.body[2]

                        if (ifStatement.type == "IfStatement" && ifStatement.consequent.type == "BlockStatement" && ifStatement.alternate && ifStatement.alternate.type == "BlockStatement") {
                            if (ifStatement.consequent.body.length == 1 && ifStatement.consequent.body[0].type == "ExpressionStatement") {
                                ifStatement.consequent.body[0] = babel.types.expressionStatement(
                                    babel.types.callExpression(
                                        babel.types.memberExpression(
                                            babel.types.identifier("currentTrace"),
                                            babel.types.identifier('push')
                                        ),
                                        [
                                            babel.types.objectExpression(
                                                [
                                                    babel.types.objectProperty(
                                                        babel.types.identifier("offset"),
                                                        babel.types.binaryExpression(
                                                            
                                                            "-",
                                                            babel.types.memberExpression(
                                                                babel.types.identifier("vmContext"),
                                                                babel.types.identifier("programCounter")
                                                            ),
                                                            babel.types.numericLiteral(1)
                                                            
                                                        )
                                                      
                                                    ),
                                                    babel.types.objectProperty(
                                                        babel.types.identifier("opcode"),
                                                        babel.types.identifier("opcode")
                                                    ),
                                                    babel.types.objectProperty(
                                                        babel.types.identifier("microOps"),
                                                        ifStatement.consequent.body[0].expression
                                                    )
                                                ]
                                            )
                                        ]
                                    )
                                )
                                

                      


                            }
                            if (ifStatement.alternate.body.length == 1 && ifStatement.alternate.body[0].type == "ExpressionStatement") {
                                ifStatement.alternate.body[0] = babel.types.expressionStatement(
                                    babel.types.callExpression(
                                        babel.types.memberExpression(
                                            babel.types.identifier("currentTrace"),
                                            babel.types.identifier('push')
                                        ),
                                        [
                                            babel.types.objectExpression(
                                                [
                                                    babel.types.objectProperty(
                                                        babel.types.identifier("offset"),
                                                        babel.types.binaryExpression(
                                                            
                                                            "-",
                                                            babel.types.memberExpression(
                                                                babel.types.identifier("vmContext"),
                                                                babel.types.identifier("programCounter")
                                                            ),
                                                            babel.types.numericLiteral(1)
                                                            
                                                        )
                                                      
                                                    ),
                                                    babel.types.objectProperty(
                                                        babel.types.identifier("opcode"),
                                                        babel.types.identifier("opcode")
                                                    ),
                                                    babel.types.objectProperty(
                                                        babel.types.identifier("microOps"),
                                                        ifStatement.alternate.body[0].expression
                                                    )
                                                ]
                                            )
                                        ]
                                    )
                                )
                                

                      


                            }
                        }
                        path.node.body.body.splice(0,0, babel.types.expressionStatement(
                            babel.types.callExpression(
                                babel.types.memberExpression(
                                    babel.types.memberExpression(
                                        babel.types.identifier("stackTrace"),
                                        babel.types.identifier("key"),
                                        true
                                    ),
                                    babel.types.identifier("push")
                                ),
                                [
                                    babel.types.identifier("currentTrace")
                                ]
                            )
                        ))
                        path.node.body.body.splice(0,0, babel.types.variableDeclaration(
                            "var",
                            [
                                babel.types.variableDeclarator(
                                    babel.types.identifier("currentTrace"),
                                    babel.types.arrayExpression()
                                )
                            ]
                        ))
                       
                        path.node.body.body.splice(0, 0, babel.types.ifStatement(
                            babel.types.unaryExpression("!", babel.types.memberExpression(
                                babel.types.identifier("stackTrace"),
                                babel.types.identifier("key"),
                                true
                            )),
                            babel.types.blockStatement([
                                babel.types.expressionStatement(
                                    babel.types.assignmentExpression(
                                        "=",
                                        babel.types.memberExpression(
                                            babel.types.identifier("stackTrace"),
                                            babel.types.identifier("key"),
                                            true
                                        ),
                                        babel.types.arrayExpression()
                                        
        
                                    )
                                )
                            ])))

                        
                        path.node.body.body.splice(0, 0, babel.types.variableDeclaration(
                            "var",
                            [
                                babel.types.variableDeclarator(
                                    babel.types.identifier("key"),
                                    babel.types.templateLiteral(
                                        [
                                          babel.types.templateElement({
                                            raw: "",
                                            cooked: ""
                                          }),
                                          babel.types.templateElement({
                                            raw: ":",
                                            cooked: ":"
                                          }),
                                          babel.types.templateElement({
                                            raw: "",
                                            cooked: ""
                                          })
                                        ],
                                        [
                                            babel.types.memberExpression(
                                                babel.types.identifier("vmContext"),
                                                babel.types.identifier("programCounter")
                                            ),
                                            babel.types.memberExpression(
                                                babel.types.identifier("vmContext"),
                                                babel.types.identifier("opcodeHandlerCounter")
                                            )
                                            
                                        ]
                                    )
                                    
                                )
                            ]
                        ))


                    }
                }

                if (variableDecl.type == "VariableDeclaration" && variableDecl.declarations.length == 2) {
                    if (variableDecl.declarations[0].id.type == "Identifier") {
                        path.scope.rename(variableDecl.declarations[0].id.name, "opcode")
                    }
                    
                }

                const vmContext = path.node.params[0]
                if (vmContext.type == "Identifier") {

                    path.scope.rename(vmContext.name, "vmContext")

                }


            }
        }
        const reduceAssignProperty = function(node: babel.types.Statement, name: string): babel.types.Statement {

            if (node.type == "ExpressionStatement" &&
                node.expression.type == "CallExpression" && node.expression.arguments.length == 3 &&
                node.expression.arguments[1].type == "StringLiteral" &&
                node.expression.arguments[2].type == "ObjectExpression" &&
                node.expression.arguments[2].properties[0].type == "ObjectProperty" &&
                node.expression.arguments[2].properties[0].value.type == "FunctionExpression") {

                // var property = node.expression.arguments[1].value
                var fn = node.expression.arguments[2].properties[0].value
                registersProperties[node.expression.arguments[1].value] = name


                return babel.types.expressionStatement(
                    babel.types.assignmentExpression(
                        "=",
                        babel.types.memberExpression(
                            babel.types.thisExpression(),
                            babel.types.identifier(name)
                        ),
                        fn,
                    )
                )


            }
            throw "UNHANDLED_TYPE"
        }
      


        const labelDependencies = function(path: babel.NodePath < babel.types.BlockStatement > ) {
            if (path.parentPath.node.type == "FunctionExpression" &&
                path.parentPath.node.params[0].type == "Identifier") {
            
                path.scope.rename(path.parentPath.node.params[0].name, "window")
            }
            
            var toDeleteNodes = []

            var start = 0
            if (path.node.body.length == 44) {
                const haltError = path.node.body[start]
                replaceProxyVariable(path, haltError)
                toDeleteNodes.push(haltError)

                start += 1
            }
            const objProxyDefinition = path.node.body[start]


            if (objProxyDefinition.type == "VariableDeclaration") {
                if (objProxyDefinition.declarations.length == 2) {
                    var obj$1 = objProxyDefinition.declarations[0]
                    var obj$2 = objProxyDefinition.declarations[1]
                    if (obj$1.id.type == "Identifier" && obj$2.id.type == "Identifier") {
                        path.scope.rename(obj$1.id.name, "globalObject$1")
                        path.scope.rename(obj$2.id.name, "globalObject$2")
                    }


                }
            }



            const proxyIdentifierDeclarations = path.node.body[start + 1]
            replaceProxyVariable(path, proxyIdentifierDeclarations)
            toDeleteNodes.push(proxyIdentifierDeclarations)


            const jsDependenciesArr = path.node.body[start + 2]
            replaceProxyVariable(path, jsDependenciesArr)
            toDeleteNodes.push(jsDependenciesArr)


            const encodedStrArr = path.node.body[start + 3]
            renameVariable(path, encodedStrArr, "encodedStringArray")


            const globalEmptyObj = path.node.body[start + 4]
            renameVariable(path, globalEmptyObj, "globalEmptyObj")


            const opcodeHandlerMap = path.node.body[start + 5]
            renameVariable(path, opcodeHandlerMap, "opcodeHandlerMap")

            const parameterArray = path.node.body[start + 6]
            renameVariable(path, parameterArray, "parameterArray")

            const numberArray = path.node.body[start + 7]
            renameVariable(path, numberArray, "numberArray")


            const decodeStringFunction = path.node.body[start + 8]
            renameVariable(path, decodeStringFunction, "decodeString")


            const nullValueVariable = path.node.body[start + 9]
            replaceProxyVariable(path, nullValueVariable)
            toDeleteNodes.push(nullValueVariable)

            const registersDecl = path.node.body[start + 10]
            renameVariable(path, registersDecl, "Registers")


            const storagePrototype = path.node.body[start + 11]
            replaceProxyVariable(path, storagePrototype)
            toDeleteNodes.push(storagePrototype)

            const deadCodePrototype = path.node.body[start + 12]
            toDeleteNodes.push(deadCodePrototype)

            const initSlot = path.node.body[start + 13]
            const getProperty = path.node.body[start + 14]
            const setProperty = path.node.body[start + 15]
            const duplicateProperty = path.node.body[start + 16]


            if (registersDecl.type == "FunctionDeclaration") {
                var propertyDefinitions = [{
                        node: initSlot,
                        newName: "init"
                    },
                    {
                        node: getProperty,
                        newName: "get"
                    },
                    {
                        node: setProperty,
                        newName: "set"
                    },
                    {
                        node: duplicateProperty,
                        newName: "clone"
                    },
                ]

                propertyDefinitions.forEach((prop) => {
                    registersDecl.body.body.push(reduceAssignProperty(prop.node, prop.newName))
                    toDeleteNodes.push(prop.node)
                })

                if (registersDecl.body.body.length == 5 && registersDecl.body.body[0].type == "ExpressionStatement" &&
                    registersDecl.body.body[0].expression.type == "AssignmentExpression" &&
                    registersDecl.body.body[0].expression.left.type == "MemberExpression" &&
                    registersDecl.body.body[0].expression.left.property.type == "Identifier") {

                    var storageProperty = registersDecl.body.body[0].expression.left.property
                    traverse(registersDecl, {
                        MemberExpression: (path) => {

                            if (path.node.property.type == "Identifier" && path.node.property.name == storageProperty.name) {
                                path.node.property = babel.types.identifier("reg")
                            }
                        }
                    }, path.scope, path.parentPath)

                }


            }



            const customArrDecl = path.node.body[start + 17]
            renameVariable(path, customArrDecl, "customArr")
            if (customArrDecl.type == "FunctionDeclaration" && customArrDecl.body.type == "BlockStatement") {

                
                for (var jj=0; jj<customArrDecl.body.body.length; jj++) {
                    
                    var bodyStatement = customArrDecl.body.body[jj]
                    if (bodyStatement.type == "ExpressionStatement" &&
                        bodyStatement.expression.type == "CallExpression" && bodyStatement.expression.arguments.length == 3 &&
                        bodyStatement.expression.arguments[1].type == "StringLiteral" &&
                        bodyStatement.expression.arguments[2].type == "ObjectExpression" &&
                        bodyStatement.expression.arguments[2].properties[0].type == "ObjectProperty" &&
                        bodyStatement.expression.arguments[2].properties[0].value.type == "MemberExpression" &&
                        bodyStatement.expression.arguments[2].properties[0].value.property.type == "Identifier") {
                            
                 
                        customArrProperties[bodyStatement.expression.arguments[1].value] = bodyStatement.expression.arguments[2].properties[0].value.property.name
                        


                    }
                   
                }
                customArrDecl.body.body = [customArrDecl.body.body[0], customArrDecl.body.body[customArrDecl.body.body.length-1]]
                
            }


            const vm = path.node.body[start + 18]
            renameVariable(path, vm, "VirtualMachine")

            const vmPrototype = path.node.body[start + 19]
            replaceProxyVariable(path, vmPrototype)
            toDeleteNodes.push(vmPrototype)



            const nextPrototype = path.node.body[start + 20]
            if (nextPrototype.type == "ExpressionStatement" &&
                nextPrototype.expression.type == "CallExpression" &&
                nextPrototype.expression.arguments.length == 3 &&
                nextPrototype.expression.arguments[1].type == "StringLiteral") {

                vmProperties[nextPrototype.expression.arguments[1].value] = "next"
            }

            toDeleteNodes.push(nextPrototype)


            toDeleteNodes.push(path.node.body[start + 21])
            toDeleteNodes.push(path.node.body[start + 22])
            toDeleteNodes.push(path.node.body[start + 23])
            toDeleteNodes.push(path.node.body[start + 24])
            toDeleteNodes.push(path.node.body[start + 25])
            toDeleteNodes.push(path.node.body[start + 26])
            toDeleteNodes.push(path.node.body[start + 27])
            toDeleteNodes.push(path.node.body[start + 28])
            toDeleteNodes.push(path.node.body[start + 29])
            toDeleteNodes.push(path.node.body[start + 30])


            const tryCatchExecInstruction = path.node.body[start + 31]
            renameVariable(path, tryCatchExecInstruction, "tryExecInstruction")

            const catchExecError = path.node.body[start + 32]
            renameVariable(path, catchExecError, "catchExecError")

            const instructionHandlers = path.node.body[start + 33]
            renameVariable(path, instructionHandlers, "instructionHandlers")

            const createOpcodeFunction = path.node.body[start + 34]
            renameVariable(path, createOpcodeFunction, "createOpcodeFunction")

            const emptyObject = path.node.body[start + 36]
            renameVariable(path, emptyObject, "emptyObject")

            const decodedBytecode = path.node.body[start + 37]
            renameVariable(path, decodedBytecode, "decodedBytecode")

            const initVm = path.node.body[start + 38]
            renameVariable(path, initVm, "_initVm")

            const newVmContext = path.node.body[start + 40]
            renameVariable(path, newVmContext, "_newVmContext")

      
           
       

            const startVm = path.node.body[start + 41]
            renameVariable(path, startVm, "_vmStart")
            


            path.node.body = removeNodes(path.node.body, toDeleteNodes)


        }


        const isMainVmBody = function(path: babel.NodePath < babel.types.BlockStatement > ) {
            return path.node.body.length == 44 || path.node.body.length == 43
        }


        const reduceFunctions = function(path: babel.NodePath < babel.types.BlockStatement > ) {
            traverse(path.node, {
                FunctionDeclaration: (path) => {
                    if (path.node.id?.name == "tryExecInstruction") {
                        reduceTryCatchExecInstruction(path)
                    }
                    if (path.node.id?.name == "VirtualMachine") {
                        reduceVm(path)
                    }
                    if (path.node.id?.name == "catchExecError") {
                        reduceCatchExec(path)
                    }
                    if (path.node.id?.name == "_vmStart") {
                        reduceVmStart(path)
                    }


                    if (path.node.id?.name == "_initVm") {
                        reduceInitVm(path)
                    }
                    if (path.node.id?.name == "_newVmContext") {
                        reduceNewVmContext(path)
                    }




                }
            }, path.scope, path.parentPath)
        }
        const updateRegisterCallExpression = function(path: babel.NodePath < babel.types.BlockStatement > ) {
            traverse(path.node, {
                MemberExpression: (path) => {
                    if (path.node.object.type == "Identifier" &&
                        path.node.property.type == "Identifier" &&
                        !path.node.computed) {
                        if (path.node.object.name == "registers" || path.node.object.name == "prevRegisters") {
                            if (registersProperties[path.node.property.name]) {
                                path.node.property.name = registersProperties[path.node.property.name]
                            }
                        }
                    }
                    if (path.node.object.type == "MemberExpression" &&
                        path.node.object.object.type == "Identifier" &&
                        path.node.object.object.name == "vmContext" &&
                        path.node.object.property.type == "Identifier" &&
                        path.node.object.property.name == "registers" &&
                        path.node.property.type == "Identifier") {

                        if (registersProperties[path.node.property.name]) {
                            path.node.property.name = registersProperties[path.node.property.name]
                        }

                    }
                }
            }, path.scope, path.parentPath)
        }
        const updateCustomArrCallExpressions = function(path: babel.NodePath < babel.types.BlockStatement > ) {
            traverse(path.node, {
                MemberExpression: (path) => {
                    
                    if (path.node.object.type == "MemberExpression" &&
                        path.node.object.object.type == "Identifier" &&
                        path.node.object.object.name == "vmContext" &&
                        path.node.object.property.type == "Identifier" &&
                        (path.node.object.property.name == "vStack" || path.node.object.property.name == "stack" || path.node.object.property.name == "yStack") &&
                        path.node.property.type == "Identifier") {

                        if (customArrProperties[path.node.property.name]) {
                            path.node.property.name = customArrProperties[path.node.property.name]
                        }

                    }
                }
            }, path.scope, path.parentPath)
        }
        const updateVmContextCallExpressions = function(path: babel.NodePath < babel.types.BlockStatement > ) {
            traverse(path.node, {
                MemberExpression: (path) => {

                    if (path.node.object.type == "Identifier" &&
                        path.node.object.name == "vmContext" &&
                        path.node.property.type == "Identifier") {

                        

                        if (vmProperties[path.node.property.name]) {
                            
                            path.node.property.name = vmProperties[path.node.property.name]

                        }

                    }
                }
            }, path.scope, path.parentPath)
        }

        const renameVmContextParam = function(path: babel.NodePath < babel.types.BlockStatement > ) {
            traverse(path.node, {
                FunctionExpression: (path) => {
                    if (path.parent.type == "ArrayExpression") {
                        if (path.node.params.length == 1 && path.node.params[0].type == "Identifier") {


                            path.scope.rename(path.node.params[0].name, "vmContext")
                        }


                    }
                }
            }, path.scope, path.parentPath)
        }
        const reduceObjectCallObjectBind = function(path: babel.NodePath < babel.types.BlockStatement > ) {
            traverse(path.node, {
                CallExpression: (path) => { 
                   
                    if (path.node.callee &&
                        path.node.callee.type == "CallExpression" &&
                        path.node.callee.callee &&
                        path.node.callee.callee.type == "CallExpression" &&
                        path.node.callee.callee.callee.type == "MemberExpression" &&
                        path.node.callee.callee.callee.object.type == "MemberExpression" &&
                        path.node.callee.callee.callee.property.type == "Identifier" &&
                        path.node.callee.callee.callee.property.name == "bind" &&
                        path.node.callee.callee.callee.object.object.type == "Identifier" &&
                        path.node.callee.callee.callee.object.object.name == "Object" &&
                        path.node.callee.arguments[0].type == "MemberExpression") {
                        
                        var property = path.node.callee.arguments[0].property
                        var variableToCall = path.node.arguments[0]
                        if (variableToCall.type != "Identifier" && variableToCall.type != "MemberExpression") {
                            throw "UNHANDLED_OBJECT_CALL_STATE"
                        }
                        
                        
                   
                        
                        path.replaceWith(babel.types.callExpression(
                            babel.types.memberExpression(
                                variableToCall,
                                property,
                            ),
                            path.node.arguments.slice(1)
                        ))
                        
                    }
                }
            }, path.scope, path.parentPath)
        }


        const transformations: ((path: babel.NodePath < babel.types.BlockStatement > ) => void)[] = [

            labelDependencies,
            reduceFunctions,
            renameVmContextParam,
            updateVmContextCallExpressions,
            updateRegisterCallExpression,
            updateCustomArrCallExpressions,
            reduceObjectCallObjectBind,
        ]


        traverse(this.ast, {


            BlockStatement: (path, node) => {
                if (isMainVmBody(path)) {
                    for (var i = 0; i < transformations.length; i++) {
                        var transformation = transformations[i]
                        transformation(path)
                    }


                }

            }


        })
    }
    private reduceOpcodeHandler(path: babel.NodePath<babel.types.FunctionExpression>, statements: babel.types.Statement[], config: Config) {
        var toDeleteNodes = []
        var toInsertNodes = []
  
        for (var i = 0; i < statements.length; i++) {


            var node = statements[i]
            switch (node.type) {
                case "VariableDeclaration":
                    if (node.declarations.length != 1) {
                        throw "UNHANDLED_VARIABLE_DECLARATION"
                    }
                    var decl = node.declarations[0]


                    if (!(decl.init)) {
                        throw "INIT_VALUE_UNDEFINED"
                    }
                    if (decl.id.type != "Identifier") {
                        throw "UNKNOWN_ID_TYPE"
                    }
                    
                    // if it is fetching byte from decodedBytecode
                    if (decl.init.type == "MemberExpression" &&
                        decl.init.object.type == "Identifier" &&
                        decl.init.object.name == "decodedBytecode" &&
                        decl.id.type == "Identifier") {


                        path.scope.rename(decl.id.name, `byte$${config.byteCounter}`)
                        config.byteCounter++
                        continue
                    } else if (decl.init.type == "Identifier") {
                        // this.replaceProxyVariable(path, node)
                        // toDeleteNodes.push(node)
                        path.scope.rename(decl.id.name, `${decl.init.name}$`)
                        // console.log(generate(node).code)
                        continue
                    } else if (decl.init.type == "AssignmentExpression" && 
                               decl.init.left.type == "MemberExpression" &&
                               decl.init.right.type == "Identifier" &&
                               decl.id.type == "Identifier") {

                        path.scope.rename(decl.id.name, `${decl.init.right.name}$`)
                        // statements.splice(i, 0, babel.types.expressionStatement(decl.init))
                        // decl.init = decl.init.right

                        
                        // this.replaceProxyVariable(path, node)
                        // toDeleteNodes.push(node)

                        continue
                        
                    } else if (decl.init.type == "UnaryExpression" &&
                               decl.init.operator == "void") {
                        this.replaceProxyVariable(path, node)
                        toDeleteNodes.push(node)

                        continue
                        
                    } else if (decl.init.type == "NewExpression") {

                        path.scope.rename(decl.id.name, `c$${config.newDeclCount}`)
                        config.newDeclCount++
                        continue
                    } else if (decl.init.type == "ObjectExpression") {
                        this.replaceProxyVariable(path, node)
                        toDeleteNodes.push(node)

                        continue
                    } else if (decl.init.type == "ArrayExpression") {
                        path.scope.rename(decl.id.name, `array$${config.arrayCounter}`)
                        config.arrayCounter++

                        continue
                    } else if (decl.init.type == "BooleanLiteral") {
                       this.replaceProxyVariable(path, node)
                       toDeleteNodes.push(node)

                        continue
                    } else if (decl.init.type == "CallExpression" && 
                               decl.init.callee.type == "MemberExpression" &&
                               decl.init.callee.object.type == "MemberExpression" && 
                               decl.init.callee.object.object.type == "Identifier" &&
                               decl.init.callee.object.object.name == "vmContext" &&
                               decl.init.callee.property.type == "Identifier" &&
                               decl.init.callee.property.name == "pop") {
                        path.scope.rename(decl.id.name, `prevCounter`)
                        
                        continue

                    } else if (decl.init.type == "MemberExpression" &&
                        decl.init.object.type == "MemberExpression" &&
                        decl.init.object.property.type == "Identifier" &&
                        decl.init.object.property.name == "stack" &&
                        (decl.init.property.type == "MemberExpression" || decl.init.property.type == "BinaryExpression")) {

                        var name = `stack$${config.popCount}`
                        toInsertNodes.push([node, babel.types.variableDeclaration("var", [
                            babel.types.variableDeclarator(
                                babel.types.identifier(name+"Pointer"),
                                decl.init.property
                            )
                        ])])
                        
                        path.scope.rename(decl.id.name, name)

                        config.popCount++
                        continue

                    } else if (decl.init.type == "CallExpression" &&
                                decl.init.callee.type == "Identifier" &&
                                decl.init.callee.name == "decodeString") {
                        path.scope.rename(decl.id.name, `rawString$${config.stringCount}`)
                        config.stringCount++
                        continue
                        
                    } else if (decl.init.type == "StringLiteral" && decl.init.value == "") {
                        path.scope.rename(decl.id.name, `rawString$${config.stringCount}`)
                        config.stringCount++
                        continue
                    } else if (decl.init.type == "BinaryExpression" &&
                        decl.init.operator == "|" &&
                        decl.init.left.type == "Identifier") {

                            
                        this.replaceProxyVariable(path, node)
                        toDeleteNodes.push(node)
                                    
              
                        continue
                    } else if (decl.init.type == "BinaryExpression" &&
                        decl.init.operator == "|") {
                        path.scope.rename(decl.id.name, `byte$${config.byteCounter}`)
                        config.byteCounter++
                                    
        
                        continue
                    } else if (decl.init.type == "CallExpression" && 
                                decl.init.callee.type == "MemberExpression" &&
                                decl.init.callee.object.type == "MemberExpression" &&
                                decl.init.callee.object.property.type == "Identifier" &&
                                decl.init.callee.object.property.name == "registers") {
                        
                        this.replaceProxyVariable(path, node)

                        toDeleteNodes.push(node)
                        continue

                    } else if (decl.init.type == "NullLiteral") {
                        this.replaceProxyVariable(path, node)

                        toDeleteNodes.push(node)
                        continue
                    } else if (decl.init.type == "MemberExpression" && 
                               decl.init.property.type == "Identifier" &&
                               decl.init.property.name == "length") {
                        path.scope.rename(decl.id.name, `stackLength`)
                
                        continue

                     
                    } else if (decl.init.type == "BinaryExpression" &&
                               decl.init.left.type == "MemberExpression" &&
                               decl.init.left.object.type == "MemberExpression" &&
                               decl.init.left.object.object.type == "Identifier" &&
                               decl.init.left.object.property.type == "Identifier" &&
                               decl.init.left.object.object.name == "vmContext" &&
                               decl.init.left.object.property.name == "stack") {
                        path.scope.rename(decl.id.name, `stackLength`)
        
                        continue
                    } else if (decl.init.type == "MemberExpression" && 
                               decl.init.object.type == "Identifier" &&
                               decl.init.object.name == "encodedStringArray") {
                        path.scope.rename(decl.id.name, `rawString$${config.stringCount}`)
                        config.stringCount++
                        continue
                    } else if (decl.init.type == "BinaryExpression" && decl.init.left.type == "BinaryExpression") {
                        this.replaceProxyVariable(path, node)

                        toDeleteNodes.push(node)
                        continue
                    } else if (decl.init.type == "BinaryExpression" || decl.init.type == "MemberExpression") {
                        this.replaceProxyVariable(path, node)

                        toDeleteNodes.push(node)
                        continue
                       
                    } else if (decl.init.type == "CallExpression" && (decl.init.callee.type == "Identifier" || decl.init.callee.type == "CallExpression")) {
                        path.scope.rename(decl.id.name, `fn_call$${config.fnCallCount}`)
                        config.fnCallCount++



                        continue
                    }  else {
                            
                        fs.writeFileSync('labeled_vm.js', generate(this.ast).code)
                    
                        console.log(generate(node).code)
                        throw "UNHANDLED"
                    }
                case "LabeledStatement":
                    // path.scope.rename(node.label.name, "a")
                    if (node.body.type != "BlockStatement") {
                        throw "UNKNOWN_LABELED_BODY"
                    }


                    traverse(path.node, {
                        BreakStatement: (path) => {
                            if (path.node.label && 
                                path.node.label.type == "Identifier" &&
                                node.type == "LabeledStatement" &&
                                path.node.label.name == node.label.name) {
                                
                                path.node.label.name = "a"
                            }
                        }
                    }, path.scope, path.parentPath)
                    node.label.name = "a"
                    node.body.body = this.reduceOpcodeHandler(path, node.body.body, config)

                    
                    continue

                case "ExpressionStatement":
                    /*
                    if (node.expression.type == "AssignmentExpression" &&
                        node.expression.left.type == "MemberExpression" &&
                        node.expression.left.property.type == "Identifier" &&
                        node.expression.left.property.name == "programCounter" &&
                        node.expression.operator == "+=") {
                        continue
                    } else {
                        console.log(generate(node).code)
                        throw "UNHANDLED_EXPRESSION_TYPE"
                    }
                    */
                    continue
                case "ThrowStatement":
                    continue
                case "ForInStatement":
                    if (!(node.left && node.left.type == "VariableDeclaration")) {
                        throw "UNHANDLED_FOR_LOOP_TYPE"
                    }
                    this.renameVariable(path, node.left, "j")
                    continue
                case "ForStatement":
                    if (!(node.init && node.init.type == "VariableDeclaration")) {
                        throw "UNHANDLED_FOR_LOOP_TYPE"
                    }
                    this.renameVariable(path, node.init, "i")
                    continue
                case "IfStatement":
                    continue

                default:

                    fs.writeFileSync('labeled_vm.js', generate(this.ast).code)
                    console.log(node.type)
                    throw "UNHANDLED_NODE_TYP"
            }

            
        }
        
        var newStatements = this.removeNodes(statements, toDeleteNodes)

        toInsertNodes.forEach((pair) => {
            var index = newStatements.indexOf(pair[0])
            newStatements.splice(index, 0, pair[1])

        })

        return newStatements
    }
    private labelOpcodeHandlers() {
        traverse(this.ast, {
            FunctionExpression: (path) => {
                if (path.parent.type == "ArrayExpression") {
                    if (path.node.params.length == 1 && 
                        path.node.params[0].type == "Identifier" &&
                        path.node.body.type == "BlockStatement") {

                        path.node.body.body = this.reduceOpcodeHandler(path, path.node.body.body, {
                            byteCounter: 0,
                            popCount: 0,
                            stringCount: 0,
                            variableCount: 0,
                            fnCallCount: 0,
                            newDeclCount: 0,
                            arrayCounter: 0,

                        })
                        // path.scope.rename(path.node.params[0].name, "vmContext")
                        

                    }


                }
            }
        })
    }


    traverseOpcodeHandlers() {
        var mismatchedIndexs = [4,7,21,28,35,36,37,42,47,51,53,55,56,60,66,82,88,94,101,102,115,124,125,128,142,151,152,173,174,181,187,200,204,209,211,215,221,226,236]
        
        var i = 0
        traverse(this.ast, {
            ArrayExpression: (path) => {
                if (path.node.elements.length == 242) {
                    path.node.elements.forEach((n, i)=> {
                        if (mismatchedIndexs.includes(i)) {
                            var node = path.node.elements[i]
                            if (node) {
                                var code = generate(node).code
                                console.log(code)
                            }
                            
    
                        }
                        i++
                    })
                }
                
            
                
            }
        })
    }
    getOpcodeHandlerHash() {
        var hashes: string[] = []
        
        
        traverse(this.ast, {
            FunctionExpression: (path) => {
                if (path.parent.type == "ArrayExpression") {
                    if (path.node.params.length == 1 && 
                        path.node.params[0].type == "Identifier" &&
                        path.node.body.type == "BlockStatement") {
                    var code = generate(path.node.body).code.replace("\n", "")

                    var hash = crypto.createHash('md5').update(code).digest("hex")
                    
                   
                    hashes.push(hash)
                }
                
            }
        }
        })
        return hashes
        // console.log(JSON.stringify(hashes))
    }


}