import {seedFileSources,observeChatFiles,sharedFileCandidates,sharedFileBudget,rememberFileResult,retryLinkedFile,fileReferences} from './file-links.mjs';
import {ContentStore,validHash,isImage,applyImagePreference} from './file-intelligence.mjs';
import {LibraryPanel} from './library-ui.mjs';
import {LIBRARY_LIMIT,libraryState,queueLibraryScan,libraryIndex,libraryPath,libraryCandidates,manualFiles,retryLibraryFile,LIBRARY_FAILURE_LIMIT} from './library.mjs';
import {CatalogWriter} from './catalog-writer.mjs';
import {LogPanel,appendEvent} from './logs.mjs';
import {conversationFiles,libraryFileMap,viewerHandoff,catalogHTML} from './interop.mjs';
import * as db from './storage.mjs';
import {VERSION,newJob,mergeEntry,counts,validId,markdown,conversationValid,extractAttachments,ATTACHMENT_MAX_BYTES,conversationTime,epoch,limited,WEEKLY_BROKEN_MS,attachmentError,safeName,attachmentCandidates} from './core.mjs';
import {recordLimit} from './awareness.mjs';
import {Engine,Paused,YieldAttachments} from './engine.mjs';
import {hasReadyWork,hasObservedWork,enterWatching,ensureWatchSchedule,watchCheckDue,queueFullScanIfDue} from './watch.mjs';
import {repairAttachmentEntry,ATTACHMENT_STATE_REVISION} from './attachment-state.mjs';
import {renderDashboard} from './ui.mjs';
import {workPresentation} from './work-scheduler.mjs';
import {createRenderScheduler} from './ui-scheduler.mjs';
import {createDashboardStats} from './dashboard-state.mjs';
import {setUserYield,userYieldStatus} from './live-settings.mjs';
const $=id=>document.getElementById(id);
const getDashboardStats=createDashboardStats(),renderer=createRenderScheduler(paint);
function update(){renderer.request();}
let job=null,scope=null,folder=null,root=null,attachmentLibrary=null,localAttachmentIndex=null,engine=null,running=false,tabId=null,connected=false,canEdit=true,notice='';
let sensed={at:0,key:null,snapshots:[]},diskFiles=null,diskIndexEntries=null,passiveBusy=false,initializing=true;
let connecting=false,logPanel=null,libraryPanel=null;
const harvested=new Map(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const hashData=data=>digest(JSON.stringify(data));
function error(e) {notice=e.message || String(e);$('message').textContent=notice;}
function paint() {
  const {c,unavailable,unverified,deferred,queued,provenance}=getDashboardStats(job);$('saved').textContent=c.saved;$('found').textContent=c.total;$('failed').textContent=c.failed+c.discovery-(job?.sources?.filter(s=>!s.done && !s.error).length || 0);$('changed').textContent=c.changed;$('attachments-count').textContent=c.attachments;
  $('attachment-status').textContent=`Attachment backup: ${c.attachments} verified · ${unavailable} unavailable · ${unverified} awaiting validation · ${deferred} deferred${queued?` · ${queued} chats awaiting an attachment pass`:''}. Counts are attachment references across chats.`;
  $('state').textContent=job?.status || 'Ready';if (notice || job) $('message').textContent=notice || job.message;$('bar').max=Math.max(1,c.total);$('bar').value=c.saved;
  $('pace').textContent=`${Math.round((job?.pace.delay || 5000)/1000)} s · T${job?.pace?.tier || 0}`;$('awareness-state').textContent=job?.awareness?.state?.replaceAll('-',' ') || 'Observing';$('awareness-reason').textContent=job?.awareness?.reason || 'Reads the app’s existing activity before deciding what to do next.';
  const sources=job?.sources || [];
  $('coverage').textContent=`${sources.filter(s=>s.done&&!s.error).length}/${sources.length} lists finished · active ${sources.find(s=>s.key==='active')?.offset || 0} · archived ${sources.find(s=>s.key==='archived')?.offset || 0} · ${provenance.size} discovery routes · ${job?.discoveryAudit?.stable?'coverage complete':sources.some(s=>s.error)?'incomplete routes parked/repaired individually':'single traversal'}`;
  const delay=Math.max(job?.pace.until || 0,job?.pace.next || 0,job?.awareness?.waitUntil || 0)-Date.now();$('wait').textContent=running && delay>0 ? `Next network request in ${Math.ceil(delay/1000)} s · local file work is never throttled` : running ? (job?.phase==='local' ? 'Local backup recovery/write · no network wait' : 'Working one item at a time') : 'Progress kept locally';
  const times=(job?.recentDone || []).filter(t=>Date.now()-t<3600000),rate=times.length>2 ? (times.at(-1)-times[0])/(times.length-1) : 0;$('eta').textContent=c.discovery ? 'Discovering chats · total may grow' : rate>0 && c.pending ? `Estimated ${Math.max(1,Math.ceil((rate*c.pending+Math.max(0,delay))/60000))} min remaining · may change` : c.pending ? 'Estimating remaining time…' : 'No queued chats remaining';
  const work=workPresentation(job);$('work-priority').textContent=running?work.title:job?.status==='paused'?'Paused · saved queues retained':'Queues ready / last completed work';$('work-reason').textContent=running?work.reason:job?.message || work.reason;$('work-health').textContent=work.health;
  $('work-queues').textContent=`${c.pending} chats queued · ${job?.options?.attachments===false?'chat attachments off':queued+' chat attachment passes'} · uploaded, generated and image files share the Library file queue below.`;
  const watching=!!(connected && job?.schedule?.enabled && !job.schedule.suspended && job.status==='watching');
  const next=job?.schedule?.enabled && job.schedule.nextScanAt?Math.max(0,job.schedule.nextScanAt-Date.now()):0;$('passive-status').textContent=job?.schedule?.enabled ? `${job.schedule.suspended?'Passive watch stopped · press Start to resume':!connected?'Connect to resume passive watch':watching?'Passive watch active':'Passive watcher enabled'} · rescan ${next?`in ${Math.max(1,Math.ceil(next/60000))} min`:'due now'} · loaded chats checked every minute` : 'Passive rescan off';
  const held=!!(running && engine?.held);$('hold').disabled=!running;$('hold').textContent=held?'Resume in place':'Hold in place';$('pause').disabled=(!running&&!watching) || !canEdit;$('pause').textContent=watching?'Stop passive watch':'Stop run';$('start').disabled=running || watching || !canEdit;$('start').textContent=watching?'Passive watch active':'Start / resume automatic export';
  for (const id of ['connect','folder','attachment-library','repair-attachments','retry','scan','add','archived','projects','assist','verify','attachments','passive','passive-hours','recent-check-minutes','smart-watch','library-enabled','library-scan','library-retry','library-deduplicate','download-images','work-mode','export-state','import-state']) $(id).disabled=running || !canEdit || initializing;
  $('yield-user').disabled=!canEdit || initializing;
  $('yield-status').textContent=userYieldStatus(job || {options:{yieldUser:$('yield-user').checked}});
  if(initializing)$('start').disabled=true;
  const schedule=job?.schedule || {},stamp=t=>t?new Date(t).toLocaleTimeString():'not yet',recent=Math.max(0,(schedule.nextCheckAt || Date.now())-Date.now());
  const observedAgo=schedule.lastTelemetryAt?Math.floor((Date.now()-schedule.lastTelemetryAt)/1000):null;
  const waiting=Math.max(job?.pace.until || 0,schedule.checkWaitUntil || 0)>Date.now();
  $('watch-details').textContent=job?.schedule?.enabled?`Last tab observation: ${observedAgo===null?'not yet':observedAgo+' s ago'} · ${schedule.observedTabs || 0} tabs · last server check: ${stamp(schedule.lastCheckAt)} · recent check ${recent?'in '+Math.ceil(recent/60000)+' min':'due'}${waiting?' (waiting for the network window)':''}${schedule.checkError?' · '+schedule.checkError:''}. Keep the dashboard and connected ChatGPT tab open; browser alarms wake checks when the dashboard is in the background.`:'Passive watcher is off.';
  logPanel?.update(job?.events || []);renderLibrary();$('connection').textContent=connected ? 'Connected':'Not connected';$('account').textContent=scope ? `User ${scope.user} · workspace ${scope.account || 'default session'}` : 'One workspace per backup.';$('folder-name').textContent=folder ? `${folder.name} / chatgpt-backup-${scope?.key.slice(0,12) || '…'}`:'No folder selected';$('attachment-library-name').textContent=attachmentLibrary ? `${attachmentLibrary.name} · reported hash required for unrelated file reuse`:'No local file library selected';
  renderDashboard(document,{job,scope,connected,connecting,initializing,folder,running,notice,saved:c.saved,total:c.total,failed:c.failed+c.discovery-(job?.sources?.filter(s=>!s.done && !s.error).length || 0)});
}
async function bridge(args,targetId=tabId) {
  if (!targetId) throw new Paused('Connect to ChatGPT first.');
  let timer;let results;
  try{results=await Promise.race([chrome.scripting.executeScript({target:{tabId:targetId},world:'MAIN',func:async args=>{if (!window.__englishExporterBridgeV247) return {ok:false,status:0,kind:'bridge',error:'ChatGPT is still loading.'};return window.__englishExporterBridgeV247.rpc(args);},args:[args]}),new Promise(resolve=>{timer=setTimeout(()=>resolve([{result:{ok:false,status:504,error:'The ChatGPT bridge timed out; this item can be deferred.'}}]),100000);})]);}finally{clearTimeout(timer);}
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
            const fresh=!old || cached.at>old.at && epoch(cached.data.update_time)>=epoch(old.data?.update_time);
            if(fresh && oldHash && oldHash!==hash)result.changedBodies.push({id:entry.id,title:cached.data.title,update_time:cached.data.update_time,create_time:cached.data.create_time || conversationTime(cached.data),contentHash:hash,previousContentHash:oldHash,origin:'passively observed changed chat'});
            if(fresh)await db.put('chats',key,{data:cached.data,at:cached.at,hash,passive:true});harvested.set(harvestKey,entry.at);
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
function applyJobOptionsToUI(){if(!job)return;for (const id of ['archived','projects','assist','verify','attachments','passive']) $(id).checked=job.options[id]!==false;$('yield-user').checked=job.options.yieldUser!==false;$('library-enabled').checked=job.options.library!==false;$('download-images').checked=job.options.downloadImages!==false;$('smart-watch').checked=job.options.smartWatch!==false;$('work-mode').value=job.options.mode || 'index-first';$('passive-hours').value=String(job.options.passiveHours || Math.round((job.schedule?.intervalMs || 10800000)/3600000) || 3);$('recent-check-minutes').value=String(Math.round((job.schedule?.recentIntervalMs || 300000)/60000));}
function migrateLoadedJob(j){
  if(!j)return false;const linksNew=!j.fileLinks;seedFileSources(j);let changed=linksNew;const now=Date.now();if(j.options.library==null){j.options.library=true;changed=true;}if(j.options.smartWatch==null){j.options.smartWatch=true;changed=true;}libraryState(j,now);
  if(j.version==='2.3.0'){
    const regimes=j.pace?.regimes || [],last=[...regimes].reverse().find(r=>['step-up','limit-same-episode'].includes(r.event));
    const explicit=last?.retryAfter>0 ? last.at+last.retryAfter : 0;
    if(j.pace){j.pace.until=explicit>now?explicit:Math.min(j.pace.until || 0,now+120000);j.pace.next=Math.min(j.pace.next || 0,now+Math.max(5000,j.pace.delay || 5000));}
    j.events ||= [];j.events.push({at:now,message:'v2.3.1 migration: removed legacy self-generated long traffic rests; real Retry-After cooldowns remain authoritative.'});j.events=j.events.slice(-1500);j.version='2.3.1';changed=true;
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
    j.events ||= [];j.events.push({at:now,message:`v2.3.2 migration: retired ${retired} legacy attachment failures from automatic retry. Existing local files can be reconciled without network traffic.`});j.events=j.events.slice(-1500);j.version='2.3.2';changed=true;
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
    j.events ||= [];j.events.push({at:now,message:`v2.3.3 migration: requeued ${repaired} attachment read${repaired===1?'':'s'} affected by the v2.3.2 prepared-chunk workspace bug.`});j.events=j.events.slice(-1500);j.version='2.3.3';changed=true;
  }
  if(j.version==='2.3.3'){
    let parked=0;
    for(const e of Object.values(j.entries || {})){
      const m=String(e.error || '').match(/HTTP\s+(400|404|410|412|422)/i);
      if(m && ['pending','failed'].includes(e.status)){e.status='failed';e.attempts=Math.max(1,e.attempts || 0);e.lastFailureAt=e.lastFailureAt || now;e.lastFailureStatus=Number(m[1]);e.brokenUntil=Math.max(e.brokenUntil || 0,now+WEEKLY_BROKEN_MS);e.retryAt=0;parked++;}
    }
    j.options ||= {};if(j.options.yieldUser==null)j.options.yieldUser=true;
    j.discoveryAudit ||= {round:0,baseline:Object.keys(j.entries || {}).length,stable:false};j.discoveryAudit.round=0;
    j.events ||= [];j.events.push({at:now,message:`v2.3.4 migration: parked ${parked} known hard chat failure${parked===1?'':'s'} for 7 days and disabled redundant full-list verification loops.`});j.events=j.events.slice(-1500);j.version='2.3.4';changed=true;
  }
  if(j.version==='2.3.4'){
    for(const e of Object.values(j.entries || {})){
      // Tiny legacy downloads are unverified, not proof of success. Validate
      // their real bytes on the next attachment pass, retaining the old files.
      if(e.attachments?.some(a=>a.status==='saved' && Number(a.size)<=8192)){e.attachmentPending=true;e.attachmentRetryAt=0;e.attachmentScannedAt=0;}
    }
    j.version='2.3.5';changed=true;
  }
  if(j.version==='2.3.5'){
    j.schedule ||= newJob(j.scope,j.options || {}).schedule;
    if(j.status==='paused')j.schedule.suspended=true;
    else if(j.schedule?.enabled && ['complete','incomplete','indexed'].includes(j.status))enterWatching(j,now);
    j.version='2.3.6';changed=true;
  }
  if(Object.values(j.entries || {}).some(e=>!e.attachmentStateRevision)){
    let requeued=0;for(const e of Object.values(j.entries || {}))if(repairAttachmentEntry(e))requeued++;
    j.events ||= [];j.events.push({at:now,message: `v2.3.7 attachment repair: ${requeued} saved chats queued for local byte validation and corrected file routes; transcript/discovery state retained.`});
    j.events=j.events.slice(-1500);changed=true;
  }
  if(j.options.downloadImages==null){j.options.downloadImages=true;changed=true;}
  if(j.imagePreferenceRevision!==1){j.imagePreferenceRevision=1;for(const e of Object.values(j.entries || {}))if(e.status==='saved'){e.attachmentPending=true;e.attachmentRetryAt=0;e.attachmentScannedAt=0;}changed=true;}
  applyImagePreference(j);const lib=libraryState(j,now);
  for(const f of Object.values(lib.entries))if((f.attempts || 0)>=LIBRARY_FAILURE_LIMIT && f.status!=='saved' && !f.parked){f.parked=true;f.status='unavailable';f.retryAt=0;f.parkedAt ||= now;changed=true;}
  if(lib.discoveryRevision!==2){lib.discoveryRevision=2;lib.sources=[];lib.nextScanAt=now;lib.state='ready';changed=true;}
  if(j.version!==VERSION){ensureWatchSchedule(j,now);j.version=VERSION;changed=true;}
  return changed;
}
async function connect(expectedKey=null) {
  $('message').textContent='Connecting to your signed-in ChatGPT session…';await ensureTab();const result=await readyBridge(),nextScope={...result.scope,key:await digest(JSON.stringify([result.scope.user,result.scope.account || null]))};
  if (expectedKey && nextScope.key!==expectedKey) throw new Paused('The account or workspace changed. Automatic resume stopped; reconnect to the original workspace.');scope=nextScope;connected=true;await db.put('meta','lastScope',scope);job=await db.get('jobs',scope.key) || null;if(migrateLoadedJob(job))await db.put('jobs',scope.key,job);folder=await db.get('meta',`folder:${scope.key}`) || null;attachmentLibrary=await db.get('meta',`attachmentLibrary:${scope.key}`) || null;root=null;localAttachmentIndex=null;diskFiles=null;diskIndexEntries=null;sensed.at=0;applyJobOptionsToUI();update();if (!job) $('message').textContent='Connected. Choose a folder, then start the automatic export.';
}
async function folderReady(request=false) {if (!folder) throw new Paused('Choose a backup folder first.');let permission=await folder.queryPermission({mode:'readwrite'});if (permission!=='granted' && request) permission=await folder.requestPermission({mode:'readwrite'});if (permission!=='granted') throw new Paused('Folder permission is needed. Click Choose folder to grant access again.');if (!scope) throw new Paused('Connect to ChatGPT first.');root=await folder.getDirectoryHandle(`chatgpt-backup-${scope.key.slice(0,12)}`,{create:true});}
async function write(path,content) {
  let stream,timedOut=false,timer;
  const task=(async()=>{if(!root)await folderReady();let directory=root;const parts=path.split('/');for(const part of parts.slice(0,-1))directory=await directory.getDirectoryHandle(part,{create:true});const handle=await directory.getFileHandle(parts.at(-1),{create:true});stream=await handle.createWritable();if(timedOut){void stream.abort().catch(()=>{});return;}await stream.write(content);if(timedOut){void stream.abort().catch(()=>{});return;}await stream.close();})();
  try{await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;void stream?.abort().catch(()=>{});const e=new Error(`File write timed out after 90 seconds: ${path}`);e.name='FileTimeoutError';reject(e);},90000);})]);}catch(e){timedOut=true;void stream?.abort().catch(()=>{});throw e;}finally{clearTimeout(timer);}
}
function reportData(j) {
  return {exporter:`English Autopilot ${VERSION}`,generated_at:new Date().toISOString(),scope:j.scope,status:j.status,message:j.message,counts:counts(j),schedule:j.schedule || null,pacing:{delay_ms:j.pace.delay,tier:j.pace.tier || 0,cooldown_until:j.pace.until,last_limit:j.pace.lastLimit,strikes:j.pace.strikes,regimes:j.pace.regimes || [],native_requests_observed:j.awareness?.native?.length || 0,exporter_actions_observed:j.awareness?.actions?.length || 0},recent_responses:j.responses || [],awareness:j.awareness?{state:j.awareness.state,reason:j.awareness.reason,pressure:j.awareness.pressure}:null,discoveryAudit:j.discoveryAudit,discoveryUncertain:!!j.discoveryUncertain,discovery:j.sources.map(({seenPages,uniqueIds,...s})=>({...s,uniqueCount:uniqueIds?.length || 0})),conversations:Object.values(j.entries),note:'Complete means all discovered conversations were saved and enabled discovery sources reached their end. v2.3.4 records content fingerprints and overwrites the same transcript files when a changed body is observed or a newer server update is retrieved. Eligible attachment files are matched against permitted local folders first; only missing files attempt a current/observed ChatGPT route. Hard unavailable attachments are not auto-retried. Hard chat 400/404/410/412/422 results are parked for 7 days unless a newer server update appears. User interaction in ChatGPT yields network work for 6 minutes when enabled.'};
}
function indexData(j) { const fileMap=libraryFileMap(j);
  return {schema:'chatgpt-conversation-index/v1',library_index:'attachments/library-index.json',viewer_handoff:'viewer-handoff.json',version:VERSION,generated_at:new Date().toISOString(),scope:j.scope.key,total:Object.keys(j.entries).length,order:'calendar create time (earliest known conversation/message time)',entries:Object.values(j.entries).sort((a,b)=>(epoch(a.create_time)||epoch(a.update_time)||Infinity)-(epoch(b.create_time)||epoch(b.update_time)||Infinity)).map(e=>({id:e.id,url:`https://chatgpt.com/c/${e.id}`,title:e.title,status:e.status,create_time:e.create_time || null,update_time:e.update_time,checked_update_time:e.checkedUpdateTime || null,chat_kind:e.chatKind || (e.projectId?'project-chat':'unknown'),chat_kind_evidence:e.chatKindEvidence || null,project:e.project || null,found_via:e.foundVia || [],saved_at:e.savedAt || null,content_hash:e.contentHash || null,previous_content_hash:e.previousContentHash || null,revision_count:e.revisionCount || 0,changed_at:e.changedAt || null,json:e.basename?`json/${e.basename}.json`:null,markdown:e.basename?`markdown/${e.basename}.md`:null,attachments:conversationFiles(j,e,fileMap),attachment_state_revision:e.attachmentStateRevision || 0,attachment_scanned_at:e.attachmentScannedAt || null,attachment_pending:!!e.attachmentPending,attachment_retry_at:e.attachmentRetryAt || 0,error:e.error || null,last_failure_at:e.lastFailureAt || null,last_failure_status:e.lastFailureStatus || null,broken_until:e.brokenUntil || 0}))};
}
async function diskInventory() {
  if(diskFiles && diskIndexEntries)return [...diskIndexEntries.values()];diskFiles=new Map();diskIndexEntries=new Map();if(!root)return [];
  const metadata=new Map();
  try {
    const handle=await root.getFileHandle('conversation-index.json'),saved=JSON.parse(await(await handle.getFile()).text());
    if(saved.scope===scope.key)for(const e of saved.entries || [])if(validId(e.id)){
      metadata.set(e.id,e);
      diskIndexEntries.set(e.id,{id:e.id,title:e.title,update_time:e.update_time,checkedUpdateTime:e.checked_update_time,create_time:e.create_time,contentHash:e.content_hash || null,previousContentHash:e.previous_content_hash || null,revisionCount:e.revision_count || 0,changedAt:e.changed_at || null,savedAt:e.saved_at || null,chatKind:e.chat_kind || null,chatKindEvidence:e.chat_kind_evidence || null,project:e.project || null,foundVia:e.found_via || [],basename:e.json?.startsWith('json/')?e.json.slice(5,-5):null,indexStatus:e.status || 'pending',attachments:e.attachments || [],attachmentStateRevision:e.attachment_state_revision || 0,attachmentScannedAt:e.attachment_scanned_at || null,attachmentPending:!!e.attachment_pending,attachmentRetryAt:e.attachment_retry_at || 0,origin:'existing conversation index'});
    }
  } catch(e){if(e.name!=='NotFoundError' && !(e instanceof SyntaxError))throw e;}
  let directory;try {directory=await root.getDirectoryHandle('json');} catch(e){if(e.name==='NotFoundError')return [...diskIndexEntries.values()];throw e;}
  const byName=new Map([...metadata.values()].filter(e=>e.json?.startsWith('json/')).map(e=>[e.json.slice(5),e]));
  for await(const [name,handle] of directory.entries()) {
    if(handle.kind!=='file' || !name.endsWith('.json'))continue;
    const saved=byName.get(name),id=saved?.id || name.match(/_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/i)?.[1];if(!validId(id))continue;
    const basename=name.slice(0,-5),entry={id,title:saved?.title || name.slice(0,-id.length-6),update_time:saved?.update_time,checkedUpdateTime:saved?.checked_update_time,create_time:saved?.create_time,contentHash:saved?.content_hash || null,previousContentHash:saved?.previous_content_hash || null,revisionCount:saved?.revision_count || 0,changedAt:saved?.changed_at || null,savedAt:saved?.saved_at || null,chatKind:saved?.chat_kind || null,chatKindEvidence:saved?.chat_kind_evidence || null,project:saved?.project || null,foundVia:saved?.found_via || [],basename,diskBacked:true,inventoryStatus:'saved',attachments:saved?.attachments || [],attachmentStateRevision:saved?.attachment_state_revision || 0,attachmentScannedAt:saved?.attachment_scanned_at || null,attachmentPending:!!saved?.attachment_pending,attachmentRetryAt:saved?.attachment_retry_at || 0,origin:'existing backup file'};
    diskFiles.set(id,{handle,basename,entry});diskIndexEntries.set(id,{...(diskIndexEntries.get(id)||{}),...entry});
  }
  return [...diskIndexEntries.values()];
}
async function diskRead(id) {await diskInventory();const found=diskFiles.get(id);if(!found)return null;try {const file=await found.handle.getFile(),data=JSON.parse(await file.text());if(!conversationValid(data,id))return null;return {data,at:file.lastModified,basename:found.basename,hash:found.entry.contentHash || await hashData(data),passive:false};} catch(e){if(e.name==='NotFoundError' || e instanceof SyntaxError)return null;throw e;}}
async function index(j) {const data=indexData(j);await write('conversation-index.json',JSON.stringify(data,null,2));await write('viewer-handoff.json',JSON.stringify(viewerHandoff(j,data),null,2));}
const catalogWriter=new CatalogWriter(write);
async function libraryReport(j){await catalogWriter.report(j,root,!running || ['complete','incomplete','indexed','paused','watching'].includes(j.status));}
let lastEngineReportAt=0,engineReportRoot=null;
async function engineReport(j){if(root!==engineReportRoot){engineReportRoot=root;lastEngineReportAt=0;}if(j.status==='running'&&Date.now()-lastEngineReportAt<15000)return;await report(j);lastEngineReportAt=Date.now();}
async function report(j) {await libraryReport(j);await write('export-report.json',JSON.stringify(reportData(j),null,2));await index(j);await write('portable-state.json',JSON.stringify(portableData(j),null,2));}
async function recover(id,expected,isStopped) {const context=await bridge({op:'context'});if (!context.ok || JSON.stringify([context.scope?.user,context.scope?.account])!==JSON.stringify([expected.user,expected.account])) throw new Paused('Account changed before browser recovery. Reconnect to the original account.');const since=Date.now();await chrome.tabs.update(tabId,{url:`https://chatgpt.com/c/${encodeURIComponent(id)}`,active:false});sensed.at=0;for (let i=0;i<40;i++) {if (isStopped()) throw new Paused('Paused by you.');await sleep(1000);let result;try {result=await bridge({op:'peek',id,since,scope:expected});} catch {continue;}if ([401,403,409].includes(result.status)) throw new Paused(result.error || 'Sign in or finish the browser check in the ChatGPT tab.');if (result.status===200 && result.data) {sensed.at=0;return {data:result.data};}if (result.limit && result.limit.at>=since) {sensed.at=0;return {limit:result.limit};}}return null;}
function addIds() {const text=$('ids').value.trim();if (!text) return;const ids=text.split(/[\s,]+/).filter(Boolean).map(value=> {if (/^https?:/i.test(value)) {try {const u=new URL(value);return ['chatgpt.com','chat.openai.com'].includes(u.hostname) ? u.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/)?.[1] : null;} catch {return null;}}return value;});if (ids.some(id=>!validId(id))) throw new Error('One or more links / IDs are invalid. Use full ChatGPT conversation links or conversation IDs.');for (const id of ids) mergeEntry(job,{id,title:'Added conversation'});$('ids').value='';}
function decode64(value){const s=atob(value),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;}
function localKey(name){return String(name || '').normalize('NFC').trim().toLocaleLowerCase();}
async function attachmentLibraryReady(request=false){
  if(!attachmentLibrary)return false;let permission=await attachmentLibrary.queryPermission({mode:'read'});if(permission!=='granted' && request)permission=await attachmentLibrary.requestPermission({mode:'read'});return permission==='granted';
}
async function buildLocalAttachmentIndex(){
  if(localAttachmentIndex)return localAttachmentIndex;const index=new Map();let scanned=0,truncated=false;
  const add=async(handle,path,source)=>{if(scanned>=50000){truncated=true;return;}let file;try{file=await handle.getFile();}catch{return;}scanned++;if(file.size>ATTACHMENT_MAX_BYTES)return;if(file.size<=8192 && attachmentError(await file.text()))return;const key=localKey(file.name);if(!key)return;const list=index.get(key)||[];list.push({handle,path,source,size:file.size,lastModified:file.lastModified});index.set(key,list);};
  const walk=async(dir,prefix,source,depth=0)=>{if(depth>8 || scanned>=50000){truncated=true;return;}for await(const [name,handle] of dir.entries()){if(scanned>=50000){truncated=true;break;}if(handle.kind==='directory'){if(source==='backup' && depth===0 && ['json','markdown','attachment-errors'].includes(name))continue;await walk(handle,`${prefix}${name}/`,source,depth+1);}else await add(handle,`${prefix}${name}`,source);}};
  if(root)await walk(root,'','backup');
  if(await attachmentLibraryReady(false))await walk(attachmentLibrary,'','library');
  localAttachmentIndex={index,scanned,truncated,at:Date.now()};return localAttachmentIndex;
}
async function reuseLocalAttachment(asset,basename){
  const expected=validHash(asset.remoteSha256);if(!expected || !asset?.name || job.options.downloadImages===false && isImage(asset))return null;
  const inventory=await buildLocalAttachmentIndex(),candidates=(inventory.index.get(localKey(asset.name)) || []).filter(x=>asset.size!=null&&x.size===Number(asset.size));
  for(const candidate of candidates){const file=await candidate.handle.getFile();if(await byteHash(file)!==expected)continue;const saved=await contentStore.find(expected,{size:file.size}) || await contentStore.save(file,asset,{source:'local-copy'});return {name:asset.name,id:asset.id,...saved,mime:file.type || asset.mime || null};}
  return null;
}

