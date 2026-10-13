import { getModel,ModelRegistry,MDX_MODEL } from '../models/registry.js';
import { MdxAdapter } from '../models/mdx-adapter.js';
import { loadModel } from '../runtime/model-cache.js';
import { initializeInference } from '../runtime/inference.js';
import { reconstruct } from '../audio/reconstructor.js';
import type { Backend,ProgressEvent,Stereo } from '../types.js';
import type { InferenceSession } from 'onnxruntime-web';
import { AudioEngineError } from '../utils/errors.js';
const scope=globalThis as unknown as {onmessage:(event:MessageEvent)=>void;postMessage:(message:unknown,transfer?:Transferable[])=>void};
const registry=new ModelRegistry();registry.register(MDX_MODEL,()=>new MdxAdapter());
scope.onmessage=async({data}:{data:{model:string;backend:Backend;channels:Stereo;cache:boolean}})=>{
  let session:InferenceSession|undefined;const adapter=registry.create(data.model),report=(event:ProgressEvent)=>scope.postMessage({type:'progress',event});
  try{
    const model=getModel(data.model);adapter.validate(data.channels);
    const bytes=await loadModel(model,data.cache,report),init=await initializeInference(bytes,model,data.backend,report);session=init.session;
    const started=performance.now(),prediction=await adapter.infer(session,data.channels,report);
    report({stage:'reconstructing'});const stems=reconstruct(data.channels,prediction,model.preprocessing.compensation);
    await session.release();session=undefined;adapter.dispose();
    scope.postMessage({type:'done',...stems,backend:init.backend,inferenceSeconds:(performance.now()-started)/1000},
      [...stems.vocals,...stems.instrumental].map(channel=>channel.buffer));
  }catch(error){try{await session?.release();}catch{}adapter.dispose();
    scope.postMessage({type:'error',code:error instanceof AudioEngineError?error.code:'RUNTIME',message:error instanceof Error?error.message:'Unknown inference error.'});}
};
