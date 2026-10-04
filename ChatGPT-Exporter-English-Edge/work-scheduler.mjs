export const DISCOVERY_WINDOW_MS=180000;
const CYCLE=['library','chat','attachment','chat-scan','recent','library','chat','verify','library'];
export function schedulerState(job,now=Date.now()){
  return job.workScheduler ||= {schema:'chatgpt-work-scheduler/v1',startedAt:now,cursor:0,urgentBurst:0,completed:0,lanes:{},library:{startedAt:now,highWater:0,pages:0,pagesSinceFile:0,filesSincePage:0,samples:[]}};
}
export function beginLibraryScan(job,now=Date.now()){
  const state=schedulerState(job,now),previous=state.library;
  state.library={startedAt:now,highWater:previous.highWater || 0,pages:0,pagesSinceFile:0,filesSincePage:0,samples:[],lastFileAt:previous.lastFileAt || 0};
}
export function recordDiscovery(job,newFiles,known,now=Date.now()){
  const s=schedulerState(job,now).library;s.pages++;s.pagesSinceFile++;s.filesSincePage=0;s.lastPageAt=now;s.highWater=Math.max(s.highWater || 0,known);
  s.samples=[...(s.samples || []).filter(x=>now-x.at<DISCOVERY_WINDOW_MS),{at:now,added:newFiles}].slice(-200);
  if(newFiles)s.lastNewAt=now;
}
export function libraryPolicy(job,now=Date.now()){
  const s=schedulerState(job,now).library,known=Object.keys(job.library?.entries || {}).length,highWater=Math.max(known,s.highWater || 0),growth=(s.samples || []).filter(x=>now-x.at<DISCOVERY_WINDOW_MS).reduce((n,x)=>n+x.added,0);
  const observed=now-s.startedAt>=DISCOVERY_WINDOW_MS,slow=observed&&growth<Math.max(1,Math.ceil(highWater*.02));
  const enoughKnown=known>=200 || highWater>=200&&known>=highWater*.5;
  const warm=!enoughKnown&&s.pages<2&&now-s.startedAt<30000&&!s.lastFileAt;
  return {known,highWater,growth,observed,slow,warm,downloadShare:slow?80:20,reason:slow?'Discovery added less than 2% of the observed high-water count in three minutes; favouring downloads.':warm?'Brief discovery warm-up; ready downloads start within two pages or 30 seconds.':'Discovery and downloads alternate; ready files do not wait for a complete scan.'};
}
export function chooseLibrary(job,source,file,now=Date.now()){
  if(!source)return file?{file}:null;if(!file)return {source};
  const policy=libraryPolicy(job,now),s=schedulerState(job,now).library;
  if(policy.warm)return {source};
  if(!s.lastFileAt || now-s.lastFileAt>=60000)return {file};
  if(policy.slow)return (s.filesSincePage || 0)<4?{file}:{source};
  return (s.pagesSinceFile || 0)>=4?{file}:{source};
}
export function pickWork(job,available,{urgent=false,local=false,now=Date.now()}={}){
  const s=schedulerState(job,now);
  if(available.chat&&urgent&&s.urgentBurst<2)return {lane:'chat',work:available.chat,reason:'Saving a newly changed chat; two urgent turns at most before other ready work.'};
  if(available.chat&&local&&(s.localBurst || 0)<4)return {lane:'chat',work:available.chat,reason:'Writing an already captured chat locally; no network request needed.'};
  if(job.options.mode==='index-first'&&available['chat-scan']&&(s.chatPages || 0)<2&&now-s.startedAt<30000)return {lane:'chat-scan',work:available['chat-scan'],reason:'Brief chat-index warm-up; file queues remain eligible afterwards.'};
  for(let i=0;i<CYCLE.length;i++){const at=(s.cursor+i)%CYCLE.length,lane=CYCLE[at];if(available[lane]){s.cursor=(at+1)%CYCLE.length;return {lane,work:available[lane],reason:lane==='library'?libraryPolicy(job,now).reason:lane==='attachment'?'One bounded chat-attachment batch, then another ready queue.':lane==='verify'?'Checking one local copy between productive turns.':'Fair queue turn; other ready queues retain their place.'};}}
  return null;
}
export function beginWork(job,decision,now=Date.now()){
  const s=schedulerState(job,now),kind=decision.lane==='library'?(decision.work.file?'library-file':'library-scan'):decision.lane;
  s.active={kind,reason:decision.reason,since:now};
}
export function finishWork(job,lane,{savedFile=false,urgent=false,local=false,now=Date.now()}={}){
  const s=schedulerState(job,now);s.completed++;s.lastCompletedAt=now;s.lastCompletedLane=lane;s.lanes[lane]={at:now,turns:(s.lanes[lane]?.turns || 0)+1};
  s.urgentBurst=lane==='chat'&&urgent?s.urgentBurst+1:0;s.localBurst=lane==='chat'&&local?(s.localBurst || 0)+1:0;
  if(lane==='chat-scan')s.chatPages=(s.chatPages || 0)+1;
  if(lane==='library-file'){s.library.lastFileAt=now;s.library.pagesSinceFile=0;s.library.filesSincePage=(s.library.filesSincePage || 0)+1;}
  if(savedFile)s.lastFileProgressAt=now;
}
export function assetsMustYield(job,now=Date.now()){
  const active=job.workScheduler?.active;
  if(!active)return Object.values(job.entries).some(e=>e.status==='pending'&&(!e.retryAt||e.retryAt<=now)) || job.sources.some(s=>!s.done&&!s.error);
  return job.workScheduler.urgentBurst<2&&Object.values(job.entries).some(e=>e.status==='pending'&&(!e.retryAt||e.retryAt<=now)&&e.refresh&&(e.nativeWriteAt || e.changeReason));
}
export function workPresentation(job,now=Date.now()){
  const s=job?.workScheduler,labels={chat:'Chat text / JSON','chat-scan':'Chat discovery',recent:'Recent-chat check',attachment:'Chat attachments','library-file':'Library / retained files','library-scan':'Library discovery',verify:'Local file validation'};
  if(!job)return {title:'Ready to choose work',reason:'Ready queues take turns. Uploaded files, generated files and images share the file queue.',health:'Progress will appear after Start.'};
  const p=libraryPolicy(job,now),waiting=(job.awareness?.waitUntil || 0)>now,active=s?.active;
  const idle=Math.max(0,now-(s?.lastCompletedAt || s?.startedAt || now));
  const fileAge=Math.max(0,now-(s?.lastFileProgressAt || s?.startedAt || now)),summary=job.options.mode==='index-only'?'Index only · transcript and file downloads are off.':job.options.library===false?'Automatic Library downloads are off.':`Library turns: ${p.downloadShare}% downloads when both queues are ready · ${p.growth} new files in the rolling three-minute window${p.observed?'':' (warming up)'} · observed high-water ${p.highWater.toLocaleString()}.`;
  return {title:waiting?'Waiting · '+(labels[active?.kind] || 'network window'):labels[active?.kind] || 'Preparing saved queues',reason:waiting?job.awareness.reason:active?.reason || p.reason,health:summary+(job.status==='running'&&fileAge>=600000?' No new file saved for '+Math.floor(fileAge/60000)+' min; discovery, validation, retries or a network wait may still be active.':'')+(job.status==='running'&&idle>=600000?' No work completed for '+Math.floor(idle/60000)+' min; '+(waiting?'waiting for the condition above.':'check the connection, folder access and activity log.'):'')};
}
