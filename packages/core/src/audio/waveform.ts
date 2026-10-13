import type { Stereo } from '../types.js';
export function waveformPeaks(channels: Stereo, points=800): Float32Array<ArrayBuffer> {
  if(!Number.isSafeInteger(points)||points<1||points>10000)throw new RangeError('Invalid waveform resolution.');
  const n=channels[0].length,peaks=new Float32Array(Math.min(n,points));
  for(let p=0;p<peaks.length;p++){
    const start=Math.floor(p*n/peaks.length),end=Math.floor((p+1)*n/peaks.length);let peak=0;
    for(let i=start;i<end;i++)peak=Math.max(peak,Math.abs(channels[0][i]),Math.abs(channels[1][i]));
    peaks[p]=peak;
  }
  return peaks;
}
