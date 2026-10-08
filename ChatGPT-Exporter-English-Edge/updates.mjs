export const UPDATE_KEY='englishExporterUpdates';
export const UPDATE_ALARM='english-exporter-release-check';
export const UPDATE_INTERVALS={'12h':12*3600000,'24h':24*3600000,week:7*86400000,off:0};
const API='https://api.github.com/repos/kitomisaitichi-design/chatgpt-exporter/releases/latest';
const RELEASES='https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT';
export function newerVersion(candidate,current){const parse=v=>/^\d+\.\d+\.\d+$/.test(v || '')?v.split('.').map(Number):null,a=parse(candidate),b=parse(current);if(!a||!b)return false;for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false;}
export class UpdateChecker{
 constructor({storage,alarms,version,fetch=globalThis.fetch.bind(globalThis),now=Date.now,notify=()=>{}}){Object.assign(this,{storage,alarms,version,fetch,now,notify});this.state=null;this.ready=null;this.pending=null;}
 async initialize(){if(!this.ready)this.ready=(async()=>{const prior=(await this.storage.get(UPDATE_KEY))[UPDATE_KEY] || {};this.state={interval:'24h',autoInstall:false,lastCheckedAt:0,lastAttemptAt:0,nextCheckAt:0,lastError:null,...prior};if(!Object.hasOwn(UPDATE_INTERVALS,this.state.interval))this.state.interval='24h';this.state.available=newerVersion(this.state.latestVersion,this.version);if(!this.state.nextCheckAt&&this.state.interval!=='off')this.state.nextCheckAt=this.now()+1000;await this.schedule();await this.persist();return this.state;})().catch(e=>{this.ready=null;throw e;});return this.ready;}
 async persist(){await this.storage.set({[UPDATE_KEY]:{...this.state}});this.notify({...this.state,checking:!!this.pending});}
 async schedule(){await this.alarms.clear(UPDATE_ALARM);if(this.state.interval!=='off')await this.alarms.create(UPDATE_ALARM,{when:Math.max(this.now()+1000,this.state.nextCheckAt || this.now()+UPDATE_INTERVALS[this.state.interval])});else this.state.nextCheckAt=0;}
 async setInterval(interval){await this.initialize();if(!Object.hasOwn(UPDATE_INTERVALS,interval))throw Error('Choose 12 hours, 24 hours, weekly, or off.');this.state.interval=interval;this.state.nextCheckAt=interval==='off'?0:this.now()+UPDATE_INTERVALS[interval];if(interval==='off'&&!this.manual)this.controller?.abort();await this.schedule();await this.persist();return {...this.state,checking:!!this.pending};}
 async status(){await this.initialize();return {...this.state,checking:!!this.pending};}
 async setAutoInstall(enabled){await this.initialize();this.state.autoInstall=enabled===true;await this.persist();return this.status();}
 async check({manual=false}={}){await this.initialize();if(this.pending)return this.pending;if(!manual&&this.state.interval==='off')return this.status();this.manual=manual;this.controller=new AbortController();
  this.pending=(async()=>{this.state.lastAttemptAt=this.now();await this.persist();let timer;
   try{timer=setTimeout(()=>this.controller.abort(),20000);const response=await this.fetch(API,{headers:{Accept:'application/vnd.github+json',...(this.state.etag?{'If-None-Match':this.state.etag}:{})},signal:this.controller.signal,cache:'no-cache'});
    if(response.status!==304){if(!response.ok)throw Error(`GitHub update check returned HTTP ${response.status}.`);const release=await response.json(),version=release.tag_name?.match(/^ChatGPT(\d+\.\d+\.\d+)$/)?.[1];if(!version||release.draft||release.prerelease||release.html_url!==RELEASES+version)throw Error('GitHub returned an unexpected release; no update link was accepted.');this.state.latestVersion=version;this.state.releaseUrl=release.html_url;this.state.etag=response.headers.get('etag') || null;}
    else if(!this.state.latestVersion)throw Error('GitHub returned an empty cached release; check again.');
    this.state.lastCheckedAt=this.now();this.state.available=newerVersion(this.state.latestVersion,this.version);this.state.lastError=null;
   }catch(e){if(this.state.interval!=='off'||manual)this.state.lastError=e.name==='AbortError'?'Update check timed out or was cancelled.':e.message || String(e);}
   finally{clearTimeout(timer);this.state.nextCheckAt=this.state.interval==='off'?0:this.now()+(this.state.lastError?Math.min(3600000,UPDATE_INTERVALS[this.state.interval]):UPDATE_INTERVALS[this.state.interval]);await this.schedule();await this.persist();}
   return {...this.state,checking:false};
  })().finally(()=>{this.pending=null;this.controller=null;this.notify({...this.state,checking:false});});return this.pending;
 }
}
export function updateStatus(state,version){if(!state)return 'Loading update settings…';if(state.checking)return 'Checking the official GitHub release…';const last=state.lastCheckedAt?new Date(state.lastCheckedAt).toLocaleString():'not checked yet',next=state.interval==='off'?'scheduled checks off':`next check ${new Date(state.nextCheckAt).toLocaleString()}`;return `${state.available?'Update '+state.latestVersion+' available':'Installed '+version}${state.lastError?' · '+state.lastError:''} · last successful check: ${last} · ${next}.`;}
