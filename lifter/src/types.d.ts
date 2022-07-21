export type Instruction = "IF_ELSE_BRANCH" | "ELSE_BRANCH" | "IF_BRANCH" | "PUSH" | "SET" | "DEFINE_PROPERTY" | "SET_GLOBAL_EMPTY_OBJECT" | "SAVE_CALL_FUNCTION" | "JMP" | "SAVE_BINARY_EXPRESSION" | "SAVE_MEMBER_EXPRESSION" | "SAVE_NUMBER"

export type FunctionTrace = Opcode[]
export interface Argument {
    type: any
    value?: any
    args?: any
}
export interface MicroOp {
    instruction: Instruction
    args: Argument[]
}
export interface Opcode {
    offset: number
    opcode: number
    microOps: MicroOp[]
}

export interface LabeledMicroOpcode {
    offset: number,
    microOp: MicroOp
}

export interface Context {
    // stack just keeps track of initalized stack indexes
    label: string

    stack: Map<number, boolean> 
    registers: Map<number, boolean>
    parentBody: babel.types.Statement[]

    statements: babel.types.Statement[]

    // this.registers = new Map<number, boolean>();

}
export interface Block {
    opcodes: LabeledMicroOpcode[]
    isDeadBlock: boolean


}
export interface IntermediateRepresentation {
    functions: Map<string, FunctionRepresentation>
}

export interface FunctionRepresentation {
    

    blocks: Map<string, Block>
    

}