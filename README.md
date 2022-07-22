## Shape Security Decompiler Tool-Kit


This tool kit is capable of dynamically deobfuscating all versions of shape security's virtual machine interpreter script and injecting a custom tracer that is capable of tracing all opcodes that is executed in the virtual machine script. It also has a custom lifter that will lift these traces into javascript.

## Javascript Virtualization Obfuscation

Javascript virtualization obfuscation is a obfuscation technique that requires the defenders to create a full virtual machine in javascript along with a custom compiler that is capable of compiling javascript into bytecode that this virtual machine is able to understand. Since the source code is never restored at anytime while the virtual machine is running, this obfuscation technique requires a reverse engineer to first reverse engineer and fully understand the virtual machine which could be heavily obfuscated.

## Overview

Shape Security implements a custom stack based CISC virtual machine in javascript with a rotating instruction set that executes custom bytecode. They do this in order to protect the source code that is executed on the browser side. The virtualized code itself was also obfuscated before it was virtualized in order to deter reverse engineering attempts. This repo isn't about using the devirtualized code to create a bypass but instead mainly about the reverse engineering process to understanding their virtual machine and then writing a lifter that lifts the executed bytecode into javascript. The approach I took in this tool kit was not to target the full instruction but instead the micro instructions that're consistent across all versions and to then hook into those.


## Self Defending Inquiry

NOTE as of 2022-07-21 I can confidently say that Shape dosen't have any self defending checks in their virtual machine execution. The injected virtual machine is able to gen headers that pass fine on target. I can confidently say that the paths that're traced with the injected virtual machine are devoid of fake paths and should be 1:1 with the actual paths taken with the normal script in the browser.


If you just want to see the lifted javascript code you can go to the lifter/cleaned.js
