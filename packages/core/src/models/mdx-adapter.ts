import * as ort from 'onnxruntime-web';
import { PffftSTFT } from 'web-audio-separation';
import { MDX_MODEL } from './registry.js';
import type { ModelAdapter } from './adapter.js';
import type { ProgressEvent,Stereo } from '../types.js';
import { AudioEngineError } from '../utils/errors.js';
import { planChunks,hann } from '../audio/chunker.js';
export class MdxAdapter implements ModelAdapter {
  readonly manifest=MDX_MODEL;
  private fft?:PffftSTFT;
  validate(channels:Stereo):void {
    if(!channels[0].length||channels[0].length!==channels[1].length||channels[0].length>this.manifest.sampleRate*300)
      throw new AudioEngineError('LIMIT','Invalid stereo input or duration exceeds 300 seconds.');
    for(const c of channels)for(const sample of c)if(!Number.isFinite(sample))throw new AudioEngineError('DECODE','Non-finite input sample.');
  }
  async infer(session:ort.InferenceSession,mix:Stereo,report:(event:ProgressEvent)=>void):Promise<Stereo> {
    this.validate(mix);const p=this.manifest.preprocessing,{chunkSize,trim,starts}=planChunks(mix[0].length,p.fft,p.hop,p.frames);
    const length=mix[0].length,results=[new Float32Array(length),new Float32Array(length)],weights=new Float32Array(length),window=hann(chunkSize);
    // STFT helper by Dan Kurtz: reflect padding, periodic Hann, packed complex stereo,
    // low-bin mask matching UVR, and normalized ISTFT. No upstream separation controller is used.
    if(!this.fft){this.fft=new PffftSTFT(p.fft,p.hop,p.bins);await this.fft.init();}const fft=this.fft;let completed=0;
    const chunk=new Float32Array(chunkSize*2);
    for(const start of starts){
      report({stage:'preparing-tensors'});
      chunk.fill(0);
      const audioStart=start-trim,from=Math.max(0,audioStart),to=Math.min(length,audioStart+chunkSize);
      for(let ch=0;ch<2;ch++)if(to>from)chunk.set(mix[ch].subarray(from,to),ch*chunkSize+from-audioStart);
      const spectrum=fft.forward(chunk,1,chunkSize);
      if(spectrum.length!==4*p.bins*p.frames)throw new AudioEngineError('OUTPUT','Incorrect input tensor dimensions.');
      const tensor=new ort.Tensor('float32',spectrum,[1,4,p.bins,p.frames]);let outputs:ort.InferenceSession.ReturnType|undefined;
      try{
        report({stage:'inference',completed,total:starts.length,progress:completed/starts.length});
        outputs=await session.run({[session.inputNames[0]]:tensor});const output=outputs[session.outputNames[0]];
        if(output.type!=='float32'||output.data.length!==spectrum.length||output.dims.join(',')!==`1,4,${p.bins},${p.frames}`)
          throw new AudioEngineError('OUTPUT','Incorrect model output tensor dimensions.');
        const wave=fft.inverse(output.data as Float32Array,1);
        for(let i=0;i<chunkSize;i++){const destination=start-trim+i;if(destination<0||destination>=length)continue;
          const weight=window[i];weights[destination]+=weight;
          for(let ch=0;ch<2;ch++)results[ch][destination]+=wave[ch*chunkSize+i]*weight;}
      }finally{tensor.dispose();if(outputs)for(const value of Object.values(outputs))value.dispose();}
      report({stage:'inference',completed:++completed,total:starts.length,progress:completed/starts.length});
    }
    for(const channel of results)for(let i=0;i<length;i++)channel[i]/=weights[i]+1e-8;
    return results as Stereo;
  }
  dispose():void {this.fft=undefined;} // Worker termination frees the FFT library's WASM heap (no public free API).
}
