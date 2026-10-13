import type { AudioModelManifest } from '../types.js';
import type { ModelAdapter } from './adapter.js';
import { AudioEngineError } from '../utils/errors.js';
export const MDX_MODEL: AudioModelManifest = Object.freeze({
  id:'mdx-default',name:'UVR-MDX-NET-Voc_FT',version:'fddec39677560e41e3194f24a9e4c4cd32ef0e83',
  author:'Anjok07 and aufr33 (UVR); MDX-Net by Kuielab / Woosung Choi',architecture:'MDX-Net',
  description:'Stereo vocal prediction with complementary instrumental reconstruction.',
  modelUrl:'https://huggingface.co/Blane187/all_public_uvr_models/resolve/fddec39677560e41e3194f24a9e4c4cd32ef0e83/UVR-MDX-NET-Voc_FT.onnx',
  sha256:'534b2070fcc7df514b13ef660dc8cbb328679c2374d04354a5c42bb14ecce111',sizeBytes:66762490,
  license:'MIT',sourceUrl:'https://github.com/Anjok07/ultimatevocalremovergui',
  sampleRate:44100,supportedStems:Object.freeze(['vocals','instrumental'] as const),supportedBackends:Object.freeze(['webgpu','wasm'] as const),
  preprocessing:Object.freeze({fft:7680,hop:1024,bins:3072,frames:256,compensation:1.021})
});
export function validateManifest(model: AudioModelManifest): void {
  const url=new URL(model.modelUrl);
  if(url.protocol!=='https:'||url.username||url.password||!model.id||!model.author||!model.license||
    !/^[a-f0-9]{64}$/.test(model.sha256)||!Number.isSafeInteger(model.sizeBytes)||model.sizeBytes<=0||
    !Number.isSafeInteger(model.sampleRate)||model.sampleRate<8000||model.sampleRate>192000||
    !model.supportedBackends.length||model.supportedBackends.some(b=>!['wasm','webgpu'].includes(b)))
    throw new AudioEngineError('MODEL','Invalid model manifest.');
  const p=model.preprocessing;
  if(![p.fft,p.hop,p.bins,p.frames].every(n=>Number.isSafeInteger(n)&&n>0)||p.bins>p.fft/2+1||p.compensation<=0||!Number.isFinite(p.compensation))
    throw new AudioEngineError('MODEL','Invalid spectral dimensions.');
}
export function getModel(id='mdx-default'): AudioModelManifest {
  if(id!==MDX_MODEL.id)throw new AudioEngineError('MODEL',`Model ${id} has no implemented trusted adapter.`);
  validateManifest(MDX_MODEL); return MDX_MODEL;
}
export function listModels(): readonly AudioModelManifest[] { return [MDX_MODEL]; }
export class ModelRegistry {
  private factories=new Map<string,()=>ModelAdapter>();
  register(manifest:AudioModelManifest,factory:()=>ModelAdapter):void {
    validateManifest(manifest);if(this.factories.has(manifest.id))throw new AudioEngineError('MODEL','Duplicate model adapter.');
    this.factories.set(manifest.id,factory);
  }
  create(id:string):ModelAdapter {
    const factory=this.factories.get(id);if(!factory)throw new AudioEngineError('MODEL','No trusted compiled model adapter.');
    const adapter=factory();validateManifest(adapter.manifest);if(adapter.manifest.id!==id){adapter.dispose();throw new AudioEngineError('MODEL','Adapter identity mismatch.');}return adapter;
  }
}
