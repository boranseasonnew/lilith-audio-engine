export interface ChunkPlan { chunkSize: number; trim: number; paddedLength: number; starts: number[]; }
export function planChunks(length: number, fft=7680, hop=1024, frames=256): ChunkPlan {
  if(!Number.isSafeInteger(length)||length<=0)throw new RangeError('Empty or invalid audio.');
  const chunkSize=hop*(frames-1),trim=fft/2,usable=chunkSize-2*trim,step=Math.floor(chunkSize*.75);
  if(usable<=0||step<1)throw new RangeError('Invalid chunk configuration.');
  const paddedLength=trim+length+usable+trim-(length%usable),starts:number[]=[];
  for(let start=0;start<=paddedLength-chunkSize;start+=step)starts.push(start);
  // Cover the final tail even when a 75% step does not land on it.
  const last=paddedLength-chunkSize;
  if(starts.at(-1)!==last)starts.push(last);
  return {chunkSize,trim,paddedLength,starts};
}
export function hann(size: number): Float32Array<ArrayBuffer> {
  return Float32Array.from({length:size},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/size));
}
