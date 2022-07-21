import { Labeler } from './labeler';
import fs from 'fs'
import { parse } from '@babel/parser';
import express from 'express'
import { Tracer } from './tracer';
const myArgs = process.argv.slice(2);
if (myArgs[0] == "--test") {
    var ast = parse(fs.readFileSync("./input/raw.js").toString())
    var labeler = new Labeler(ast)
    
    var labeled = labeler.labelVirtualMachine()

    var tracer = new Tracer(parse(labeled))
    
    fs.writeFileSync('./output/injected_vm.js', tracer.injectTracer())
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
    
    

} else if (myArgs[0] == "--server") {
    const app = express();
    app.use(express.json({limit: '50mb'}));

    const port = 6969; // default port to listen

    // define a route handler for the default home page
    app.post("/", ( req, res ) => {

        const ast = parse(req.body.body);

 
        var labeler = new Labeler(ast)
        
        var labeled = labeler.labelVirtualMachine()
        // res.send(labeled)
        var tracer = new Tracer(parse(labeled))
        res.send(tracer.injectTracer());
        // res.send(labeled)
    } );

    // start the Express server
    app.listen( port, () => {
        console.log( `server started at http://localhost:${ port }` );
    } );

}






// let raw = fs.readFileSync("./input/raw.js").toString()



