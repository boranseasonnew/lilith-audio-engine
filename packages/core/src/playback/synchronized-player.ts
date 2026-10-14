import type {SeparationResult,StemName} from '../types.js';
export type PlaybackMode=StemName|'both';
const names:StemName[]=['vocals','instrumental'];
export class SynchronizedPlayer {
  private buffers:Partial<Record<StemName,AudioBuffer>>;private gains:Record<StemName,GainNode>;
  private sources:Partial<Record<StemName,AudioBufferSourceNode>>={};private enabled=new Set<StemName>();private revision=0;
  private offset=0;private startedAt=0;private active=false;private disposed=false;
  private volumes:Record<StemName,number>={vocals:1,instrumental:1};private muted:Record<StemName,boolean>={vocals:false,instrumental:false};
  readonly context:AudioContext;readonly duration:number;
  constructor(result:SeparationResult,context?:AudioContext){
    this.context=context??new AudioContext();this.duration=result.vocals.duration;
    if(!this.duration||result.instrumental.duration!==this.duration)throw new RangeError('Aligned stems required.');
    const buffer=(name:StemName)=>{const s=result[name],b=this.context.createBuffer(2,s.channels[0].length,s.sampleRate);for(let ch=0;ch<2;ch++)b.copyToChannel(s.channels[ch],ch);return b;};
    this.buffers={vocals:buffer('vocals'),instrumental:buffer('instrumental')};
    this.gains={vocals:this.context.createGain(),instrumental:this.context.createGain()};for(const g of Object.values(this.gains))g.connect(this.context.destination);
  }
  get playing(){return this.active&&this.currentTime<this.duration;}
  get playbackMode():PlaybackMode{return this.enabled.size===1?[...this.enabled][0]:'both';}
  get currentTime(){return Math.min(this.duration,Math.max(0,this.offset+(this.active?Math.max(0,this.context.currentTime-this.startedAt):0)));}
  isPlaying(name:StemName){return this.playing&&this.enabled.has(name);}
  async play(mode:PlaybackMode=this.playbackMode){
    if(this.disposed)throw Error('Player disposed.');if(!['both',...names].includes(mode))throw new RangeError('Invalid playback mode.');
    this.pause();this.enabled=new Set(mode==='both'?names:[mode]);await this.resume();
  }
  // Join the same clock instead of stopping the other stem. Both PCM sources
  // stay scheduled together; per-stem transport gates their individual gains.
  async playStem(name:StemName){
    if(this.disposed)throw Error('Player disposed.');if(!names.includes(name))throw new RangeError('Invalid stem.');
    this.enabled.add(name);if(this.playing){this.updateGain(name);return;}await this.resume();
  }
  pauseStem(name:StemName){this.enabled.delete(name);this.updateGain(name);if(!this.enabled.size)this.pause();}
  private async resume(){
    const revision=++this.revision;await this.context.resume();if(this.disposed||revision!==this.revision)return;
    this.stopNodes();if(this.offset>=this.duration)this.offset=0;
    const when=this.context.currentTime+.03;this.startedAt=when;this.active=true;
    for(const name of names){const source=this.context.createBufferSource();source.buffer=this.buffers[name]!;source.connect(this.gains[name]);this.sources[name]=source;this.updateGain(name);source.start(when,this.offset);
      source.onended=()=>{if(this.currentTime>=this.duration){this.offset=this.duration;this.active=false;this.enabled.clear();this.stopNodes();}};}
  }
  private stopNodes(){for(const source of Object.values(this.sources)){source.onended=null;try{source.stop();}catch{}source.disconnect();}this.sources={};}
  pause(){++this.revision;this.offset=this.currentTime;this.active=false;this.enabled.clear();this.stopNodes();}
  async seek(seconds:number){if(!Number.isFinite(seconds))throw new RangeError('Invalid seek position.');const resume=this.playing,enabled=new Set(this.enabled);this.pause();this.offset=Math.max(0,Math.min(this.duration,seconds));if(resume){this.enabled=enabled;await this.resume();}}
  volume(name:StemName,value:number){if(!Number.isFinite(value)||value<0||value>1)throw new RangeError('Volume must be between 0 and 1.');this.volumes[name]=value;this.updateGain(name);}
  mute(name:StemName,value:boolean){this.muted[name]=value;this.updateGain(name);}
  private updateGain(name:StemName){this.gains[name].gain.setTargetAtTime(this.muted[name]||!this.enabled.has(name)?0:this.volumes[name],this.context.currentTime,.01);}
  async dispose(){if(this.disposed)return;this.pause();this.disposed=true;this.buffers={};for(const g of Object.values(this.gains))g.disconnect();await this.context.close();}
}
