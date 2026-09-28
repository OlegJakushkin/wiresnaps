// Static preview only. The exported website has no application-server API.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(process.argv[2]??'dist');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{let file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+sep))throw Error('path');if((await stat(file)).isDirectory())file=resolve(file,'index.html');res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'0.0.0.0',()=>console.log('WireSnaps static preview on port 4173'));
