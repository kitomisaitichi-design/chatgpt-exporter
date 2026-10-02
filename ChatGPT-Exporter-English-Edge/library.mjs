import {safeName,validId,epoch} from './core.mjs';

export const LIBRARY_LIMIT=10_000_000; // Decimal MB; the boundary itself is manual.
export const LIBRARY_INTERVAL=3*60*60*1000;
const idOf=v=>typeof v==='string' && /^[a-zA-Z0-9_-]{1,180}$/.test(v)?v:null;
export function libraryState(job,now=Date.now()) {
  return job.library ||= {schema:'chatgpt-library/v1',entries:{},directories:{},sources:[],nextScanAt:now,lastScanAt:0};
}
export function normalizeLibraryItem(item,parent=null) {
  if(!item || typeof item!=='object')return null;
  const f=item.file || item.library_file || item.file_metadata || item.metadata || item;
  const directory=item.directory || /^(directory|folder)$/i.test(item.type || item.node_type || item.kind || '');
  if(directory){const d=typeof directory==='object'?directory:item;const id=idOf(d.id || d.directory_id || item.id);return id?{directory:true,id,name:String(d.name || d.title || 'Folder').slice(0,512),parent:d.parent_directory_id || parent}:null;}
  const fileId=idOf(f.file_id || item.file_id || (/^file[-_]/.test(f.id || '')?f.id:null));
  const libraryId=idOf(item.library_file_id || f.library_file_id || item.id || f.id);
  const id=fileId || libraryId;if(!id)return null;
  const rawSize=f.file_size_bytes ?? f.size_bytes ?? f.file_size ?? f.size ?? f.bytes ?? item.file_size_bytes ?? item.size;
  const size=rawSize!==undefined && rawSize!==null && rawSize!=='' && Number.isFinite(Number(rawSize)) && Number(rawSize)>=0?Number(rawSize):null;
  const c=f.conversation_ids || item.conversation_ids || [f.conversation_id || item.conversation_id || f.source_conversation_id || item.source_conversation_id];
  return {id,fileId,libraryId,name:String(f.file_name || f.filename || f.name || item.name || id).slice(0,1024),size,mime:f.mime_type || f.content_type || item.mime_type || null,parent:f.parent_directory_id || item.parent_directory_id || parent,created:f.create_time || f.created_at || item.created_at || null,updated:f.update_time || f.updated_at || item.updated_at || null,conversationIds:[...new Set((Array.isArray(c)?c:[]).filter(validId))]};
}
export function libraryPage(data) {
  const body=data?.data && typeof data.data==='object'?data.data:data;
  const items=Array.isArray(body)?body:body?.items || body?.nodes || body?.files || body?.results;
  const list=Array.isArray(items)?items:items?.items;
  if(!Array.isArray(list))throw Error('Library returned an unfamiliar list format; coverage remains incomplete.');
  const cursor=body?.next_cursor ?? body?.nextCursor ?? body?.pagination?.next_cursor ?? null;
  const total=Number(body?.total ?? body?.total_count ?? body?.pagination?.total);
  return {items:list,cursor:cursor===null||cursor===''?null:String(cursor),hasMore:body?.has_more ?? body?.hasMore ?? body?.pagination?.has_more ?? null,total:Number.isFinite(total)?total:null};
}
export function mergeLibraryItem(state,item,now=Date.now()) {
  if(item.directory){state.directories[item.id]=item;return false;}
  const old=state.entries[item.id];
  const changed=old && ((item.size!==null && old.size!==null && item.size!==old.size) || epoch(item.updated)>epoch(old.updated));
  const status=item.size!==null && item.size>=LIBRARY_LIMIT?'manual':!old||changed?'pending':old.status;
  state.entries[item.id]={...old,...item,conversationIds:[...new Set([...(old?.conversationIds || []),...item.conversationIds])],status,seenAt:now,...changed?{path:null,sha256:null,refresh:true,retryAt:0,attempts:0,error:null}:{}};
  return !old || changed;
}
export function queueLibraryScan(job,now=Date.now(),force=false) {
  if(job.options?.library===false || job.options?.mode==='index-only')return false;
  const s=libraryState(job,now);
  if(s.sources.some(x=>!x.done&&!x.error) || !force&&now<s.nextScanAt)return false;
  s.sources=[{key:'root',parent:null,mode:s.mode || 'nodes',cursor:null,offset:0,done:false,seen:[],seenIds:[],failures:0}];
  s.nextScanAt=now+LIBRARY_INTERVAL;s.scanStartedAt=now;s.state='indexing';return true;
}
export function libraryWork(job,now=Date.now()) {
  if(job?.options?.library===false || job?.options?.mode==='index-only')return null;
  const s=libraryState(job,now);
  const source=s.sources.find(x=>!x.done&&!x.error || x.error&&x.failures<3&&(x.retryAt || 0)<=now);
  if(source)return {source};
  const file=Object.values(s.entries).filter(x=>['pending','deferred'].includes(x.status)&&(x.retryAt || 0)<=now).sort((a,b)=>(a.size??LIBRARY_LIMIT)-(b.size??LIBRARY_LIMIT) || a.id.localeCompare(b.id))[0];
  return file?{file}:null;
}
export function libraryPath(file){return `attachments/library/${safeName(file.id,180)}/${safeName(file.name,160)}`;}
export function libraryCandidates(file) {
  const ids=[...new Set([file.fileId,file.id].filter(Boolean))],out=[];
  for(const id of ids){out.push(`/backend-api/files/download/${encodeURIComponent(id)}?inline=false`,`/backend-api/files/${encodeURIComponent(id)}/download`);}
  return out;
}
export function libraryIndex(job) {
  const s=libraryState(job),entries=Object.values(s.entries).sort((a,b)=>a.name.localeCompare(b.name)).map(({id,fileId,libraryId,name,size,mime,parent,created,updated,conversationIds,status,path,sha256,savedAt,error})=>({id,file_id:fileId,library_file_id:libraryId,name,size,mime,parent,created,updated,conversation_ids:conversationIds,status,path:path || null,sha256:sha256 || null,saved_at:savedAt || null,error:error || null,manual_url:parent?`https://chatgpt.com/library/d/${encodeURIComponent(parent)}`:'https://chatgpt.com/library',conversation_urls:conversationIds.map(id=>`https://chatgpt.com/c/${encodeURIComponent(id)}`)}));
  return {schema:'chatgpt-library-index/v1',version:job.version,generated_at:new Date().toISOString(),scope_key:job.scope.key,automatic_download_limit_bytes:LIBRARY_LIMIT,limit_rule:'strictly-less-than',state:s.state || 'ready',coverage_complete:!!s.lastScanAt && s.sources.every(x=>x.done&&!x.error),last_scan_at:s.lastScanAt || null,next_scan_at:s.nextScanAt,discovery:s.sources.map(({key,parent,mode,done,error})=>({key,parent,mode,done,error:error || null})),directories:Object.values(s.directories),entries};
}
export function manualFiles(job){return libraryIndex(job).entries.filter(x=>x.status!=='saved');}
export function linkedLibraryFiles(job,id){return libraryIndex(job).entries.filter(x=>x.conversation_ids.includes(id));}

