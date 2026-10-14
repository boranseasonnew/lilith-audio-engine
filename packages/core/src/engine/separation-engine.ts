import type { AudioStem,Backend,JobOptions,ProgressEvent,SeparationResult,SeparatorOptions,Stereo,StemName } from '../types.js';
import { getModel } from '../models/registry.js';
import { decodeAudio } from '../audio/decoder.js';
import { AudioEngineError,checkAbort } from '../utils/errors.js';
import { encodeWav } from '../export/wav.js';
import { zipStems } from '../export/zip.js';
import { modelStorage,clearModelCache } from '../runtime/model-cache.js';
type WorkerResult={type:'done';vocals:Stereo;instrumental:Stereo;backend:Exclude<Backend,'auto'>;inferenceSeconds:number;setupSeconds:number;modelReused:boolean;gain:number};
export class SeparationEngine {
  readonly model;private busy=false;private disposed=false;private worker?:Worker;private abort?:()=>void;private idleTimer?:ReturnType<typeof setTimeout>;
  constructor(private readonly options:SeparatorOptions={}) {
    this.model=getModel(options.model);
    if(options.backend&&!['auto','webgpu','wasm'].includes(options.backend))throw new AudioEngineError('RUNTIME','Invalid backend.');
  }
  async separate(file:Blob,job:JobOptions={}):Promise<SeparationResult> {
    if(this.disposed)throw new AudioEngineError('DISPOSED','Separator was disposed.');
    if(this.busy)throw new AudioEngineError('BUSY','A separation job is already running.');
    checkAbort(job.signal);
    if(typeof Worker==='undefined'||typeof OfflineAudioContext==='undefined'||!globalThis.isSecureContext)
      throw new AudioEngineError('UNSUPPORTED','Use a current browser on HTTPS or localhost with Web Audio and module Worker support.');
    if(this.idleTimer)clearTimeout(this.idleTimer);this.idleTimer=undefined;
    const totalStart=performance.now();this.busy=true;const controller=new AbortController();
    this.abort=()=>controller.abort();const externalAbort=()=>controller.abort();job.signal?.addEventListener('abort',externalAbort,{once:true});
    const report=(event:ProgressEvent)=>job.onProgress?.(event);
    try{
      report({stage:'decoding'});const audio=await decodeAudio(file,this.model.sampleRate,{...this.options,range:job.range??this.options.range},controller.signal);checkAbort(controller.signal);
      const output=await new Promise<WorkerResult>((resolve,reject)=>{
        const worker=this.worker??new Worker(this.options.workerUrl??new URL('./separation-worker.js',import.meta.url),{type:'module'});this.worker=worker;
        const timer=setTimeout(()=>fail(new AudioEngineError('WORKER','Inference exceeded 60 minutes. Try a shorter file.')),60*60*1000);
        const cleanup=(terminate:boolean)=>{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;if(terminate)this.releaseWorker();};
        const fail=(error:Error)=>{cleanup(true);reject(error);};
        const abort=()=>fail(new AudioEngineError('ABORTED','Operation canceled.'));controller.signal.addEventListener('abort',abort,{once:true});
        worker.onerror=event=>fail(new AudioEngineError('WORKER',event.message||'Inference worker failed.'));
        worker.onmessageerror=()=>fail(new AudioEngineError('WORKER','Invalid worker message.'));
        worker.onmessage=({data})=>{
          if(data.type==='progress'){try{report(data.event);}catch(error){fail(error instanceof Error?error:new Error('Progress callback failed.'));}}
          else if(data.type==='done'){cleanup(false);resolve(data as WorkerResult);}
          else if(data.type==='error')fail(new AudioEngineError(data.code,data.message));
        };
        worker.postMessage({model:this.model.id,backend:this.options.backend??'auto',cache:this.options.cache!==false,channels:audio.channels},audio.channels.map(c=>c.buffer));
      });
      checkAbort(controller.signal);
      const stem=(channels:Stereo):AudioStem=>({channels,sampleRate:this.model.sampleRate,duration:channels[0].length/this.model.sampleRate});
      const vocals=stem(output.vocals),instrumental=stem(output.instrumental);let disposed=false;
      const ensure=()=>{if(disposed)throw new AudioEngineError('DISPOSED','Result PCM was released.');};
      const result:SeparationResult={vocals,instrumental,metadata:{model:this.model.id,backend:output.backend,inferenceSeconds:output.inferenceSeconds,setupSeconds:output.setupSeconds,modelReused:output.modelReused,totalSeconds:(performance.now()-totalStart)/1000,gain:output.gain},
        exportWav:(name:StemName)=>{ensure();if(!['vocals','instrumental'].includes(name))throw new AudioEngineError('OUTPUT','Unknown stem.');const value=name==='vocals'?vocals:instrumental;return encodeWav(value.channels,value.sampleRate);},
        exportZip:async(name='audio')=>{ensure();return zipStems(result.exportWav('vocals'),result.exportWav('instrumental'),name);},
        dispose:()=>{disposed=true;vocals.channels=[new Float32Array(),new Float32Array()];instrumental.channels=[new Float32Array(),new Float32Array()];}
      };
      report({stage:'ready',backend:output.backend});return result;
    }finally{job.signal?.removeEventListener('abort',externalAbort);this.busy=false;this.abort=undefined;if(this.worker&&!this.disposed){const idle=Math.min(300000,Math.max(1000,this.options.idleTimeoutMs??120000));this.idleTimer=setTimeout(()=>{this.releaseWorker();},idle);}}
  }
  private releaseWorker(){if(this.idleTimer)clearTimeout(this.idleTimer);this.idleTimer=undefined;this.worker?.terminate();this.worker=undefined;}
  storageInfo(){return modelStorage();}
  clearCache(){if(this.busy)throw new AudioEngineError('BUSY','Wait or cancel before clearing the model cache.');this.releaseWorker();return clearModelCache();}
  async dispose():Promise<void>{this.disposed=true;this.abort?.();this.releaseWorker();}
}
export async function createSeparator(options:SeparatorOptions={}):Promise<SeparationEngine>{return new SeparationEngine(options);}
