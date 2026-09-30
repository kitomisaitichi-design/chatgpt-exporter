import * as db from './storage.mjs';
import {VERSION,newJob,mergeEntry,counts,validId,markdown,conversationValid,extractAttachments,ATTACHMENT_MAX_BYTES,conversationTime,epoch,limited,WEEKLY_BROKEN_MS} from './core.mjs';
import {recordLimit} from './awareness.mjs';
import {Engine,Paused} from './engine.mjs';
const $=id=>document.getElementById(id);
let job=null,scope=null,folder=null,root=null,attachmentLibrary=null,localAttachmentIndex=null,engine=null,running=false,tabId=null,connected=false,canEdit=true,notice='';
let sensed={at:0,key:null,snapshots:[]},diskFiles=null,diskIndexEntries=null,passiveBusy=false;
const harvested=new Map(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const hashData=data=>digest(JSON.stringify(data));
function error(e) {notice=e.message || String(e);$('message').textContent=notice;}
function update() {
  const c=counts(job);$('saved').textContent=c.saved;$('found').textContent=c.total;$('failed').textContent=c.failed+c.discovery-(job?.sources?.filter(s=>!s.done && !s.error).length || 0);$('changed').textContent=c.changed;$('attachments-count').textContent=c.attachments;
  $('state').textContent=job?.status || 'Ready';if (notice || job) $('message').textContent=notice || job.message;$('bar').max=Math.max(1,c.total);$('bar').value=c.saved;
  $('pace').textContent=`${Math.round((job?.pace.delay || 5000)/1000)} s · T${job?.pace?.tier || 0}`;$('awareness-state').textContent=job?.awareness?.state?.replaceAll('-',' ') || 'Observing';$('awareness-reason').textContent=job?.awareness?.reason || 'Reads the app’s existing activity before deciding what to do next.';
  const provenance=new Set(Object.values(job?.entries || {}).flatMap(e=>e.foundVia || [])),sources=job?.sources || [];
  $('coverage').textContent=`${sources.filter(s=>s.done&&!s.error).length}/${sources.length} lists finished · active ${sources.find(s=>s.key==='active')?.offset || 0} · archived ${sources.find(s=>s.key==='archived')?.offset || 0} · ${provenance.size} discovery routes · ${job?.discoveryAudit?.stable?'coverage complete':sources.some(s=>s.error)?'incomplete routes parked/repaired individually':'single traversal'}`;
  const delay=Math.max(job?.pace.until || 0,job?.pace.next || 0,job?.awareness?.waitUntil || 0)-Date.now();$('wait').textContent=running && delay>0 ? `Next network request in ${Math.ceil(delay/1000)} s · local file work is never throttled` : running ? (job?.phase==='local' ? 'Local backup recovery/write · no network wait' : 'Working one item at a time') : 'Progress kept locally';
  const times=(job?.recentDone || []).filter(t=>Date.now()-t<3600000),rate=times.length>2 ? (times.at(-1)-times[0])/(times.length-1) : 0;$('eta').textContent=c.discovery ? 'Discovering chats · total may grow' : rate>0 && c.pending ? `Estimated ${Math.max(1,Math.ceil((rate*c.pending+Math.max(0,delay))/60000))} min remaining · may change` : c.pending ? 'Estimating remaining time…' : 'No queued chats remaining';
  const next=job?.schedule?.enabled && job.schedule.nextScanAt?Math.max(0,job.schedule.nextScanAt-Date.now()):0;$('passive-status').textContent=job?.schedule?.enabled ? `Passive rescan ${next?`in ${Math.max(1,Math.ceil(next/3600000))} h`:'due now'} · telemetry can wake changed/new chats sooner` : 'Passive rescan off';
  const held=!!(running && engine?.held);$('hold').disabled=!running;$('hold').textContent=held?'Resume in place':'Hold in place';$('pause').disabled=!running;$('start').disabled=running || !canEdit;
  for (const id of ['connect','folder','attachment-library','retry','scan','add','archived','projects','assist','verify','attachments','passive','passive-hours','work-mode','export-state','import-state']) $(id).disabled=running || !canEdit;
  $('log').textContent=(job?.events || []).map(e=>`${new Date(e.at).toLocaleTimeString()}  ${e.message}`).join('\n');$('connection').textContent=connected ? 'Connected':'Not connected';$('account').textContent=scope ? `User ${scope.user} · workspace ${scope.account || 'default session'}` : 'One workspace per backup.';$('folder-name').textContent=folder ? `${folder.name} / chatgpt-backup-${scope?.key.slice(0,12) || '…'}`:'No folder selected';$('attachment-library-name').textContent=attachmentLibrary ? `${attachmentLibrary.name} · exact name + size reuse`:'No local file library selected';
}
async function bridge(args,targetId=tabId) {
  if (!targetId) throw new Paused('Connect to ChatGPT first.');
  const results=await chrome.scripting.executeScript({target:{tabId:targetId},world:'MAIN',func:async args=>{if (!window.__englishExporterBridgeV234) return {ok:false,status:0,kind:'bridge',error:'ChatGPT is still loading.'};return window.__englishExporterBridgeV234.rpc(args);},args:[args]});
  return results[0]?.result || {ok:false,status:0,kind:'bridge'};
}
async function sense(expected) {
  if(sensed.key===expected.key && Date.now()-sensed.at<4000)return sensed.snapshots;
  const tabs=await chrome.tabs.query({url:'https://chatgpt.com/*'}),snapshots=[];if(!tabs.some(t=>t.id===tabId))throw new Paused('The connected ChatGPT tab closed. Reconnect to resume.');
  for(let offset=0;offset<tabs.length;offset+=8){
    const batch=await Promise.all(tabs.slice(offset,offset+8).map(async tab=>{
      const worker=tab.id===tabId;if(tab.discarded || tab.frozen)return worker?{worker,tabId:tab.id,discarded:tab.discarded,frozen:tab.frozen}:null;
      try {
        let result=await bridge({op:'sense',scope:expected},tab.id);if(result.kind==='bridge'){await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['bridge.js']});result=await bridge({op:'sense',scope:expected},tab.id);}
        if(!result.ok){if(worker && result.status===409)return {worker,blocked:'The account or workspace changed. Reconnect to the original workspace.'};return null;}
        result.changedBodies=[];
        for(const entry of result.verified?result.captured || []:[]){
          const harvestKey=`${tab.id}:${result.documentId}:${entry.id}`;if(harvested.get(harvestKey)===entry.at)continue;
          const cached=await bridge({op:'cached',id:entry.id,scope:expected},tab.id);
          if(cached.ok && conversationValid(cached.data,entry.id)){
            const key=`${expected.key}:${entry.id}`,old=await db.get('chats',key),hash=await hashData(cached.data);
            let oldHash=old?.hash || (old?.data?await hashData(old.data):null) || job?.entries?.[entry.id]?.contentHash || null;
            if(!oldHash && root){const disk=await diskRead(entry.id);oldHash=disk?.hash || null;if(oldHash && job?.entries?.[entry.id])job.entries[entry.id].contentHash=oldHash;}
            if(oldHash && oldHash!==hash)result.changedBodies.push({id:entry.id,title:cached.data.title,update_time:cached.data.update_time,create_time:cached.data.create_time || conversationTime(cached.data),contentHash:hash,previousContentHash:oldHash,origin:'passively observed changed chat'});
            if(!old || old.at<cached.at || oldHash!==hash)await db.put('chats',key,{data:cached.data,at:cached.at,hash,passive:true});harvested.set(harvestKey,entry.at);
          }
        }
        return {...result,worker,tabId:tab.id};
      } catch(e){if(worker)throw new Paused('Unable to observe the ChatGPT tab. Open it, let it load, and reconnect.');return null;}
    }));snapshots.push(...batch.filter(Boolean));
  }
  sensed={at:Date.now(),key:expected.key,snapshots};return snapshots;
}
async function readyBridge() {
  for (let n=0;n<60;n++) {try {const result=await bridge({op:'context'});if (result.ok) return result;if(result.kind==='bridge')await chrome.scripting.executeScript({target:{tabId},world:'MAIN',files:['bridge.js']});if (result.status && result.status!==0) throw new Paused(result.error || `ChatGPT session returned HTTP ${result.status}. Open the connected tab, sign in, then click Connect again.`);} catch (e) {if (e instanceof Paused) throw e;}await sleep(1000);}throw new Paused('ChatGPT did not finish loading. Sign in in the connected tab, then click Connect again.');
}
async function ensureTab() {if (tabId) {try {const tab=await chrome.tabs.get(tabId);if (tab.url?.startsWith('https://chatgpt.com/')) return;} catch {}}const tab=await chrome.tabs.create({url:'https://chatgpt.com/',active:false});tabId=tab.id;await chrome.storage.session.set({exporterTabId:tabId});}
function applyJobOptionsToUI(){if(!job)return;for (const id of ['archived','projects','assist','verify','attachments','passive','yield-user']) $(id).checked=job.options[id]!==false;$('work-mode').value=job.options.mode || 'index-first';$('passive-hours').value=String(job.options.passiveHours || Math.round((job.schedule?.intervalMs || 10800000)/3600000) || 3);}
function migrateLoadedJob(j){
  if(!j)return false;let changed=false;const now=Date.now();
  if(j.version==='2.3.0'){
    const regimes=j.pace?.regimes || [],last=[...regimes].reverse().find(r=>['step-up','limit-same-episode'].includes(r.event));
    const explicit=last?.retryAfter>0 ? last.at+last.retryAfter : 0;
    if(j.pace){j.pace.until=explicit>now?explicit:Math.min(j.pace.until || 0,now+120000);j.pace.next=Math.min(j.pace.next || 0,now+Math.max(5000,j.pace.delay || 5000));}
    j.events ||= [];j.events.push({at:now,message:'v2.3.1 migration: removed legacy self-generated long traffic rests; real Retry-After cooldowns remain authoritative.'});j.events=j.events.slice(-180);j.version='2.3.1';changed=true;
  }
  if(j.version==='2.3.1'){
    let retired=0;
    for(const e of Object.values(j.entries || {})){
      if(Array.isArray(e.attachments))for(const a of e.attachments){
        if(a.status==='failed'){
          const msg=String(a.error || '');
          a.status=/paused by you/i.test(msg)?'deferred-manual':'unavailable';
          a.autoRetry=false;retired++;
        }
      }
      // Old attachment failures must not turn a saved transcript back into queued chat work.
      e.attachmentPending=false;e.attachmentRetryAt=0;e.recoveryPending=null;
    }
    j.options ||= {};if(j.options.assist==null)j.options.assist=false;
    j.events ||= [];j.events.push({at:now,message:`v2.3.2 migration: retired ${retired} legacy attachment failures from automatic retry. Existing local files can be reconciled without network traffic.`});j.events=j.events.slice(-180);j.version='2.3.2';changed=true;
  }
  if(j.version==='2.3.2'){
    let repaired=0;
    for(const e of Object.values(j.entries || {})){
      let retry=false;
      if(Array.isArray(e.attachments))for(const a of e.attachments){
        if(a.status==='deferred' && /signed-in user or workspace changed|workspace changed.*prepared attachment/i.test(String(a.error || ''))){a.autoRetry=true;retry=true;repaired++;}
      }
      if(retry){e.attachmentPending=true;e.attachmentRetryAt=0;e.attachmentScannedAt=0;}
    }
    j.events ||= [];j.events.push({at:now,message:`v2.3.3 migration: requeued ${repaired} attachment read${repaired===1?'':'s'} affected by the v2.3.2 prepared-chunk workspace bug.`});j.events=j.events.slice(-180);j.version='2.3.3';changed=true;
  }
  if(j.version==='2.3.3'){
    let parked=0;
    for(const e of Object.values(j.entries || {})){
      const m=String(e.error || '').match(/HTTP\s+(400|404|410|412|422)/i);
      if(m && ['pending','failed'].includes(e.status)){e.status='failed';e.attempts=Math.max(1,e.attempts || 0);e.lastFailureAt=e.lastFailureAt || now;e.lastFailureStatus=Number(m[1]);e.brokenUntil=Math.max(e.brokenUntil || 0,now+WEEKLY_BROKEN_MS);e.retryAt=0;parked++;}
    }
    j.options ||= {};if(j.options.yieldUser==null)j.options.yieldUser=true;
    j.discoveryAudit ||= {round:0,baseline:Object.keys(j.entries || {}).length,stable:false};j.discoveryAudit.round=0;
    j.events ||= [];j.events.push({at:now,message:`v2.3.4 migration: parked ${parked} known hard chat failure${parked===1?'':'s'} for 7 days and disabled redundant full-list verification loops.`});j.events=j.events.slice(-180);j.version='2.3.4';changed=true;
  }
  return changed;
}
async function connect(expectedKey=null) {
  $('message').textContent='Connecting to your signed-in ChatGPT session…';await ensureTab();const result=await readyBridge(),nextScope={...result.scope,key:await digest(JSON.stringify([result.scope.user,result.scope.account || null]))};
  if (expectedKey && nextScope.key!==expectedKey) throw new Paused('The account or workspace changed. Automatic resume stopped; reconnect to the original workspace.');scope=nextScope;connected=true;await db.put('meta','lastScope',scope);job=await db.get('jobs',scope.key) || null;if(migrateLoadedJob(job))await db.put('jobs',scope.key,job);folder=await db.get('meta',`folder:${scope.key}`) || null;attachmentLibrary=await db.get('meta',`attachmentLibrary:${scope.key}`) || null;root=null;localAttachmentIndex=null;diskFiles=null;diskIndexEntries=null;sensed.at=0;applyJobOptionsToUI();update();if (!job) $('message').textContent='Connected. Choose a folder, then start the automatic export.';
}
async function folderReady(request=false) {if (!folder) throw new Paused('Choose a backup folder first.');let permission=await folder.queryPermission({mode:'readwrite'});if (permission!=='granted' && request) permission=await folder.requestPermission({mode:'readwrite'});if (permission!=='granted') throw new Paused('Folder permission is needed. Click Choose folder to grant access again.');if (!scope) throw new Paused('Connect to ChatGPT first.');root=await folder.getDirectoryHandle(`chatgpt-backup-${scope.key.slice(0,12)}`,{create:true});}
async function write(path,content) {if (!root) await folderReady();let directory=root;const parts=path.split('/');for (const part of parts.slice(0,-1)) directory=await directory.getDirectoryHandle(part,{create:true});const handle=await directory.getFileHandle(parts.at(-1),{create:true}),stream=await handle.createWritable();try {await stream.write(content);await stream.close();} catch(e) {try {await stream.abort();} catch {}throw e;}}
function reportData(j) {
  return {exporter:`English Autopilot ${VERSION}`,generated_at:new Date().toISOString(),scope:j.scope,status:j.status,message:j.message,counts:counts(j),schedule:j.schedule || null,pacing:{delay_ms:j.pace.delay,tier:j.pace.tier || 0,cooldown_until:j.pace.until,last_limit:j.pace.lastLimit,strikes:j.pace.strikes,regimes:j.pace.regimes || [],native_requests_observed:j.awareness?.native?.length || 0,exporter_actions_observed:j.awareness?.actions?.length || 0},recent_responses:j.responses || [],awareness:j.awareness?{state:j.awareness.state,reason:j.awareness.reason,pressure:j.awareness.pressure}:null,discoveryAudit:j.discoveryAudit,discoveryUncertain:!!j.discoveryUncertain,discovery:j.sources.map(({seenPages,uniqueIds,...s})=>({...s,uniqueCount:uniqueIds?.length || 0})),conversations:Object.values(j.entries),note:'Complete means all discovered conversations were saved and enabled discovery sources reached their end. v2.3.4 records content fingerprints and overwrites the same transcript files when a changed body is observed or a newer server update is retrieved. Eligible attachment files are matched against permitted local folders first; only missing files attempt a current/observed ChatGPT route. Hard unavailable attachments are not auto-retried. Hard chat 400/404/410/412/422 results are parked for 7 days unless a newer server update appears. User interaction in ChatGPT yields network work for 6 minutes when enabled.'};
}
function indexData(j) {
  return {version:VERSION,generated_at:new Date().toISOString(),scope:j.scope.key,total:Object.keys(j.entries).length,order:'calendar create time (earliest known conversation/message time)',entries:Object.values(j.entries).sort((a,b)=>(epoch(a.create_time)||epoch(a.update_time)||Infinity)-(epoch(b.create_time)||epoch(b.update_time)||Infinity)).map(e=>({id:e.id,url:`https://chatgpt.com/c/${e.id}`,title:e.title,status:e.status,create_time:e.create_time || null,update_time:e.update_time,chat_kind:e.chatKind || (e.projectId?'project-chat':'unknown'),chat_kind_evidence:e.chatKindEvidence || null,project:e.project || null,found_via:e.foundVia || [],saved_at:e.savedAt || null,content_hash:e.contentHash || null,previous_content_hash:e.previousContentHash || null,revision_count:e.revisionCount || 0,changed_at:e.changedAt || null,json:e.basename?`json/${e.basename}.json`:null,markdown:e.basename?`markdown/${e.basename}.md`:null,attachments:e.attachments || [],attachment_scanned_at:e.attachmentScannedAt || null,attachment_pending:!!e.attachmentPending,attachment_retry_at:e.attachmentRetryAt || 0,error:e.error || null,last_failure_at:e.lastFailureAt || null,last_failure_status:e.lastFailureStatus || null,broken_until:e.brokenUntil || 0}))};
}
async function diskInventory() {
  if(diskFiles && diskIndexEntries)return [...diskIndexEntries.values()];diskFiles=new Map();diskIndexEntries=new Map();if(!root)return [];
  const metadata=new Map();
  try {
    const handle=await root.getFileHandle('conversation-index.json'),saved=JSON.parse(await(await handle.getFile()).text());
    if(saved.scope===scope.key)for(const e of saved.entries || [])if(validId(e.id)){
      metadata.set(e.id,e);
      diskIndexEntries.set(e.id,{id:e.id,title:e.title,update_time:e.update_time,create_time:e.create_time,contentHash:e.content_hash || null,previousContentHash:e.previous_content_hash || null,revisionCount:e.revision_count || 0,changedAt:e.changed_at || null,savedAt:e.saved_at || null,chatKind:e.chat_kind || null,chatKindEvidence:e.chat_kind_evidence || null,project:e.project || null,foundVia:e.found_via || [],basename:e.json?.startsWith('json/')?e.json.slice(5,-5):null,indexStatus:e.status || 'pending',attachments:e.attachments || [],attachmentScannedAt:e.attachment_scanned_at || null,attachmentPending:!!e.attachment_pending,attachmentRetryAt:e.attachment_retry_at || 0,origin:'existing conversation index'});
    }
  } catch(e){if(e.name!=='NotFoundError' && !(e instanceof SyntaxError))throw e;}
  let directory;try {directory=await root.getDirectoryHandle('json');} catch(e){if(e.name==='NotFoundError')return [...diskIndexEntries.values()];throw e;}
  const byName=new Map([...metadata.values()].filter(e=>e.json?.startsWith('json/')).map(e=>[e.json.slice(5),e]));
  for await(const [name,handle] of directory.entries()) {
    if(handle.kind!=='file' || !name.endsWith('.json'))continue;
    const saved=byName.get(name),id=saved?.id || name.match(/_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/i)?.[1];if(!validId(id))continue;
    const basename=name.slice(0,-5),entry={id,title:saved?.title || name.slice(0,-id.length-6),update_time:saved?.update_time,create_time:saved?.create_time,contentHash:saved?.content_hash || null,previousContentHash:saved?.previous_content_hash || null,revisionCount:saved?.revision_count || 0,changedAt:saved?.changed_at || null,savedAt:saved?.saved_at || null,chatKind:saved?.chat_kind || null,chatKindEvidence:saved?.chat_kind_evidence || null,project:saved?.project || null,foundVia:saved?.found_via || [],basename,diskBacked:true,inventoryStatus:'saved',attachments:saved?.attachments || [],attachmentScannedAt:saved?.attachment_scanned_at || null,attachmentPending:!!saved?.attachment_pending,attachmentRetryAt:saved?.attachment_retry_at || 0,origin:'existing backup file'};
    diskFiles.set(id,{handle,basename,entry});diskIndexEntries.set(id,{...(diskIndexEntries.get(id)||{}),...entry});
  }
  return [...diskIndexEntries.values()];
}
async function diskRead(id) {await diskInventory();const found=diskFiles.get(id);if(!found)return null;try {const file=await found.handle.getFile(),data=JSON.parse(await file.text());if(!conversationValid(data,id))return null;return {data,at:file.lastModified,basename:found.basename,hash:found.entry.contentHash || await hashData(data),passive:false};} catch(e){if(e.name==='NotFoundError' || e instanceof SyntaxError)return null;throw e;}}
async function index(j) {await write('conversation-index.json',JSON.stringify(indexData(j),null,2));}
async function report(j) {await write('export-report.json',JSON.stringify(reportData(j),null,2));await index(j);await write('portable-state.json',JSON.stringify(portableData(j),null,2));}
async function recover(id,expected,isStopped) {const context=await bridge({op:'context'});if (!context.ok || JSON.stringify([context.scope?.user,context.scope?.account])!==JSON.stringify([expected.user,expected.account])) throw new Paused('Account changed before browser recovery. Reconnect to the original account.');const since=Date.now();await chrome.tabs.update(tabId,{url:`https://chatgpt.com/c/${encodeURIComponent(id)}`,active:false});sensed.at=0;for (let i=0;i<40;i++) {if (isStopped()) throw new Paused('Paused by you.');await sleep(1000);let result;try {result=await bridge({op:'peek',id,since,scope:expected});} catch {continue;}if ([401,403,409].includes(result.status)) throw new Paused(result.error || 'Sign in or finish the browser check in the ChatGPT tab.');if (result.status===200 && result.data) {sensed.at=0;return {data:result.data};}if (result.limit && result.limit.at>=since) {sensed.at=0;return {limit:result.limit};}}return null;}
function addIds() {const text=$('ids').value.trim();if (!text) return;const ids=text.split(/[\s,]+/).filter(Boolean).map(value=> {if (/^https?:/i.test(value)) {try {const u=new URL(value);return ['chatgpt.com','chat.openai.com'].includes(u.hostname) ? u.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/)?.[1] : null;} catch {return null;}}return value;});if (ids.some(id=>!validId(id))) throw new Error('One or more links / IDs are invalid. Use full ChatGPT conversation links or conversation IDs.');for (const id of ids) mergeEntry(job,{id,title:'Added conversation'});$('ids').value='';}
function attachmentCandidates(a,conversationId){const out=[...(a.urls || [])];if(a.id)out.push(`/backend-api/files/download/${encodeURIComponent(a.id)}`);return [...new Set(out)];}
function decode64(value){const s=atob(value),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;}
function localKey(name){return String(name || '').normalize('NFC').trim().toLocaleLowerCase();}
async function attachmentLibraryReady(request=false){
  if(!attachmentLibrary)return false;let permission=await attachmentLibrary.queryPermission({mode:'read'});if(permission!=='granted' && request)permission=await attachmentLibrary.requestPermission({mode:'read'});return permission==='granted';
}
async function buildLocalAttachmentIndex(){
  if(localAttachmentIndex)return localAttachmentIndex;const index=new Map();let scanned=0,truncated=false;
  const add=async(handle,path,source)=>{if(scanned>=50000){truncated=true;return;}let file;try{file=await handle.getFile();}catch{return;}scanned++;if(file.size>ATTACHMENT_MAX_BYTES)return;const key=localKey(file.name);if(!key)return;const list=index.get(key)||[];list.push({handle,path,source,size:file.size,lastModified:file.lastModified});index.set(key,list);};
  const walk=async(dir,prefix,source,depth=0)=>{if(depth>8 || scanned>=50000){truncated=true;return;}for await(const [name,handle] of dir.entries()){if(scanned>=50000){truncated=true;break;}if(handle.kind==='directory'){if(source==='backup' && depth===0 && ['json','markdown'].includes(name))continue;await walk(handle,`${prefix}${name}/`,source,depth+1);}else await add(handle,`${prefix}${name}`,source);}};
  if(root)await walk(root,'','backup');
  if(await attachmentLibraryReady(false))await walk(attachmentLibrary,'','library');
  localAttachmentIndex={index,scanned,truncated,at:Date.now()};return localAttachmentIndex;
}
async function reuseLocalAttachment(asset,basename){
  if(!asset?.name)return null;const inventory=await buildLocalAttachmentIndex(),all=inventory.index.get(localKey(asset.name)) || [];if(!all.length)return null;
  const sized=asset.size ? all.filter(x=>x.size===Number(asset.size)) : all;const candidate=(sized.length?sized:[])[0];if(!candidate)return null;
  const filename=safeName(asset.name || asset.id || 'attachment',120),dest=`attachments/${basename}/${filename}`;
  if(candidate.source==='backup' && candidate.path===dest)return {name:asset.name,id:asset.id,status:'saved',source:'existing-local',size:candidate.size,path:dest,mime:asset.mime || null};
  const file=await candidate.handle.getFile();await write(dest,file);return {name:asset.name,id:asset.id,status:'saved',source:'local-copy',sourcePath:candidate.path,size:file.size,path:dest,mime:file.type || asset.mime || null};
}
async function backupAttachments(entry,data,basename,beforeRequest){
  const assets=extractAttachments(data),results=[],already=new Map((entry.attachments || []).filter(a=>a.status==='saved').map(a=>[String(a.id || a.name),a]));if(!assets.length)return results;
  for(const asset of assets){
    const prior=already.get(String(asset.id || asset.name));if(prior){results.push(prior);continue;}
    if(asset.size && asset.size>ATTACHMENT_MAX_BYTES){results.push({name:asset.name,id:asset.id,status:'skipped-too-large',size:asset.size,autoRetry:false});continue;}
    const local=await reuseLocalAttachment(asset,basename);if(local){results.push(local);continue;}
    try {
      await beforeRequest();const prep=await bridge({op:'assetPrepare',scope,fileId:asset.id,candidates:attachmentCandidates(asset,entry.id),maxBytes:ATTACHMENT_MAX_BYTES});
      if(!prep.ok){
        if(prep.status===429){job.lastLimitSeen=Date.now();limited(job.pace,prep.retryAfter,Date.now(),Math.random(),'exporter');recordLimit(job);await db.put('jobs',scope.key,job);results.push({name:asset.name,id:asset.id,status:'rate-limited',size:prep.size || asset.size || null,error:prep.error || 'HTTP 429',retryAfter:prep.retryAfter || null,autoRetry:true});continue;}
        const status=prep.status===413?'skipped-too-large':[401,403,409].includes(prep.status)?'permission-unavailable':'unavailable';
        results.push({name:asset.name,id:asset.id,status,size:prep.size || asset.size || null,error:prep.error || `HTTP ${prep.status}`,autoRetry:false});continue;
      }
      const chunks=[];let offset=0;for(;;){const part=await bridge({op:'assetChunk',key:prep.key,offset,length:384*1024});if(!part.ok){const err=new Error(part.error || 'Attachment chunk failed.');err.status=part.status || 0;throw err;}chunks.push(decode64(part.base64));offset=part.next;if(part.done)break;}
      await bridge({op:'assetRelease',key:prep.key}).catch(()=>{});const blob=new Blob(chunks,{type:prep.type || asset.mime || 'application/octet-stream'}),filename=safeName(asset.name || asset.id || 'attachment',120);await write(`attachments/${basename}/${filename}`,blob);results.push({name:asset.name,id:asset.id,status:'saved',source:'network',size:prep.size,path:`attachments/${basename}/${filename}`,mime:prep.type || asset.mime || null});
    } catch(e){if(e instanceof Paused)throw e;const status=e.status===429?'rate-limited':[401,403,409].includes(e.status)?'permission-unavailable':e.status===404?'unavailable':'deferred';results.push({name:asset.name,id:asset.id,status,size:asset.size || null,error:e.message || String(e),autoRetry:status==='rate-limited' || status==='deferred'});}
  }
  return results;
}
async function reconcileLocalAttachments(){
  if(!job || !root)return {matched:0,checked:0};localAttachmentIndex=null;const inventory=await buildLocalAttachmentIndex();const libraryGranted=await attachmentLibraryReady(false);let matched=0,checked=0;
  for(const entry of Object.values(job.entries || {})){
    if(entry.status!=='saved')continue;const key=`${scope.key}:${entry.id}`;let cached=await db.get('chats',key);if(!cached?.data)cached=await diskRead(entry.id);if(!cached?.data)continue;
    const assets=extractAttachments(cached.data);if(!assets.length)continue;checked+=assets.length;const prior=new Map((entry.attachments || []).map(a=>[String(a.id || a.name),a])),next=[];let unresolvedAuto=false;
    for(const asset of assets){const existing=prior.get(String(asset.id || asset.name));if(existing?.status==='saved'){next.push(existing);continue;}const local=await reuseLocalAttachment(asset,entry.basename || entry.id);if(local){next.push(local);matched++;continue;}if(existing){next.push(existing);if(existing.autoRetry!==false && ['deferred','rate-limited'].includes(existing.status))unresolvedAuto=true;}else unresolvedAuto=true;}
    if(next.length)entry.attachments=next;entry.attachmentPending=unresolvedAuto;entry.attachmentRetryAt=0;
  }
  const source=libraryGranted?'backup + chosen existing-files folder':'backup folder only (no readable existing-files folder selected)';
  job.events ||= [];job.events.push({at:Date.now(),message:`Local attachment reconciliation: ${matched} file${matched===1?'':'s'} reused/copied from disk; ${checked-matched} attachment reference${checked-matched===1?'':'s'} not matched locally. Scanned ${inventory.scanned} permitted file${inventory.scanned===1?'':'s'} from ${source}${inventory.truncated?' (scan cap reached)':''}.`});job.events=job.events.slice(-180);await db.put('jobs',scope.key,job);await report(job);update();return {matched,checked,scanned:inventory.scanned,libraryGranted};
}
function resetSourcesForScan(reason='Rescanning lists for new / changed chats…') {job.sources=newJob(scope,{archived:$('archived').checked,projects:$('projects').checked}).sources;job.options.archived=$('archived').checked;job.options.projects=$('projects').checked;job.discoveryAudit={round:0,baseline:Object.keys(job.entries || {}).length,stable:false,lastVerifiedAt:job.discoveryAudit?.verifiedAt || 0};job.discoveryUncertain=false;sensed.at=0;job.status='ready';job.message=reason;}
function portableData(j){return {schema:'english-autopilot-portable-state/v1',version:VERSION,exported_at:new Date().toISOString(),scope_key:j.scope.key,job:structuredClone(j),index:indexData(j),note:'Portable queue/index/schedule/adaptive-pacing state. Conversation bodies remain in the backup folder/cache and are not duplicated into this state file.'};}
async function importPortableObject(obj){
  if(!scope)throw new Paused('Connect to ChatGPT before importing state.');let imported;
  if(obj?.schema==='english-autopilot-portable-state/v1' && obj.job)imported=obj.job;
  else if(Array.isArray(obj?.entries)){imported=newJob(scope,{archived:$('archived').checked,projects:$('projects').checked,assist:$('assist').checked,verify:$('verify').checked,attachments:$('attachments').checked,passive:$('passive').checked,passiveHours:Number($('passive-hours').value)||3});for(const e of obj.entries)if(validId(e.id))mergeEntry(imported,{...e,origin:'imported index'});}
  else throw new Error('This is not a v2.3 portable-state or conversation-index JSON file.');
  if(imported.scope?.key && imported.scope.key!==scope.key || obj.scope_key && obj.scope_key!==scope.key)throw new Error('The imported state belongs to a different ChatGPT account/workspace.');
  imported.scope=scope;migrateLoadedJob(imported);imported.version=VERSION;imported.options={...newJob(scope,{}).options,...imported.options};imported.pace={...newJob(scope,{}).pace,...imported.pace,until:Math.max(0,imported.pace?.until || 0),next:Math.max(0,imported.pace?.next || 0)};imported.schedule={...newJob(scope,imported.options).schedule,...imported.schedule};imported.events=(imported.events || []).slice(-180);imported.recentDone=(imported.recentDone || []).slice(-30);imported.status=imported.status==='running'?'paused':imported.status || 'ready';imported.message='Portable state imported. Existing files/cache will be reused before any conversation is fetched.';
  job=imported;await db.put('jobs',scope.key,job);applyJobOptionsToUI();update();if(root){diskFiles=null;await diskInventory();}await index(job).catch(()=>{});
}
async function start(auto=false) {
  if (running) return;if (!connected || !scope) throw new Paused('Connect to ChatGPT first.');await folderReady(!auto);
  const opts={archived:$('archived').checked,projects:$('projects').checked,assist:$('assist').checked,verify:$('verify').checked,attachments:$('attachments').checked,passive:$('passive').checked,passiveHours:Number($('passive-hours').value)||3,yieldUser:$('yield-user').checked,mode:$('work-mode').value};
  if (!job) job=newJob(scope,opts);else Object.assign(job.options,opts);job.schedule ||= newJob(scope,opts).schedule;job.schedule.enabled=opts.passive;job.schedule.intervalMs=opts.passiveHours*3600000;if(!job.schedule.nextScanAt)job.schedule.nextScanAt=Date.now()+job.schedule.intervalMs;
  addIds();if (job.status==='complete' && counts(job).pending) job.status='ready';if (job.status==='complete') {update();$('message').textContent='This backup is current. Passive mode or Scan again will pick up later changes.';return;}
  running=true;update();engine=new Engine(job,{save:j=>db.put('jobs',scope.key,j),changed:update,request:async(path,expected,lastLimitSeen)=>{try {return await bridge({op:'get',path,scope:expected,lastLimitSeen});}catch {throw new Paused('The connected ChatGPT tab closed or navigated away. Click Connect, then resume.');}},refresh:async()=>{const r=await bridge({op:'context'});if (!r.ok) throw new Paused(r.error || 'Please sign in to ChatGPT again.');},cacheGet:key=>db.get('chats',key),cachePut:(key,value)=>db.put('chats',key,value),inventory:async s=>[...await db.cacheInventory(s.key),...await diskInventory()],diskRead,sense,write,report,index,recover,hash:hashData,attachments:backupAttachments});
  try {await engine.run();} finally {running=false;update();}
}
function download(blob,name) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function bind(id,handler) {$(id).addEventListener('click',()=>{notice='';Promise.resolve().then(handler).catch(error);});}
async function passiveTick(){
  if(passiveBusy || running || !job || !scope || !connected || !job.schedule?.enabled)return;passiveBusy=true;
  try{
    const now=Date.now();
    if(now>=(job.schedule.nextScanAt || 0)){resetSourcesForScan('Passive scheduled rescan: checking lists for new / changed chats…');job.schedule.lastScanAt=now;job.schedule.nextScanAt=now+(job.schedule.intervalMs || 10800000);await db.put('jobs',scope.key,job);await start(true);return;}
    const snapshots=await sense(scope),unknown=snapshots.some(s=>(s.hints || []).some(h=>!job.entries[h.id])),changed=snapshots.some(s=>(s.changedBodies || []).length);
    const dueAttachment=Object.values(job.entries).some(e=>e.attachmentPending && (!e.attachmentRetryAt || e.attachmentRetryAt<=now));if(unknown || changed || Object.values(job.entries).some(e=>e.status==='pending') || dueAttachment){job.schedule.lastTelemetryAt=now;job.status='ready';job.message=changed?'Passive observation found a changed chat; overwriting its existing export…':unknown?'Passive observation found a new chat link; indexing it now…':dueAttachment?'Retrying only transient/rate-limited attachment work during a quiet window…':'Queued chat work is ready.';await db.put('jobs',scope.key,job);await start(true);}
  }catch(e){job.message=`Passive watcher deferred: ${e.message || e}`;await db.put('jobs',scope.key,job).catch(()=>{});update();}finally{passiveBusy=false;}
}
async function init() {
  bind('connect',connect);
  bind('folder',async()=>{if (!scope) throw new Paused('Connect to ChatGPT first.');const next=await showDirectoryPicker({mode:'readwrite',id:'chatgpt-backup'}),previous=folder;folder=next;root=null;localAttachmentIndex=null;diskFiles=null;diskIndexEntries=null;await db.put('meta',`folder:${scope.key}`,folder);await folderReady();if (job && (!previous || !(await previous.isSameEntry(next)))) {for (const e of Object.values(job.entries)) if(e.status==='saved') {e.status='pending';e.retryAt=0;}job.status='ready';job.message='Folder changed. Valid JSON files/cache will be reused before any server retrieval.';await db.put('jobs',scope.key,job);}update();});
  bind('attachment-library',async()=>{if(!scope)throw new Paused('Connect to ChatGPT first.');attachmentLibrary=await showDirectoryPicker({mode:'read',id:'chatgpt-existing-files'});localAttachmentIndex=null;await db.put('meta',`attachmentLibrary:${scope.key}`,attachmentLibrary);await attachmentLibraryReady(true);if(job){if(!root)try{await folderReady(false);}catch{}if(root){job.message='Scanning your chosen local files folder for existing attachment matches…';update();await reconcileLocalAttachments();}else{job.message='Existing files folder saved. Grant the backup-folder permission or press Start; local attachment matching will run before any missing file uses the network.';await db.put('jobs',scope.key,job);update();}}else update();});
  bind('start',()=>start());bind('hold',async()=>{if(!running || !engine)return;engine.held=!engine.held;job.status=engine.held?'held':'running';job.message=engine.held?'Held in place. The live worker, queue position, discovery cursors, and connection stay open; no new network work starts until you resume.':'Resuming the same live run exactly where it was held.';job.events ||= [];job.events.push({at:Date.now(),message:job.message});job.events=job.events.slice(-180);await db.put('jobs',scope.key,job);update();});bind('pause',async()=>{if(engine){engine.stopped=true;job.status='pausing';job.message='Stopping the active run after the current request / disk write…';await db.put('jobs',scope.key,job);update();}});
  bind('retry',async()=>{if (!job) return;const now=Date.now();let parked=0,requeued=0;if(job.discoveryUncertain){job.sources=newJob(scope,job.options).sources;job.discoveryAudit={round:0,baseline:Object.keys(job.entries || {}).length,stable:false};job.discoveryUncertain=false;}for (const e of Object.values(job.entries)){if(e.status==='failed'){if((e.brokenUntil || 0)>now){parked++;}else{e.status='pending';e.attempts=0;e.retryAt=0;e.recoveryAttempted=false;e.brokenUntil=0;requeued++;}}if(e.attachmentPending){e.attachmentRetryAt=0;e.attachmentScannedAt=0;}}for (const s of job.sources) if(s.error){s.error=null;s.done=false;s.seenPages=[];s.uniqueIds=[];s.emptyChecks=0;s.failures=0;s.reportedTotal=0;if(s.kind==='list')s.offset=0;else s.cursor=s.kind==='project'?'0':null;}job.status='ready';job.message=`Requeued ${requeued} unresolved chat${requeued===1?'':'s'}; ${parked} hard failure${parked===1?'':'s'} checked within the last 7 days stayed parked. Transient attachment retries were reopened; hard attachment failures stay retired.`;await db.put('jobs',scope.key,job);await start();});
  bind('scan',async()=>{if (!job) return;resetSourcesForScan();await db.put('jobs',scope.key,job);await start();});
  bind('add',async()=>{if(!scope) throw new Paused('Connect first.');if(!job) job=newJob(scope,{archived:$('archived').checked,projects:$('projects').checked,assist:$('assist').checked,verify:$('verify').checked,attachments:$('attachments').checked,passive:$('passive').checked,passiveHours:Number($('passive-hours').value)||3});addIds();job.status='ready';job.message='Added links to the queue. Click Start / resume.';await db.put('jobs',scope.key,job);update();});
  bind('report',async()=>{if(job) download(new Blob([JSON.stringify(reportData(job),null,2)],{type:'application/json'}),'export-report.json');});bind('index',async()=>{if(job)download(new Blob([JSON.stringify(indexData(job),null,2)],{type:'application/json'}),'conversation-index.json');});
  bind('export-state',async()=>{if(job)download(new Blob([JSON.stringify(portableData(job),null,2)],{type:'application/json'}),`chatgpt-exporter-portable-state-${new Date().toISOString().slice(0,10)}.json`);});bind('import-state',()=>$('state-file').click());$('state-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;await importPortableObject(JSON.parse(await file.text()));e.target.value='';});
  bind('zip',async()=>{if (!job) throw new Error('There are no cached chats yet.');$('zip').disabled=true;try {const zip=new JSZip();let n=0,bytes=0;for (const e of Object.values(job.entries)) {const record=await db.get('chats',`${scope.key}:${e.id}`);if(!record)continue;const json=JSON.stringify(record.data,null,2),md=markdown(record.data,e.id);bytes+=new TextEncoder().encode(json+md).length;if(bytes>250*1024*1024)throw new Error('The backup is too large for a memory-based ZIP. Your individual folder files remain available. Use Windows to compress the backup folder after the export finishes.');const name=e.basename || e.id;zip.file(`json/${name}.json`,json);zip.file(`markdown/${name}.md`,md);n++;}if(!n)throw new Error('No conversation data has been cached yet.');zip.file('export-report.json',JSON.stringify({...reportData(job),zip_cached_count:n},null,2));zip.file('conversation-index.json',JSON.stringify(indexData(job),null,2));zip.file('portable-state.json',JSON.stringify(portableData(job),null,2));download(await zip.generateAsync({type:'blob',compression:'DEFLATE'}),`chatgpt-cached-${n}-${new Date().toISOString().slice(0,10)}.zip`);} finally {$('zip').disabled=false;}});
  for(const id of ['passive','passive-hours','attachments','yield-user'])$(id).addEventListener('change',async()=>{if(!job)return;job.options.passive=$('passive').checked;job.options.passiveHours=Number($('passive-hours').value)||3;job.options.attachments=$('attachments').checked;job.options.yieldUser=$('yield-user').checked;job.schedule ||= newJob(scope,job.options).schedule;job.schedule.enabled=job.options.passive;job.schedule.intervalMs=job.options.passiveHours*3600000;job.schedule.nextScanAt=Date.now()+job.schedule.intervalMs;await db.put('jobs',scope.key,job);update();});
  tabId=(await chrome.storage.session.get('exporterTabId')).exporterTabId;scope=await db.get('meta','lastScope');if (scope) {job=await db.get('jobs',scope.key);if(migrateLoadedJob(job))await db.put('jobs',scope.key,job);folder=await db.get('meta',`folder:${scope.key}`);attachmentLibrary=await db.get('meta',`attachmentLibrary:${scope.key}`) || null;}applyJobOptionsToUI();update();setInterval(update,1000);setInterval(passiveTick,60000);chrome.runtime.onMessage.addListener(msg=>{if(msg?.type==='passive-tick')void passiveTick();});
  if (job?.status==='running') {try {running=true;const restoring=engine={stopped:false};while(Date.now()<(job.pace.until || 0)){if(restoring.stopped)throw new Paused('Paused by you.');job.message='Restoring the saved cooldown before reconnecting…';update();await sleep(Math.min(1000,job.pace.until-Date.now()));}if(restoring.stopped)throw new Paused('Paused by you.');await connect(scope.key);running=false;await start(true);} catch(e){if(job){job.status='paused';job.message=`Saved progress found. ${e.message}`;await db.put('jobs',scope.key,job);}}finally{running=false;update();}}
  else if (job?.status==='pausing' || job?.status==='held') {job.status='paused';job.message='The previous live hold/run is no longer in memory, but its exact queue/cursors are preserved. Click Connect, then resume; no scan reset is performed.';await db.put('jobs',scope.key,job);update();}
}
navigator.locks.request('english-exporter-dashboard',{ifAvailable:true},async lock=>{if(!lock){canEdit=false;update();$('message').textContent='Another exporter tab is already open. Continue there, or close it and reload this tab.';return;}await init();await new Promise(()=>{});}).catch(error);
