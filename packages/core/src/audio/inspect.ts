export async function inspectAudio(file:Blob):Promise<{duration:number;channels?:number}>{
  try{return await (await import('./media-input.js')).inspect(file);}catch{
    return new Promise((resolve,reject)=>{const audio=document.createElement('audio'),url=URL.createObjectURL(file);const cleanup=()=>{clearTimeout(timer);audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);};const fail=()=>{cleanup();reject(Error('Metadata unavailable.'));};const timer=setTimeout(fail,8000);audio.preload='metadata';audio.onloadedmetadata=()=>{const duration=audio.duration;cleanup();Number.isFinite(duration)?resolve({duration}):reject(Error('Invalid duration.'));};audio.onerror=fail;audio.src=url;});
  }
}
