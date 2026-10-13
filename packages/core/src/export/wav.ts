import type { Stereo } from '../types.js';
export function encodeWav(channels:Stereo,rate=44100):Blob {
  if(!channels[0].length||channels[0].length!==channels[1].length||!Number.isSafeInteger(rate)||rate<8000||rate>192000)throw new RangeError('Invalid PCM dimensions/rate.');
  const count=channels[0].length,buffer=new ArrayBuffer(44+count*4),view=new DataView(buffer);
  const ascii=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
  ascii(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);ascii(8,'WAVE');ascii(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);
  ascii(36,'data');view.setUint32(40,count*4,true);
  for(let i=0;i<count;i++)for(let ch=0;ch<2;ch++){
    const value=channels[ch][i];if(!Number.isFinite(value))throw new RangeError('Non-finite PCM.');
    const x=Math.max(-1,Math.min(1,value));view.setInt16(44+(i*2+ch)*2,Math.round(x*(x<0?32768:32767)),true);
  }
  return new Blob([buffer],{type:'audio/wav'});
}
