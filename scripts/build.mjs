import {readFileSync,writeFileSync,mkdirSync,copyFileSync,cpSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
const root=new URL('../',import.meta.url),path=p=>fileURLToPath(new URL(p,root));
const output='packages/core/dist/';mkdirSync(path(output+'runtime'),{recursive:true});
execFileSync(process.execPath,[path('node_modules/typescript/lib/tsc.js'),'--emitDeclarationOnly'],{cwd:path('.'),stdio:'inherit'});
const binary=readFileSync(path('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm')),parts=[];
for(let i=0;i<binary.length;i+=20*1024*1024){const part=binary.subarray(i,i+20*1024*1024),name='runtime-'+createHash('sha256').update(part).digest('hex').slice(0,12)+'.bin';writeFileSync(path(output+'runtime/'+name),part);parts.push('./runtime/'+name);}
const runtime={parts,bytes:binary.length,mjs:'./runtime/ort-wasm-simd-threaded.asyncify.mjs'};
copyFileSync(path('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs'),path(output+'runtime/ort-wasm-simd-threaded.asyncify.mjs'));
writeFileSync(path(output+'runtime.json'),JSON.stringify(runtime,null,2)+'\n');
const common={bundle:true,format:'esm',platform:'browser',target:'es2022',legalComments:'eof'};
await build({...common,entryPoints:{index:path('packages/core/src/index.ts')},outdir:path(output),splitting:true,chunkNames:'audio-io-[hash]'});
await build({...common,entryPoints:[path('packages/core/src/workers/audio-export-worker.ts')],outfile:path(output+'audio-export-worker.js'),minify:true});
await build({...common,entryPoints:[path('packages/core/src/workers/separation-worker.ts')],outfile:path(output+'separation-worker.js'),minify:true,alias:{'onnxruntime-web':'onnxruntime-web/webgpu'},define:{__RUNTIME__:JSON.stringify(runtime)}});
for(const file of ['LICENSE','THIRD_PARTY_NOTICES.md','README.md'])copyFileSync(path(file),path('packages/core/'+file));
cpSync(path('docs/licenses'),path('packages/core/dist/licenses'),{recursive:true});
if(process.argv.includes('--core-only')){console.log('Independent SDK built without the Studio.');process.exit(0);}
mkdirSync(path('dist/studio'),{recursive:true});cpSync(path('packages/core/dist'),path('dist/studio/engine'),{recursive:true});
await build({...common,entryPoints:[path('apps/studio/src/main.ts')],outfile:path('dist/studio/studio.js'),plugins:[{name:'public-sdk',setup(builder){builder.onResolve({filter:/^@lilith\/audio-engine$/},()=>({path:'./engine/index.js',external:true}));}}]});
copyFileSync(path('apps/studio/public/index.html'),path('dist/studio/index.html'));
copyFileSync(path('apps/studio/public/favicon.svg'),path('dist/studio/favicon.svg'));
copyFileSync(path('apps/studio/src/studio.css'),path('dist/studio/studio.css'));
for(const file of ['LICENSE','THIRD_PARTY_NOTICES.md','README.md'])copyFileSync(path(file),path('packages/core/'+file));
cpSync(path('docs/licenses'),path('packages/core/dist/licenses'),{recursive:true});
cpSync(path('docs/licenses'),path('dist/studio/engine/licenses'),{recursive:true});
console.log('SDK declarations, independent ESM library, worker, Pages-compatible runtime parts and Studio built.');
