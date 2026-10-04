import {seedFileSources,observeFileSource,finishLibraryPresence,rememberFileResult,retainedFileRows,sharedFileBudget,createFileLookup} from './file-links.mjs';
import {beginLibraryScan,recordDiscovery,chooseLibrary,finishWork,schedulerState} from './work-scheduler.mjs';
import {safeName,validId,epoch} from './core.mjs';
import {validHash,analyzeFiles,applyImagePreference} from './file-intelligence.mjs';

export const LIBRARY_LIMIT=10_000_000; // Decimal MB; the boundary itself is manual.
export const LIBRARY_INTERVAL=3*60*60*1000;
export const LIBRARY_FAILURE_LIMIT=2;
const idOf=v=>typeof v==='string' && /^[a-zA-Z0-9_-]{1,180}$/.test(v)?v:null;
export function libraryState(job,now=Date.now()) {
  return job.library ||= {schema:'chatgpt-library/v1',entries:{},directories:{},sources:[],nextScanAt:now,lastScanAt:0};
}
export function normalizeLibraryItem(item,parent=null) {
  if(!item || typeof item!=='object')return null;
  const f=[item.file,item.library_file,item.file_metadata,item.metadata,item].find(x=>x && typeof x==='object');
  const directory=item.directory || /^(directory|folder)$/i.test(item.type || item.node_type || item.kind || '');
  if(directory){const d=typeof directory==='object'?directory:item,external=(d.access_kind || item.access_kind)==='mounted';const raw=d.id || d.directory_id || item.id,id=idOf(raw) || (external && typeof raw==='string' && raw.length<=512 && !/[\x00-\x1f]/.test(raw)?raw:null);return id?{directory:true,id,name:String(d.name || d.title || 'Folder').slice(0,512),parent:d.parent_directory_id || parent,external}:null;}
  const fileId=idOf(f.file_id || item.file_id || (/^file[-_]/.test(f.id || '')?f.id:null));
  const libraryId=idOf(item.library_file_id || f.library_file_id || item.id || f.id);
  const id=fileId || libraryId;if(!id)return null;
  const rawSize=f.file_size_bytes ?? f.size_bytes ?? f.file_size ?? f.size ?? f.bytes ?? item.file_size_bytes ?? item.size;
  const size=rawSize!==undefined && rawSize!==null && rawSize!=='' && Number.isFinite(Number(rawSize)) && Number(rawSize)>=0?Number(rawSize):null;
  const conversationIds=f.conversation_ids || item.conversation_ids;
  const c=[...Array.isArray(conversationIds)?conversationIds:[],f.conversation_id,item.conversation_id,f.source_conversation_id,item.source_conversation_id,f.origination_thread_id,item.origination_thread_id];
  return {id,fileId,libraryId,name:String(f.file_name || f.filename || f.name || item.name || id).slice(0,1024),size,mime:f.mime_type || f.content_type || item.mime_type || null,parent:f.parent_directory_id || item.parent_directory_id || f.directory_id || item.directory_id || parent,created:f.create_time ?? f.created_at ?? f.creation_time ?? f.record_creation_time ?? item.created_at ?? null,uploaded:f.uploaded_at ?? f.upload_time ?? item.uploaded_at ?? null,firstModified:f.first_modified_at ?? f.first_modified_time ?? item.first_modified_at ?? null,updated:f.update_time ?? f.updated_at ?? f.modified_at ?? f.modification_time ?? f.last_modified_at ?? item.updated_at ?? null,remoteSha256:validHash(f.sha256 || f.content_sha256 || f.checksum?.sha256 || item.sha256),gizmoId:idOf(f.gizmo_id || item.gizmo_id),external:(f.access_kind || item.access_kind)==='mounted' || !!f.cloud_doc_url,conversationIds:[...new Set(c.filter(validId))]};
}
export function libraryPage(data) {
  const body=data?.data && typeof data.data==='object'?data.data:data;
  const items=Array.isArray(body)?body:body?.items || body?.nodes || body?.files || body?.results;
  const list=Array.isArray(items)?items:items?.items;
  if(!Array.isArray(list))throw Error('Library returned an unfamiliar list format; coverage remains incomplete.');
  const cursor=body?.next_cursor ?? body?.nextCursor ?? body?.pagination?.next_cursor ?? body?.cursor ?? null;
  const total=Number(body?.total ?? body?.total_count ?? body?.pagination?.total);
  return {items:list,cursor:cursor===null||cursor===''?null:String(cursor),cursorProvided:['next_cursor','nextCursor','cursor'].some(k=>Object.hasOwn(body,k)) || !!body?.pagination && Object.hasOwn(body.pagination,'next_cursor'),hasMore:body?.has_more ?? body?.hasMore ?? body?.pagination?.has_more ?? null,total:Number.isFinite(total)?total:null};
}
export function mergeLibraryItem(state,item,now=Date.now()) {
  if(item.directory){state.directories[item.id]=item;return false;}
  const old=state.entries[item.id],reportedHash=validHash(item.remoteSha256);
  if(old){item={...item};for(const key of ['size','mime','created','uploaded','firstModified','updated','remoteSha256','fileId','libraryId','parent'])if(item[key]==null)item[key]=old[key];if(item.name===item.id && old.name)item.name=old.name;}
  const sameKnownContent=old && reportedHash && reportedHash===validHash(old.sha256) && (item.size==null || item.size===old.size);
  const changed=old && !sameKnownContent && ((reportedHash && reportedHash!==old.remoteSha256 && reportedHash!==old.sha256) || (item.size!==null && old.size!==null && item.size!==old.size) || epoch(item.updated)>epoch(old.updated));
  if(changed)item.remoteSha256=reportedHash;
  const parked=!!old?.parked || (old?.attempts || 0)>=LIBRARY_FAILURE_LIMIT && old?.status!=='saved';
  const status=parked?'unavailable':item.external || item.size!==null && item.size>=LIBRARY_LIMIT?'manual':!old||changed?'pending':old.status;
  // A pacing check can observe this file while its transfer is in flight. Keep
  // the queue object stable so the transfer's result cannot land on an orphan.
  const next={...old,...item,conversationIds:[...new Set([...(old?.conversationIds || []),...item.conversationIds])],status,parked,seenAt:now,firstSeenAt:old?.firstSeenAt || now,...changed&&!parked?{path:null,sha256:null,duplicateOf:null,duplicate:false,refresh:true,...old?.attempts?{}:{retryAt:0,attempts:0,error:null}}:{}};
  state.entries[item.id]=old?Object.assign(old,next):next;
  return !old || changed;
}
export function queueLibraryScan(job,now=Date.now(),force=false) {
  if(job.options?.library===false || job.options?.mode==='index-only')return false;
  const s=libraryState(job,now);
  if(s.sources.some(x=>!x.done&&!x.error) || !force&&now<s.nextScanAt)return false;
  beginLibraryScan(job,now);s.sources=[{key:'root',parent:null,mode:s.mode || 'nodes',cursor:null,offset:0,done:false,seen:[],seenIds:[],failures:0}];
  s.nextScanAt=now+LIBRARY_INTERVAL;s.scanStartedAt=now;s.state='indexing';return true;
}
export function libraryWork(job,now=Date.now()) {
  seedFileSources(job,now);applyImagePreference(job);
  if(job?.options?.library===false || job?.options?.mode==='index-only')return null;
  const s=libraryState(job,now);
  const source=s.sources.filter(x=>!x.done&&!x.error || x.error&&x.failures<3&&(x.retryAt || 0)<=now).sort((a,b)=>(a.lastPageAt || 0)-(b.lastPageAt || 0))[0];
  const candidates=[...Object.values(s.entries),...(job.options?.attachments!==false?Object.values(job.fileLinks.sources).filter(x=>x.sourceKind==='chat'&&!x.historical):[])];
  const file=candidates.filter(x=>!x.external&&!x.parked&&(x.attempts || 0)<LIBRARY_FAILURE_LIMIT&&['pending','deferred'].includes(x.status)&&(x.retryAt || 0)<=now).sort((a,b)=>(a.size??LIBRARY_LIMIT)-(b.size??LIBRARY_LIMIT) || a.id.localeCompare(b.id));
  if((schedulerState(job,now).lanes['library-file']?.turns || 0)%4===3)file.sort((a,b)=>(a.firstSeenAt || epoch(a.created) || now)-(b.firstSeenAt || epoch(b.created) || now)||(a.size??LIBRARY_LIMIT)-(b.size??LIBRARY_LIMIT));
  const lookup=createFileLookup(job),next=file.find(x=>!sharedFileBudget(job,x,lookup).parked);
  return chooseLibrary(job,source,next,now);
}
export function libraryPath(file){return `attachments/library/${safeName(file.id,180)}/${safeName(file.name,160)}`;}
export function libraryCandidates(file) {
  const ids=[...new Set([file.fileId,file.id].filter(Boolean))],out=[];
  for(const id of ids){const route=`/backend-api/files/download/${encodeURIComponent(id)}`;out.push(route);for(const cid of file.conversationIds || []){const params=new URLSearchParams({conversation_id:cid});if(file.gizmoId)params.set('gizmo_id',file.gizmoId);out.push(route+'?'+params);}out.push(`/backend-api/files/${encodeURIComponent(id)}/download`);}
  return out;
}
export function retryLibraryFile(file,now=Date.now()) {
  if(!file || ['saved','manual'].includes(file.status))return false;
  Object.assign(file,{status:'pending',parked:false,parkedAt:null,attempts:0,retryAt:0,error:null,lastFailureStatus:null,retriedAt:now});return true;
}
export function recordLibraryFailure(file,result,now=Date.now()) {
  const attempts=Math.min(LIBRARY_FAILURE_LIMIT,(file.attempts || 0)+1),parked=attempts>=LIBRARY_FAILURE_LIMIT;
  Object.assign(file,{attempts,parked,status:parked?'unavailable':'deferred',error:result.error || 'The file could not be downloaded.',lastFailureStatus:result.httpStatus || result.statusCode || null,lastFailureAt:now,retryAt:parked?0:now+120000,parkedAt:parked?now:null});
  file.failureHistory=[...(file.failureHistory || []),{at:now,attempt:attempts,status:file.lastFailureStatus,error:file.error}].slice(-8);
}
export function libraryIndex(job) {
  seedFileSources(job);applyImagePreference(job);const s=libraryState(job),rows=retainedFileRows(job),analysis=analyzeFiles(rows),entries=rows.sort((a,b)=>a.name.localeCompare(b.name)).map(({id,fileId,libraryId,name,size,mime,parent,created,updated,conversationIds=[],status,path,sha256,savedAt,error,attempts=0,parked=false,parkedAt,lastFailureStatus,lastFailureAt,uploaded,firstModified,firstSeenAt,remoteSha256,duplicateOf,duplicate,imageExcluded,sourceRefs=[],historical=false})=>({id,source_refs:sourceRefs,historical,uploaded:uploaded || null,first_modified:firstModified || null,first_seen_at:firstSeenAt || null,remote_sha256:remoteSha256 || null,duplicate_of:duplicateOf || null,duplicate:analysis.get(id)?.duplicate || (duplicate?{isAlias:true,canonicalId:duplicateOf}:null),version_info:analysis.get(id)?.version || null,image_excluded:!!imageExcluded,native_file_id:fileId,file_id:historical?id:fileId,library_file_id:libraryId,name,size,mime,parent,created,updated,conversation_ids:conversationIds,status,attempts,parked,parked_at:parkedAt || null,last_failure_status:lastFailureStatus || null,last_failure_at:lastFailureAt || null,path:path || null,expected_path:path || libraryPath({id,name}),sha256:sha256 || null,saved_at:savedAt || null,error:error || null,manual_url:parent?`https://chatgpt.com/library/d/${encodeURIComponent(parent)}`:'https://chatgpt.com/library',conversation_urls:conversationIds.map(id=>`https://chatgpt.com/c/${encodeURIComponent(id)}`)}));
  return {schema:'chatgpt-library-index/v1',version:job.version,generated_at:new Date().toISOString(),scope_key:job.scope.key,automatic_download_limit_bytes:LIBRARY_LIMIT,limit_rule:'strictly-less-than',download_images:job.options?.downloadImages!==false,deduplication:s.deduplication || null,failure_limit:LIBRARY_FAILURE_LIMIT,coverage_scope:'ChatGPT files and owned folders; connected-provider folders are listed for manual access.',state:s.state || 'ready',coverage_complete:!!s.lastScanAt && s.sources.length>0 && s.sources.every(x=>x.done&&!x.error&&!x.unsupported),last_scan_at:s.lastScanAt || null,next_scan_at:s.nextScanAt,discovery:s.sources.map(({key,parent,mode,done,error,offset,unsupported=0})=>({key,parent,mode,done,items_seen:offset || 0,unsupported,error:error || null})),directories:Object.values(s.directories),entries};
}
export function manualFiles(job){return libraryIndex(job).entries.filter(x=>x.status!=='saved');}
export function linkedLibraryFiles(job,id){return libraryIndex(job).entries.filter(x=>x.conversation_ids.includes(id));}

