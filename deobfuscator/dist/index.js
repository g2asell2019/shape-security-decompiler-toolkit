"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const labeler_1 = require("./labeler");
const fs_1 = __importDefault(require("fs"));
const parser_1 = require("@babel/parser");
const express_1 = __importDefault(require("express"));
const tracer_1 = require("./tracer");
const myArgs = process.argv.slice(2);
if (myArgs[0] == "--test") {
    var ast = (0, parser_1.parse)(fs_1.default.readFileSync("./input/raw.js").toString());
    var labeler = new labeler_1.Labeler(ast);
    var labeled = labeler.labelVirtualMachine();
    fs_1.default.writeFileSync('./output/labeled_vm.js', labeled);
    var tracer = new tracer_1.Tracer((0, parser_1.parse)(labeled));
    fs_1.default.writeFileSync('./output/injected_vm.js', tracer.injectTracer());
    // labeler.traverseOpcodeHandlers()
    /*
    // fs.writeFileSync('./output/labeled_vm_raw3.js', labeler.labelVirtualMachine())
    var ast2 = parse(fs.readFileSync("./input/raw3.js").toString())
    var labeler2 = new Labeler(ast2)
    fs.writeFileSync('./output/labeled_vm_raw3.js', labeler2.labelVirtualMachine())


    var usedOpcodes = JSON.parse(fs.readFileSync("used_opcodes.json").toString())
    
    var hashes = labeler.getOpcodeHandlerHash()
    var hashes2 = labeler2.getOpcodeHandlerHash()

    var count = 0

    var indexOfFunctionsThatDontMatch: number[] = []
    hashes.forEach((hash, i)=> {
        
        if (usedOpcodes[i]) {
            
            if (!(hashes2.includes(hash))) {
                indexOfFunctionsThatDontMatch.push(i)
            }
        }
    })
    console.log(JSON.stringify(indexOfFunctionsThatDontMatch))
    */
}
else if (myArgs[0] == "--server") {
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: '50mb' }));
    const port = 6969; // default port to listen
    // define a route handler for the default home page
    app.post("/", (req, res) => {
        const ast = (0, parser_1.parse)(req.body.body);
        var labeler = new labeler_1.Labeler(ast);
        var labeled = labeler.labelVirtualMachine();
        // res.send(labeled)
        var tracer = new tracer_1.Tracer((0, parser_1.parse)(labeled));
        res.send(tracer.injectTracer());
        // res.send(labeled)
    });
    // start the Express server
    app.listen(port, () => {
        console.log(`server started at http://localhost:${port}`);
    });
}
// let raw = fs.readFileSync("./input/raw.js").toString()
