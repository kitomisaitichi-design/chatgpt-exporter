import {missingLocalFile} from './local-io.mjs';
import {fileReferences,relatedFiles,compatibleFile,rememberFileResult,createFileLookup,registerFileReference,invalidateFileLookup} from './file-links.mjs';
export {fileReferences} from './file-links.mjs';
import {epoch,safeName,attachmentError,ATTACHMENT_MAX_BYTES,compareText} from './core.mjs';

export function contentFileName(value,max=64){const name=String(value || 'file'),ext=name.match(/\.[a-z0-9]{1,12}$/i)?.[0] || '';return safeName(ext?name.slice(0,-ext.length):name,max-ext.length)+ext;}
export const validHash=value=>typeof value==='string' && /^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():null;
export const isImage=file=>/^image\//i.test(file?.mime || file?.mime_type || '') || /\.(?:png|jpe?g|gif|webp|avif|bmp|svg|ico|tiff?|heic|heif|jxl)$/i.test(file?.name || '');
export function applyImagePreference(job){
  for(const f of fileReferences(job)){
    if(job.options?.downloadImages===false && isImage(f) && f.status!=='saved' && !f.parked){f.imageExcluded=true;f.status='manual';}
    else if(job.options?.downloadImages!==false && f.imageExcluded){f.imageExcluded=false;f.status=f.parked?'unavailable':f.external || f.size!==null&&f.size>=10_000_000?'manual':'pending';}
  }
}
export const safeContentPath=value=>typeof value==='string' && value.startsWith('attachments/') && !value.includes('\\') && !/[\x00-\x1f]/.test(value) && value.split('/').every(p=>p && p!=='.' && p!=='..');
const verifiedBlobs=new WeakMap();let hashTask=Promise.resolve();
export async function contentHash(blob){let task=verifiedBlobs.get(blob);if(!task){task=hashTask.then(async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join(''));verifiedBlobs.set(blob,task);hashTask=task.catch(()=>{});task.catch(()=>verifiedBlobs.delete(blob));}return task;}
export function rememberVerifiedBlob(blob,hash){if(validHash(hash))verifiedBlobs.set(blob,Promise.resolve(validHash(hash)));}


// A browser's numbered-copy suffix is evidence of a family, not a revision date.
export function fileFamily(file){
  let name=String(file.name || '').normalize('NFKC').toLocaleLowerCase().trim(),ext='',copy=0,revision=0;
  const extension=name.match(/(\.[a-z0-9]{1,12})$/);if(extension){ext=extension[1];name=name.slice(0,-ext.length);}
  let match;while((match=name.match(/\s*\((\d+)\)$/))){copy=Math.max(copy,Number(match[1]));name=name.slice(0,-match[0].length).trim();}
  match=name.match(/(?:[\s_-]+)(?:v|ver(?:sion)?|rev(?:ision)?)[\s._-]*(\d+)$/);if(match){revision=Number(match[1]);name=name.slice(0,-match[0].length).trim();}
  name=name.replace(/\s+/g,' ');
  return {key:JSON.stringify([file.parent || '',file.gizmoId || '',name,ext]),name:name+ext,copy,revision};
}
export function analyzeFiles(files){
  const info=new Map(),families=new Map(),hashes=new Map();
  for(const f of files){info.set(f.id,{});const family=fileFamily(f);if(family.name){const list=families.get(family.key) || [];list.push({...family,file:f});families.set(family.key,list);}const hash=validHash(f.sha256);if(hash){const list=hashes.get(hash) || [];list.push(f);hashes.set(hash,list);}}
  for(const [hash,list] of hashes)if(list.length>1){const canonical=[...list].sort((a,b)=>Number(!!a.duplicateOf)-Number(!!b.duplicateOf) || (a.savedAt || Infinity)-(b.savedAt || Infinity) || compareText(a.id ?? a.sourceKey ?? a.name,b.id ?? b.sourceKey ?? b.name))[0];for(const f of list)info.get(f.id).duplicate={canonicalId:canonical.id,canonicalName:canonical.name,hash,count:list.length,sharedPath:canonical.path || null,isAlias:f.id!==canonical.id};}
  for(const list of families.values()){
    if(list.length<2)continue;
    const verified=list.map(x=>validHash(x.file.sha256)),identical=verified.every(Boolean)&&new Set(verified).size===1;
    let ranked=null,reason='',confidence='review';
    if(identical){reason='Identical verified content; these names share the same bytes.';confidence='exact';}
    else {
      const signals=[['modified',x=>epoch(x.file.updated) || epoch(x.file.firstModified),'Latest reported modification date','date'],['uploaded',x=>epoch(x.file.uploaded) || epoch(x.file.created),'Latest reported upload / creation date','date'],['revision',x=>x.revision,'Highest explicit revision number','revision']];
      for(const [,score,label,strength] of signals){const scores=list.map(score),highest=Math.max(...scores);if(scores.every(n=>strength==='revision'?n>=0:n>0)&&highest>0&&new Set(scores).size>1&&scores.filter(n=>n===highest).length===1){ranked=list[scores.indexOf(highest)];reason=label;confidence=strength;break;}}
      if(!ranked){const sizes=list.map(x=>x.file.size),max=Math.max(...sizes);if(sizes.every(n=>n!==null&&Number.isFinite(n))&&new Set(sizes).size>1&&sizes.filter(n=>n===max).length===1){ranked=list[sizes.indexOf(max)];reason='Largest file; size alone does not establish a newer version.';confidence='size';}else reason='Numbered copies or matching names; no reliable date / revision winner.';}
    }
    for(const x of list)info.get(x.file.id).version={family:x.name,count:list.length,copyNumber:x.copy,revision:x.revision,preferredId:ranked?.file.id || null,preferredName:ranked?.file.name || null,role:identical?'identical':!ranked?'review':confidence==='size'?(x===ranked?'larger-candidate':'review'):x===ranked?'preferred':'earlier',confidence,reason,content:identical?'identical':verified.every(Boolean)?'different':'unverified'};
  }
  return info;
}