export async function processLibrary(engine,work) {
  const j=engine.job,s=libraryState(j,engine.now()),now=()=>engine.now();seedFileSources(j,now());
  if(work.source){
    const source=work.source;source.error=null;j.phase='library-index';j.message='Indexing Library files and folders…';await engine.save();
    try{
      await engine.paceRequest('discovery');
      const response=await engine.io.libraryList(source,j.scope);
      if(response.observedAt)j.lastLimitSeen=Math.max(j.lastLimitSeen || 0,response.observedAt);
      if(!response.ok){
        if(source.key==='root'&&source.mode==='nodes'&&[400,404,405,422].includes(response.status)){source.mode='files';source.offset=0;source.cursor=null;await engine.save();return;}
        const e=Error(response.error || `Library list returned HTTP ${response.status || 0}.`);e.status=response.status;e.retryAfter=response.retryAfter;throw e;
      }
      const knownBefore=Object.keys(s.entries).length,page=libraryPage(response.data),ids=page.items.map(x=>normalizeLibraryItem(x,source.parent)?.id || ''),fingerprint=JSON.stringify(ids);
      if(page.items.length&&source.seen.includes(fingerprint))throw Error('Library repeated a page; stopped to avoid a download loop.');

      for(const raw of page.items){const item=normalizeLibraryItem(raw,source.parent);if(!item){source.unsupported=(source.unsupported || 0)+1;continue;}if(!source.seenIds.includes(item.id))source.seenIds.push(item.id);mergeLibraryItem(s,item,now());if(!item.directory)observeFileSource(j,s.entries[item.id],'library',null,now());if(item.directory && !item.external && !s.sources.some(x=>x.parent===item.id)){if(s.sources.length>=2000){source.unsupported=(source.unsupported || 0)+1;continue;}s.sources.push({key:item.id,parent:item.id,mode:'nodes',cursor:null,offset:0,done:false,seen:[],seenIds:[],failures:0});}}
      if(page.cursor===source.cursor && page.cursor)throw Error('Library repeated its pagination cursor.');
      if(page.items.length)source.seen.push(fingerprint);
      source.offset+=page.items.length;source.cursor=page.cursor;
      if(page.cursor || page.hasMore===true || page.total!==null&&source.offset<page.total || !page.cursorProvided&&page.hasMore===null&&page.total===null&&page.items.length>=100){if(!page.items.length)throw Error('Library ended before its reported total.');}
      else source.done=true;
      source.lastPageAt=now();recordDiscovery(j,Object.keys(s.entries).length-knownBefore,Object.keys(s.entries).length,now());
      source.failures=0;source.error=null;s.mode=s.sources[0].mode;
      if(s.sources.every(x=>x.done&&!x.error)){s.lastScanAt=now();s.state=s.sources.some(x=>x.unsupported)?'incomplete':'indexed';finishLibraryPresence(j,s.sources.flatMap(x=>x.seenIds || []),now(),s.state==='indexed');engine.event(`Library inventory ready: ${Object.keys(s.entries).length} files; ${Object.values(s.entries).filter(x=>x.status==='manual').length} listed for manual download.${s.state==='incomplete'?' Some unsupported entries were skipped; other pages and folders were still scanned.':''}`,'info','library');}
    }catch(e){if(e.name==='Paused')throw e;source.failures=(source.failures || 0)+1;source.error=e.message;source.retryAt=now()+Math.min(6*3600000,60000*2**source.failures);s.state='incomplete';if(e.status===429)engine.io.libraryLimit?.(e);if([401,403,409].includes(e.status)){source.failures=3;source.retryAt=0;}engine.event(`Library discovery deferred: ${e.message}. Chat backups can continue.`,'warn','library');}
  }else{
    const f=work.file,budget=sharedFileBudget(j,f);if(budget.attempts>(f.attempts || 0))f.attempts=budget.attempts;j.phase='library-file';j.message=`Saving file: ${f.name}`;await engine.save();
    try{const result=await engine.io.libraryDownload(f,async()=>{await engine.paceRequest('asset');});Object.assign(f,result);if(f.status==='saved'){f.savedAt=now();f.error=null;f.retryAt=0;f.parked=false;engine.event(`Library ${f.duplicate?'reused identical content':'saved'}: ${f.name} (${f.size} bytes).`,'info','library');}else if(f.status==='manual'){f.retryAt=0;engine.event(`Library manual download: ${f.name}.`,'info','library');}else if(result.httpStatus===429){f.status='deferred';f.retryAt=now()+120000;engine.io.libraryLimit?.({retryAfter:result.retryAfter});engine.event('Library downloads waiting for the server cooldown. Failure counts are unchanged.','warn','library');}else{recordLibraryFailure(f,result,now());engine.event(`Library ${f.parked?'parked':'failed'} ${f.attempts}/${LIBRARY_FAILURE_LIMIT}: ${f.name} — ${f.error}${f.parked?' · skipped until you explicitly retry it':''}.`,'warn','library');}}
    catch(e){if(e.name==='Paused')throw e;if(e.name==='YieldAttachments'){f.retryAt=now()+60000;}else{recordLibraryFailure(f,{error:e.message,httpStatus:e.status},now());engine.event(`Library ${f.parked?'parked':'failed'} ${f.attempts}/${LIBRARY_FAILURE_LIMIT}: ${f.name} — ${e.message}.`,'warn','library');}}
  }
  if(work.file){rememberFileResult(j,work.file,{...work.file},{now:now()});finishWork(j,'library-file',{savedFile:work.file.status==='saved',now:now()});}else finishWork(j,'library-scan',{now:now()});
  j.phase=null;await engine.save();await engine.io.report(j);
}
