import type { DecodedAudio, SeparatorOptions } from '../types.js';
import { AudioEngineError,checkAbort } from '../utils/errors.js';
export function validateInput(file: Blob, options: SeparatorOptions): void {
  if(!(file instanceof Blob)||!file.size)throw new AudioEngineError('DECODE','Choose a nonempty audio file.');
  if(file.size>(options.maxFileBytes??24*1024*1024))throw new AudioEngineError('LIMIT','File exceeds the configured memory-safe limit.');
}
async function durationHint(file: Blob, signal?: AbortSignal): Promise<number> {
  if(typeof document==='undefined')return NaN;
  return new Promise((resolve,reject)=>{
    const audio=document.createElement('audio'),url=URL.createObjectURL(file);
    let timer:ReturnType<typeof setTimeout>;
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);};
    const abort=()=>{cleanup();reject(new AudioEngineError('ABORTED','Operation canceled.'));};
    audio.preload='metadata';audio.onloadedmetadata=()=>{const d=audio.duration;cleanup();resolve(d);};
    audio.onerror=()=>{cleanup();resolve(NaN);};
    timer=setTimeout(()=>{cleanup();resolve(NaN);},5000);
    signal?.addEventListener('abort',abort,{once:true});audio.src=url;
    if(signal?.aborted)abort();
  });
}
export async function decodeAudio(file: Blob, rate: number, options: SeparatorOptions, signal?: AbortSignal): Promise<DecodedAudio> {
  checkAbort(signal);validateInput(file,options);
  const max=options.maxDuration??60, hint=await durationHint(file,signal);checkAbort(signal);
  if(Number.isFinite(hint)&&hint>max)throw new AudioEngineError('LIMIT',`Audio must be ${max} seconds or shorter.`);
  const bytes=await file.arrayBuffer();checkAbort(signal);
  // decodeAudioData resamples into this context's rate, without playing sound.
  const context=new OfflineAudioContext(2,1,rate);
  let audio:AudioBuffer;
  try{audio=await context.decodeAudioData(bytes);}catch(error){throw new AudioEngineError('DECODE','This browser cannot decode the file. Try WAV, MP3 or a supported codec.',{cause:error});}
  checkAbort(signal);
  if(audio.duration<=0||audio.duration>max||audio.length>rate*max||audio.sampleRate!==rate||audio.numberOfChannels>2)
    throw new AudioEngineError('LIMIT','Decoded audio exceeds duration/channel limits (mono or stereo only).');
  const left=new Float32Array(audio.getChannelData(0)),right=new Float32Array(audio.getChannelData(audio.numberOfChannels===1?0:1));
  for(const channel of [left,right])for(const sample of channel)if(!Number.isFinite(sample))throw new AudioEngineError('DECODE','Audio contains invalid samples.');
  return {channels:[left,right],sampleRate:rate,duration:audio.length/rate};
}
