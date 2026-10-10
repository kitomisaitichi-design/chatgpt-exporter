import {availableLocalFile,sameLocalEntry} from './local-io.mjs';
import {walkLocalFiles,readLocalJSON} from './local-detection.mjs';
import {attachmentError} from './core.mjs';
import {validHash} from './file-intelligence.mjs';
import {fileIds} from './file-links.mjs';
const key=name=>String(name || '').normalize('NFC').trim().toLocaleLowerCase();
const add=(map,k,value)=>{if(!k)return;let list=map.get(k);if(!list)map.set(k,list=new Set());if(list.add)list.add(value);else if(!list.includes(value))list.push(value);};
const drop=(map,k,value)=>{const list=map.get(k);if(list?.delete)list.delete(value);else if(list)map.set(k,list.filter(c=>c!==value));};
export async function scanLocalFileCopies(roots,scopeKey,{onProgress=()=>{},priorIndex=null,checkpoint=async()=>{}}={}){
  const index=new Map(),byHash=new Map(),byId=new Map(),bySize=new Map(),hashCache=new Map(),records=new Map(),unclassified=new Map(),stats={scanned:0,eligible:0,large:0,invalid:0,truncated:false,errors:0},seen=[];
  const inventory={index,byHash,byId,bySize,hashCache,records,unclassified,unclassifiedCount:0,...stats,at:Date.now()};let tick=performance.now();
  for(const {handle,source} of roots){if(!handle)continue;if((await Promise.all(seen.map(h=>sameLocalEntry(h,handle)))).some(Boolean))continue;const covered=[...seen];seen.push(handle);const walkStats={},hints=new Map();
    const safe=p=>typeof p==='string'&&!p.includes('\\')&&!p.startsWith('/')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
    const indexDirectory=async(dir,prefix)=>{
      await checkpoint();
      if(prefix)for(const h of covered)if(await sameLocalEntry(dir,h))return false;
      const lib=await readLocalJSON(dir,'library-index.json'),conv=await readLocalJSON(dir,'conversation-index.json');
      for(const f of [...(lib?.scope_key===scopeKey?lib.entries || []:[]),...(conv?.scope===scopeKey?(conv.entries || []).flatMap(e=>e.attachments || []):[])])if(safe(f.path)){const base=prefix.endsWith('attachments/')&&f.path.startsWith('attachments/')?prefix.slice(0,-12):prefix,path=handle.name==='attachments'&&!prefix&&f.path.startsWith('attachments/')?f.path.slice(12):base+f.path,old=hints.get(path)||[];old.push(f);hints.set(path,old);}
      return true;
    };
    for await(const item of walkLocalFiles(handle,{stats:walkStats,acceptDirectory:indexDirectory,onProgress:s=>onProgress({...stats,source,filesInSource:s.files}),exclude:(name,h,path)=>h.kind==='directory'&&['.git','node_modules','attachment-errors'].includes(name)||source==='backup'&&h.kind==='directory'&&['json','markdown'].includes(name)})){
      if(source==='backup'&&['conversation-index.json','portable-state.json','export-report.json','viewer-handoff.json','library-index.json'].includes(item.name))continue;
      await checkpoint();const file=await availableLocalFile(item.handle,stats);if(!file)continue;stats.scanned++;if(file.size>=10_000_000){stats.large++;continue;}if(!file.size || file.size<=8192&&attachmentError(await file.text())){stats.invalid++;continue;}
      const hint=hints.get(item.path)||[],pathHash=validHash(item.path.match(/(?:^|\/)content\/([a-f0-9]{64})\//i)?.[1]) || (handle.name==='content'?validHash(item.path.split('/')[0]):validHash(handle.name)),prior=priorIndex?.hashCache?.get(source+':'+item.path+':'+file.size+':'+file.lastModified),priorHash=validHash(prior?.hash || prior),candidate={handle:item.handle,path:item.path,source,size:file.size,lastModified:file.lastModified,hash:pathHash || validHash(hint.find(f=>validHash(f.sha256))?.sha256) || priorHash};
      candidate.name=file.name;candidate.identityHash=validHash(hint.find(f=>validHash(f.sha256))?.sha256);candidate.ids=hint.flatMap(f=>fileIds({...f,fileId:f.native_file_id || f.file_id || f.fileId}));candidate.key=JSON.stringify([source,item.path]);
      const old=priorIndex?.records?.get(candidate.key);if(old&&old.size===file.size&&old.lastModified===file.lastModified&&await sameLocalEntry(old.handle,candidate.handle)){candidate.hash=old.hash || candidate.hash;if(old.verified){candidate.verified=true;hashCache.set(source+':'+item.path+':'+file.size+':'+file.lastModified,{hash:old.hash,handle:candidate.handle});}}
      stats.eligible++;registerLocalCandidate(inventory,candidate);if(performance.now()-tick>=8){onProgress({...stats});await new Promise(r=>setTimeout(r,0));tick=performance.now();}
    }
    stats.truncated ||= walkStats.truncated;stats.errors+=walkStats.errors;
  }
  return Object.assign(inventory,stats);
}
export function registerLocalCandidate(inventory,candidate){
  inventory.records ||= new Map();inventory.unclassified ||= new Map();candidate.key ||= JSON.stringify([candidate.source,candidate.path]);
  const old=inventory.records.get(candidate.key);if(old&&old!==candidate)removeLocalCandidate(inventory,old);
  inventory.records.set(candidate.key,candidate);if(!candidate.verified)add(inventory.index,key(candidate.name || candidate.path.split('/').at(-1)),candidate);add(inventory.byHash,candidate.hash,candidate);add(inventory.bySize,candidate.size,candidate);for(const id of candidate.ids || [])add(inventory.byId,id,candidate);
  if(!candidate.verified){let bucket=inventory.unclassified.get(candidate.size);if(!bucket)inventory.unclassified.set(candidate.size,bucket=new Set());if(!bucket.has(candidate)){bucket.add(candidate);inventory.unclassifiedCount=(inventory.unclassifiedCount || 0)+1;}}inventory.onDirty?.(candidate);return candidate;
}
export function removeLocalCandidate(inventory,candidate){
  for(const [map,k] of [[inventory.index,key(candidate.name || candidate.path.split('/').at(-1))],[inventory.byHash,candidate.hash],[inventory.bySize,candidate.size],...(candidate.ids || []).map(id=>[inventory.byId,id])])drop(map,k,candidate);
  unclassifyDone(inventory,candidate);inventory.records?.delete(candidate.key);candidate.removed=true;inventory.onDirty?.({...candidate,deleted:true});
}
function unclassifyDone(inventory,candidate){const bucket=inventory.unclassified?.get(candidate.size);if(bucket?.delete(candidate))inventory.unclassifiedCount=Math.max(0,(inventory.unclassifiedCount || 0)-1);if(bucket&&!bucket.size)inventory.unclassified.delete(candidate.size);}
function classify(inventory,candidate,hash){
  const old=candidate.hash;if(old!==hash&&old)drop(inventory.byHash,old,candidate);
  candidate.hash=hash;candidate.verified=true;add(inventory.byHash,hash,candidate);drop(inventory.index,key(candidate.name || candidate.path.split('/').at(-1)),candidate);unclassifyDone(inventory,candidate);inventory.onDirty?.(candidate);inventory.onClassified?.(hash,candidate);
}
export function localCopyCandidates(inventory,asset){return [...iterateLocalCopyCandidates(inventory,asset)];}
export function* iterateLocalCopyCandidates(inventory,asset){
  const expected=validHash(asset.remoteSha256 || asset.sha256),ids=fileIds(asset),names=inventory.index.get(key(asset.name))||[],exact=expected?inventory.byHash.get(expected)||[]:[];
  const native=new Set(ids.flatMap(id=>[...(inventory.byId.get(id)||[])])),peers=expected&&asset.size!=null?(inventory.unclassified?inventory.unclassified.get(Number(asset.size)) || []:inventory.bySize.get(Number(asset.size)) || []):[],seen=new Set();
  for(const group of [exact,native,expected?names:[],peers])for(const c of group){if(seen.has(c)||c.removed)continue;seen.add(c);if(asset.size!=null&&c.size!==Number(asset.size)&&!expected||!expected&&(!c.identityHash||!native.has(c)||c.verified&&c.hash!==c.identityHash)||expected&&c.verified&&c.hash!==expected)continue;yield c;}
}
export async function verifyLocalCopy(candidate,asset,inventory,hashBlob){
  for(const k of ['index','byHash','byId','bySize','hashCache','records','unclassified'])inventory[k] ||= new Map();
  let file;try{file=await candidate.handle.getFile();}catch(e){if(['NotFoundError','TypeMismatchError'].includes(e.name)){removeLocalCandidate(inventory,candidate);return null;}throw e;}
  if(file.size>=10_000_000||file.size===0||attachmentError(await file.slice(0,8192).text())){removeLocalCandidate(inventory,candidate);return null;}
  const expected=validHash(asset.remoteSha256 || asset.sha256) || candidate.identityHash || candidate.hash;
  if(file.size!==candidate.size||candidate.lastModified!=null&&file.lastModified!==candidate.lastModified){removeLocalCandidate(inventory,candidate);candidate={...candidate,size:file.size,lastModified:file.lastModified,verified:false,hash:null,removed:false};registerLocalCandidate(inventory,candidate);}
  const cacheKey=candidate.source+':'+candidate.path+':'+file.size+':'+file.lastModified,cached=inventory.hashCache.get(cacheKey);let hash=cached?.handle&&await sameLocalEntry(cached.handle,candidate.handle)?cached.hash:null;if(!hash){hash=await hashBlob(file);inventory.hashCache.set(cacheKey,{hash,handle:candidate.handle});}
  classify(inventory,candidate,hash);inventory.onVerified?.(candidate,file,hash);return expected&&hash===expected?file:null;
}
