import traverse from '@babel/traverse';
import fs from 'fs'
import * as babel from "@babel/core";

import generate from '@babel/generator';


export class Tracer {
    ast: babel.types.File


    constructor(ast: babel.types.File) {
        this.ast = ast
    }
    private traverseStatementsAndInjectTracer(path: babel.NodePath<babel.types.BlockStatement|babel.types.FunctionExpression>, node: babel.types.BlockStatement) {
        var nodesToInsert: any[] = []
        var nodesToReplace: any[] = []

        function isMemberExpressionVmStack(node: babel.types.MemberExpression): boolean {
            return (node.object.type == "Identifier" && node.object.name == "vmContext" && node.property.type == "Identifier" && node.property.name == "stack")
        }   
        function isMemberExpressionVmProgramCounter(node: babel.types.MemberExpression): boolean {
            return (node.object.type == "Identifier" && node.object.name == "vmContext" && node.property.type == "Identifier" && node.property.name == "programCounter")
        }   
        function isMemberExpressionVmOpcodeCounter(node: babel.types.MemberExpression): boolean {
            return (node.object.type == "Identifier" && node.object.name == "vmContext" && node.property.type == "Identifier" && node.property.name == "opcodeHandlerCounter")
        }   
        function isMemberExpressionVmRegister(node: babel.types.MemberExpression): boolean {
            return (node.object.type == "Identifier" && node.object.name == "vmContext" && node.property.type == "Identifier" && node.property.name == "registers")
        }   

        
        function createGetGlobalEmptyObj(pointer: babel.types.BinaryExpression) {
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("getGlobalEmptyObj"),
                ),
                babel.types.objectProperty(
                    babel.types.identifier("args"),
                    babel.types.arrayExpression([
                        createRawValue(pointer),
                    ])
            )])
        }
        function createStackSliceArg(start: babel.types.Expression, end: babel.types.Expression) {
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("stackSlice"),
                ),
                babel.types.objectProperty(
                    babel.types.identifier("args"),
                    babel.types.arrayExpression([
                        createRawValue(start),
                        createRawValue(end)
                    ])
                
            )])
        }
        function createNewOpcodeFunctionArg(programCounter: babel.types.Expression, opcodeHandlerCounter: babel.types.Expression) {
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("newOpcodeFunction"),
                ),
                babel.types.objectProperty(
                    babel.types.identifier("args"),
                    babel.types.arrayExpression([
                        createRawValue(programCounter),
                        createRawValue(opcodeHandlerCounter)
                    ])
                
            )])
        }


        function createCallArg(args: babel.types.ObjectExpression[]) {
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("fnCall"),
                ),
                babel.types.objectProperty(
                    babel.types.identifier("args"),
                    babel.types.arrayExpression(args)
                
            )])
        }
        function createApplyArg(args: babel.types.ObjectExpression[]) {
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("apply"),
                ),
                babel.types.objectProperty(
                    babel.types.identifier("args"),
                    babel.types.arrayExpression(args)
                
            )])
        }
    
        function translateUnaryExpression(node: babel.types.UnaryExpression): babel.types.ObjectExpression {
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("unaryExpression"),
                ),
                babel.types.objectProperty(
                    babel.types.identifier("args"),
                    babel.types.arrayExpression([
                        createRawValue(babel.types.stringLiteral(node.operator)),
                        translateExpressionToArgument(node.argument)
                    ])
                
            )])
        }
        function createGetProperty(args: babel.types.ObjectExpression[]) {
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("getProperty"),
                ),
                babel.types.objectProperty(
                    babel.types.identifier("args"),
                    babel.types.arrayExpression(args)
                
            )])
        }
    
        function createFetchArg(method: "register"|"stack"|"function", pointer: babel.types.Expression): babel.types.ObjectExpression {
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral(method),
                ),
                babel.types.objectProperty(
                    
                    babel.types.identifier("value"),
                    pointer,
                )])
        }
        function createRawValue(node: babel.types.Expression): babel.types.ObjectExpression {
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("raw"),
                ),
                babel.types.objectProperty(
                    
                    babel.types.identifier("value"),
                    node,
                )])
        }
        function createIdentifier(node: babel.types.StringLiteral): babel.types.ObjectExpression {
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("identifier"),
                ),
                babel.types.objectProperty(
                    
                    babel.types.identifier("value"),
                    node,
                )])
        }
        function translateIdentifierToArgument(node: babel.types.Identifier): babel.types.ObjectExpression {
            if (node.name.includes("byte") || node.name.includes("rawString$")) {
                return createRawValue(node)
            } else if (node.name.includes("stack$")) {
                if (node.name.charAt(node.name.length-1) == "$") {
                    var n = node.name.slice(0, node.name.length-1)
                    return createFetchArg("stack", babel.types.identifier(n+"Pointer"))
                }
    
                return createFetchArg("stack", babel.types.identifier(node.name+"Pointer"))
            } else if (node.name.includes("fn_call$")) {
                var pointer = parseInt(node.name.replace("fn_call$", ""))
                return createFetchArg("function", babel.types.numericLiteral(pointer))
            } else {
                
                return createIdentifier(babel.types.stringLiteral(node.name))
            }
       
            throw "UNKNOWN_ARGUMENT_VALUE"
        }
        function translateNewExpression(node: babel.types.NewExpression): babel.types.ObjectExpression {
            if (node.callee.type != "Identifier") {
                throw "UNHANDLED_NEW_CALLEE"
            }
            var args = [
                translateExpressionToArgument(node.callee)
            ]
            node.arguments.forEach((node)=> {
                 if (node.type != 'ArgumentPlaceholder' && 
                    node.type != "SpreadElement" && 
                    node.type != 'JSXNamespacedName') {
    
            
                    args.push(translateExpressionToArgument(node))
                }
            })
    
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("newExpression"),
                ),
                babel.types.objectProperty(
                    babel.types.identifier("args"),
                    babel.types.arrayExpression(args)
                
            )])
        }
    
    
    
        function translateMemberExpression(node: babel.types.MemberExpression): babel.types.ObjectExpression {
            if (node.property.type == "PrivateName") {
                throw "UNKNOWN_MEMBER_EXPRESSION"
            }
            return createGetProperty([
                translateExpressionToArgument(node.object),
                translateExpressionToArgument(node.property)
                
            ])   
        }
        function translateCallExpression(node: babel.types.CallExpression): babel.types.ObjectExpression {
    
            // we only accept identifiers, memberexpressions or call expressions as callee
            if (node.callee.type != "Identifier" && node.callee.type != "MemberExpression" && node.callee.type != "CallExpression") {
                throw "UNKNOWN_CALLEE_TYPE"
            }
            var args = [
                translateExpressionToArgument(node.callee),
            ]
    
            node.arguments.forEach((node) => {
                if (node.type != 'ArgumentPlaceholder' && 
                    node.type != "SpreadElement" && 
                    node.type != 'JSXNamespacedName') {
    
            
                    args.push(translateExpressionToArgument(node))
                }
           
            })
            return createCallArg(args)  
        }
        function translateBinaryExpression(node: babel.types.BinaryExpression): babel.types.ObjectExpression {
            var leftArgument = null
            var rightArgument = null
            if (node.left.type == "BinaryExpression") {
                leftArgument = translateBinaryExpression(node.left)
            } else {
                if (node.left.type == "PrivateName") {
                    throw "UNHANDLED_BINARY_TYPE"
                }
                leftArgument = translateExpressionToArgument(node.left)
            }
    
            if (node.right.type == "BinaryExpression") {
                rightArgument = translateBinaryExpression(node.right)
            } else {
              
                rightArgument = translateExpressionToArgument(node.right)
            }
            return babel.types.objectExpression([
                babel.types.objectProperty(
                    
                    babel.types.identifier("type"),
                    babel.types.stringLiteral("binaryExpression"),
                ),
                babel.types.objectProperty(
                    babel.types.identifier("args"),
                    babel.types.arrayExpression([
                        createRawValue(babel.types.stringLiteral(node.operator)),
                        leftArgument,
                        rightArgument,
    
                    ])
                
            )])
        }
        function translateExpressionToArgument(node: babel.types.Expression): babel.types.ObjectExpression {
            switch (node.type) {
                case "Identifier":
                    return translateIdentifierToArgument(node)
                case "AssignmentExpression":
                    if (node.left.type == "MemberExpression" &&
                        node.left.object.type == "Identifier" &&
                        node.right.type == "Identifier" && 
                        node.left.object.name == "globalEmptyObj" &&
                        node.left.computed) {
                        
                        var rightAssignmentNode = translateIdentifierToArgument(node.right)
                        
                        return rightAssignmentNode
                    } 
                    console.log(node.type)
                    console.log(generate(node).code)
                    throw "UNHANDLED_ASSIGNMENT_NODE"
                case "NewExpression":
                    return translateNewExpression(node)
                case "UnaryExpression":
                    return translateUnaryExpression(node)
                case "CallExpression":
                    if (node.callee.type == "MemberExpression" && 
                    node.callee.property.type == "Identifier" && 
                    node.callee.property.name == "get" &&
                    node.callee.object.type == "MemberExpression" &&
                    isMemberExpressionVmRegister(node.callee.object)) {
                        var arg1 = node.arguments[0]
                        if (arg1.type != 'ArgumentPlaceholder' && arg1.type != "SpreadElement" && arg1.type != 'JSXNamespacedName') {
                            return createFetchArg("register", arg1)
                        }
                    } else if (node.callee.type == "Identifier" && node.callee.name != "createOpcodeFunction") {
                        
                        return translateCallExpression(node)  
                        
                        
                    } else if (node.callee.type == "MemberExpression" && 
                               node.callee.object.type == "MemberExpression" &&
                               isMemberExpressionVmStack(node.callee.object) &&
                               node.callee.property.type == "Identifier" &&
                               node.callee.property.name == "slice" &&
                               node.arguments.length == 1) {

                        const arg1 = node.arguments[0]
                        if (arg1.type != "BinaryExpression") {
                            throw "Unknown arg"
                        }

                        
                        return createStackSliceArg(arg1, babel.types.binaryExpression(
                            "-",
                            babel.types.memberExpression(
                                babel.types.memberExpression(
                                    babel.types.identifier("vmContext"),
                                    babel.types.identifier("stack"),
                                ),
                                babel.types.identifier("length"),
                                
                            ),
                            babel.types.numericLiteral(1)
                        ))

                    } else if (node.callee.type == "MemberExpression" &&
                               node.callee.object.type == "Identifier" &&
                               node.callee.property.type == "Identifier" &&
                               
                               node.arguments.length == 0) {
                            return createCallArg([translateMemberExpression(node.callee)])
                    } else if (node.callee.type == "Identifier" && node.callee.name == "createOpcodeFunction") {
                        // var n = Object.assign({}, node)
                        // n.arguments.length -=1

                 
                        var programCounter = node.arguments[1]
                        var opcodeHandlerCounter = node.arguments[2]
                        if ((programCounter.type != 'ArgumentPlaceholder' && programCounter.type != "SpreadElement" && programCounter.type != 'JSXNamespacedName') &&
                            (opcodeHandlerCounter.type != 'ArgumentPlaceholder' && opcodeHandlerCounter.type != "SpreadElement" && opcodeHandlerCounter.type != 'JSXNamespacedName'))  {
                            return createNewOpcodeFunctionArg(programCounter, opcodeHandlerCounter)
                        
                        }
                        throw "unkn"
                       
                        
                        
                    } else if (node.callee.type == "MemberExpression" &&
                               node.callee.property.type == "Identifier" &&
                               node.callee.property.name == "apply" &&
                               node.arguments.length == 2) {
                        var arg1 = node.arguments[0]
                        var arg2 = node.arguments[1]
                        if ((arg1.type != 'ArgumentPlaceholder' && arg1.type != "SpreadElement" && arg1.type != 'JSXNamespacedName') &&
                            (arg2.type != 'ArgumentPlaceholder' && arg2.type != "SpreadElement" && arg2.type != 'JSXNamespacedName'))  {
                            return createApplyArg([
                                translateExpressionToArgument(node.callee.object),
                                translateExpressionToArgument(arg1),
                                translateExpressionToArgument(arg2),
                                
                            ])    
                        }
                        throw "unk"
                        
                    } else if ((node.callee.type == "CallExpression" &&
                               node.callee.callee.type == "MemberExpression") || (node.callee.type == "MemberExpression")) {
                        return translateCallExpression(node)
                        
                        
                    }
                    console.log(node.type)
                    console.log(generate(node).code)
                    throw "UNHANDLED_CALLEXPRESSION_TYPE"
                    
                case "MemberExpression":
                    if (node.object.type == "Identifier") {
                        if (node.object.name == "numberArray") {
                            
                            return createRawValue(node)
                            
                        } else if (node.object.type == "Identifier" && node.object.name == "vmContext" &&
                               node.property.type == "Identifier" && node.property.name.includes("window")) {

                            return createIdentifier(babel.types.stringLiteral(node.property.name))

                        } else if (node.property.type == "Identifier") {
                            return translateMemberExpression(node)
                        } else if (node.object.name == "globalEmptyObj" && node.property.type == "BinaryExpression") {
                            
                            return createGetGlobalEmptyObj(node.property)
                        }
    
                        
                    } else if (node.object.type == "MemberExpression" &&
                               isMemberExpressionVmStack(node.object)) {
                        if (node.property.type != "PrivateName") {
                            return createFetchArg("stack", node.property)
                        }
                        
                    } else if (node.object.type == "MemberExpression" && node.property.type == "MemberExpression") {
                        return translateMemberExpression(node)
                    } else if (node.object.type == "CallExpression" && node.property.type == "Identifier") {
                        return translateMemberExpression(node)
                    } else if (node.object.type == "MemberExpression" && 
                               node.object.object.type == "Identifier" && 
                               node.object.property.type == "Identifier" &&
                               node.object.property.name == "reg") {
                        return createRawValue(node)
                    } 
                    console.log(node.type)
                    console.log(generate(node).code)
                    throw "UNHANDLED_MEMBER_EXPRESSION_TYPE"
                case "ArrayExpression":
                    return createRawValue(node)
                case "ObjectExpression":
                    return createRawValue(node)
                case "BooleanLiteral":
                    return createRawValue(node)
                case "NullLiteral":
                    return createRawValue(node)
                case "StringLiteral":
                    return createRawValue(node)
                case "BinaryExpression":
                    
    
                    return translateBinaryExpression(node)
    
                case "NumericLiteral":
                    return createRawValue(node)
                default:
                    console.log(node.type)
                    console.log(generate(node).code)
                    throw "UNHANDLED_NODE"
            }
        }
        function createMicroOpLabel(instruction: string, args: babel.types.ObjectExpression[]): babel.types.Statement {
            return babel.types.expressionStatement(
                babel.types.callExpression(
                    babel.types.memberExpression(
                        babel.types.identifier(
                            "microOps"
                        ),
                        babel.types.identifier(
                            "push"
                        ),
                        false
                    ),
                    [
                        babel.types.objectExpression(
                            [
                                babel.types.objectProperty(
                                    babel.types.identifier("instruction"),
                                    babel.types.stringLiteral(instruction)
                                ),
                                babel.types.objectProperty(
                                    babel.types.identifier("args"),
                                    babel.types.arrayExpression(
                                        args
                                    ),
                                )
                            ]
                        )
                    ]
                )
            )
        }
    
    
        function checkIfPushOp(node: babel.types.Statement) {
            if (node.type == "ExpressionStatement" &&
                node.expression.type == "AssignmentExpression" &&
                node.expression.left.type == "MemberExpression" &&
                node.expression.left.property.type != "PrivateName" && 
                node.expression.operator == "=" &&
                node.expression.left.object.type == "MemberExpression" &&
                
                isMemberExpressionVmStack(node.expression.left.object)) {
    
                if (node.expression.right.type == "AssignmentExpression" &&
                    node.expression.right.left.type == "MemberExpression" &&
                    node.expression.right.left.object.type == "Identifier" &&
                    node.expression.right.right.type == "Identifier" && 
                    node.expression.right.left.object.name == "globalEmptyObj" &&
                    node.expression.right.left.computed) {
                    
                                if (node.expression.right.left.property.type != "BinaryExpression") {
                        throw "UNKNOWN_TYPE_BINARY_ASSIGNMENT"
                    }
                    
                    var rightAssignmentNode = translateIdentifierToArgument(node.expression.right.right)
                    if (node.expression.right.left.property.type != "BinaryExpression") {
                        throw "UNKNOWN_TYPE_BINARY_ASSIGNMENT"
                    }
                    nodesToInsert.push([node, babel.types.labeledStatement(babel.types.identifier("m2"),babel.types.blockStatement([
                        createMicroOpLabel("PUSH", [
                            createRawValue(node.expression.left.property),
                            rightAssignmentNode,
                        ]),
                        createMicroOpLabel("SET_GLOBAL_EMPTY_OBJECT", [
                            createRawValue(node.expression.right.left.property),
                            rightAssignmentNode,
                        ]),
                    ]))])
                         
    
                    return rightAssignmentNode
                } 
                nodesToInsert.push([node, createMicroOpLabel("PUSH", [
                    createRawValue(node.expression.left.property),
                    translateExpressionToArgument(node.expression.right)
                ])])
    
            }
        
            
    
        }

        function checkIfJMPNode(node: babel.types.Statement, consequentNode: babel.types.Statement) {
            if ((node.type == "ExpressionStatement" &&
                node.expression.type == "AssignmentExpression" &&
                node.expression.left.type == "MemberExpression" &&
                node.expression.left.property.type != "PrivateName" && 
                node.expression.operator == "=" &&
                isMemberExpressionVmProgramCounter(node.expression.left)) && (consequentNode.type == "ExpressionStatement" &&
                consequentNode.expression.type == "AssignmentExpression" &&
                consequentNode.expression.left.type == "MemberExpression" &&
                consequentNode.expression.left.property.type != "PrivateName" && 
                consequentNode.expression.operator == "=" &&
                
                isMemberExpressionVmOpcodeCounter(consequentNode.expression.left))) {
    
                nodesToInsert.push([node, createMicroOpLabel("JMP", [
                    createRawValue(node.expression.right),
                    createRawValue(consequentNode.expression.right)
                ])])
    
            }
        
            
    
        }
        function checkIfSetRegister(node: babel.types.Statement) {
            if (node.type == "ExpressionStatement" &&
                node.expression.type == "CallExpression" &&
                node.expression.callee.type == "MemberExpression" && 
                node.expression.callee.property.type == "Identifier" && 
                node.expression.callee.property.name == "set" &&
                node.expression.callee.object.type == "MemberExpression" &&
                isMemberExpressionVmRegister(node.expression.callee.object)) {
                    
                var location = node.expression.arguments[0]
                var value = node.expression.arguments[1]
                if ((location.type != 'ArgumentPlaceholder' && value.type != 'ArgumentPlaceholder') && 
                    (location.type != "SpreadElement" && value.type != 'SpreadElement') && 
                    (location.type != 'JSXNamespacedName' && value.type != "JSXNamespacedName")) {
                    nodesToInsert.push([node, createMicroOpLabel("SET", [
                        translateExpressionToArgument(location),
                        translateExpressionToArgument(value)
                    ])])
                } else {
                    throw "UNKNOWN_SET_CALL"
                }
                
            }
        }
        
        function checkIfDefineProperty(node: babel.types.Statement) {
            if (node.type == "ExpressionStatement" &&
                node.expression.type == "CallExpression" &&
                node.expression.callee.type == "MemberExpression" && 
                node.expression.callee.object.type == "Identifier" &&
                node.expression.callee.property.type == "Identifier" && 
                node.expression.callee.object.name == "Object" &&
                node.expression.callee.property.name == "defineProperty" &&
                node.expression.arguments.length ==3 ) {
    
                    
                var obj = node.expression.arguments[0]
                var property = node.expression.arguments[1]
                var value = node.expression.arguments[2]
                
                if (obj.type != "Identifier" && obj.type != "MemberExpression") {
                    throw "UNHANDLED_DEFINE_PROPERTY_STATE"
                }
                if (property.type != "Identifier" && property.type != "MemberExpression") {
                    throw "UNHANDLED_DEFINE_PROPERTY_STATE"
                }
                if (value.type != "ObjectExpression") {
                    throw "UNHANDLED_DEFINE_PROPERTY_STATE"
                }
                if (value.properties.length == 3) {
                    var valueSet = value.properties[2]
                    if (valueSet.type != "ObjectProperty") {
                        throw "UNHANDLED_DEFINE_PROPERTY_STATE"
                    }
                    if (valueSet.value.type == "ArrayPattern" || valueSet.value.type == "AssignmentPattern" || valueSet.value.type == "RestElement" ||
                        valueSet.value.type == "ObjectPattern") {
                        throw "UNHANDLED_DEFINE_PROPERTY_STATE"
                    }
                    nodesToInsert.push([node, createMicroOpLabel("DEFINE_PROPERTY_WITH_SETTER", [
                        translateExpressionToArgument(obj),
                        translateExpressionToArgument(property),
                        translateExpressionToArgument(valueSet.value),
                        
                    ])])
                } else {
                    var valueSet = value.properties[3]
                    if (valueSet.type != "ObjectProperty") {
                        throw "UNHANDLED_DEFINE_PROPERTY_STATE"
                    }
                    if (valueSet.value.type == "ArrayPattern" || valueSet.value.type == "AssignmentPattern" || valueSet.value.type == "RestElement" ||
                        valueSet.value.type == "ObjectPattern") {
                        throw "UNHANDLED_DEFINE_PROPERTY_STATE"
                    }
                        
                    
    
                    nodesToInsert.push([node, createMicroOpLabel("DEFINE_PROPERTY", [
                        translateExpressionToArgument(obj),
                        translateExpressionToArgument(property),
                        translateExpressionToArgument(valueSet.value),
                        
                    ])])
                }
    
                
                    
                    
    
                    
             
                
    
                
    
            }
    
    
            
        }  
        function checkifDefineArray(node: babel.types.Statement) {
            if (node.type == "VariableDeclaration" &&
                node.declarations.length == 1 &&
                node.declarations[0].type == "VariableDeclarator" &&
                node.declarations[0].init &&
                node.declarations[0].init.type == "CallExpression" &&
                node.declarations[0].init.callee.type == "Identifier" &&
                node.declarations[0].id.type == "Identifier" &&
                node.declarations[0].id.name.includes("fn_call$")) {
                
                var decl = node.declarations[0]
                if (decl.id.type != "Identifier") {
                    throw "UNHANDLED_FN_CALL_TYPE"
                }
                var pointer = decl.id.name.replace("fn_call$", "")
                if (node.declarations[0].init.callee.name.includes("createOpcodeFunction")) {
                    var args = [
                        createRawValue(babel.types.numericLiteral(parseInt(pointer))),
                        translateExpressionToArgument(node.declarations[0].init),   
                    ]
                    nodesToInsert.push([node, createMicroOpLabel("SAVE_CALL_FUNCTION", args)])
                    return
                }


                var args = [
                    createRawValue(babel.types.numericLiteral(parseInt(pointer))),
                    translateExpressionToArgument(node.declarations[0].init.callee),   
                ]
    
                node.declarations[0].init.arguments.forEach((node) => {
                    if (node.type != 'ArgumentPlaceholder' && 
                        node.type != "SpreadElement" && 
                        node.type != 'JSXNamespacedName') {
    
                    
                        args.push(translateExpressionToArgument(node))
                    }
                })
                
                
                nodesToInsert.push([node, createMicroOpLabel("SAVE_CALL_FUNCTION", args)])
            }
        } 
        function checkIfFnCallVariable(node: babel.types.Statement) {
            if (node.type == "VariableDeclaration" &&
                node.declarations.length == 1 &&
                node.declarations[0].type == "VariableDeclarator" &&
                node.declarations[0].init &&
                node.declarations[0].init.type == "CallExpression" &&
                node.declarations[0].init.callee.type == "Identifier" &&
                node.declarations[0].id.type == "Identifier" &&
                node.declarations[0].id.name.includes("fn_call$")) {
                
                var decl = node.declarations[0]
                if (decl.id.type != "Identifier") {
                    throw "UNHANDLED_FN_CALL_TYPE"
                }
                var pointer = decl.id.name.replace("fn_call$", "")
                if (node.declarations[0].init.callee.name.includes("createOpcodeFunction")) {
                    var args = [
                        createRawValue(babel.types.numericLiteral(parseInt(pointer))),
                        translateExpressionToArgument(node.declarations[0].init),   
                    ]
                    nodesToInsert.push([node, createMicroOpLabel("SAVE_CALL_FUNCTION", args)])
                    return
                }


                var args = [
                    createRawValue(babel.types.numericLiteral(parseInt(pointer))),
                    translateExpressionToArgument(node.declarations[0].init.callee),   
                ]
    
                node.declarations[0].init.arguments.forEach((node) => {
                    if (node.type != 'ArgumentPlaceholder' && 
                        node.type != "SpreadElement" && 
                        node.type != 'JSXNamespacedName') {
    
                    
                        args.push(translateExpressionToArgument(node))
                    }
                })
                
                
                nodesToInsert.push([node, createMicroOpLabel("SAVE_CALL_FUNCTION", args)])
            }
        }
        function checkIfSetGlobalEmptyObject(node: babel.types.Statement) {
            if (node.type == "VariableDeclaration" &&
                node.declarations.length == 1 &&
                node.declarations[0].type == "VariableDeclarator" &&
                node.declarations[0].init &&
                node.declarations[0].init.type == "AssignmentExpression" &&
                node.declarations[0].init.operator == "=" &&
                node.declarations[0].init.left.type == "MemberExpression" &&
                node.declarations[0].init.left.object.type == "Identifier" &&
                node.declarations[0].init.right.type == "Identifier" &&

                node.declarations[0].init.left.object.name == "globalEmptyObj") {
                if (node.declarations[0].init.left.property.type != "BinaryExpression") {
                    throw "UNKNOWN_TYPE_BINARY_ASSIGNMENT"
                }
                
                
                nodesToInsert.push([node, createMicroOpLabel("SET_GLOBAL_EMPTY_OBJECT", [
                    createRawValue(node.declarations[0].init.left.property),
                    translateIdentifierToArgument(node.declarations[0].init.right),
                ])])
            }
        }
        var blockStatement = node
        node.body.forEach((node, i) => {
            if (node.type == "BlockStatement") {
                this.traverseStatementsAndInjectTracer(path, node)
            } else if (node.type == "IfStatement") {
                
                
                if (node.alternate) {
                    throw "UNHANDLED_IF_ALTERNATE_CASE"
                }

                if (node.consequent && node.consequent.type == "BlockStatement" && node.consequent.body[node.consequent.body.length-1].type != "ThrowStatement" && node.consequent.body[node.consequent.body.length-1].type != "BreakStatement" && !node.alternate) {
                    node.consequent.body.unshift(babel.types.expressionStatement(
                        babel.types.assignmentExpression(
                            "=",
                            babel.types.identifier("microOps"),
                            babel.types.identifier("branchBody")
                        )
                    ))


                    node.consequent.body.unshift(
                        babel.types.variableDeclaration(
                            "var",
                            [
                                babel.types.variableDeclarator(
                                    babel.types.identifier("branchBody"),
                                    babel.types.arrayExpression()
                                )
                            ],

                        ),
                        
                    )
                    node.consequent.body.unshift(
                        babel.types.variableDeclaration(
                            "var",
                            [
                                babel.types.variableDeclarator(
                                    babel.types.identifier("oldMicroOps"),
                                    babel.types.identifier("microOps"),
                                )
                            ],

                        ),
                        
                    )
                    
                    this.traverseStatementsAndInjectTracer(path, node.consequent)

                    var setMicroOpsBackNode = babel.types.expressionStatement(
                        babel.types.assignmentExpression(
                            "=",
                            babel.types.identifier("microOps"),
                            babel.types.identifier("oldMicroOps"))
                    )


                    var ifStatementInstruction = createMicroOpLabel("IF_BRANCH", [
                        translateExpressionToArgument(node.test),
                        babel.types.objectExpression(
                            [
                                babel.types.objectProperty(babel.types.identifier("type"), babel.types.stringLiteral("body")),
                                babel.types.objectProperty(babel.types.identifier("value"), babel.types.identifier("branchBody"))
                            ]
                      
                        )
                        
                    ])
                        

                    var last = node.consequent.body[node.consequent.body.length-1]
                    if (last.type == "ReturnStatement" || last.type == "ThrowStatement") {
                        node.consequent.body.splice(node.consequent.body.length-1, 0, setMicroOpsBackNode)
                        node.consequent.body.splice(node.consequent.body.length-1, 0, ifStatementInstruction)
                        
                    } else {
                        node.consequent.body[node.consequent.body.length] = setMicroOpsBackNode
                        node.consequent.body[node.consequent.body.length] = ifStatementInstruction

                        
                    }

                    var elseStatementInstruction = createMicroOpLabel("ELSE_BRANCH", [
                        translateExpressionToArgument(node.test)
                        
                    ])
                    node.alternate = babel.types.blockStatement([
                        elseStatementInstruction
                    ])
                    

                }

            
                
                
            } else if (node.type == "ReturnStatement" && node.argument == null) {

                nodesToReplace.push([
                    node,
                    babel.types.returnStatement(
                        babel.types.identifier("microOps")
                    )
                ]
                    
                )
             
            } else if (node.type == "LabeledStatement" && node.body.type == "BlockStatement") {
                this.traverseStatementsAndInjectTracer(path, node.body)
            }
            
            
            checkIfSetGlobalEmptyObject(node)
            checkIfPushOp(node)
            checkIfSetRegister(node)
            checkIfDefineProperty(node)
            checkIfJMPNode(node, blockStatement.body[i+1])
            checkIfFnCallVariable(node)
        })
        nodesToInsert.forEach((pair) => {
    
            var index = node.body.indexOf(pair[0])
            
            var block = babel.types.labeledStatement(
                babel.types.identifier(`hook_${pair[0].type}`),
                babel.types.blockStatement([
                    pair[1],
                    pair[0]
                    
                ])
            )
            node.body[index] = block
        }) 
        nodesToReplace.forEach((pair) => {
    
            var index = node.body.indexOf(pair[0])

            
            node.body[index] = pair[1]
        }) 
    }
  
    private injectMicroOpTracer() {
        traverse(this.ast, {
            FunctionExpression: (path) => {
                if (path.parent.type == "ArrayExpression") {
                    if (path.node.params.length == 1 && 
                        path.node.params[0].type == "Identifier" &&
                        path.node.body.type == "BlockStatement") {
                        
            

                        // insert var microOps = [] at the top of each function
                        path.node.body.body.unshift(babel.types.variableDeclaration(
                            "var",
                            [
                                babel.types.variableDeclarator(
                                    babel.types.identifier("microOps"),
                                    babel.types.arrayExpression()
                                )
                            ]
                        ))
                    
                        

                        



                        path.node.body.body.splice(path.node.body.body.length, 0, babel.types.returnStatement(
                            babel.types.identifier("microOps")
                        ))
                        this.traverseStatementsAndInjectTracer(path, path.node.body)

                        

                        

                        

                    }


                }

         
                
            
            }
        })
    }
    private transformInstructionsIntoDict() {
        traverse(this.ast, {
            ArrayExpression: (path) => {
                if (path.node.elements[0] && path.node.elements.length > 200 && path.node.elements[0].type == "FunctionExpression") {

                    const properties: babel.types.ObjectProperty[] = []
                    const objExpression = babel.types.objectExpression(properties)
                    
                    path.node.elements.forEach((elem, index) => {
                        if (elem && elem.type == "FunctionExpression") {
                            properties.push(babel.types.objectProperty(
                                babel.types.numericLiteral(index),
                                elem
                            ))
                        }
                        
                    })
                    path.replaceWith(objExpression)
                }


            }
        })


    }
    injectTracer(): string {
        this.injectMicroOpTracer()
   
            
                        
                        
                    
                
            
        
        

        

        

        this.transformInstructionsIntoDict()
            

        return generate(this.ast).code
    }
}