import {availableLocalFile,sameLocalEntry} from './local-io.mjs';
import {validId,conversationValid,epoch,safeName,conversationTime} from './core.mjs';

const missing=e=>['NotFoundError','TypeMismatchError'].includes(e.name);
const safePath=p=>typeof p==='string'&&!p.includes('\\')&&!p.startsWith('/')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
const scopeOf=o=>o?.scope_key || o?.scope?.key || (typeof o?.scope==='string'?o.scope:null) || o?.job?.scope?.key;
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
export async function readLocalJSON(dir,name,maxBytes=64*1024*1024){
  try{const file=await(await dir.getFileHandle(name)).getFile();if(file.size>maxBytes)return null;return JSON.parse(await file.text());}catch(e){if(missing(e)||e instanceof SyntaxError)return null;throw e;}
}
// Read only complete header values. Never search arbitrary chat text for identity.
function headerValue(text,wanted,tail=false){
  let i=0;const space=()=>{while(/\s/.test(text[i] || '')&&i<text.length)i++;};
  const end=start=>{let quoted=false,escaped=false,depth=0;
    for(let j=start;j<text.length;j++){const c=text[j];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"'){quoted=false;if(!depth)return j+1;}}else if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){if(!depth)return j;if(--depth===0)return j+1;}else if(!depth&&c===',')return j;}return -1;};
  space();if(text[i++]!=='{')return null;
  for(;;){space();if(text[i]!=='"')return null;const k=end(i);if(k<0)return null;let key;try{key=JSON.parse(text.slice(i,k));}catch{return null;}i=k;space();if(text[i++]!==':')return null;space();if(key===wanted&&tail)return text.slice(i);const e=end(i);if(e<0)return null;if(key===wanted){try{return JSON.parse(text.slice(i,e));}catch{return null;}}i=e;space();if(text[i++]!==',')return null;}
}
async function stateIdentity(dir){
  try{const file=await(await dir.getFileHandle('portable-state.json')).getFile();if(!file.slice)return null;
    const text=await file.slice(0,64*1024).text(),schema=headerValue(text,'schema'),key=headerValue(text,'scope_key'),job=headerValue(text,'job',true),scope=job&&headerValue(job,'scope');
    return schema==='english-autopilot-portable-state/v1'&&typeof key==='string'&&scope?.key===key&&typeof scope.user==='string'?scope:null;
  }catch(e){if(missing(e)||e instanceof SyntaxError)return null;throw e;}
}
async function marker(dir,key){
  const index=await readLocalJSON(dir,'conversation-index.json'),state=await readLocalJSON(dir,'portable-state.json');
  const identity=state?.job?.scope || (!state?await stateIdentity(dir):null);
  const recognized=index?.schema==='chatgpt-conversation-index/v1'||state?.schema==='english-autopilot-portable-state/v1';
  const keys=[scopeOf(index),scopeOf(state),identity?.key].filter(Boolean),foreign=keys.some(x=>x!==key);
  let layout=false;try{await dir.getDirectoryHandle('json');layout=true;}catch(e){if(!missing(e))throw e;}
  return {index,state,identity,recognized,foreign,match:recognized&&!foreign&&keys.includes(key),layout};
}
export async function resolveBackupFolder(selected,key,{maxDepth=4,maxDirectories=400,onProgress=()=>{}}={}){
  const expected='chatgpt-backup-'+key.slice(0,12),first=await marker(selected,key);
  if(!first.foreign&&(first.match || selected.name===expected))return {root:selected,path:selected.name,created:false,metadata:first,checked:1};
  const queue=[{dir:selected,path:selected.name,depth:0}],matches=[];let checked=0,truncated=false;
  while(queue.length){const {dir,path,depth}=queue.shift();if(++checked>maxDirectories){truncated=true;break;}if(checked%20===0){onProgress({directories:checked});await yieldUI();}
    const m=dir===selected?first:await marker(dir,key);
    if(!m.foreign&&(m.match || dir.name===expected)){matches.push({root:dir,path,created:false,metadata:m,checked});continue;}
    if(depth>=maxDepth)continue;
    for await(const [name,handle] of dir.entries())if(handle.kind==='directory'&&!['attachments','markdown','attachment-errors','.git','node_modules',...(m.foreign?['json']:[])].includes(name))queue.push({dir:handle,path:path+'/'+name,depth:depth+1});
  }
  if(matches.length){matches.sort((a,b)=>Number(b.root.name===expected)-Number(a.root.name===expected)||a.path.split('/').length-b.path.split('/').length||a.path.localeCompare(b.path));return {...matches[0],candidates:matches.length,checked,truncated};}
  if(first.foreign || /^chatgpt-backup-[a-f0-9]{12}$/i.test(selected.name))throw Error('This backup belongs to a different account/workspace and contains no matching nested backup. Choose the matching backup or its parent folder.');
  // A legacy root with json/ or directly selected transcript subfolder is valid.
  let direct=false;for await(const [name,h] of selected.entries())if(h.kind==='file'&&/\.json$/i.test(name)&&!['conversation-index.json','portable-state.json','export-report.json'].includes(name)){const data=await readLocalJSON(selected,name,32*1024*1024);if(Array.isArray(data)?data.some(x=>validId(x?.conversation_id || x?.id)&&conversationValid(x,x.conversation_id || x.id)):validId(data?.conversation_id || data?.id)&&conversationValid(data,data.conversation_id || data.id)){direct=true;break;}}
  if(first.layout || direct)return {root:selected,path:selected.name,created:false,metadata:first,checked,truncated,legacy:true};
  const root=await selected.getDirectoryHandle(expected,{create:true});return {root,path:selected.name+'/'+expected,created:true,metadata:await marker(root,key),checked,truncated};
}
export async function* walkLocalFiles(start,{maxDepth=12,maxFiles=50000,maxDirectories=5000,exclude=()=>false,acceptDirectory=async()=>true,stats={},onProgress=()=>{}}={}){
  Object.assign(stats,{files:0,directories:0,truncated:false,errors:0});const queue=[{dir:start,path:'',depth:0}];
  while(queue.length){const {dir,path,depth}=queue.shift();if(++stats.directories>maxDirectories){stats.truncated=true;break;}let tick=0;
    try{if(!await acceptDirectory(dir,path))continue;for await(const [name,handle] of dir.entries()){
      if(exclude(name,handle,path,depth))continue;const relative=path+name;
      if(handle.kind==='directory'){if(depth>=maxDepth){stats.truncated=true;continue;}queue.push({dir:handle,path:relative+'/',depth:depth+1});}
      else {if(stats.files>=maxFiles){stats.truncated=true;return;}stats.files++;yield {name,handle,path:relative,dir,prefix:path};}
      if(++tick%100===0){onProgress({...stats});await yieldUI();}
    }}catch(e){if(!missing(e))throw e;stats.errors++;}
    onProgress({...stats});await yieldUI();
  }
}
export async function scanTranscriptInventory(root,key,{onProgress=()=>{},maxFiles=50000,maxDepth=12,hashData=async()=>null,scopeUser=null,knownIds=null,cache=new Map(),excludeRoots=[]}={}){
  const m=await marker(root,key),canImport=x=>x.foreign&&scopeUser&&x.identity?.user===scopeUser&&knownIds;
  if(m.foreign&&!canImport(m))throw Object.assign(Error('Backup metadata belongs to another workspace.'),{code:'FOREIGN_BACKUP'});
  const metadata=new Map((m.index?.scope===key || canImport(m)?m.index?.entries || []:[]).filter(e=>validId(e.id)&&(!m.foreign||knownIds.has(e.id))).map(e=>[e.id,e])),byPath=new Map([...metadata.values()].filter(e=>safePath(e.json)).map(e=>[e.json,e])),files=new Map(),entries=new Map(),stats={},contexts=new Map([['',m]]),nextCache=new Map();
  for(const e of metadata.values())entries.set(e.id,{id:e.id,title:e.title,update_time:e.update_time,create_time:e.create_time,checkedUpdateTime:e.checked_update_time,contentHash:e.content_hash || null,revisionHash:e.revision_hash || null,basename:safePath(e.json)&&e.json.startsWith('json/')?e.json.slice(5,-5):null,indexStatus:e.status || 'pending',attachments:e.attachments || [],attachmentStateRevision:e.attachment_state_revision || 0,attachmentScannedAt:e.attachment_scanned_at || 0,attachmentPending:!!e.attachment_pending,origin:'existing conversation index'});
  let valid=0,invalid=0,tooLarge=0,rewrites=0,reused=0;const knownKey=knownIds?await hashData([...knownIds].sort())||[...knownIds].sort().join('|'):null;
  for await(const item of walkLocalFiles(root,{maxFiles,maxDepth,stats,onProgress,acceptDirectory:async(dir,path)=>{if(!path)return true;for(const h of excludeRoots)if(await sameLocalEntry(dir,h))return false;const own=await marker(dir,key),parent=contexts.get(path.slice(0,path.slice(0,-1).lastIndexOf('/')+1))||m,current=own.recognized?own:parent;contexts.set(path,current);return !current.foreign||!!canImport(current);},exclude:(name,h)=>h.kind==='directory'&&['attachments','markdown','attachment-errors','.git','node_modules'].includes(name)})){
    if(!/\.json$/i.test(item.name)||['conversation-index.json','portable-state.json','export-report.json','viewer-handoff.json'].includes(item.name))continue;
    const blob=await availableLocalFile(item.handle,stats);if(!blob)continue;if(blob.size>64*1024*1024){tooLarge++;continue;}
    const prior=cache.get(item.path),context=contexts.get(item.prefix)||m;
    const insert=f=>{if(context.foreign&&!knownIds?.has(f.entry.id))return;const old=files.get(f.entry.id);if(old&&old.score>=f.score)return;const copy={...f,entry:{...f.entry}};files.set(f.entry.id,copy);entries.set(f.entry.id,copy.entry);};
    const filterKey=context.foreign?knownKey:null;
    if(prior&&prior.filterKey===filterKey&&prior.size===blob.size&&prior.lastModified===blob.lastModified&&await sameLocalEntry(item.handle,prior.handle)){
      const records=prior.records.map(r=>{const saved=metadata.get(r.entry.id);return {...r,entry:{...r.entry,checkedUpdateTime:saved?saved.content_hash===r.entry.contentHash?saved.checked_update_time:null:r.entry.checkedUpdateTime}};});for(const r of records)insert({...r,handle:item.handle});nextCache.set(item.path,{...prior,handle:item.handle,records});reused++;continue;
    }
    let parsed;try{parsed=JSON.parse(await blob.text());}catch{invalid++;continue;}const records=[];
    const bodies=Array.isArray(parsed)?parsed:[parsed];
    for(const data of bodies){const id=data?.conversation_id || data?.id || byPath.get(item.path)?.id;if(!validId(id)||!conversationValid(data,id)){invalid++;continue;}
      if(context.foreign&&!knownIds?.has(id))continue;
      const score=epoch(data.update_time)||blob.lastModified;
      const saved=metadata.get(id)||{},canonical=!Array.isArray(parsed)&&item.path.startsWith('json/'),basename=canonical?item.path.slice(5,-5):safeName(data.title || saved.title || 'Recovered chat',65)+'_'+id;
      const contentHash=await hashData(data),entry={...(entries.get(id)||{}),id,title:data.title || saved.title || 'Recovered local chat',update_time:data.update_time || saved.update_time,create_time:data.create_time || saved.create_time || conversationTime(data) || null,checkedUpdateTime:saved.content_hash===contentHash?saved.checked_update_time:null,contentHash,revisionHash:saved.content_hash===contentHash?saved.revision_hash || null:null,basename,diskBacked:canonical,validated:true,localRewrite:!canonical,cacheBacked:!canonical,localDetected:true,inventoryStatus:canonical?'saved':'pending',origin:canonical?'validated existing backup file':'nested/renamed local transcript'};
      const record={basename,entry,score,arrayId:Array.isArray(parsed)?id:null};records.push(record);insert({...record,handle:item.handle});
    }
    nextCache.set(item.path,{handle:item.handle,size:blob.size,lastModified:blob.lastModified,filterKey,records});
  }
  for(const f of files.values()){valid++;if(f.entry.localRewrite)rewrites++;}
  return {files,entries,cache:nextCache,metadata:m,stats:{...stats,valid,invalid,tooLarge,rewrites,reused,indexOnly:entries.size-files.size}};
}
export async function readDetectedTranscript(found){
  const file=await found.handle.getFile(),parsed=JSON.parse(await file.text()),data=found.arrayId?parsed.find(x=>(x.conversation_id || x.id)===found.arrayId):parsed;
  return conversationValid(data,found.entry.id)?{data,at:file.lastModified,basename:found.basename}:null;
}
export function mergeFolderMetadata(job,metadata){
  const imported=metadata.state?.job,key=job.scope.key;if(imported?.scope?.key===key){
    for(const [id,e] of Object.entries(imported.entries || {}))if(validId(id)&&!job.entries[id])job.entries[id]=structuredClone(e);
    if(!job.library&&imported.library)job.library=structuredClone(imported.library);
    else if(imported.library){job.library.entries ||= {};for(const [id,f] of Object.entries(imported.library.entries || {}))if(!job.library.entries[id])job.library.entries[id]=structuredClone(f);}
    if(imported.fileLinks){job.fileLinks ||= {schema:'chatgpt-file-links/v1',sources:{}};for(const [id,f] of Object.entries(imported.fileLinks.sources || {}))if(!job.fileLinks.sources[id])job.fileLinks.sources[id]=structuredClone(f);}
  }
  return job;
}
