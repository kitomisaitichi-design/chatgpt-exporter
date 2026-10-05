import {validId,conversationValid,epoch,safeName,conversationTime} from './core.mjs';

const missing=e=>['NotFoundError','TypeMismatchError'].includes(e.name);
const safePath=p=>typeof p==='string'&&!p.includes('\\')&&!p.startsWith('/')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
const scopeOf=o=>o?.scope_key || o?.scope?.key || (typeof o?.scope==='string'?o.scope:null) || o?.job?.scope?.key;
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
export async function readLocalJSON(dir,name,maxBytes=64*1024*1024){
  try{const file=await(await dir.getFileHandle(name)).getFile();if(file.size>maxBytes)return null;return JSON.parse(await file.text());}catch(e){if(missing(e)||e instanceof SyntaxError)return null;throw e;}
}
async function marker(dir,key){
  const index=await readLocalJSON(dir,'conversation-index.json'),state=await readLocalJSON(dir,'portable-state.json');
  const recognized=index?.schema==='chatgpt-conversation-index/v1'||state?.schema==='english-autopilot-portable-state/v1';
  const keys=[scopeOf(index),scopeOf(state)].filter(Boolean),foreign=keys.some(x=>x!==key);
  let layout=false;try{await dir.getDirectoryHandle('json');layout=true;}catch(e){if(!missing(e))throw e;}
  return {index,state,recognized,foreign,match:recognized&&!foreign&&keys.includes(key),layout};
}
export async function resolveBackupFolder(selected,key,{maxDepth=4,maxDirectories=400,onProgress=()=>{}}={}){
  const expected='chatgpt-backup-'+key.slice(0,12),first=await marker(selected,key);
  if(first.foreign)throw Error('This backup belongs to a different account/workspace. Choose the matching backup or its parent folder.');
  if(first.match || selected.name===expected)return {root:selected,path:selected.name,created:false,metadata:first,checked:1};
  if(/^chatgpt-backup-[a-f0-9]{12}$/i.test(selected.name))throw Error('The selected backup name belongs to a different workspace. Choose the matching backup or a parent folder.');
  const queue=[{dir:selected,path:selected.name,depth:0}],matches=[];let checked=0,truncated=false;
  while(queue.length){const {dir,path,depth}=queue.shift();if(++checked>maxDirectories){truncated=true;break;}if(checked%20===0){onProgress({directories:checked});await yieldUI();}
    const m=dir===selected?first:await marker(dir,key);if(m.foreign || /^chatgpt-backup-[a-f0-9]{12}$/i.test(dir.name)&&dir.name!==expected&&!m.match)continue;
    if(m.match || dir.name===expected){matches.push({root:dir,path,created:false,metadata:m,checked});continue;}
    if(depth>=maxDepth)continue;
    for await(const [name,handle] of dir.entries())if(handle.kind==='directory'&&!['attachments','markdown','attachment-errors','.git','node_modules'].includes(name))queue.push({dir:handle,path:path+'/'+name,depth:depth+1});
  }
  if(matches.length){matches.sort((a,b)=>Number(b.root.name===expected)-Number(a.root.name===expected)||a.path.split('/').length-b.path.split('/').length||a.path.localeCompare(b.path));return {...matches[0],candidates:matches.length,checked,truncated};}
  // A legacy root with json/ or directly selected transcript subfolder is valid.
  let direct=false;for await(const [name,h] of selected.entries())if(h.kind==='file'&&/\.json$/i.test(name)&&!['conversation-index.json','portable-state.json','export-report.json'].includes(name)){const data=await readLocalJSON(selected,name,32*1024*1024);if(Array.isArray(data)?data.some(x=>validId(x?.conversation_id || x?.id)&&conversationValid(x,x.conversation_id || x.id)):validId(data?.conversation_id || data?.id)&&conversationValid(data,data.conversation_id || data.id)){direct=true;break;}}
  if(first.layout || direct)return {root:selected,path:selected.name,created:false,metadata:first,checked,truncated,legacy:true};
  const root=await selected.getDirectoryHandle(expected,{create:true});return {root,path:selected.name+'/'+expected,created:true,metadata:await marker(root,key),checked,truncated};
}
export async function* walkLocalFiles(start,{maxDepth=12,maxFiles=50000,maxDirectories=5000,exclude=()=>false,acceptDirectory=async()=>true,stats={},onProgress=()=>{}}={}){
  Object.assign(stats,{files:0,directories:0,truncated:false,errors:0});const queue=[{dir:start,path:'',depth:0}];
  while(queue.length){const {dir,path,depth}=queue.shift();if(++stats.directories>maxDirectories){stats.truncated=true;break;}if(!await acceptDirectory(dir,path))continue;let tick=0;
    try{for await(const [name,handle] of dir.entries()){
      if(exclude(name,handle,path,depth))continue;const relative=path+name;
      if(handle.kind==='directory'){if(depth>=maxDepth){stats.truncated=true;continue;}queue.push({dir:handle,path:relative+'/',depth:depth+1});}
      else {if(stats.files>=maxFiles){stats.truncated=true;return;}stats.files++;yield {name,handle,path:relative,dir,prefix:path};}
      if(++tick%100===0){onProgress({...stats});await yieldUI();}
    }}catch(e){if(['NotAllowedError','SecurityError'].includes(e.name))throw e;stats.errors++;}
    onProgress({...stats});await yieldUI();
  }
}
export async function scanTranscriptInventory(root,key,{onProgress=()=>{},maxFiles=50000,maxDepth=12,hashData=async()=>null}={}){
  const m=await marker(root,key);if(m.foreign)throw Error('Backup metadata belongs to another workspace.');
  const metadata=new Map((m.index?.scope===key?m.index.entries || []:[]).filter(e=>validId(e.id)).map(e=>[e.id,e])),byPath=new Map([...metadata.values()].filter(e=>safePath(e.json)).map(e=>[e.json,e])),files=new Map(),entries=new Map(),stats={};
  for(const e of metadata.values())entries.set(e.id,{id:e.id,title:e.title,update_time:e.update_time,create_time:e.create_time,checkedUpdateTime:e.checked_update_time,contentHash:e.content_hash || null,basename:safePath(e.json)&&e.json.startsWith('json/')?e.json.slice(5,-5):null,indexStatus:e.status || 'pending',attachments:e.attachments || [],attachmentStateRevision:e.attachment_state_revision || 0,attachmentScannedAt:e.attachment_scanned_at || 0,attachmentPending:!!e.attachment_pending,origin:'existing conversation index'});
  let valid=0,invalid=0,tooLarge=0,rewrites=0;
  for await(const item of walkLocalFiles(root,{maxFiles,maxDepth,stats,onProgress,acceptDirectory:async(dir,path)=>{if(!path)return true;const m=await marker(dir,key);return !m.foreign&&(!/^chatgpt-backup-[a-f0-9]{12}$/i.test(dir.name)||dir.name==='chatgpt-backup-'+key.slice(0,12)||m.match);},exclude:(name,h)=>h.kind==='directory'&&['attachments','markdown','attachment-errors','.git','node_modules'].includes(name)})){
    if(!/\.json$/i.test(item.name)||['conversation-index.json','portable-state.json','export-report.json','viewer-handoff.json'].includes(item.name))continue;
    const blob=await item.handle.getFile();if(blob.size>64*1024*1024){tooLarge++;continue;}let parsed;try{parsed=JSON.parse(await blob.text());}catch{invalid++;continue;}
    const bodies=Array.isArray(parsed)?parsed:[parsed];
    for(const data of bodies){const id=data?.conversation_id || data?.id || byPath.get(item.path)?.id;if(!validId(id)||!conversationValid(data,id)){invalid++;continue;}
      const old=files.get(id),score=epoch(data.update_time)||blob.lastModified;if(old&&old.score>=score)continue;
      const saved=metadata.get(id)||{},canonical=!Array.isArray(parsed)&&item.path.startsWith('json/'),basename=canonical?item.path.slice(5,-5):safeName(data.title || saved.title || 'Recovered chat',65)+'_'+id;
      const entry={...(entries.get(id)||{}),id,title:data.title || saved.title || 'Recovered local chat',update_time:data.update_time || saved.update_time,create_time:data.create_time || saved.create_time || conversationTime(data) || null,contentHash:await hashData(data),basename,diskBacked:canonical,validated:canonical,localRewrite:!canonical,cacheBacked:!canonical,localDetected:true,inventoryStatus:canonical?'saved':'pending',origin:canonical?'validated existing backup file':'nested/renamed local transcript'};
      files.set(id,{handle:item.handle,basename,entry,score,arrayId:Array.isArray(parsed)?id:null});entries.set(id,entry);
    }
  }
  for(const f of files.values()){valid++;if(f.entry.localRewrite)rewrites++;}
  return {files,entries,metadata:m,stats:{...stats,valid,invalid,tooLarge,rewrites,indexOnly:entries.size-files.size}};
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
