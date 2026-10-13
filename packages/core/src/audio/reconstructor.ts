import type { Stereo } from '../types.js';
import { AudioEngineError } from '../utils/errors.js';
export function reconstruct(mix: Stereo, prediction: Stereo, compensation: number, reusePrediction=false): {vocals:Stereo;instrumental:Stereo;gain:number} {
  const vocals:Stereo=reusePrediction?prediction:[new Float32Array(mix[0].length),new Float32Array(mix[0].length)];
  const instrumental:Stereo=[new Float32Array(mix[0].length),new Float32Array(mix[0].length)];let peak=1;
  for(let ch=0;ch<2;ch++){
    if(!mix[ch].length||mix[ch].length!==prediction[ch].length)throw new AudioEngineError('OUTPUT','Incorrect output dimensions.');
    for(let i=0;i<mix[ch].length;i++){
      const vocal=prediction[ch][i]*compensation,other=mix[ch][i]-vocal;
      if(!Number.isFinite(vocal)||!Number.isFinite(other))throw new AudioEngineError('OUTPUT','Non-finite model output.');
      vocals[ch][i]=vocal;instrumental[ch][i]=other;peak=Math.max(peak,Math.abs(vocal),Math.abs(other));
    }
  }
  const gain=1/peak;
  if(gain<1)for(const stem of [vocals,instrumental])for(const channel of stem)for(let i=0;i<channel.length;i++)channel[i]*=gain;
  return {vocals,instrumental,gain};
}
