export function safeFilename(name='audio'):string {
  return name.replace(/\.[^.]+$/,'').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'audio';
}
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes:Uint8Array):number {let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
export async function zipStems(vocals:Blob,instrumental:Blob,name='audio'):Promise<Blob> {
  const locals:BlobPart[]=[],central:BlobPart[]=[];let offset=0,centralSize=0;
  for(const [filename,blob] of [[safeFilename(name)+'_vocals.wav',vocals],[safeFilename(name)+'_instrumental.wav',instrumental]] as const){
    const encoded=new TextEncoder().encode(filename),bytes=new Uint8Array(await blob.arrayBuffer()),crc=crc32(bytes);
    const local=new Uint8Array(30+encoded.length),l=new DataView(local.buffer);
    l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint32(14,crc,true);
    l.setUint32(18,bytes.length,true);l.setUint32(22,bytes.length,true);l.setUint16(26,encoded.length,true);local.set(encoded,30);
    const entry=new Uint8Array(46+encoded.length),c=new DataView(entry.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);
    c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,encoded.length,true);c.setUint32(42,offset,true);entry.set(encoded,46);
    locals.push(local,blob);central.push(entry);offset+=local.length+bytes.length;centralSize+=entry.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);
  e.setUint16(8,2,true);e.setUint16(10,2,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  return new Blob([...locals,...central,end],{type:'application/zip'});
}
