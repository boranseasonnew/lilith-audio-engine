import type { SeparationResult,StemName } from '../types.js';
export type PlaybackMode=StemName|'both';
export class SynchronizedPlayer {
  private buffers:Partial<Record<StemName,AudioBuffer>>;private gains:Record<StemName,GainNode>;private sources:AudioBufferSourceNode[]=[];private revision=0;
  private offset=0;private startedAt=0;private active=false;private mode:PlaybackMode='both';private disposed=false;
  private volumes:Record<StemName,number>={vocals:1,instrumental:1};private muted:Record<StemName,boolean>={vocals:false,instrumental:false};
  readonly context:AudioContext;readonly duration:number;
  constructor(result:SeparationResult,context?:AudioContext) {
    this.context=context??new AudioContext();this.duration=result.vocals.duration;
    if(!this.duration||result.instrumental.duration!==this.duration)throw new RangeError('Aligned stems required.');
    const buffer=(name:StemName)=>{const stem=result[name],b=this.context.createBuffer(2,stem.channels[0].length,stem.sampleRate);for(let ch=0;ch<2;ch++)b.copyToChannel(stem.channels[ch],ch);return b;};
    this.buffers={vocals:buffer('vocals'),instrumental:buffer('instrumental')};
    this.gains={vocals:this.context.createGain(),instrumental:this.context.createGain()};
    for(const gain of Object.values(this.gains))gain.connect(this.context.destination);
  }
  get playing():boolean{return this.active&&this.currentTime<this.duration;}
  get playbackMode():PlaybackMode{return this.mode;}
  get currentTime():number{return Math.min(this.duration,Math.max(0,this.offset+(this.active?Math.max(0,this.context.currentTime-this.startedAt):0)));}
  async play(mode:PlaybackMode=this.mode):Promise<void> {
    if(this.disposed)throw new Error('Player disposed.');
    if(!['both','vocals','instrumental'].includes(mode))throw new RangeError('Invalid playback mode.');
    this.pause();const revision=this.revision;if(this.offset>=this.duration)this.offset=0;this.mode=mode;await this.context.resume();
    if(this.disposed||revision!==this.revision)return;
    // Every source starts at exactly the SAME AudioContext time and PCM offset.
    const when=this.context.currentTime+.03;this.startedAt=when;this.active=true;
    for(const name of (mode==='both'?['vocals','instrumental']:[mode]) as StemName[]){
      const source=this.context.createBufferSource();source.buffer=this.buffers[name]!;source.connect(this.gains[name]);source.start(when,this.offset);this.sources.push(source);
      source.onended=()=>{if(this.currentTime>=this.duration){this.active=false;this.offset=this.duration;this.stopNodes();}};
    }
  }
  private stopNodes():void {for(const source of this.sources){source.onended=null;try{source.stop();}catch{}source.disconnect();}this.sources=[];}
  pause():void {++this.revision;this.offset=this.currentTime;this.active=false;this.stopNodes();}
  async seek(seconds:number):Promise<void> {if(!Number.isFinite(seconds))throw new RangeError('Invalid seek position.');const resume=this.playing;this.pause();this.offset=Math.max(0,Math.min(this.duration,seconds));if(resume)await this.play(this.mode);}
  volume(name:StemName,value:number):void {if(!Number.isFinite(value)||value<0||value>1)throw new RangeError('Volume must be between 0 and 1.');this.volumes[name]=value;this.updateGain(name);}
  mute(name:StemName,value:boolean):void {this.muted[name]=value;this.updateGain(name);}
  private updateGain(name:StemName):void {this.gains[name].gain.setTargetAtTime(this.muted[name]?0:this.volumes[name],this.context.currentTime,.01);}
  async dispose():Promise<void>{if(this.disposed)return;this.pause();this.disposed=true;this.buffers={};for(const gain of Object.values(this.gains))gain.disconnect();await this.context.close();}
}
