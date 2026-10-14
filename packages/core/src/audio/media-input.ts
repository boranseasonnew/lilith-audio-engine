import {Input,BlobSource,ALL_FORMATS,AudioSampleSink} from 'mediabunny';
import type {DecodedAudio,Stereo} from '../types.js';
import {AudioEngineError,checkAbort} from '../utils/errors.js';
const open=(file:Blob)=>new Input({source:new BlobSource(file),formats:ALL_FORMATS});
export async function inspect(file:Blob){const input=open(file);try{const track=await input.getPrimaryAudioTrack();if(!track)throw Error('No audio track.');return {duration:await track.computeDuration(),channels:await track.getNumberOfChannels()};}finally{input.dispose();}}
export async function decodeRange(file:Blob,start:number,duration:number,rate:number,signal?:AbortSignal):Promise<DecodedAudio>{
  const input=open(file);const abort=()=>input.dispose();signal?.addEventListener('abort',abort,{once:true});
  try{
    checkAbort(signal);const track=await input.getPrimaryAudioTrack();if(!track)throw new AudioEngineError('DECODE','No audio track.');
    if(await track.getNumberOfChannels()>2)throw new AudioEngineError('CHANNELS','Only mono or stereo audio is supported.');
    if(!await track.canDecode())throw new AudioEngineError('UNSUPPORTED','This browser cannot decode a selected range.');
    const sampleRate=await track.getSampleRate(),fullDuration=await track.computeDuration(),end=Math.min(fullDuration,start+duration);
    if(!Number.isFinite(start)||!Number.isFinite(duration)||start<0||duration<=0||end<=start)throw new AudioEngineError('DURATION','Invalid selected range.');
    const length=Math.round((end-start)*sampleRate),channels:Stereo=[new Float32Array(length),new Float32Array(length)];let written=0;
    const sink=new AudioSampleSink(track);
    for await(const sample of sink.samples(start,end)){
      try{checkAbort(signal);const skip=Math.max(0,Math.round((start-sample.timestamp)*sampleRate)),dest=Math.max(0,Math.round((sample.timestamp-start)*sampleRate)),count=Math.min(sample.numberOfFrames-skip,length-dest);if(count<=0)continue;
        for(let ch=0;ch<2;ch++)sample.copyTo(channels[ch].subarray(dest,dest+count),{planeIndex:Math.min(ch,sample.numberOfChannels-1),format:'f32-planar',frameOffset:skip,frameCount:count});written+=count;
      }finally{sample.close();}
    }
    checkAbort(signal);if(!written)throw new AudioEngineError('DECODE','The selected range contains no decoded audio.');
    if(sampleRate===rate)return {channels,sampleRate:rate,duration:length/rate};
    const context=new OfflineAudioContext(2,Math.round(length*rate/sampleRate),rate),buffer=context.createBuffer(2,length,sampleRate);channels.forEach((ch,i)=>buffer.copyToChannel(ch,i));const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start();const resampled=await context.startRendering();checkAbort(signal);
    return {channels:[new Float32Array(resampled.getChannelData(0)),new Float32Array(resampled.getChannelData(1))],sampleRate:rate,duration:resampled.length/rate};
  }catch(error){checkAbort(signal);if(error instanceof AudioEngineError)throw error;throw new AudioEngineError('DECODE','Cannot decode the selected audio range.',{cause:error});}
  finally{signal?.removeEventListener('abort',abort);input.dispose();}
}