async function validateSavedAttachment(asset,prior){
  if(!prior?.path || !prior.path.startsWith('attachments/') || prior.path.split('/').some(p=>!p || p==='..'))return null;
  try{
    let directory=root;const parts=prior.path.split('/');for(const p of parts.slice(0,-1))directory=await directory.getDirectoryHandle(p);
    const file=await(await directory.getFileHandle(parts.at(-1))).getFile(),envelope=attachmentError(await file.slice(0,8192).text());
    if(envelope){
      // Preserve evidence in a separate folder before removing the fake document.
      await write('attachment-errors/'+parts.slice(1).join('/')+'.error-response.json',file);
      await directory.removeEntry(parts.at(-1));localAttachmentIndex=null;return null;
    }
    if(file.size===0 || file.size>ATTACHMENT_MAX_BYTES || asset.size && file.size!==Number(asset.size))return null;
    const hash=await byteHash(file);if(validHash(prior.sha256)&&hash!==prior.sha256 || validHash(asset.remoteSha256)&&hash!==asset.remoteSha256)return null;const reused=await contentStore.find(hash,{size:file.size,exclude:prior});return {...prior,...reused,name:asset.name,id:asset.id,status:'saved',imageExcluded:false,error:undefined,autoRetry:false,size:file.size,sha256:hash,validatedAt:Date.now()};
  }catch(e){if(e.name==='NotFoundError')return null;throw e;}
}
async function backupAttachments(entry,data,basename,beforeRequest,{maxTransfers=Infinity,maxItems=Infinity}={}){
  const original=extractAttachments(data),cursor=Math.max(0,(entry.attachmentCursor || 0)%Math.max(1,original.length)),assets=[...original.slice(cursor),...original.slice(0,cursor)],results=[];let transfers=0;
  const already=new Map((entry.attachments || []).map(a=>[String(a.id || a.name),a]));observeChatFiles(job,entry.id,assets);if(!assets.length)return results;
  for(const [assetIndex,asset] of assets.entries()){
    entry.attachmentCursor=(cursor+assetIndex+1)%assets.length;
    if(assetIndex>=maxItems){for(const remaining of assets.slice(assetIndex)){const old=already.get(String(remaining.id || remaining.name));results.push(old?.status==='saved'?old:{name:remaining.name,id:remaining.id,status:'deferred',size:remaining.size || null,autoRetry:true,batchPending:true});}entry.attachmentCursor=(cursor+assetIndex)%assets.length;break;}
    const prior=already.get(String(asset.id || asset.name)),dest=`attachments/${basename}/${safeName(asset.name || asset.id || 'attachment',120)}`;
    const push=(result,failure=false)=>{const {urls,asset_pointer,...metadata}=asset;results.push(rememberFileResult(job,asset,{...metadata,...result},{failure}));};
    const verified=prior?.path || validHash(asset.remoteSha256)?await validateSavedAttachment(asset,prior?.path?prior:{...prior,name:asset.name,id:asset.id,path:dest,source:'existing-local'}):null;if(verified){push(verified);continue;}
    if(job.options.downloadImages===false && isImage(asset)){push({name:asset.name,id:asset.id,mime:asset.mime,status:'manual',imageExcluded:true,size:asset.size || null,autoRetry:false});continue;}
    const linked=await contentStore.findFor(asset);if(linked){push(linked);continue;}
    const budget=sharedFileBudget(job,asset);if(budget.parked){push({name:asset.name,id:asset.id,status:'unavailable',...budget,autoRetry:false,error:'Parked after two shared file attempts. Retry this file to resume.'});continue;}
    if(prior?.autoRetry===false && ['unavailable','permission-unavailable'].includes(prior.status)){push(prior);continue;}
    if(asset.size && asset.size>=LIBRARY_LIMIT){push({name:asset.name,id:asset.id,status:'skipped-too-large',size:asset.size,autoRetry:false});continue;}
    const local=await reuseLocalAttachment(asset,basename);if(local){push(local);continue;}
    try {
      if(transfers>=maxTransfers){const e=new YieldAttachments('Attachment batch yielded its turn to other ready queues.');e.batchPending=true;throw e;}
      await beforeRequest();transfers++;const prep=await bridge({op:'assetPrepare',scope,excludeImages:job.options.downloadImages===false,fileId:asset.id,candidates:[...(asset.urls || []),...sharedFileCandidates(job,asset,entry.id),...attachmentCandidates(asset,entry.id)],maxBytes:LIBRARY_LIMIT-1});
      if(!prep.ok){
        if([401,409].includes(prep.status))throw new Paused(prep.error || 'Reconnect to ChatGPT before downloading files.');
        if(prep.imageExcluded){push({name:asset.name,id:asset.id,mime:prep.type,status:'manual',imageExcluded:true,size:asset.size || null,autoRetry:false});continue;}
        if(prep.status===429){job.lastLimitSeen=Date.now();limited(job.pace,prep.retryAfter,Date.now(),Math.random(),'exporter');recordLimit(job);await db.put('jobs',scope.key,job);push({name:asset.name,id:asset.id,status:'rate-limited',size:prep.size || asset.size || null,error:prep.error || 'HTTP 429',retryAfter:prep.retryAfter || null,autoRetry:true});continue;}
        const status=prep.status===413?'skipped-too-large':[401,403,409].includes(prep.status)?'permission-unavailable':!prep.status || prep.status>=500?'deferred':'unavailable';
        push({name:asset.name,id:asset.id,status,size:prep.size || asset.size || null,error:prep.error || `HTTP ${prep.status}`,routesTried:prep.attempts || [],autoRetry:status==='deferred' || status==='unavailable'},status!=='skipped-too-large');continue;
      }
      const chunks=[];let offset=0;try{for(;;){await engine?.holdPoint();const part=await bridge({op:'assetChunk',key:prep.key,offset,length:384*1024});if(!part.ok){const err=new Error(part.error || 'Attachment chunk failed.');err.status=part.status || 0;throw err;}const bytes=decode64(part.base64);if(part.next!==offset+bytes.length || part.next<=offset && !part.done || part.next>prep.size)throw new Error('Attachment chunk made no valid progress.');chunks.push(bytes);offset=part.next;if(part.done){if(offset!==prep.size)throw new Error('Attachment bytes were incomplete.');break;}}}finally{await bridge({op:'assetRelease',key:prep.key}).catch(()=>{});}
      const preview=new Blob(chunks);const envelope=attachmentError(await preview.slice(0,8192).text());if(envelope){const err=new Error(`Attachment service returned ${envelope}, not document bytes.`);err.status=404;throw err;}if(asset.size && offset!==Number(asset.size))throw new Error(`Attachment size mismatch: expected ${asset.size}, received ${offset}.`);
      await bridge({op:'assetRelease',key:prep.key}).catch(()=>{});const blob=new Blob(chunks,{type:prep.type || asset.mime || 'application/octet-stream'}),filename=safeName(asset.name || asset.id || 'attachment',120);const saved=await contentStore.save(blob,asset,{maxBytes:LIBRARY_LIMIT-1});push({name:asset.name,id:asset.id,...saved,validatedAt:Date.now(),routesTried:prep.attempts || [],mime:prep.type || asset.mime || null});
    } catch(e){if(e instanceof Paused)throw e;if(e instanceof YieldAttachments){entry.attachmentCursor=(cursor+assetIndex)%assets.length;for(const remaining of assets.slice(assetIndex)){const old=already.get(String(remaining.id || remaining.name));results.push(old?.status==='saved'?old:{name:remaining.name,id:remaining.id,status:'deferred',size:remaining.size || null,error:e.message,autoRetry:true,yielded:true,batchPending:!!e.batchPending});}break;}const status=e.status===429?'rate-limited':[401,403,409].includes(e.status)?'permission-unavailable':e.status===404?'unavailable':'deferred';push({name:asset.name,id:asset.id,status,size:asset.size || null,error:e.message || String(e),autoRetry:status==='rate-limited' || status==='deferred'},status!=='rate-limited');}
  }
  return results;
}

