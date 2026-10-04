import {counts} from './core.mjs';
export function dashboardStats(job){
  const c=counts(job);let unavailable=0,unverified=0,deferred=0,queued=0;const provenance=new Set();
  for(const entry of Object.values(job?.entries || {})){
    for(const route of entry.foundVia || [])provenance.add(route);
    if(entry.status==='saved'&&(!entry.attachmentScannedAt||entry.attachmentPending))queued++;
    for(const asset of entry.attachments || []){if(['unavailable','permission-unavailable','failed'].includes(asset.status))unavailable++;if(asset.status==='unverified')unverified++;if(['deferred','rate-limited'].includes(asset.status))deferred++;}
  }
  return {c,unavailable,unverified,deferred,queued,provenance};
}
export function createDashboardStats(){let previous=null,revision=null,value;return job=>{if(!value||job!==previous||`${job?.updated}:${job?.uiRevision}`!==revision){value=dashboardStats(job);previous=job;revision=`${job?.updated}:${job?.uiRevision}`;}return value;};}
