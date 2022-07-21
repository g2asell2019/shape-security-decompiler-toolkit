## Trace Lifter

The trace lifter is capable of lifting the traced logs we collected from our modified vm script and lifts it to javascript.


## Features

- Block identification based on JMPs
- Basic If Else control flow translation
- Cleaner for javascript output

## Usage

- Put the vm call stack into the input folder
- Instantiate and use the lifter and cleaner classes


Note: Function call arguments aren't accurate and while loops are not created but their behavior is representated in the block calls.
```js
var functionTraces: {[key: string]: FunctionTrace[]}  = JSON.parse(fs.readFileSync('input/vm_call_stack.json').toString())

const functionTraceMap = new Map<string, FunctionTrace[]>()

Object.keys(functionTraces).forEach((key)=> {
    const traces = functionTraces[key]
    functionTraceMap.set(key, traces)

})


var irLifter = new IntermediateRepresentationLifter(functionTraceMap)

var ir = irLifter.lift()


var jsLifter = new JavascriptLifter(ir)
var outputAst = jsLifter.lift()

var cleaner = new JavascriptBeautifier(outputAst)

fs.writeFileSync("cleaned.js", cleaner.clean());


```


## Output
```js
function fn_43518_9() {
    var s6 = null;
    var s5 = null;
    var s4 = null;
    var s3 = null;
    var s2 = null;
    var s1 = null;
    var s0 = null;
    block_104153_5_43520();
  
    function block_104153_5_43520() {
      block_43525_3_104158();
    }
  
    function block_43525_3_104158() {
      globalObj["h9eeGmv-AlL3cxEdPYmeLfuH,733"] = "vgRwgpsdn";
      s5 = fn_72714_0(window$1);
      block_102398_3_43544();
    }
  
    function block_102398_3_43544() {
      s0 = r0["initCustomEvent"].apply(r0, ["vgRwgpsdn", false, false, s5]);
      block_43549_9_102404();
    }
  
    function block_43549_9_102404() {
      block_107901_6_43551();
    }
  
    function block_107901_6_43551() {
      s0 = window["dispatchEvent"](r0);
    }
  }


```
