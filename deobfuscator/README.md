## Deobfuscator And Injector


This is the deobfuscator for shape's virtual machine interpreter script, it will remove all obfuscations they have on their virtual machine.



## Features

- Removes Proxy Object Definitions
- Labels all components about their virtual machine
- Reduces all Proxy identifier calls

## Explanation

The deobfuscator is capable of deobfuscating every single version of shape's virtual machine interpreter script and injecting a tracer into the script that traces all of the important op's that're executed in the virtual machine. It will automatically save the output every 30s as a JSON with a save of the functions that're created in the virtual machine opcodes along with all of the branches that was visited in each function. This output is meant to be used in the lifter where it is then cleaned and translated into javascript.

## Usage

It is meant to be used as a server that deobfuscates scripts on the fly and replaces it in the browser, it will start a server on the port **6969** that accepts vm scripts via POST request and returns a deobfuscated version.

One easy way to do this is using mitmproxy, I won't go into the full steps but you can look at the mitmproxy script i have to get a good understanding of the logic.

- mitmproxy -s rewrite.py
- npm start

```js

var ast = parse(fs.readFileSync("./input/raw.js").toString())
var labeler = new Labeler(ast)

var labeled = labeler.labelVirtualMachine()

var tracer = new Tracer(parse(labeled))

fs.writeFileSync('./output/injected_vm.js', tracer.injectTracer())

```



![Example of the output](https://i.imgur.com/E0Un6R4.png)