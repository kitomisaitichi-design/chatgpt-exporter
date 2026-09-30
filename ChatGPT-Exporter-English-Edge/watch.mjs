import {counts,epoch} from './core.mjs';
export function hasReadyWork(job,now=Date.now()){
  if(!job)return false;
  if(job.sources?.some(s=>!s.done&&!s.error || s.error&&(s.failures || 0)<=2&&(s.retryAt || 0)<=now && job.options.verify!==false))return true;
  const entries=Object.values(job.entries || {});
  if(job.options.mode!=='index-only' && entries.some(e=>e.status==='pending'&&(e.retryAt || 0)<=now))return true;
  return job.options.attachments!==false && entries.some(e=>e.status==='saved'&&(!e.attachmentScannedAt || e.attachmentPending)&&(e.attachmentRetryAt || 0)<=now);
}
export function hasObservedWork(job,snapshots){
  return snapshots.some(s=>(s.hints || []).some(h=>!job.entries[h.id] || epoch(h.update_time)>Math.max(epoch(job.entries[h.id].update_time),epoch(job.entries[h.id].checkedUpdateTime))) || (s.changedBodies || []).some(h=>h.contentHash && h.contentHash!==job.entries[h.id]?.contentHash && h.contentHash!==job.entries[h.id]?.observedBodyHash));
}
export function enterWatching(job,now=Date.now()){
  if(job.status!=='watching')job.lastRunStatus=job.status;
  job.status='watching';job.phase=null;
  const c=counts(job);
  job.message=`Passive watch active — ${c.saved} chats saved${c.failed?`; ${c.failed} unresolved chats remain parked`:''}. Watching loaded chats for changes and waiting for the scheduled rescan.`;
  job.schedule ||= {};job.schedule.suspended=false;
  if(!job.schedule.nextScanAt)job.schedule.nextScanAt=now+(job.schedule.intervalMs || 10800000);
  Object.assign(job.awareness ||= {},{state:'watching',reason:job.message,waitUntil:0});
}
