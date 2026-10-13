import * as ort from 'onnxruntime-web';
import type { AudioModelManifest,Backend,ProgressEvent } from '../types.js';
import { AudioEngineError } from '../utils/errors.js';
declare const __RUNTIME__: {parts:string[];mjs:string;bytes:number};
export async function initializeInference(bytes:ArrayBuffer,model:AudioModelManifest,backend:Backend,report:(event:ProgressEvent)=>void) {
  report({stage:'runtime'});
  const parts=await Promise.all(__RUNTIME__.parts.map(async part=>{
    const response=await fetch(new URL(part,import.meta.url));if(!response.ok)throw new AudioEngineError('RUNTIME','Runtime asset is unavailable.');
    return new Uint8Array(await response.arrayBuffer());
  }));
  const binary=new Uint8Array(__RUNTIME__.bytes);let offset=0;
  for(const part of parts){binary.set(part,offset);offset+=part.length;}
  if(offset!==binary.length)throw new AudioEngineError('RUNTIME','Incorrect runtime asset size.');
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmBinary=binary;
  ort.env.wasm.wasmPaths={mjs:new URL(__RUNTIME__.mjs,import.meta.url).href};
  const nav=navigator as Navigator & {gpu?:{requestAdapter():Promise<unknown>}};
  let gpu=false;try{gpu=backend!=='wasm'&&model.supportedBackends.includes('webgpu')&&!!(await nav.gpu?.requestAdapter());}catch{gpu=false;}
  if(backend==='webgpu'&&!gpu)throw new AudioEngineError('RUNTIME','WebGPU is unavailable. Select Auto or WASM.');
  report({stage:'model-load',backend:gpu?'webgpu':'wasm'});
  const options={executionProviders:gpu?['webgpu','wasm']:['wasm'],enableCpuMemArena:false,enableMemPattern:false,logSeverityLevel:3 as const};
  let session:ort.InferenceSession;
  try{session=await ort.InferenceSession.create(bytes,options);}catch(error){
    if(!gpu||backend==='webgpu')throw new AudioEngineError('RUNTIME','Inference session initialization failed.',{cause:error});
    report({stage:'cpu-fallback',backend:'wasm'});session=await ort.InferenceSession.create(bytes,{...options,executionProviders:['wasm']});gpu=false;
  }
  let actualBackend:Exclude<Backend,'auto'>='wasm';
  if(gpu)try{await ort.env.webgpu.device;actualBackend='webgpu';}catch{actualBackend='wasm';}
  if(backend==='webgpu'&&actualBackend!=='webgpu'){await session.release();throw new AudioEngineError('RUNTIME','WebGPU did not initialize. Select Auto or WASM.');}
  return {session,backend:actualBackend};
}
