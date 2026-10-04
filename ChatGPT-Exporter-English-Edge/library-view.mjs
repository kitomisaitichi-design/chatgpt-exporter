import {retainedFileRows} from './file-links.mjs';
import {analyzeFiles} from './file-intelligence.mjs';

// Dashboard inventory is separate from export generation and never mutates a job.
export function libraryView(job){
  const all=job?retainedFileRows(job):[],analysis=analyzeFiles(all),counts={saved:0,pending:0,parked:0,manual:0},unique=new Map(),families=new Set();let duplicates=0;
  for(const file of all){
    if(file.parked)counts.parked++;else if(['pending','deferred'].includes(file.status))counts.pending++;else if(file.status in counts)counts[file.status]++;
    if(file.status==='saved')unique.set(file.path || file.id,file.size || 0);
    const intel=analysis.get(file.id);if(file.duplicate || intel?.duplicate?.isAlias)duplicates++;if(intel?.version)families.add(intel.version.family);
  }
  let bytes=0;for(const size of unique.values())bytes+=size;
  const state=job?.library,sources=state?.sources || [];
  return {all,analysis,counts,bytes,duplicates,versions:families.size,sources,done:sources.filter(s=>s.done&&!s.error).length,unsupported:sources.reduce((n,s)=>n+(s.unsupported || 0),0),external:Object.values(state?.directories || {}).filter(d=>d.external).length,coverageComplete:!!state?.lastScanAt&&sources.length>0&&sources.every(s=>s.done&&!s.error&&!s.unsupported)};
}
export function createLibraryView(){let previous,revision,value;return job=>{const next=`${job?.updated}:${job?.uiRevision}:${job?.options?.downloadImages}:${job?.options?.library}`;if(!value || previous!==job || next!==revision){value=libraryView(job);previous=job;revision=next;}return value;};}
