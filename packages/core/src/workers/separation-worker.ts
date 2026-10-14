import {getModel,ModelRegistry,MDX_MODEL} from '../models/registry.js';
import {MdxAdapter} from '../models/mdx-adapter.js';
import {loadModel} from '../runtime/model-cache.js';
import {initializeInference} from '../runtime/inference.js';
import {reconstruct} from '../audio/reconstructor.js';
import type {Backend,ProgressEvent,Stereo} from '../types.js';
import type {ModelAdapter} from '../models/adapter.js';
import type {InferenceSession} from 'onnxruntime-web';
import {AudioEngineError} from '../utils/errors.js';
const scope=globalThis as unknown as {onmessage:(event:MessageEvent)=>void;postMessage:(message:unknown,transfer?:Transferable[])=>void};
const registry=new ModelRegistry();registry.register(MDX_MODEL,()=>new MdxAdapter());
let warmed:{key:string;session:InferenceSession;adapter:ModelAdapter;backend:Exclude<Backend,'auto'>}|undefined;
let running=false;
const release=async()=>{const previous=warmed;warmed=undefined;previous?.adapter.dispose();try{await previous?.session.release();}catch{}};
scope.onmessage=async({data}:{data:{model:string;backend:Backend;channels:Stereo;cache:boolean}})=>{
  if(running){scope.postMessage({type:'error',code:'BUSY',message:'A separation is already running.'});return;}
  running=true;const report=(event:ProgressEvent)=>scope.postMessage({type:'progress',event});
  try{
    const model=getModel(data.model),key=model.sha256+':'+data.backend,setupStart=performance.now();let modelReused=false;
    if(warmed?.key!==key){await release();const adapter=registry.create(data.model);adapter.validate(data.channels);
      try{const bytes=await loadModel(model,data.cache,report),init=await initializeInference(bytes,model,data.backend,report);warmed={key,adapter,...init};}
      catch(error){adapter.dispose();throw error;}
    }else{modelReused=true;report({stage:'model-ready',cached:true,backend:warmed.backend});}
    const setupSeconds=(performance.now()-setupStart)/1000;
    warmed!.adapter.validate(data.channels);const started=performance.now(),prediction=await warmed!.adapter.infer(warmed!.session,data.channels,report);
    report({stage:'reconstructing'});const stems=reconstruct(data.channels,prediction,model.preprocessing.compensation,true);
    // Only the model/session and FFT workspace survive. Input/output PCM is
    // local to this job and returned buffers are transferred out of the worker.
    scope.postMessage({type:'done',...stems,backend:warmed!.backend,inferenceSeconds:(performance.now()-started)/1000,setupSeconds,modelReused},[...stems.vocals,...stems.instrumental].map(c=>c.buffer));
  }catch(error){await release();scope.postMessage({type:'error',code:error instanceof AudioEngineError?error.code:'RUNTIME',message:error instanceof Error?error.message:'Inference failed.'});}
  finally{running=false;}
};
