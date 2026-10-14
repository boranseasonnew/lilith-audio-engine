import type {AudioStem} from '../types.js';
import {AudioEngineError,checkAbort} from '../utils/errors.js';
import {encodeWav} from './wav.js';
export type AudioExportFormat='wav'|'mp3'|'flac';
export async function exportAudio(stem:AudioStem,format:AudioExportFormat,options:{signal?:AbortSignal;onProgress?:(fraction:number)=>void;workerUrl?:string|URL}={}):Promise<Blob>{
  checkAbort(options.signal);if(format==='wav')return encodeWav(stem.channels,stem.sampleRate);
  if(!['mp3','flac'].includes(format))throw new AudioEngineError('OUTPUT','Unknown export format.');
  return new Promise((resolve,reject)=>{
    const worker=new Worker(options.workerUrl??new URL('./audio-export-worker.js',import.meta.url),{type:'module'});
    const cleanup=()=>{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);worker.terminate();};
    const fail=(error:Error)=>{cleanup();reject(error);};const abort=()=>fail(new AudioEngineError('ABORTED','Export canceled.'));const timer=setTimeout(()=>fail(new AudioEngineError('OUTPUT','Export timed out.')),10*60*1000);
    options.signal?.addEventListener('abort',abort,{once:true});worker.onerror=e=>fail(new AudioEngineError('OUTPUT',e.message||'Audio encoding failed.'));
    worker.onmessage=({data})=>{if(data.type==='progress'){try{options.onProgress?.(data.progress);}catch{fail(new AudioEngineError('OUTPUT','Export callback failed.'));}}else if(data.type==='done'){cleanup();resolve(data.blob);}else if(data.type==='error')fail(new AudioEngineError('OUTPUT',data.message));};
    // Structured-clone preserves the result buffers for playback and later downloads.
    worker.postMessage({channels:stem.channels,sampleRate:stem.sampleRate,format});if(options.signal?.aborted)abort();
  });
}
