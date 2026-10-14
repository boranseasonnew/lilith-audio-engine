import type { AudioModelManifest,ProgressEvent } from '../types.js';
import { AudioEngineError } from '../utils/errors.js';
export const MODEL_CACHE='lilith-models-v1';
export async function verifyModel(bytes: ArrayBuffer, model: AudioModelManifest): Promise<void> {
  if(bytes.byteLength!==model.sizeBytes)throw new AudioEngineError('INTEGRITY','Model size check failed.');
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  if(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')!==model.sha256)
    throw new AudioEngineError('INTEGRITY','Model SHA-256 check failed.');
}
export async function loadModel(model:AudioModelManifest, useCache:boolean, report:(event:ProgressEvent)=>void):Promise<ArrayBuffer> {
  let cache:Cache|undefined;
  if(useCache)try{
    cache=await caches.open(MODEL_CACHE);const hit=await cache.match(model.modelUrl);
    if(hit){const bytes=await hit.arrayBuffer();try{await verifyModel(bytes,model);report({stage:'model-download',loaded:model.sizeBytes,total:model.sizeBytes,cached:true,progress:1});return bytes;}
      catch{await cache.delete(model.modelUrl);report({stage:'model-download',warning:'Corrupt cached model removed.'});}}
  }catch{report({stage:'model-download',warning:'Model cache is unavailable; downloading without persistent caching.'});}
  report({stage:'model-download',loaded:0,total:model.sizeBytes,progress:0});
  const response=await fetch(model.modelUrl,{credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok||!response.body)throw new AudioEngineError('MODEL','Model download failed. Check connectivity and hosting restrictions.');
  const bytes=new Uint8Array(model.sizeBytes),reader=response.body.getReader();let loaded=0,last=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;
    if(loaded+value.length>model.sizeBytes)throw new AudioEngineError('INTEGRITY','Model download exceeded expected size.');
    bytes.set(value,loaded);loaded+=value.length;
    if(performance.now()-last>120||loaded===model.sizeBytes){report({stage:'model-download',loaded,total:model.sizeBytes,progress:loaded/model.sizeBytes});last=performance.now();}
  }}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  report({stage:'model-verify'});await verifyModel(bytes.buffer,model);
  if(cache)try{await cache.put(model.modelUrl,new Response(bytes,{headers:{'Content-Length':String(model.sizeBytes)}}));}catch{report({stage:'model-load',warning:'Model cache quota exceeded; inference can continue.'});}
  return bytes.buffer;
}
export async function modelStorage():Promise<{cachedBytes:number;usage?:number;quota?:number}> {
  let cachedBytes=0;
  if(typeof caches!=='undefined'&&await caches.has(MODEL_CACHE)){
    const cache=await caches.open(MODEL_CACHE);for(const request of await cache.keys()){
      const response=await cache.match(request);if(response){const declared=Number(response.headers.get('Content-Length'));cachedBytes+=Number.isSafeInteger(declared)&&declared>0?declared:(await response.blob()).size;}
    }
  }
  const estimate=await navigator.storage?.estimate();return {cachedBytes,usage:estimate?.usage,quota:estimate?.quota};
}
export async function clearModelCache():Promise<boolean>{return typeof caches!=='undefined'?caches.delete(MODEL_CACHE):false;}
