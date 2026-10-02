export const LOG_LIMIT=1500;
export function eventInfo(e){
  const message=String(e.message || '');
  const level=e.level || (/error|failed|needs attention|paused:|denied|mismatch/i.test(message)?'error':/deferred|limit|unavailable|incomplete|parked/i.test(message)?'warn':'info');
  const category=e.category || (/library/i.test(message)?'library':/attachment|file work/i.test(message)?'files':/limit|pacing|network|traffic/i.test(message)?'network':/watch|recent-chat|scan|discovery/i.test(message)?'watch':/changed|downloaded|backup|chat/i.test(message)?'chats':'system');
  return {...e,message,level,category};
}
export function appendEvent(job,message,at=Date.now(),level,category){
  const prev=job.events?.at(-1);
  if(prev?.message===message&&at-prev.at<30000){prev.repeated=(prev.repeated || 1)+1;prev.lastAt=at;return;}
  (job.events ||= []).push(eventInfo({at,message,level,category}));job.events=job.events.slice(-LOG_LIMIT);
}
export function filterEvents(events,{search='',level='all',category='all',since=0}={}){
  const q=search.trim().toLocaleLowerCase();
  return events.map(eventInfo).filter(e=>(e.lastAt || e.at)>since&&(level==='all'||e.level===level)&&(category==='all'||e.category===category)&&(!q||`${e.message} ${e.category}`.toLocaleLowerCase().includes(q)));
}
export function logText(events){return events.map(e=>`${new Date(e.at).toLocaleString()}  [${e.level.toUpperCase()} / ${e.category}] ${e.message}${e.repeated>1?` (×${e.repeated})`:''}`).join('\n');}
export class LogPanel {
  constructor(document,{download,onError}={}){
    this.d=document;this.download=download;this.onError=onError;this.snapshot=null;this.events=[];this.since=0;this.signature='';this.follow=true;
    let settings={};try{settings=JSON.parse(localStorage.getItem('exporter-log-controls') || '{}');}catch{}
    for(const id of ['log-search','log-level','log-category']){const el=this.get(id);if(settings[id])el.value=settings[id];el.addEventListener(id==='log-search'?'input':'change',()=>{this.saveSettings();this.signature='';this.render();});}
    this.get('log-follow').checked=settings.follow!==false;this.follow=this.get('log-follow').checked;
    this.get('log-follow').addEventListener('change',()=>{this.follow=this.get('log-follow').checked;this.saveSettings();this.signature='';this.render();});
    this.get('log').addEventListener('scroll',()=>{const el=this.get('log');if(el.scrollHeight-el.scrollTop-el.clientHeight>35){this.follow=false;this.get('log-follow').checked=false;}});
    this.get('log-latest').onclick=()=>{this.follow=true;this.get('log-follow').checked=true;this.get('log').scrollTop=this.get('log').scrollHeight;this.saveSettings();};
    this.get('log-pause').onclick=()=>{this.snapshot=this.snapshot?null:this.events.map(e=>({...e}));this.signature='';this.render();};
    this.get('log-clear').onclick=()=>{this.since=this.events.at(-1)?.lastAt || this.events.at(-1)?.at || 0;this.signature='';this.render();};
    this.get('log-reset').onclick=()=>{this.since=0;this.snapshot=null;for(const id of ['log-search','log-level','log-category'])this.get(id).value=id==='log-search'?'':'all';this.signature='';this.saveSettings();this.render();};
    this.get('log-copy').onclick=()=>navigator.clipboard.writeText(logText(this.filtered())).then(()=>this.feedback('Visible events copied.'),this.onError);
    this.get('log-save').onclick=()=>this.download(new Blob([logText(this.filtered())],{type:'text/plain'}),'chatgpt-exporter-visible-log.txt');
    this.get('log-json').onclick=()=>this.download(new Blob([JSON.stringify({schema:'chatgpt-exporter-log/v1',generated_at:new Date().toISOString(),events:this.events.map(eventInfo)},null,2)],{type:'application/json'}),'chatgpt-exporter-log.json');
  }
  get(id){return this.d.getElementById(id);}
  saveSettings(){try{localStorage.setItem('exporter-log-controls',JSON.stringify(Object.fromEntries([...['log-search','log-level','log-category'].map(id=>[id,this.get(id).value]),['follow',this.follow]])));}catch{}}
  filtered(){return filterEvents(this.snapshot || this.events,{search:this.get('log-search').value,level:this.get('log-level').value,category:this.get('log-category').value,since:this.since});}
  update(events){this.events=events || [];this.render();}
  feedback(text){this.get('log-summary').textContent=text;}
  render(){
    const events=this.filtered(),text=logText(events),signature=JSON.stringify([text,!!this.snapshot]);
    if(this.signature!==signature){const el=this.get('log'),top=el.scrollTop;el.textContent=text;el.scrollTop=this.follow?el.scrollHeight:top;this.signature=signature;}
    const unseen=this.snapshot?Math.max(0,this.events.reduce((n,e,i)=>n+Math.max(0,(e.repeated || 1)-(this.snapshot[i]?.repeated || (this.snapshot[i]?1:0))),0)):0;
    this.get('log-summary').textContent=`${events.length} shown / ${this.events.length} retained${this.snapshot?` · display paused · ${unseen} new`:''}${this.since?' · earlier events hidden':''}`;
    this.get('log-pause').textContent=this.snapshot?'Resume log display':'Pause log display';
  }
}
