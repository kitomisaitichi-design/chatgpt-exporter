import {walkLocalFiles,readLocalJSON} from './local-detection.mjs';
import {attachmentError} from './core.mjs';
import {validHash} from './file-intelligence.mjs';
import {fileIds} from './file-links.mjs';
const key=name=>String(name || '').normalize('NFC').trim().toLocaleLowerCase();
const add=(map,k,value)=>{if(!k)return;const list=map.get(k)||[];list.push(value);map.set(k,list);};
export async function scanLocalFileCopies(roots,scopeKey,{onProgress=()=>{},priorIndex=null}={}){
  const index=new Map(),byHash=new Map(),byId=new Map(),bySize=new Map(),hashCache=new Map(),stats={scanned:0,eligible:0,large:0,invalid:0,truncated:false,errors:0},seen=[];
  for(const {handle,source} of roots){if(!handle)continue;if((await Promise.all(seen.map(h=>h.isSameEntry(handle)))).some(Boolean))continue;const covered=[...seen];seen.push(handle);const walkStats={},hints=new Map();
    const safe=p=>typeof p==='string'&&!p.includes('\\')&&!p.startsWith('/')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
    const indexDirectory=async(dir,prefix)=>{
      if(prefix)for(const h of covered)if(dir===h || dir.isSameEntry&&await dir.isSameEntry(h))return false;
      const lib=await readLocalJSON(dir,'library-index.json'),conv=await readLocalJSON(dir,'conversation-index.json');
      for(const f of [...(lib?.scope_key===scopeKey?lib.entries || []:[]),...(conv?.scope===scopeKey?(conv.entries || []).flatMap(e=>e.attachments || []):[])])if(safe(f.path)){const base=prefix.endsWith('attachments/')&&f.path.startsWith('attachments/')?prefix.slice(0,-12):prefix,path=handle.name==='attachments'&&!prefix&&f.path.startsWith('attachments/')?f.path.slice(12):base+f.path,old=hints.get(path)||[];old.push(f);hints.set(path,old);}
      return true;
    };
    for await(const item of walkLocalFiles(handle,{stats:walkStats,acceptDirectory:indexDirectory,onProgress:s=>onProgress({...stats,source,filesInSource:s.files}),exclude:(name,h,path)=>h.kind==='directory'&&['.git','node_modules','attachment-errors'].includes(name)||source==='backup'&&h.kind==='directory'&&['json','markdown'].includes(name)})){
      if(source==='backup'&&['conversation-index.json','portable-state.json','export-report.json','viewer-handoff.json','library-index.json'].includes(item.name))continue;
      const file=await item.handle.getFile();stats.scanned++;if(file.size>=10_000_000){stats.large++;continue;}if(!file.size || file.size<=8192&&attachmentError(await file.text())){stats.invalid++;continue;}
      const hint=hints.get(item.path)||[],pathHash=validHash(item.path.match(/(?:^|\/)content\/([a-f0-9]{64})\//i)?.[1]) || (handle.name==='content'?validHash(item.path.split('/')[0]):validHash(handle.name)),prior=priorIndex?.hashCache?.get(source+':'+item.path+':'+file.size+':'+file.lastModified),priorHash=validHash(prior?.hash || prior),candidate={handle:item.handle,path:item.path,source,size:file.size,lastModified:file.lastModified,hash:pathHash || validHash(hint.find(f=>validHash(f.sha256))?.sha256) || priorHash};
      stats.eligible++;add(index,key(file.name),candidate);add(byHash,candidate.hash,candidate);add(bySize,file.size,candidate);for(const f of hint)for(const id of fileIds({...f,fileId:f.native_file_id || f.file_id || f.fileId}))add(byId,id,candidate);
    }
    stats.truncated ||= walkStats.truncated;stats.errors+=walkStats.errors;
  }
  return {index,byHash,byId,bySize,hashCache,...stats,at:Date.now()};
}
export function localCopyCandidates(inventory,asset){
  const expected=validHash(asset.remoteSha256 || asset.sha256),ids=fileIds(asset),names=inventory.index.get(key(asset.name))||[],exact=expected?inventory.byHash.get(expected)||[]:[];
  const native=ids.flatMap(id=>inventory.byId.get(id)||[]),peers=expected&&asset.size!=null?inventory.bySize.get(Number(asset.size))||[]:[],out=new Set([...exact,...native,...(expected?names:[]),...peers]);
  return [...out].filter(c=>(asset.size==null||c.size===Number(asset.size))&&(expected || c.hash&&native.includes(c)));
}
export async function verifyLocalCopy(candidate,asset,inventory,hashBlob){
  const file=await candidate.handle.getFile();if(file.size>=10_000_000||file.size===0||file.size!==candidate.size||attachmentError(await file.slice(0,8192).text()))return null;
  const cacheKey=candidate.source+':'+candidate.path+':'+file.size+':'+file.lastModified,cached=inventory.hashCache.get(cacheKey);let hash=cached?.handle?.isSameEntry&&await cached.handle.isSameEntry(candidate.handle)?cached.hash:null;if(!hash){hash=await hashBlob(file);inventory.hashCache.set(cacheKey,{hash,handle:candidate.handle});}
  const expected=validHash(asset.remoteSha256 || asset.sha256) || candidate.hash;
  return expected&&hash===expected?file:null;
}