async function ensureLibraryJob(){if(!connected || !scope)throw new Paused('Connect to ChatGPT first.');await folderReady(true);job ||= newJob(scope);job.options.library=true;$('library-enabled').checked=true;}
async function fileAt(path){let d=root;const parts=path.split('/');for(const p of parts.slice(0,-1))d=await d.getDirectoryHandle(p);return (await d.getFileHandle(parts.at(-1))).getFile();}
async function byteHash(blob){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function verifyLibraryFile(f){
  try{const disk=await fileAt(f.path || libraryPath(f));if(disk.size===0 || disk.size>ATTACHMENT_MAX_BYTES || f.size!=null&&disk.size!==f.size || attachmentError(await disk.slice(0,8192).text()))return false;const hash=await byteHash(disk);if(f.sha256 && hash!==f.sha256)return false;f.sha256=hash;f.size=disk.size;return true;}
  catch(e){if(['NotFoundError','TypeMismatchError'].includes(e.name))return false;throw e;}
}
async function downloadLibraryFile(f,beforeRequest){
  const dest=libraryPath(f);
  if(f.size!==null&&f.size>=LIBRARY_LIMIT)return {status:'manual',autoRetry:false,error:'At or above the 10 MB automatic-download boundary.'};
  if(!f.refresh){
    try{const disk=await fileAt(f.path || dest);if(disk.size<LIBRARY_LIMIT && (f.size===null || disk.size===f.size) && !attachmentError(await disk.slice(0,8192).text())){const hash=await byteHash(disk);if((!f.sha256 || f.sha256===hash)&&(!f.remoteSha256 || f.remoteSha256===hash))return await contentStore.find(hash,{size:disk.size,maxBytes:LIBRARY_LIMIT-1,exclude:f}) || {status:'saved',source:'existing-local',refresh:false,size:disk.size,path:f.path || dest,sha256:hash};}}catch(e){if(!['NotFoundError','TypeMismatchError'].includes(e.name))throw e;}
    // A local name+size match also requires a reported SHA-256 before reuse.
    if(f.size!==null && validHash(f.remoteSha256)){const inventory=await buildLocalAttachmentIndex(),candidates=(inventory.index.get(localKey(f.name)) || []).filter(x=>x.size===f.size && x.size<LIBRARY_LIMIT);if(candidates.length===1){const file=await candidates[0].handle.getFile(),hash=await byteHash(file);if(f.remoteSha256===hash)return await contentStore.save(file,f,{source:'local-copy',maxBytes:LIBRARY_LIMIT-1});}}
  }
  if(job.options.downloadImages===false && isImage(f))return {status:'manual',imageExcluded:true,error:null};
  const reused=await contentStore.findFor(f,{maxBytes:LIBRARY_LIMIT-1});if(reused)return reused;
  await beforeRequest();const prep=await bridge({op:'assetPrepare',scope,excludeImages:job.options.downloadImages===false,fileId:f.fileId || f.id,library:true,candidates:sharedFileCandidates(job,f),maxBytes:LIBRARY_LIMIT-1});
  if(!prep.ok){if(prep.imageExcluded)return {status:'manual',imageExcluded:true,mime:prep.type,error:null};if([401,409].includes(prep.status))throw new Paused(prep.error || 'Reconnect to ChatGPT before downloading Library files.');return {status:prep.status===413?'manual':'deferred',httpStatus:prep.status,retryAfter:prep.retryAfter,routesTried:prep.attempts || [],size:prep.size ?? f.size,error:prep.error || 'HTTP '+prep.status};}
  const chunks=[];let offset=0;
  try{for(;;){await engine?.holdPoint();const part=await bridge({op:'assetChunk',key:prep.key,offset,length:384*1024});if(!part.ok)throw Error(part.error || 'Library file chunk failed.');const bytes=decode64(part.base64);if(part.next!==offset+bytes.length || !part.done&&part.next<=offset || part.next>=LIBRARY_LIMIT)throw Error('Library chunk exceeded its boundary or made no progress.');chunks.push(bytes);offset=part.next;if(part.done){if(offset!==prep.size)throw Error('Library file bytes were incomplete.');break;}}}finally{await bridge({op:'assetRelease',key:prep.key}).catch(()=>{});}
  const blob=new Blob(chunks,{type:prep.type || f.mime || 'application/octet-stream'});if(f.size!==null && blob.size!==f.size)throw Error('Library file size differs from its metadata.');if(attachmentError(await blob.slice(0,8192).text()))return {status:'unavailable',error:'Library service returned an error envelope instead of file bytes.'};
  const saved=await contentStore.save(blob,f,{maxBytes:LIBRARY_LIMIT-1});localAttachmentIndex=null;return {...saved,mime:prep.type || f.mime,routesTried:prep.attempts || []};
}
async function removeContent(path){let d=root;const parts=path.split('/');for(const p of parts.slice(0,-1))d=await d.getDirectoryHandle(p);await d.removeEntry(parts.at(-1));}
const contentStore=new ContentStore(()=>job,{read:fileAt,write,remove:removeContent,checkpoint:async()=>{await engine?.holdPoint?.();},commit:async()=>{await catalogWriter.report(job,root,true);await report(job);await db.put('jobs',scope.key,job);}});
async function deduplicateFiles(){
  if(running || !canEdit || initializing)return;await ensureLibraryJob();const previous=job.status;running=true;engine={stopped:false,held:false,holdPoint:async()=>{while(engine.held&&!engine.stopped)await sleep(250);if(engine.stopped)throw new Paused('Stopped by you. Verified copies and file links are retained.');}};job.status='running';job.phase='local';job.message='Checking saved files by SHA-256 and comparing version metadata…';update();
  try{const result=await contentStore.deduplicate();localAttachmentIndex=null;job.message=`Smart scan: ${result.checked} local files checked; ${result.linked} references linked to identical content; ${result.removed} duplicate copies removed${result.errors.length?'; '+result.errors.length+' files need inspection':''}. Distinct versions are retained.`;appendEvent(job,job.message,Date.now(),'info','library');job.status=previous==='watching'?'watching':previous || 'ready';}
  catch(e){job.status='paused';job.message=e.message;throw e;}finally{job.phase=null;running=false;engine=null;await db.put('jobs',scope.key,job);await report(job);update();}
}
function renderLibrary(){libraryPanel?.update(job,{running,canEdit,initializing});}

async function reconcileLocalAttachments(){
  if(!job || !root)return {matched:0,checked:0};localAttachmentIndex=null;const inventory=await buildLocalAttachmentIndex();const libraryGranted=await attachmentLibraryReady(false);let matched=0,checked=0;
  for(const entry of Object.values(job.entries || {})){
    if(entry.status!=='saved')continue;const key=`${scope.key}:${entry.id}`;let cached=await db.get('chats',key);if(!cached?.data)cached=await diskRead(entry.id);if(!cached?.data)continue;
    const assets=extractAttachments(cached.data);if(!assets.length)continue;checked+=assets.length;const prior=new Map((entry.attachments || []).map(a=>[String(a.id || a.name),a])),next=[];let unresolvedAuto=false;
    for(const asset of assets){const existing=prior.get(String(asset.id || asset.name));if(existing?.status==='saved' || existing?.status==='unverified'){const validated=await validateSavedAttachment(asset,existing);if(validated){next.push(validated);continue;}existing.status='deferred';existing.autoRetry=true;existing.error='Previously saved attachment is missing or invalid; queued for retrieval.';}const local=await reuseLocalAttachment(asset,entry.basename || entry.id);if(local){next.push(local);matched++;continue;}if(existing){next.push(existing);if(existing.autoRetry!==false && ['deferred','rate-limited'].includes(existing.status))unresolvedAuto=true;}else unresolvedAuto=true;}
    if(next.length)entry.attachments=next;entry.attachmentStateRevision=ATTACHMENT_STATE_REVISION;entry.attachmentPending=unresolvedAuto;entry.attachmentRetryAt=0;
  }
  const source=libraryGranted?'backup + chosen existing-files folder':'backup folder only (no readable existing-files folder selected)';
  job.events ||= [];job.events.push({at:Date.now(),message:`Local attachment reconciliation: ${matched} file${matched===1?'':'s'} reused/copied from disk; ${checked-matched} attachment reference${checked-matched===1?'':'s'} not matched locally. Scanned ${inventory.scanned} permitted file${inventory.scanned===1?'':'s'} from ${source}${inventory.truncated?' (scan cap reached)':''}.`});job.events=job.events.slice(-1500);await db.put('jobs',scope.key,job);await report(job);update();return {matched,checked,scanned:inventory.scanned,libraryGranted};
}
function resetSourcesForScan(reason='Rescanning lists for new / changed chats…') {job.sources=newJob(scope,{archived:$('archived').checked,projects:$('projects').checked}).sources;job.options.archived=$('archived').checked;job.options.projects=$('projects').checked;job.discoveryAudit={round:0,baseline:Object.keys(job.entries || {}).length,stable:false,lastVerifiedAt:job.discoveryAudit?.verifiedAt || 0};job.discoveryUncertain=false;sensed.at=0;job.status='ready';job.message=reason;job.schedule ||= {};job.schedule.fullScanPending=true;job.schedule.lastScanAttemptAt=Date.now();job.schedule.nextScanAt=Date.now()+(job.schedule.intervalMs || 10800000);}
function portableData(j){return {schema:'english-autopilot-portable-state/v1',version:VERSION,exported_at:new Date().toISOString(),scope_key:j.scope.key,job:structuredClone(j),index:indexData(j),note:'Portable queue/index/schedule/adaptive-pacing state. Conversation bodies remain in the backup folder/cache and are not duplicated into this state file.'};}
async function importPortableObject(obj){
  if(!scope)throw new Paused('Connect to ChatGPT before importing state.');let imported;
  if(obj?.schema==='english-autopilot-portable-state/v1' && obj.job)imported=obj.job;
  else if(Array.isArray(obj?.entries)){imported=newJob(scope,{archived:$('archived').checked,projects:$('projects').checked,assist:$('assist').checked,verify:$('verify').checked,attachments:$('attachments').checked,passive:$('passive').checked,passiveHours:Number($('passive-hours').value)||3});for(const e of obj.entries)if(validId(e.id))mergeEntry(imported,{...e,origin:'imported index'});}
  else throw new Error('This is not a v2.3 portable-state or conversation-index JSON file.');
  if(imported.scope?.key && imported.scope.key!==scope.key || obj.scope_key && obj.scope_key!==scope.key)throw new Error('The imported state belongs to a different ChatGPT account/workspace.');
  imported.scope=scope;migrateLoadedJob(imported);imported.version=VERSION;imported.options={...newJob(scope,{}).options,...imported.options};imported.pace={...newJob(scope,{}).pace,...imported.pace,until:Math.max(0,imported.pace?.until || 0),next:Math.max(0,imported.pace?.next || 0)};imported.schedule={...newJob(scope,imported.options).schedule,...imported.schedule};imported.events=(imported.events || []).slice(-1500);imported.recentDone=(imported.recentDone || []).slice(-30);imported.status=imported.status==='running'?'paused':imported.status || 'ready';imported.message='Portable state imported. Existing files/cache will be reused before any conversation is fetched.';
  job=imported;await db.put('jobs',scope.key,job);applyJobOptionsToUI();update();if(root){diskFiles=null;await diskInventory();}await index(job).catch(()=>{});
}
async function start(auto=false,observed=false) {
  if (running) return;if (!connected || !scope) throw new Paused('Connect to ChatGPT first.');await folderReady(!auto);
  const opts={archived:$('archived').checked,projects:$('projects').checked,assist:$('assist').checked,verify:$('verify').checked,attachments:$('attachments').checked,passive:$('passive').checked,passiveHours:Number($('passive-hours').value)||3,yieldUser:$('yield-user').checked,library:$('library-enabled').checked,downloadImages:$('download-images').checked,smartWatch:$('smart-watch').checked,mode:$('work-mode').value};
  if (!job) job=newJob(scope,opts);else Object.assign(job.options,opts);job.schedule ||= newJob(scope,opts).schedule;job.schedule.enabled=opts.passive;job.schedule.intervalMs=opts.passiveHours*3600000;ensureWatchSchedule(job);job.schedule.recentIntervalMs=Number($('recent-check-minutes').value)*60000 || 300000;
  if(!auto)job.schedule.suspended=false;
  addIds();if(opts.library)queueLibraryScan(job);
  if(opts.passive && !job.schedule.suspended && !hasReadyWork(job) && !watchCheckDue(job) && !observed){
    enterWatching(job);await db.put('jobs',scope.key,job);update();return;
  }
  if(!observed && !hasReadyWork(job) && !watchCheckDue(job) && ['complete','incomplete','indexed','watching'].includes(job.status)){if(job.status==='watching')job.status=job.lastRunStatus || 'complete';await db.put('jobs',scope.key,job);update();return;}
  running=true;update();engine=new Engine(job,{save:j=>db.put('jobs',scope.key,j),changed:update,request:async(path,expected,lastLimitSeen)=>{try {return await bridge({op:'get',path,scope:expected,lastLimitSeen});}catch {throw new Paused('The connected ChatGPT tab closed or navigated away. Click Connect, then resume.');}},refresh:async()=>{const r=await bridge({op:'context'});if (!r.ok) throw new Paused(r.error || 'Please sign in to ChatGPT again.');},cacheGet:key=>db.get('chats',key),cachePut:(key,value)=>db.put('chats',key,value),inventory:async s=>[...await db.cacheInventory(s.key),...await diskInventory()],diskRead,sense,write,report:engineReport,index,recover,hash:hashData,attachments:backupAttachments,libraryList:(source,expected)=>bridge({op:'libraryList',source,scope:expected,lastLimitSeen:job.lastLimitSeen || 0}),libraryDownload:downloadLibraryFile,libraryVerify:verifyLibraryFile,libraryLimit:e=>{limited(job.pace,e.retryAfter);recordLimit(job);},online:()=>navigator.onLine});
  try {await engine.run();if(opts.passive && !job.schedule.suspended && ['complete','incomplete','indexed'].includes(job.status)){enterWatching(job);await db.put('jobs',scope.key,job);await report(job);}} finally {running=false;if(job && root)await libraryReport(job);update();}
}
function download(blob,name) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function bind(id,handler) {$(id).addEventListener('click',()=>{notice='';Promise.resolve().then(handler).catch(error);});}
async function passiveTick(){
  if(!job || !scope || !connected || !job.schedule?.enabled || job.schedule.suspended)return;job.schedule.lastTickAt=Date.now();if(passiveBusy || running){update();return;}passiveBusy=true;
  try{
    const now=Date.now();
    if(!navigator.onLine){if(job.schedule.checkState!=='offline'){job.schedule.checkState='offline';job.schedule.checkError='Offline: waiting for an internet connection.';appendEvent(job,'Offline: network watcher deferred; saved files and queue retained.',now,'warn','network');await db.put('jobs',scope.key,job);}update();return;}
    const libraryDue=queueLibraryScan(job,now);
    if(queueFullScanIfDue(job,now)){await db.put('jobs',scope.key,job);await start(true,true);return;}
    const snapshots=await sense(scope);job.schedule.lastTelemetryAt=now;job.schedule.observedTabs=snapshots.length;
    const recentDue=watchCheckDue(job,now) && now>=Math.max(job.pace.until || 0,job.pace.next || 0,job.schedule.checkWaitUntil || 0);
    if(libraryDue || recentDue || hasObservedWork(job,snapshots) || hasReadyWork(job,now)){job.schedule.lastTelemetryAt=now;job.status='ready';job.message='Passive observation found new, changed, or due work; resuming the saved queue…';await db.put('jobs',scope.key,job);await start(true,true);}else if(job.status!=='watching'){enterWatching(job,now);await db.put('jobs',scope.key,job);update();}
  }catch(e){job.message=`Passive watcher deferred: ${e.message || e}`;await db.put('jobs',scope.key,job).catch(()=>{});update();}finally{passiveBusy=false;}
}
async function init() {
  logPanel=new LogPanel(document,{download,onError:error});
  libraryPanel=new LibraryPanel(document,{onError:error,retry:async id=>{if(running || !canEdit || initializing)return;await ensureLibraryJob();if(!retryLinkedFile(job,job.library.entries[id] || Object.values(job.fileLinks?.sources || {}).find(f=>f.sourceKey===id || f.id===id)))return;await db.put('jobs',scope.key,job);await report(job);update();await start(false,true);}});
  bind('library-deduplicate',deduplicateFiles);
  bind('library-scan',async()=>{await ensureLibraryJob();queueLibraryScan(job,Date.now(),true);await db.put('jobs',scope.key,job);await start(false,true);});
  bind('library-retry',async()=>{await ensureLibraryJob();for(const f of fileReferences(job))if(f.parked || ['unavailable','permission-unavailable'].includes(f.status))retryLinkedFile(job,f);await db.put('jobs',scope.key,job);await report(job);await start(false,true);});
  bind('library-index',()=>{if(job)download(new Blob([JSON.stringify(libraryIndex(job),null,2)],{type:'application/json'}),'chatgpt-library-index.json');});
  bind('library-manual',()=>{if(job)download(new Blob([catalogHTML(job,true)],{type:'text/html'}),'chatgpt-library-manual-downloads.html');});

  addEventListener('online',()=>{if(job?.schedule){job.schedule.checkError=null;job.schedule.checkWaitUntil=0;}void passiveTick();});
  update();
  bind('connect',async()=>{connecting=true;update();try{await connect();}finally{connecting=false;update();}});
  bind('folder',async()=>{if (!scope) throw new Paused('Connect to ChatGPT first.');const next=await showDirectoryPicker({mode:'readwrite',id:'chatgpt-backup'}),previous=folder;folder=next;root=null;localAttachmentIndex=null;diskFiles=null;diskIndexEntries=null;await db.put('meta',`folder:${scope.key}`,folder);await folderReady();if (job && (!previous || !(await previous.isSameEntry(next)))) {for (const e of Object.values(job.entries)) if(e.status==='saved') {e.status='pending';e.retryAt=0;}for(const f of Object.values(job.library?.entries || {}))if(f.status==='saved'){f.status='pending';f.retryAt=0;}job.status='ready';job.message='Folder changed. Valid JSON files/cache will be reused before any server retrieval.';await db.put('jobs',scope.key,job);}update();});
  bind('attachment-library',async()=>{if(!scope)throw new Paused('Connect to ChatGPT first.');attachmentLibrary=await showDirectoryPicker({mode:'read',id:'chatgpt-existing-files'});localAttachmentIndex=null;await db.put('meta',`attachmentLibrary:${scope.key}`,attachmentLibrary);await attachmentLibraryReady(true);if(job){if(!root)try{await folderReady(false);}catch{}if(root){job.message='Scanning your chosen local files folder for existing attachment matches…';update();await reconcileLocalAttachments();}else{job.message='Existing files folder saved. Grant the backup-folder permission or press Start; local attachment matching will run before any missing file uses the network.';await db.put('jobs',scope.key,job);update();}}else update();});
  bind('repair-attachments',async()=>{
    if(!job || !connected)throw new Paused('Connect to ChatGPT first.');await folderReady(true);
    let queued=0;for(const e of Object.values(job.entries || {}))if(repairAttachmentEntry(e,true))queued++;
    job.options.attachments=true;$('attachments').checked=true;job.status='ready';localAttachmentIndex=null;job.attachmentRepairGeneration=(job.attachmentRepairGeneration || 0)+1;
    job.message=`Attachment repair queued for ${queued} chats using saved JSON. Valid files are reused; error responses are preserved under attachment-errors before retrying.`;
    job.events ||= [];job.events.push({at:Date.now(),message:job.message});job.events=job.events.slice(-1500);
    await db.put('jobs',scope.key,job);await report(job);update();await start();
  });
  bind('start',()=>start());bind('hold',async()=>{if(!running || !engine)return;engine.held=!engine.held;job.status=engine.held?'held':'running';job.message=engine.held?'Held in place. The live worker, queue position, discovery cursors, and connection stay open; no new network work starts until you resume.':'Resuming the same live run exactly where it was held.';job.events ||= [];job.events.push({at:Date.now(),message:job.message});job.events=job.events.slice(-1500);await db.put('jobs',scope.key,job);update();});bind('pause',async()=>{if(job?.schedule)job.schedule.suspended=true;if(!running && job){job.status='paused';job.message='Passive watch stopped. Queue, saved files and discovery cursors are retained. Press Start to resume watching.';Object.assign(job.awareness ||= {},{state:'paused',reason:job.message,waitUntil:0});await db.put('jobs',scope.key,job);update();return;}if(engine){engine.stopped=true;job.status='pausing';job.message='Stopping the active run after the current request / disk write…';await db.put('jobs',scope.key,job);update();}});
  bind('retry',async()=>{if (!job) return;const now=Date.now();let parked=0,requeued=0;if(job.discoveryUncertain){job.sources=newJob(scope,job.options).sources;job.discoveryAudit={round:0,baseline:Object.keys(job.entries || {}).length,stable:false};job.discoveryUncertain=false;}for (const e of Object.values(job.entries)){if(e.status==='failed'){if((e.brokenUntil || 0)>now){parked++;}else{e.status='pending';e.attempts=0;e.retryAt=0;e.recoveryAttempted=false;e.brokenUntil=0;requeued++;}}if(e.attachmentPending){e.attachmentRetryAt=0;e.attachmentScannedAt=0;}}for (const s of job.sources) if(s.error){s.error=null;s.done=false;s.seenPages=[];s.uniqueIds=[];s.emptyChecks=0;s.failures=0;s.reportedTotal=0;if(s.kind==='list')s.offset=0;else s.cursor=s.kind==='project'?'0':null;}job.status='ready';job.message=`Requeued ${requeued} unresolved chat${requeued===1?'':'s'}; ${parked} hard failure${parked===1?'':'s'} checked within the last 7 days stayed parked. Transient attachment retries were reopened; hard attachment failures stay retired.`;await db.put('jobs',scope.key,job);await start();});
  bind('scan',async()=>{if (!job) return;resetSourcesForScan();await db.put('jobs',scope.key,job);await start();});
  bind('add',async()=>{if(!scope) throw new Paused('Connect first.');if(!job) job=newJob(scope,{archived:$('archived').checked,projects:$('projects').checked,assist:$('assist').checked,verify:$('verify').checked,attachments:$('attachments').checked,passive:$('passive').checked,passiveHours:Number($('passive-hours').value)||3});addIds();job.status='ready';job.message='Added links to the queue. Click Start / resume.';await db.put('jobs',scope.key,job);update();});
  bind('report',async()=>{if(job) download(new Blob([JSON.stringify(reportData(job),null,2)],{type:'application/json'}),'export-report.json');});bind('index',async()=>{if(job)download(new Blob([JSON.stringify(indexData(job),null,2)],{type:'application/json'}),'conversation-index.json');});
  bind('export-state',async()=>{if(job)download(new Blob([JSON.stringify(portableData(job),null,2)],{type:'application/json'}),`chatgpt-exporter-portable-state-${new Date().toISOString().slice(0,10)}.json`);});bind('import-state',()=>$('state-file').click());$('state-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;await importPortableObject(JSON.parse(await file.text()));e.target.value='';});
  bind('zip',async()=>{if (!job) throw new Error('There are no cached chats yet.');$('zip').disabled=true;try {const zip=new JSZip();let n=0,bytes=0;for (const e of Object.values(job.entries)) {const record=await db.get('chats',`${scope.key}:${e.id}`);if(!record)continue;const json=JSON.stringify(record.data,null,2),md=markdown(record.data,e.id);bytes+=new TextEncoder().encode(json+md).length;if(bytes>250*1024*1024)throw new Error('The backup is too large for a memory-based ZIP. Your individual folder files remain available. Use Windows to compress the backup folder after the export finishes.');const name=e.basename || e.id;zip.file(`json/${name}.json`,json);zip.file(`markdown/${name}.md`,md);n++;}if(!n)throw new Error('No conversation data has been cached yet.');zip.file('export-report.json',JSON.stringify({...reportData(job),zip_cached_count:n},null,2));zip.file('conversation-index.json',JSON.stringify(indexData(job),null,2));zip.file('portable-state.json',JSON.stringify(portableData(job),null,2));download(await zip.generateAsync({type:'blob',compression:'DEFLATE'}),`chatgpt-cached-${n}-${new Date().toISOString().slice(0,10)}.zip`);} finally {$('zip').disabled=false;}});
  for(const id of ['passive','passive-hours','recent-check-minutes','attachments','download-images','library-enabled','smart-watch'])$(id).addEventListener('change',async()=>{if(!job)return;job.options.downloadImages=$('download-images').checked;if(id==='download-images')applyImagePreference(job);if(id==='download-images'&&job.options.downloadImages)for(const e of Object.values(job.entries || {}))if(e.status==='saved'){e.attachmentPending=true;e.attachmentRetryAt=0;e.attachmentScannedAt=0;}job.options.library=$('library-enabled').checked;job.options.smartWatch=$('smart-watch').checked;job.options.passive=$('passive').checked;job.options.passiveHours=Number($('passive-hours').value)||3;job.options.attachments=$('attachments').checked;job.options.yieldUser=$('yield-user').checked;job.schedule ||= newJob(scope,job.options).schedule;job.schedule.enabled=job.options.passive;if(id==='passive')job.schedule.suspended=!job.options.passive;job.schedule.intervalMs=job.options.passiveHours*3600000;if(id==='passive-hours' || id==='passive' && job.options.passive)job.schedule.nextScanAt=Date.now()+job.schedule.intervalMs;if(id==='recent-check-minutes'){job.schedule.recentIntervalMs=Number($('recent-check-minutes').value)*60000;job.schedule.nextCheckAt=Date.now();}job.updated=Date.now();update();try{await db.put('jobs',scope.key,job);if(root)await report(job);}catch(e){error(e);}update();});
  $('yield-user').addEventListener('change',()=>{if(!job){update();return;}job.message=setUserYield(job,$('yield-user').checked);engine?.wake?.();update();void db.put('jobs',scope.key,job).catch(error);});
  tabId=(await chrome.storage.session.get('exporterTabId')).exporterTabId;scope=await db.get('meta','lastScope');if (scope) {job=await db.get('jobs',scope.key);if(migrateLoadedJob(job))await db.put('jobs',scope.key,job);folder=await db.get('meta',`folder:${scope.key}`);attachmentLibrary=await db.get('meta',`attachmentLibrary:${scope.key}`) || null;}initializing=false;applyJobOptionsToUI();update();setInterval(update,1000);setInterval(passiveTick,60000);chrome.runtime.onMessage.addListener(msg=>{if(msg?.type==='passive-tick')void passiveTick();});
  if (job?.status==='running' || job?.status==='watching' && job.schedule?.enabled && !job.schedule.suspended) {try {running=true;const restoring=engine={stopped:false};if(restoring.stopped)throw new Paused('Paused by you.');await connect(scope.key);if(restoring.stopped)throw new Paused('Paused by you.');running=false;await start(true);} catch(e){if(job){job.status='paused';job.message=`Saved progress found. ${e.message}`;await db.put('jobs',scope.key,job);}}finally{running=false;update();}}
  else if (job?.status==='pausing' || job?.status==='held') {job.status='paused';job.message='The previous live hold/run is no longer in memory, but its exact queue/cursors are preserved. Click Connect, then resume; no scan reset is performed.';await db.put('jobs',scope.key,job);update();}
}
navigator.locks.request('english-exporter-dashboard',{ifAvailable:true},async lock=>{if(!lock){canEdit=false;update();$('message').textContent='Another exporter tab is already open. Continue there, or close it and reload this tab.';return;}await init();await new Promise(()=>{});}).catch(error);
