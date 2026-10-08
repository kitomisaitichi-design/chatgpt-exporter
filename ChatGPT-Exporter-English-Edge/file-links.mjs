import {safeName,validId,epoch} from './core.mjs';

const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(v)?v:null;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v)?v.toLowerCase():null;
export function fileIds(file){return [...new Set([file.fileId,file.file_id,file.id,file.libraryId,file.library_file_id].map(id).filter(Boolean))];}
export function fileLinkState(job){return job.fileLinks ||= {schema:'chatgpt-file-links/v1',sources:{}};}
export function fileReferences(job){return [...Object.values(job?.library?.entries || {}),...Object.values(job?.entries || {}).flatMap(e=>e.attachments || []),...Object.values(job?.fileLinks?.sources || {})];}
const lookups=new WeakMap();
export function invalidateFileLookup(job){if(job)lookups.delete(job);}
export function createFileLookup(job){
  let lookup=lookups.get(job);if(lookup)return lookup;
  const references=fileReferences(job),byId=new Map(),byHash=new Map(),byPath=new Map();
  lookup={references,byId,byHash,byPath,pendingPaths:new Set(),members:new Map()};for(const file of references){indexReference(lookup,file);lookup.members.set(file,{ids:fileIds(file),hash:hash(file.sha256),path:file.path});}lookups.set(job,lookup);return lookup;
}
function indexReference(lookup,file){for(const [map,keys] of [[lookup.byId,fileIds(file)],[lookup.byHash,[hash(file.sha256)]],[lookup.byPath,[file.path]]])for(const key of keys)if(key){let bucket=map.get(key);if(!bucket){map.set(key,bucket=new Set());if(map===lookup.byPath)lookup.pendingPaths.add(key);}bucket.add(file);}}
export function registerFileReference(job,file){const lookup=lookups.get(job);if(!lookup)return;const prior=lookup.members.get(file);if(prior)for(const [map,keys] of [[lookup.byId,prior.ids],[lookup.byHash,[prior.hash]],[lookup.byPath,[prior.path]]])for(const k of keys)map.get(k)?.delete(file);if(!prior)lookup.references.push(file);lookup.members.set(file,{ids:fileIds(file),hash:hash(file.sha256),path:file.path});indexReference(lookup,file);}
export function relatedFiles(job,file,lookup=createFileLookup(job)){
  const found=new Set([file]),seen=new Set(),pending=fileIds(file);
  for(let i=0;i<pending.length;i++){const key=pending[i];if(seen.has(key))continue;seen.add(key);for(const peer of lookup.byId.get(key) || [])if(!found.has(peer)){found.add(peer);pending.push(...fileIds(peer));}}
  return [...found];
}
export function compatibleFile(target,candidate){
  const expected=hash(target.remoteSha256 || target.sha256),actual=hash(candidate.sha256 || candidate.remoteSha256);
  const native=f=>f.fileId || f.file_id || (/^file[-_]/.test(f.id || '')?f.id:null),a=native(target),b=native(candidate);
  if(a&&b&&a!==b&&(!expected||expected!==actual))return false;
  if(expected&&actual&&expected!==actual)return false;
  if(target.size!=null&&candidate.size!=null&&Number(target.size)!==Number(candidate.size))return false;
  if(target.refresh&&!hash(target.remoteSha256))return false;
  if(!expected&&epoch(target.updated)>epoch(candidate.updated)&&epoch(candidate.updated))return false;
  return true;
}
export function observeFileSource(job,file,kind,conversationId=null,now=Date.now()){
  const sources=fileLinkState(job).sources,identity=id(kind==='library'?file.libraryId || file.id:file.id) || safeName(file.name || 'unnamed',160),key=kind+':'+(conversationId || '')+':'+identity,old=sources[key];
  const changed=old&&((file.fileId&&old.fileId&&file.fileId!==old.fileId) || (hash(file.remoteSha256)&&hash(file.remoteSha256)!==hash(old.sha256 || old.remoteSha256)) || file.size!=null&&old.size!=null&&Number(file.size)!==Number(old.size) || file.refresh&&!old.refresh);
  if(changed&&old.status==='saved'&&old.path){const historical=key+':saved:'+hash(old.sha256);sources[historical]={...old,sourceKey:historical,presence:'previous-version',historical:true};registerFileReference(job,sources[historical]);}
  const fields={id:file.id || identity,fileId:file.fileId || file.file_id || file.id,libraryId:file.libraryId || file.library_file_id || null,name:file.name || identity,size:file.size??old?.size??null,mime:file.mime || old?.mime || null,parent:file.parent || old?.parent || null,gizmoId:file.gizmoId || old?.gizmoId || null,external:!!file.external,updated:file.updated || old?.updated || null,created:file.created || old?.created || null,uploaded:file.uploaded || old?.uploaded || null,remoteSha256:hash(file.remoteSha256) || (!changed?old?.remoteSha256:null) || null,conversationIds:[...new Set([...(old?.conversationIds || []),...(file.conversationIds || []),conversationId].filter(validId))],sourceKey:key,sourceKind:kind,sourceConversationId:conversationId,presence:'observed',firstSeenAt:old?.firstSeenAt || now,seenAt:now};
  const next={...old,...fields};if(!old||changed)Object.assign(next,{status:file.status || 'pending',attempts:file.attempts || 0,parked:!!file.parked,path:file.path || null,sha256:file.sha256 || null,refresh:!!file.refresh});
  if(file.status==='saved'&&file.path)Object.assign(next,{status:'saved',path:file.path,sha256:file.sha256,size:file.size,parked:false});
  // Restoring an old retired attachment must not silently reopen its failure loop.
  if(!old&&file.autoRetry===false&&['unavailable','permission-unavailable'].includes(file.status))Object.assign(next,{attempts:2,parked:true});
  if(next.status==='skipped-too-large')next.status='manual';
  sources[key]=old?Object.assign(old,next):next;file.sourceKind ||= kind;file.sourceConversationId ||= conversationId;registerFileReference(job,file);registerFileReference(job,sources[key]);return sources[key];
}
export function seedFileSources(job,now=Date.now()){
  const sources=fileLinkState(job).sources;
  for(const f of Object.values(job.library?.entries || {}))if(!sources['library::'+(f.libraryId || f.id)])observeFileSource(job,f,'library',null,now);
  for(const e of Object.values(job.entries || {}))for(const f of e.attachments || [])if(!sources['chat:'+e.id+':'+(f.id || safeName(f.name,160))])observeFileSource(job,f,'chat',e.id,now);
}
export function observeChatFiles(job,conversationId,files,now=Date.now()){
  invalidateFileLookup(job);seedFileSources(job,now);
  const seen=new Set();for(const f of files){f.sourceKind='chat';f.sourceConversationId=conversationId;seen.add(observeFileSource(job,f,'chat',conversationId,now).sourceKey);}
  for(const f of Object.values(fileLinkState(job).sources))if(!f.historical&&f.sourceKind==='chat'&&f.sourceConversationId===conversationId&&!seen.has(f.sourceKey)){f.presence='not-seen-in-latest-chat-body';f.lastAbsentAt=now;}
}
export function finishLibraryPresence(job,seenIds,now=Date.now(),complete=true){
  if(!complete)return;const seen=new Set(seenIds);
  for(const f of Object.values(fileLinkState(job).sources))if(!f.historical&&f.sourceKind==='library'&&!fileIds(f).some(x=>seen.has(x))){f.presence='not-seen-in-complete-library-scan';f.lastAbsentAt=now;}
  for(const f of Object.values(job.library?.entries || {}))f.libraryPresence=seen.has(f.id)?'observed':'not-seen-in-complete-library-scan';
}
export function markChatSourceUnavailable(job,cid,status,now=Date.now()){
  seedFileSources(job,now);for(const f of Object.values(fileLinkState(job).sources))if(!f.historical&&f.sourceKind==='chat'&&f.sourceConversationId===cid){f.presence='chat-unavailable';f.lastAbsentAt=now;f.lastSourceStatus=status;}
}
export function rememberFileResult(job,file,result,{failure=false,now=Date.now()}={}){
  const kind=file.sourceKind || (job.library?.entries?.[file.id]===file?'library':'chat'),cid=file.sourceConversationId || null;
  const key=file.sourceKey || kind+':'+(cid || '')+':'+(kind==='library'?file.libraryId || file.id:file.id || safeName(file.name,160));
  const source=fileLinkState(job).sources[key] || observeFileSource(job,file,kind,cid,now),peers=relatedFiles(job,file).filter(f=>!f.historical&&(f===file || compatibleFile(f,{...file,...result,refresh:false})));
  const attempts=Math.min(2,Math.max(...peers.filter(f=>f.status!=='saved').map(f=>f.attempts || 0),0)+(failure?1:0));
  if(result.status==='saved'&&result.path&&hash(result.sha256)){
    if(source.status==='saved'&&source.path&&hash(source.sha256)&&hash(source.sha256)!==hash(result.sha256)){const historical=key+':saved:'+hash(source.sha256);fileLinkState(job).sources[historical]={...source,sourceKey:historical,presence:'previous-version',historical:true};registerFileReference(job,fileLinkState(job).sources[historical]);}
    for(const f of new Set([file,...peers,source]))Object.assign(f,{status:'saved',path:result.path,sha256:result.sha256,size:result.size,mime:result.mime || f.mime,refresh:false,parked:false,retryAt:0,error:null,imageExcluded:false,autoRetry:false,localPending:false,batchPending:false,savedAt:now});
    const {urls,asset_pointer,download_url,download_link,...durable}=result;Object.assign(source,durable);
    for(const f of new Set([file,...peers,source]))registerFileReference(job,f);return {...result};
  }
  if(result.localWriteSkipped){for(const f of new Set([file,...peers,source]))if(f.status!=='saved'){Object.assign(f,result,{status:'manual',autoRetry:false,parked:false,retryAt:0});registerFileReference(job,f);}return {...result};}
  const {urls,asset_pointer,download_url,download_link,...durable}=result;Object.assign(source,durable);
  if(source.status==='skipped-too-large')source.status='manual';
  if(failure||file.attempts){const progress={attempts,parked:attempts>=2,...attempts>=2?{status:'unavailable',retryAt:0,autoRetry:false}:failure?{status:'deferred',retryAt:now+120000,autoRetry:true}:{}};for(const f of new Set([file,...peers,source]))if(f.status!=='saved')Object.assign(f,progress);Object.assign(result,progress);}
  return result;
}
export function sharedFileCandidates(job,file,conversationId=null){
  const related=relatedFiles(job,file),ids=[...new Set(related.flatMap(fileIds))],recent=[...related].sort((a,b)=>Number(b.presence==='observed')-Number(a.presence==='observed') || (b.seenAt || 0)-(a.seenAt || 0)),cids=[...new Set([conversationId,...recent.flatMap(f=>[f.sourceConversationId,...(f.conversationIds || [])])].filter(validId))],routes=[];
  // Native file IDs take priority over Library node IDs within the bridge's cap.
  const primary=[...new Set([file.fileId,file.file_id,file.id,...related.flatMap(f=>[f.fileId,f.file_id,f.id]),...ids].filter(id))];
  for(const fid of primary){const encoded=encodeURIComponent(fid);routes.push(`/backend-api/files/download/${encoded}`);for(const cid of cids.slice(0,2)){const query=new URLSearchParams({conversation_id:cid,inline:'false'});const gizmo=file.gizmoId || related.find(f=>f.gizmoId)?.gizmoId;if(gizmo)query.set('gizmo_id',gizmo);routes.push(`/backend-api/files/download/${encoded}?${query}`,`/backend-api/conversation/${encodeURIComponent(cid)}/attachment/${encoded}/download`);}routes.push(`/backend-api/files/${encoded}/download`);}
  return [...new Set(routes)];
}
export function sharedFileBudget(job,file,lookup){const peers=relatedFiles(job,file,lookup).filter(f=>!f.historical&&(f===file || compatibleFile(file,f))&&(f.retriedAt || 0)>=(file.retriedAt || 0));let attempts=0,parked=false;for(const peer of peers){attempts=Math.max(attempts,peer.attempts || 0);parked ||= !!peer.parked || peer.attempts>=2;}return {attempts,parked};}
export function retryLinkedFile(job,file,now=Date.now()){
  if(!file)return false;let changed=false;
  const peers=relatedFiles(job,file).filter(f=>!f.historical&&(f===file || compatibleFile({...file,refresh:false},{...f,refresh:false})));
  for(const f of peers)if(f.status!=='saved'&&(f.status!=='manual'||f.localWriteSkipped)){Object.assign(f,{status:'pending',attempts:0,parked:false,retryAt:0,error:null,retriedAt:now,autoRetry:true,localWriteSkipped:false});changed=true;}
  for(const e of Object.values(job.entries || {}))if(e.status==='saved'&&(e.attachments || []).some(a=>peers.includes(a))){e.attachmentPending=true;e.attachmentRetryAt=0;e.attachmentScannedAt=0;}
  return changed;
}
export function retainedFileRows(job){
  const library=Object.values(job.library?.entries || {}),rows=library.map(f=>({...f,sourceRefs:[]})),byId=new Map();
  const add=row=>{for(const id of fileIds(row)){let bucket=byId.get(id);if(!bucket)byId.set(id,bucket=[]);bucket.push(row);}};
  for(const row of rows)add(row);
  for(const source of Object.values(job.fileLinks?.sources || {})){
    let row=null;if(!source.historical)for(const id of fileIds(source)){row=(byId.get(id) || []).find(f=>!f.historical&&compatibleFile(f,source));if(row)break;}
    const ref={kind:source.sourceKind,name:source.name,conversationId:source.sourceConversationId || null,presence:source.presence,seenAt:source.seenAt,sourceKey:source.sourceKey};
    if(row){row.sourceRefs.push(ref);row.conversationIds=[...new Set([...(row.conversationIds || []),...(source.conversationIds || [])])];}
    else {row={...source,id:source.historical?source.sourceKey:source.id,retainedSource:true,sourceRefs:[ref],conversationIds:source.conversationIds || []};rows.push(row);if(!source.historical)add(row);}
  }
  return rows;
}