export async function processLibrary(engine,work) {
  const j=engine.job,s=libraryState(j,engine.now()),now=()=>engine.now();
  if(work.source){
    const source=work.source;source.error=null;j.phase='library-index';j.message='Indexing Library files and folders…';await engine.save();
    try{
      await engine.paceRequest('discovery');
      const response=await engine.io.libraryList(source,j.scope);
      if(!response.ok){
        if(source.key==='root'&&source.mode==='nodes'&&[400,404,405,422].includes(response.status)){source.mode='files';source.offset=0;source.cursor=null;await engine.save();return;}
        const e=Error(response.error || `Library list returned HTTP ${response.status || 0}.`);e.status=response.status;e.retryAfter=response.retryAfter;throw e;
      }
      const page=libraryPage(response.data),ids=page.items.map(x=>normalizeLibraryItem(x,source.parent)?.id || ''),fingerprint=JSON.stringify(ids);
      if(page.items.length&&source.seen.includes(fingerprint))throw Error('Library repeated a page; stopped to avoid a download loop.');
      if(page.items.length)source.seen.push(fingerprint);
      for(const raw of page.items){const item=normalizeLibraryItem(raw,source.parent);if(!item)throw Error('A Library entry had no stable ID; coverage remains incomplete.');if(!source.seenIds.includes(item.id))source.seenIds.push(item.id);mergeLibraryItem(s,item,now());if(item.directory && s.sources.length<2000 && !s.sources.some(x=>x.parent===item.id))s.sources.push({key:item.id,parent:item.id,mode:'nodes',cursor:null,offset:0,done:false,seen:[],seenIds:[],failures:0});}
      if(page.cursor===source.cursor && page.cursor)throw Error('Library repeated its pagination cursor.');
      source.offset+=page.items.length;source.cursor=page.cursor;
      if(page.cursor || page.hasMore===true || page.total!==null&&source.seenIds.length<page.total){if(!page.items.length)throw Error('Library ended before its reported total.');}
      else source.done=true;
      source.failures=0;source.error=null;s.mode=s.sources[0].mode;
      if(s.sources.every(x=>x.done&&!x.error)){s.lastScanAt=now();s.state='indexed';engine.event(`Library inventory ready: ${Object.keys(s.entries).length} files; ${Object.values(s.entries).filter(x=>x.status==='manual').length} at or above 10 MB listed for manual download.`,'info','library');}
    }catch(e){if(e.name==='Paused')throw e;source.failures=(source.failures || 0)+1;source.error=e.message;source.retryAt=now()+Math.min(6*3600000,60000*2**source.failures);s.state='incomplete';if(e.status===429)engine.io.libraryLimit?.(e);if([401,403,409].includes(e.status)){source.failures=3;source.retryAt=0;}engine.event(`Library discovery deferred: ${e.message}. Chat backups can continue.`,'warn','library');}
  }else{
    const f=work.file;j.phase='library-file';j.message=`Saving Library file: ${f.name}`;await engine.save();
    try{const result=await engine.io.libraryDownload(f,async()=>{await engine.paceRequest('asset');});Object.assign(f,result);if(f.status==='saved'){f.savedAt=now();f.error=null;f.retryAt=0;engine.event(`Library saved: ${f.name} (${f.size} bytes).`,'info','library');}else if(f.status==='deferred'){f.attempts=(f.attempts || 0)+1;f.retryAt=now()+Math.min(6*3600000,60000*2**f.attempts);if(f.attempts>=3){f.status='unavailable';f.retryAt=0;}engine.event(`Library ${f.status}: ${f.name} — ${f.error || 'manual download available'}.`,'warn','library');}else engine.event(`Library ${f.status}: ${f.name}.`,'warn','library');}
    catch(e){if(e.name==='Paused')throw e;if(e.name==='YieldAttachments'){f.retryAt=now()+60000;}else{f.attempts=(f.attempts || 0)+1;f.status=f.attempts>=3?'unavailable':'deferred';f.error=e.message;f.retryAt=now()+Math.min(6*3600000,60000*2**f.attempts);engine.event(`Library file deferred: ${f.name} — ${e.message}.`,'warn','library');}}
  }
  j.phase=null;await engine.save();await engine.io.report(j);
}