// File names and size never prove equality. Every shared path has verified bytes.
export class ContentStore {
  constructor(getJob,{read,write,remove,commit,onWrite=async()=>{},checkpoint=async()=>{},now=()=>Date.now()}){Object.assign(this,{getJob,read,write,remove,commit,onWrite,checkpoint,now});this.reset();}
  reset(){this.verified=new Map();this.canonical=new Map();this.queue=[];this.queued=new Set();this.lookup=null;this.owner=this.getJob();}
  references(){const job=this.getJob();if(this.owner!==job)this.reset();return this.lookup=createFileLookup(job);}
  async inspect(path,maxBytes=ATTACHMENT_MAX_BYTES,{fresh=false}={}){
    if(!safeContentPath(path))throw Error('Unsafe attachment path.');
    const blob=await this.read(path);if(blob.size===0 || blob.size>maxBytes || attachmentError(await blob.slice(0,8192).text()))throw Error('Local file is empty, too large, or an error response.');
    const prior=this.verified.get(path),unchanged=prior&&(prior.blob===blob || Number.isFinite(blob.lastModified)&&prior.blob.lastModified===blob.lastModified&&prior.blob.size===blob.size);
    const hash=!fresh&&unchanged?prior.hash:await contentHash(blob);rememberVerifiedBlob(blob,hash);const result={blob,hash};this.verified.set(path,result);return result;
  }
  async find(hash,{size=null,maxBytes=ATTACHMENT_MAX_BYTES,exclude=null}={}){
    hash=validHash(hash);if(!hash)return null;const visited=new Set();
    for(const f of this.references().byHash.get(hash) || []){
      if(f===exclude || f.status!=='saved' || f.refresh || validHash(f.sha256)!==hash || !safeContentPath(f.path) || visited.has(f.path))continue;visited.add(f.path);
      try{await this.checkpoint();const checked=await this.inspect(f.path,maxBytes);if(checked.hash!==hash || size!==null&&checked.blob.size!==Number(size))continue;return {status:'saved',source:'hash-reuse',refresh:false,size:checked.blob.size,path:f.path,sha256:hash,duplicateOf:f.id || f.name,duplicate:true,mime:f.mime || null};}catch(e){if(['Paused','NotAllowedError','SecurityError','QuotaExceededError'].includes(e.name))throw e;if(!['NotFoundError','TypeMismatchError'].includes(e.name)&&!/empty, too large/.test(e.message))throw e;}
    }
    return null;
  }
  async findFor(file,{maxBytes=ATTACHMENT_MAX_BYTES}={}){
    const expected=validHash(file.remoteSha256 || (!file.refresh?file.sha256:null));
    const known=await this.find(expected,{size:expected?null:file.size??null,maxBytes,exclude:file});if(known)return known;
    if(file.refresh&&!expected)return null;const visited=new Set();
    for(const f of relatedFiles(this.getJob(),file,this.references())){
      if(f===file || f.status!=='saved' || f.refresh || !validHash(f.sha256) || !safeContentPath(f.path) || visited.has(f.path) || !compatibleFile(file,f))continue;visited.add(f.path);
      try{await this.checkpoint();const checked=await this.inspect(f.path,maxBytes);if(checked.hash!==validHash(f.sha256) || expected&&checked.hash!==expected || file.size!=null&&checked.blob.size!==Number(file.size)&&!expected)continue;return {status:'saved',source:'identity-reuse',refresh:false,path:f.path,sha256:checked.hash,size:checked.blob.size,mime:f.mime || null,duplicate:true,duplicateOf:f.id};}catch(e){if(['Paused','NotAllowedError','SecurityError','QuotaExceededError'].includes(e.name))throw e;if(!['NotFoundError','TypeMismatchError'].includes(e.name)&&!/empty, too large/.test(e.message))throw e;}
    }
    return null;
  }
  async save(blob,file,{source='network',maxBytes=ATTACHMENT_MAX_BYTES}={}){
    if(blob.size===0 || blob.size>maxBytes)throw Error('File is outside its byte limit.');
    const hash=await contentHash(blob),expected=validHash(file.remoteSha256);if(expected&&expected!==hash)throw Error('File bytes do not match the reported SHA-256.');
    const reused=await this.find(hash,{size:blob.size,maxBytes,exclude:file});if(reused)return rememberFileResult(this.getJob(),file,reused);
    let path=`attachments/content/${hash}/${contentFileName(file.name || file.id || 'file')}`;
    const errors=[];
    for(let attempt=0;attempt<2;attempt++){
      await this.checkpoint();
      try{await this.write(path,blob);break;}catch(e){
        if(!missingLocalFile(e)||e.stage==='directory')throw e;
        errors.push({path,name:e.name,error:e.message,at:this.now()});
        if(attempt===1)return rememberFileResult(this.getJob(),file,{status:'manual',localWriteSkipped:true,localWriteAttempts:2,localWriteErrors:errors,error:'Skipped this file after two local write failures. Other files continue; use Retry after fixing its local destination.',autoRetry:false,parked:false,size:blob.size,mime:blob.type || file.mime || null});
        const ext=contentFileName(file.name).match(/\.[a-z0-9]{1,12}$/i)?.[0] || '';
        path=`attachments/content/${hash}/file${ext}`;
      }
    }
    const observed=await this.onWrite(path,blob,hash,file);this.verified.set(path,{blob:observed || blob,hash});
    return rememberFileResult(this.getJob(),file,{status:'saved',source,refresh:false,size:blob.size,path,sha256:hash,duplicateOf:null,duplicate:false,mime:blob.type || file.mime || null});
  }
  async maintenanceTurn(){
    const job=this.getJob(),lookup=this.references(),state=job.localMaintenance ||= {checked:0,linked:0,errors:[]};
    let path;for(const next of lookup.pendingPaths){lookup.pendingPaths.delete(next);if(safeContentPath(next)&&(lookup.byPath.get(next)?.size || 0)){path=next;break;}}if(!path){state.stage='idle';state.deferred=0;return false;}
    state.stage='hashing';state.deferred=lookup.pendingPaths.size;
    try{
      await this.checkpoint();
      const checked=await this.inspect(path),refs=[...(lookup.byPath.get(path)||[])].filter(f=>f.status==='saved'&&!f.refresh);await this.checkpoint();
      if(refs.some(f=>validHash(f.sha256)&&validHash(f.sha256)!==checked.hash))throw Error('Saved hash mismatch; copy retained for inspection.');
      state.checked++;const canonical=this.canonical.get(checked.hash);state.stage='linking';
      let target=path;if(canonical&&canonical!==path){const verified=await this.inspect(canonical);await this.checkpoint();if(verified.hash===checked.hash)target=canonical;}
      for(const f of refs){Object.assign(f,{sha256:checked.hash,size:checked.blob.size,path:target,...target!==path?{duplicate:true,duplicateOf:[...(lookup.byPath.get(target)||[])][0]?.id || null}:{}});registerFileReference(job,f);}
      if(target!==path){const s=job.library ||= {entries:{},sources:[]};s.deduplication ||= {pending:[],errors:[],reclaimedBytes:0};s.deduplication.pending ||= [];if(!s.deduplication.pending.some(x=>x.from===path))s.deduplication.pending.push({from:path,to:target,sha256:checked.hash,size:checked.blob.size});state.linked+=refs.length;}
      this.canonical.set(checked.hash,target);state.lastProgressAt=this.now();state.stage='idle';return true;
    }catch(e){if(['Paused','NotAllowedError','SecurityError','QuotaExceededError'].includes(e.name)){lookup.pendingPaths.add(path);throw e;}state.errors=[...(state.errors || []),{path,error:e.message}].slice(-100);state.stage='needs-attention';return true;}
  }
  async deduplicate(){
    const job=this.getJob(),state=job.library ||= {entries:{},directories:{},sources:[]},groups=new Map(),errors=[],checked=new Map();
    const refs=fileReferences(job).filter(f=>f.status==='saved'&&!f.refresh&&safeContentPath(f.path));
    for(const f of refs){
      await this.checkpoint();
      try{let data=checked.get(f.path);if(!data){const inspected=await this.inspect(f.path);data={hash:inspected.hash,size:inspected.blob.size};checked.set(f.path,data);}if(validHash(f.sha256)&&validHash(f.sha256)!==data.hash)throw Error('Saved hash mismatch; file kept for inspection.');const key=data.hash,list=groups.get(key)||[];list.push({file:f,...data});groups.set(key,list);}catch(e){if(e.name==='Paused')throw e;errors.push({path:f.path,error:e.message});}
    }
    const changes=[],pending=[...(state.deduplication?.pending || [])],snapshots=new Map();
    for(const [hash,list] of groups){
      list.sort((a,b)=>Number(!a.file.path.startsWith('attachments/content/'))-Number(!b.file.path.startsWith('attachments/content/')) || a.file.path.localeCompare(b.file.path));
      const canonical=list[0].file,canonicalPath=canonical.path;
      for(const {file,size} of list){snapshots.set(file,{...file});const prior=file.path;Object.assign(file,{sha256:hash,size,path:canonicalPath,duplicateOf:file===canonical?null:canonical.id || canonical.name,duplicate:file!==canonical});if(prior!==canonicalPath){changes.push({name:file.name,id:file.id || null,from:prior,to:canonicalPath,sha256:hash,size});if(!pending.some(x=>x.from===prior))pending.push({from:prior,to:canonicalPath,sha256:hash,size});}}
    }
    state.deduplication={at:this.now(),checked:checked.size,linked:changes.length,reclaimedBytes:state.deduplication?.reclaimedBytes || 0,pending,errors,changes};
    // Publish every new reference before removing a redundant physical copy.
    try{await this.commit();}catch(e){for(const [f,old] of snapshots){for(const k of Object.keys(f))delete f[k];Object.assign(f,old);}throw e;}
    invalidateFileLookup(job);const referencedPaths=new Set(createFileLookup(job).byPath.keys());let removed=0;
    for(const item of [...pending]){
      await this.checkpoint();
      try{
        if(!safeContentPath(item.from)||!safeContentPath(item.to)||item.from===item.to || referencedPaths.has(item.from))continue;
        const canonical=await this.inspect(item.to,ATTACHMENT_MAX_BYTES,{fresh:true});if(canonical.hash!==item.sha256 || canonical.blob.size!==item.size)throw Error('Canonical copy changed; duplicate kept.');
        let duplicate;try{duplicate=await this.inspect(item.from,ATTACHMENT_MAX_BYTES,{fresh:true});}catch(e){if(e.name==='NotFoundError'){state.deduplication.pending=state.deduplication.pending.filter(x=>x!==item);continue;}throw e;}
        if(duplicate.hash!==item.sha256 || duplicate.blob.size!==item.size)throw Error('Duplicate copy changed; kept for inspection.');
        await this.checkpoint();await this.remove(item.from);this.verified.delete(item.from);removed++;state.deduplication.reclaimedBytes+=item.size;state.deduplication.pending=state.deduplication.pending.filter(x=>x!==item);
      }catch(e){if(e.name==='Paused')throw e;errors.push({path:item.from,error:e.message});}
    }
    state.deduplication.removed=removed;await this.commit();return state.deduplication;
  }
}
