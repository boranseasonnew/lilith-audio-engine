import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
const root=resolve(fileURLToPath(new URL('../dist/studio/',import.meta.url))),port=Number(process.env.PORT??3340);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.bin':'application/octet-stream','.wasm':'application/wasm','.svg':'image/svg+xml'};
createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let pathname;
  try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
  const target=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!target.startsWith(root+sep)){res.writeHead(403).end();return;}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  try{if(!statSync(target).isFile())throw Error();res.setHeader('Content-Type',types[extname(target)]??'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');
    res.setHeader('Content-Security-Policy',pathname.endsWith('audio-export-worker.js')?"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self' blob:":pathname.endsWith('separation-worker.js')?"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://huggingface.co https://us.aws.cdn.hf.co; worker-src 'self'":"default-src 'self'; script-src 'self'; style-src 'self'; worker-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; object-src 'none'; base-uri 'none'");
    res.end(req.method==='HEAD'?undefined:readFileSync(target));
  }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Lilith Audio Studio: http://127.0.0.1:${port}`));
