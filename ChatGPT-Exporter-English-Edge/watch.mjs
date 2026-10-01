import {counts,epoch,newJob} from './core.mjs';
export const RECENT_CHECK_MS=5*60000;
export function ensureWatchSchedule(job,now=Date.now()){
  const s=job.schedule ||= {};s.recentIntervalMs ||= RECENT_CHECK_MS;
  if(!s.nextCheckAt)s.nextCheckAt=now; // First upgrade/start checks the server.
  if(!s.nextScanAt)s.nextScanAt=now+(s.intervalMs || 10800000);
  return s;
}
export function watchCheckDue(job,now=Date.now()){
  return !!(job?.schedule?.enabled && !job.schedule.suspended && now>=ensureWatchSchedule(job,now).nextCheckAt);
}
export function queueFullScanIfDue(job,now=Date.now()){
  if(!job?.schedule?.enabled || job.schedule.suspended)return false;
  const s=ensureWatchSchedule(job,now);
  if(s.fullScanPending || now<s.nextScanAt || job.sources.some(source=>!source.done&&!source.error))return false;
  job.sources=newJob(job.scope,job.options,now).sources;
  job.discoveryAudit={round:0,baseline:Object.keys(job.entries || {}).length,stable:false};job.discoveryUncertain=false;
  s.fullScanPending=true;s.lastScanAttemptAt=now;s.nextScanAt=now+(s.intervalMs || 10800000);
  return true;
}
export function recentWatchSources(job){
  const out=[{key:'passive active',kind:'list',offset:0}];
  if(job.options.archived)out.push({key:'passive archive',kind:'list',offset:0,archived:true});
  if(job.options.projects){
    out.push({key:'passive project previews',kind:'projects',cursor:null});
    const projects=job.sources.filter(s=>s.kind==='project');
    if(projects.length){const n=(job.schedule.projectCheckCursor || 0)%projects.length;out.push({...projects[n],cursor:'0'});job.schedule.projectCheckCursor=(n+1)%projects.length;}
  }
  return out.map(s=>({...s,seenPages:[],uniqueIds:[],emptyChecks:0,done:false,reportedTotal:0}));
}
export function hasReadyWork(job,now=Date.now()){
  if(!job)return false;
  if(job.sources?.some(s=>!s.done&&!s.error || s.error&&(s.failures || 0)<=2&&(s.retryAt || 0)<=now && job.options.verify!==false))return true;
  const entries=Object.values(job.entries || {});
  if(job.options.mode!=='index-only' && entries.some(e=>e.status==='pending'&&(e.retryAt || 0)<=now))return true;
  return job.options.attachments!==false && entries.some(e=>e.status==='saved'&&(!e.attachmentScannedAt || e.attachmentPending)&&(e.attachmentRetryAt || 0)<=now);
}
export function hasObservedWork(job,snapshots){
  return snapshots.some(s=>(s.hints || []).some(h=>!job.entries[h.id] || epoch(h.update_time)>Math.max(epoch(job.entries[h.id].update_time),epoch(job.entries[h.id].checkedUpdateTime))) || (s.changedBodies || []).some(h=>h.contentHash && h.contentHash!==job.entries[h.id]?.contentHash && h.contentHash!==job.entries[h.id]?.observedBodyHash) || (s.changedChats || []).some(h=>h.revision && h.revision!==job.entries[h.id]?.nativeWriteRevision));
}
export function enterWatching(job,now=Date.now()){
  if(job.status!=='watching')job.lastRunStatus=job.status;
  job.status='watching';job.phase=null;
  const c=counts(job);
  job.message=`Passive watch active — ${c.saved} chats saved${c.failed?`; ${c.failed} unresolved chats remain parked`:''}. Watching loaded chats for changes and waiting for the scheduled rescan.`;
  job.schedule ||= {};job.schedule.suspended=false;ensureWatchSchedule(job,now);
  if(!job.schedule.nextScanAt)job.schedule.nextScanAt=now+(job.schedule.intervalMs || 10800000);
  Object.assign(job.awareness ||= {},{state:'watching',reason:job.message,waitUntil:0});
}
