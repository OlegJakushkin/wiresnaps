// The same Emscripten test factory is used here and by the browser diagnostics.
import {pathToFileURL} from 'node:url';
const {default:run}=await import(pathToFileURL(process.argv[2]).href);
let exitCode;
try{await run({onExit:code=>{exitCode=code;},print:console.log,printErr:console.error});}
catch(e){if(typeof e.status==='number')exitCode=e.status;else{console.error(e.message);exitCode=1;}}
if(exitCode===undefined){console.error('The fixture runner did not report an exit status.');exitCode=1;}
process.exitCode=exitCode;
