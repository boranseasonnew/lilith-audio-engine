import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';
const root=new URL('../../../',import.meta.url);
mkdirSync(new URL('test-results/',root),{recursive:true});
await build({entryPoints:[fileURLToPath(new URL('packages/core/src/engine/separation-engine.ts',root))],bundle:true,format:'esm',platform:'node',outfile:fileURLToPath(new URL('test-results/lifecycle.js',root)),plugins:[{name:'decoder-fixture',setup(b){b.onLoad({filter:/audio[\\/]decoder\.ts$/},()=>({contents:`export async function decodeAudio(file,rate,options,signal){if(signal.aborted)throw Error('aborted');return {channels:[new Float32Array([.2,.3]),new Float32Array([.1,.4])],duration:2/rate};}`,loader:'js'}));}}]});
const {createSeparator}=await import(new URL('test-results/lifecycle.js',root));
function install(){
 const names=['Worker','OfflineAudioContext','isSecureContext','caches'],old=Object.fromEntries(names.map(n=>[n,globalThis[n]]));const workers=[];
 globalThis.Worker=class {constructor(){this.terminated=false;this.jobs=0;workers.push(this);}postMessage(data){this.jobs++;if(this.hold)return;queueMicrotask(()=>this.onmessage?.({data:{type:'done',vocals:data.channels,instrumental:data.channels.map(c=>c.slice()),backend:'webgpu',inferenceSeconds:1,setupSeconds:0,modelReused:this.jobs>1,gain:1}}));}terminate(){this.terminated=true;}};
 globalThis.OfflineAudioContext=class{};globalThis.isSecureContext=true;globalThis.caches={delete:async()=>true};
 return {workers,restore(){for(const n of names){if(old[n]===undefined)delete globalThis[n];else globalThis[n]=old[n];}}};
}
test('consecutive files share a worker and dispose releases it',async()=>{const f=install(),engine=await createSeparator();try{const a=await engine.separate(new Blob(['a'])),b=await engine.separate(new Blob(['b']));assert.equal(f.workers.length,1);assert.equal(a.metadata.modelReused,false);assert.equal(b.metadata.modelReused,true);a.dispose();b.dispose();await engine.dispose();assert.equal(f.workers[0].terminated,true);await assert.rejects(()=>engine.separate(new Blob(['x'])),e=>e.code==='DISPOSED');}finally{await engine.dispose();f.restore();}});
test('idle expiry releases memory but the next job still works',async()=>{const f=install(),engine=await createSeparator({idleTimeoutMs:1000});try{(await engine.separate(new Blob(['a']))).dispose();await new Promise(r=>setTimeout(r,1100));assert.equal(f.workers[0].terminated,true);(await engine.separate(new Blob(['b']))).dispose();assert.equal(f.workers.length,2);}finally{await engine.dispose();f.restore();}});
test('clearing cache invalidates warm session without disposing engine',async()=>{const f=install(),engine=await createSeparator();try{(await engine.separate(new Blob(['a']))).dispose();assert.equal(await engine.clearCache(),true);assert.equal(f.workers[0].terminated,true);(await engine.separate(new Blob(['b']))).dispose();assert.equal(f.workers.length,2);}finally{await engine.dispose();f.restore();}});
test('abort terminates warm worker and allows a clean next job',async()=>{const f=install(),engine=await createSeparator();try{(await engine.separate(new Blob(['a']))).dispose();f.workers[0].hold=true;const controller=new AbortController(),job=engine.separate(new Blob(['b']),{signal:controller.signal});await new Promise(r=>setTimeout(r,0));await assert.rejects(()=>engine.separate(new Blob(['c'])),e=>e.code==='BUSY');assert.throws(()=>engine.clearCache(),e=>e.code==='BUSY');controller.abort();await assert.rejects(()=>job,e=>e.code==='ABORTED');assert.equal(f.workers[0].terminated,true);(await engine.separate(new Blob(['d']))).dispose();assert.equal(f.workers.length,2);}finally{await engine.dispose();f.restore();}});
