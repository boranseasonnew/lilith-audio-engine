import {Output,BufferTarget,Mp3OutputFormat,FlacOutputFormat,AudioSampleSource,AudioSample,Quality} from 'mediabunny';
import {registerMp3Encoder} from '@mediabunny/mp3-encoder';
import {registerFlacEncoder} from '@mediabunny/flac-encoder';
registerMp3Encoder();registerFlacEncoder();
const scope=globalThis as unknown as {onmessage:(event:MessageEvent)=>void;postMessage:(message:unknown)=>void};
scope.onmessage=async({data})=>{
  const {channels,sampleRate,format}=data as {channels:[Float32Array,Float32Array];sampleRate:number;format:'mp3'|'flac'};
  const target=new BufferTarget(),output=new Output({target,format:format==='mp3'?new Mp3OutputFormat():new FlacOutputFormat()});
  try{
    const source=new AudioSampleSource({codec:format,quality:new Quality({bitrate:256000})});output.addAudioTrack(source);await output.start();
    const block=16384,length=channels[0].length;
    for(let offset=0;offset<length;offset+=block){const count=Math.min(block,length-offset),pcm=new Float32Array(count*2);pcm.set(channels[0].subarray(offset,offset+count));pcm.set(channels[1].subarray(offset,offset+count),count);
      const sample=new AudioSample({data:pcm,format:'f32-planar',numberOfChannels:2,sampleRate,timestamp:offset/sampleRate});try{await source.add(sample);}finally{sample.close();}scope.postMessage({type:'progress',progress:(offset+count)/length});}
    source.close();await output.finalize();scope.postMessage({type:'done',blob:new Blob([target.buffer!],{type:format==='mp3'?'audio/mpeg':'audio/flac'})});
  }catch(error){await output.cancel().catch(()=>{});scope.postMessage({type:'error',message:error instanceof Error?error.message:'Encoding failed.'});}
};
