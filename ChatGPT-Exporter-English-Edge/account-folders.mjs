import {resolveBackupFolder} from './local-detection.mjs';
import {sameLocalEntry,missingLocalFile} from './local-io.mjs';

const KEY='knownBackupFolders',LIMIT=32;
const directory=h=>h&&h.kind==='directory'&&typeof h.queryPermission==='function';
async function same(a,b){try{return await sameLocalEntry(a,b);}catch(e){if(['NotAllowedError','SecurityError'].includes(e?.name))return false;throw e;}}
async function unique(rows,limit=LIMIT){const result=[];for(const row of rows){if(!directory(row?.handle))continue;if(!(await Promise.all(result.map(x=>same(x.handle,row.handle)))).some(Boolean))result.push(row);if(result.length===limit)break;}return result;}
async function known(db,legacy=false){
  const saved=await db.get('meta',KEY),state={version:1,legacyImported:!!saved?.legacyImported,legacyLimited:!!saved?.legacyLimited,locations:Array.isArray(saved?.locations)?saved.locations:[]};
  if(legacy&&!state.legacyImported){
    const [parents,folders,locations]=await Promise.all(['backupInput:','folder:','localLocations:'].map(prefix=>db.getPrefix('meta',prefix)));
    const rows=[...state.locations,...parents.map(handle=>({handle})),...locations.flatMap(rows=>Array.isArray(rows)?rows.filter(x=>x?.role==='backup'):[]),...folders.map(handle=>({handle}))];
    const uniqueRows=await unique(rows,LIMIT+1);state.legacyLimited=uniqueRows.length>LIMIT;state.locations=uniqueRows.slice(0,LIMIT);state.legacyImported=true;await db.put('meta',KEY,state);
  }
  return state;
}
export async function rememberBackupFolders(db,scopeKey,handles){
  const rows=handles.filter(directory).map(handle=>({handle,scopeKey,name:handle.name,at:Date.now()}));if(!rows.length)return;const state=await known(db);
  state.locations=await unique([...rows,...state.locations]);await db.put('meta',KEY,state);
}
const inaccessible=e=>missingLocalFile(e)||['NotAllowedError','SecurityError'].includes(e?.name);
export async function restoreAccountFolder(db,key,{folder=null,input=null,locations=[],onProgress=()=>{},maxDirectories=400,maxEntries=4000}={}){
  let checked=0,enumerated=0,denied=0,errors=0;const scanned=[],matches=[];
  const inspect=async(handle,strictScope)=>{
    try{
      if(await handle.queryPermission({mode:'readwrite'})!=='granted'){denied++;return null;}
      const result=await resolveBackupFolder(handle,key,{existingOnly:true,strictScope,headersOnly:true,maxDirectories:Math.max(1,maxDirectories-checked),maxEntries:Math.max(0,maxEntries-enumerated),excludeRoots:scanned,onProgress:s=>onProgress({directories:checked+s.directories})});
      checked+=result.checked;enumerated+=result.enumerated || 0;scanned.push(handle);return result;
    }catch(error){if(!inaccessible(error))throw error;errors++;if(!missingLocalFile(error))denied++;return null;}
  };
  // An explicit per-account choice wins over other copies of the same archive.
  if(directory(folder)){
    const own=await inspect(folder,false);
    if(own?.root&&!own.truncated){if(own.candidates>1)return {folder:null,status:'ambiguous',matches:own.candidates,checked};return {folder:own.root,input,resolved:own,status:'restored',recovered:false,checked};}
  }
  const state=await known(db,true),candidates=await unique([{handle:input},...locations.filter(x=>x?.role==='backup'),...state.locations]);let truncated=state.legacyLimited;
  for(const {handle} of candidates){
    if((await Promise.all(scanned.map(h=>same(h,handle)))).some(Boolean))continue;
    if(checked>=maxDirectories||enumerated>=maxEntries){truncated=true;break;}
    const result=await inspect(handle,true);if(!result)continue;truncated ||= result.truncated;
    if(result.root&&!(await Promise.all(matches.map(x=>same(x.resolved.root,result.root)))).some(Boolean))matches.push({resolved:result,input:await same(handle,result.root)?null:handle});
    if((result.candidates || 1)>1)return {folder:null,status:'ambiguous',matches:result.candidates,checked};
  }
  if(!truncated&&matches.length===1){const match=matches[0],verified=await resolveBackupFolder(match.resolved.root,key,{existingOnly:true,strictScope:true,maxDirectories:1,maxEntries:0});if(verified.root&&verified.metadata.match)return {folder:verified.root,input:match.input,resolved:verified,status:'restored',recovered:true,checked,enumerated};}
  return {folder:null,status:truncated?'scan-limited':matches.length>1?'ambiguous':denied?'permission-needed':'not-found',matches:matches.length,checked,enumerated,denied,errors};
}
