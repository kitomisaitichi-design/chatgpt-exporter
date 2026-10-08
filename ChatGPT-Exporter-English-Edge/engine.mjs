import {localStorageFailure} from './local-io.mjs';
import {seedFileSources,observeFileSource,observeChatFiles,fileReferences,sharedFileBudget,markChatSourceUnavailable,createFileLookup} from './file-links.mjs';
import {pickWork,beginWork,finishWork,assetsMustYield,schedulerState,libraryPolicy} from './work-scheduler.mjs';
import {libraryState,queueLibraryScan,libraryWork,processLibrary,mergeLibraryItem,normalizeLibraryItem} from './library.mjs';
import {appendEvent} from './logs.mjs';
import {VERSION,WEEKLY_BROKEN_MS,counts, limited, succeeded, relaxIdle, sourcePath, ingestPage, conversationValid, safeName, markdown,mergeEntry,validId,calendarTime,conversationTime,classifyConversation,extractAttachments,epoch} from './core.mjs';
import {awareness,observeActivity,decide,recordAction,recordLimit,recordSuccess} from './awareness.mjs';
import {mergeInventoryAttachments,ATTACHMENT_STATE_REVISION} from './attachment-state.mjs';
import {watchCheckDue,queueFullScanIfDue,recentWatchSources,ensureWatchSchedule} from './watch.mjs';
export class Paused extends Error {constructor(...args){super(...args);this.name='Paused';}}
export class YieldAttachments extends Error {constructor(...args){super(...args);this.name='YieldAttachments';}}
export class RequestError extends Error {constructor(status, message) {super(message || `ChatGPT returned HTTP ${status}`);this.status=status;}}
export class Engine {
  constructor(job, io) {this.job=job;seedFileSources(job,(io.now || Date.now)());this.io=io;this.stopped=false;this.held=false;this.wakeRevision=0;this.cachedIds=new Set();this.now=io.now || Date.now;this.sleep=io.sleep || (ms=>new Promise(r=>setTimeout(r,ms)));}
  async save() {this.job.updated=this.now();await this.io.save(this.job);this.io.changed?.(this.job);}
  async holdPoint(){while(this.held){if(this.stopped)throw new Paused('Paused by you.');await this.sleep(400);}if(this.stopped)throw new Paused('Paused by you.');}
  event(message,level,category) {appendEvent(this.job,message,this.now(),level,category);}
  wake(){this.wakeRevision++;}
  async wait(until, label) {const revision=this.wakeRevision;while (this.now()<until&&revision===this.wakeRevision) {await this.holdPoint();await this.io.maintenance?.();this.job.message=label;this.io.changed?.(this.job);await this.sleep(Math.min(1000,Math.max(0,until-this.now())));}await this.holdPoint();}
  async observe() {
    if(!this.io.sense)return [];
    const snapshots=await this.io.sense(this.job.scope);let changed=queueFullScanIfDue(this.job,this.now());
    if(this.io.libraryList && this.job.options.library && queueLibraryScan(this.job,this.now())){this.event('Scheduled Library inventory queued.','info','library');await this.save();}
    if(this.job.schedule?.enabled){this.job.schedule.lastTelemetryAt=this.now();this.job.schedule.observedTabs=snapshots.length;}
    if(changed)this.event('Scheduled full scan queued at its fixed deadline.');
    for(const s of snapshots){
      if(this.io.libraryList && this.job.options.library)for(const observed of s.libraryObservations || (s.libraryItems || []).map(item=>({item,at:null}))){const item=normalizeLibraryItem(observed.item);if(item){const prior=this.job.library?.entries?.[item.id];if(observed.at!=null&&prior?.lastPassiveDocument===s.documentId&&prior.lastPassiveObservationAt>=observed.at)continue;changed=mergeLibraryItem(libraryState(this.job),item,this.now())||changed;if(!item.directory){const file=this.job.library.entries[item.id];file.lastPassiveObservationAt=observed.at;file.lastPassiveDocument=s.documentId;observeFileSource(this.job,file,'library',null,this.now());}}}
      for(const c of s.captured || [])this.cachedIds.add(c.id);
      for(const item of s.hints || [])changed=mergeEntry(this.job,item)||changed;
      for(const item of s.changedChats || []){
        if(!validId(item.id) || !item.revision || this.job.entries[item.id]?.nativeWriteRevision===item.revision)continue;
        mergeEntry(this.job,{id:item.id,origin:'completed ChatGPT reply'});
        Object.assign(this.job.entries[item.id],{nativeWriteRevision:item.revision,nativeWriteAt:item.at,status:'pending',refresh:true,attempts:0,retryAt:0,brokenUntil:0,changeReason:'ChatGPT reply completed'});changed=true;
        this.event('Completed ChatGPT reply queued for backup.');
      }
      for(const item of s.changedBodies || []){
        const existing=this.job.entries[item.id];
        if(existing?.observedBodyHash===item.contentHash || existing?.contentHash===item.contentHash)continue;
        mergeEntry(this.job,item);const e=this.job.entries[item.id];this.cachedIds.add(item.id);const baseline=e?.contentHash || item.previousContentHash || null;
        if(e)e.observedBodyHash=item.contentHash;
        if(e && !e.contentHash && baseline)e.contentHash=baseline;
        if(e && e.status==='saved' && item.contentHash && baseline && item.contentHash!==baseline){Object.assign(e,{status:'pending',refresh:false,retryAt:0,attempts:0,changeReason:'passively observed conversation body changed'});changed=true;}
      }
      const routes=s.fileRoutes || [];if(routes.length){const byId=new Map(routes.map(r=>[r.id,r]));for(const e of Object.values(this.job.entries)){if(e.status!=='saved' || !Array.isArray(e.attachments))continue;const matching=e.attachments.filter(a=>a.id && byId.has(a.id) && ['unavailable','permission-unavailable'].includes(a.status));if(!matching.length)continue;const newest=Math.max(...matching.map(a=>byId.get(a.id)?.at || 0));if(newest>(e.attachmentRouteWakeAt || 0)){e.attachmentRouteWakeAt=newest;e.attachmentPending=true;e.attachmentRetryAt=0;e.attachmentScannedAt=0;changed=true;}}}
      if(this.job.options.projects)for(const p of s.projects || [])if(validId(p.id) && !this.job.sources.some(source=>source.key===p.id)){this.job.sources.push({key:p.id,kind:'project',title:p.title,cursor:'0',done:false,seenPages:[],emptyChecks:0});changed=true;}
    }
    const limit=observeActivity(this.job,snapshots,this.now());
    if(limit){this.job.lastLimitSeen=limit.at;limited(this.job.pace,limit.retryAfter,this.now(),Math.random(),'app');recordLimit(this.job);this.event(`Observed a ChatGPT limit signal; adaptive pacing stepped up to tier ${this.job.pace.tier || 0}.`);await this.save();}
    else {const before=this.job.pace.tier || 0;if(relaxIdle(this.job.pace,this.now()) && (this.job.pace.tier || 0)<before){this.event(`Quiet-time decay stepped pacing down to tier ${this.job.pace.tier}.`);await this.save();}}
    if(changed && this.job.schedule?.enabled){this.job.schedule.quietChecks=0;this.job.schedule.effectiveRecentIntervalMs=this.job.schedule.recentIntervalMs || 300000;}
    if(changed){if(this.job.status==='complete' || this.job.status==='indexed')this.job.status='ready';await this.save();await this.io.index?.(this.job);}
    return snapshots;
  }
  async reconcileInventory(items=[]) {
    let diskSaved=0,indexOnly=0,cacheOnly=0;this.job.phase='local';this.job.message='Reconciling the existing backup locally — no ChatGPT requests are being made.';this.io.changed?.(this.job);
    for(const item of items){
      const before={...this.job.entries[item.id]},wasRefresh=!!before.refresh;mergeEntry(this.job,{...item,localDetected:true});const e=this.job.entries[item.id];if(!e)continue;
      if(item.checkedUpdateTime && epoch(item.checkedUpdateTime)>epoch(e.checkedUpdateTime))e.checkedUpdateTime=item.checkedUpdateTime;
      if(item.basename && !e.basename)e.basename=item.basename;if(item.contentHash && !e.contentHash)e.contentHash=item.contentHash;if(item.previousContentHash && !e.previousContentHash)e.previousContentHash=item.previousContentHash;if(item.revisionCount)e.revisionCount=Math.max(e.revisionCount || 0,item.revisionCount);if(item.changedAt)e.changedAt=e.changedAt || item.changedAt;if(item.savedAt)e.savedAt=e.savedAt || item.savedAt;if(item.chatKind && !e.chatKind)e.chatKind=item.chatKind;if(item.chatKindEvidence && !e.chatKindEvidence)e.chatKindEvidence=item.chatKindEvidence;if(item.project)e.project=e.project || item.project;mergeInventoryAttachments(e,item);
      if(Array.isArray(item.foundVia))e.foundVia=[...new Set([...(e.foundVia || []),...item.foundVia])];
      const replyPending=wasRefresh && before.changeReason!=='newer server update timestamp';
      const pendingBody=before.status==='pending' && !wasRefresh && (before.changeReason==='passively observed conversation body changed'&&before.observedBodyHash&&before.observedBodyHash!==item.contentHash || before.contentHash && before.contentHash!==item.contentHash && epoch(item.update_time)<=epoch(before.update_time));
      const covers=Math.max(epoch(item.update_time),epoch(item.checkedUpdateTime))>=epoch(e.update_time) || !wasRefresh&&(before.status==='saved'||before.localPreviouslySaved)&&before.contentHash&&before.contentHash===item.contentHash;
      const verifiedPending=item.validated && item.contentHash && covers && !replyPending && !pendingBody;
      if(item.localRewrite){this.cachedIds.add(item.id);cacheOnly++;if(verifiedPending || !wasRefresh&&!e.refresh&&covers&&!pendingBody){e.status='pending';e.retryAt=0;e.refresh=false;e.localDetectedRewrite=true;e.changeReason=null;}}
      else if(item.diskBacked){this.cachedIds.add(item.id);if(verifiedPending || !wasRefresh && !e.refresh && before.status!=='pending'){if(e.status!=='saved')diskSaved++;e.status='saved';e.error=null;e.retryAt=0;e.refresh=false;e.changeReason=null;if(item.basename)e.basename=item.basename;if(item.contentHash)e.contentHash=item.contentHash;if(!e.savedAt)e.savedAt=this.now();}}
      else if(item.cacheBacked){this.cachedIds.add(item.id);cacheOnly++;}
      else indexOnly++;
    }
    this.job.phase=null;if(diskSaved || indexOnly || cacheOnly)this.event(`Local recovery: ${diskSaved} existing transcript files credited as already saved; ${indexOnly} index-only links retained; ${cacheOnly} cache-only bodies available for local rewrite.`);
    await this.save();await this.io.index?.(this.job);
  }
  async gate(kind='read') {
    if(!this.io.sense){await this.wait(Math.max(this.job.pace.until,this.job.pace.next),'Waiting before the next request…');return;}
    const a=awareness(this.job),waitingSince=this.now();
    for(;;){
      await this.holdPoint();
      if(this.io.online && !this.io.online()){a.state='offline';a.reason='Internet connection is offline. Local progress is safe; network work resumes when online.';a.waitUntil=this.now()+30000;await this.wait(a.waitUntil,a.reason);continue;}
      const snapshots=await this.observe(),decision=decide(this.job,snapshots,kind,this.now(),waitingSince);
      if(kind==='asset' && assetsMustYield(this.job,this.now()))throw new YieldAttachments('Attachment wait yielded to queued chat updates.');
      a.state=decision.state;a.reason=decision.reason;a.waitUntil=decision.until;this.job.message=decision.reason;this.io.changed?.(this.job);
      if(decision.attention)throw new Paused(decision.reason);if(decision.probeRequired)return false;
      if(!decision.until){recordAction(this.job,kind,this.now());if(decision.gentle)a.probe=true;await this.save();return true;}
      await this.wait(Math.min(decision.until,this.now()+5000),decision.reason);
    }
  }
  async paceRequest(kind='read') {const ok=await this.gate(kind);if(ok===false)return false;this.job.pace.next=this.now()+this.job.pace.delay;await this.save();return true;}
  async request(path) {
    let serverErrors=0, authRefresh=false;const requestedAt=this.now(),detailId=path.match(/^\/backend-api\/conversation\/([a-zA-Z0-9_-]+)$/)?.[1];
    for (;;) {
      await this.paceRequest(path.includes('/conversations?') || path.includes('/sidebar?') ? 'discovery':'read');
      if(detailId && this.io.sense){const observed=await this.io.cacheGet(`${this.job.scope.key}:${detailId}`);if(observed?.passive && observed.at>=requestedAt && conversationValid(observed.data,detailId))return observed.data;}
      const result=await this.io.request(path,this.job.scope,this.job.lastLimitSeen || 0);(this.job.responses ||= []).push({at:this.now(),kind:detailId?'conversation':'discovery',status:result.status || (result.ok?200:0)});this.job.responses=this.job.responses.slice(-40);
      if (result.ok) {const before=this.job.pace.tier || 0;succeeded(this.job.pace,this.now());recordSuccess(this.job,this.now());if((this.job.pace.tier || 0)<before)this.event(`Sustained quiet success stepped pacing down to tier ${this.job.pace.tier}.`);await this.save();return result.data;}
      if (result.status===429) {this.job.lastLimitSeen=Math.max(this.job.lastLimitSeen || 0,result.observedAt || 0);limited(this.job.pace,result.retryAfter,this.now(),Math.random(),result.observedAt?'app':'exporter');recordLimit(this.job);this.event(`Rate limit: progress saved; adaptive pacing is now tier ${this.job.pace.tier || 0}.`);this.job.message='Rate limited — waiting automatically.';await this.save();continue;}
      if (result.status===401 && !authRefresh) {authRefresh=true;await this.io.refresh();continue;}
      if ([401,403,409].includes(result.status)) throw new Paused(result.error || (result.status===409 ? 'The account or workspace changed. Reconnect to the original workspace.' : 'Sign in or complete the browser check in the ChatGPT tab, then resume.'));
      if (!result.status || (result.status>=500 && !result.kind)) {if (++serverErrors>=3) throw new RequestError(result.status || 503,'Repeated network/server errors; deferred this item so other work can continue.');this.job.pace.until=Math.max(this.job.pace.until,this.now()+Math.min(300000,15000*2**serverErrors));this.event(result.status ? 'Temporary server error; retrying after a pause.' : 'Connection interrupted; waiting and retrying automatically.');await this.save();continue;}
      if(awareness(this.job).probe && [400,404,410,412,422].includes(result.status)){Object.assign(awareness(this.job),{probe:false,probeRest:this.now()+30000});await this.save();}
      throw new RequestError(result.status,result.error);
    }
  }
  async process(entry) {
    const requestedUpdateTime=entry.update_time;
    this.job.message=`Preparing: ${entry.title}`;await this.save();const key=`${this.job.scope.key}:${entry.id}`;let cached=entry.localDetectedRewrite&&!entry.refresh&&this.io.diskRead?await this.io.diskRead(entry.id):await this.io.cacheGet(key), data,usedLocal=false;
    if(!cached && this.io.diskRead){cached=await this.io.diskRead(entry.id);if(cached){entry.basename=cached.basename;await this.io.cachePut(key,cached);this.cachedIds.add(entry.id);}}
    if(cached?.data && !entry.contentHash)entry.contentHash=cached.hash || await this.io.hash(cached.data);
    if(cached?.data && !entry.refresh && !entry.localDetectedRewrite && !entry.localPreviouslySaved && epoch(cached.data.update_time)<epoch(entry.update_time) && epoch(entry.checkedUpdateTime)<epoch(entry.update_time))cached=null;
    // Recovery must not fall back to an older body after reconciliation kept
    // a newer pending revision. A matching cache can still finish it locally.
    if(cached?.data && !entry.refresh && !entry.localDetectedRewrite && entry.contentHash){const expected=entry.changeReason==='passively observed conversation body changed'?entry.observedBodyHash || entry.contentHash:entry.contentHash;if((cached.hash || await this.io.hash(cached.data))!==expected)cached=null;}
    if (cached && !entry.refresh) {data=cached.data;usedLocal=true;}
    else if(cached && entry.refresh && cached.passive && cached.data.update_time && cached.data.update_time===entry.update_time && (!entry.nativeWriteAt || cached.at>=entry.nativeWriteAt)){data=cached.data;usedLocal=true;}
    if (!data) {
      try {data=await this.request(`/backend-api/conversation/${encodeURIComponent(entry.id)}`);}
      catch (error) {
        if (!(error instanceof RequestError)) throw error;
        if ([404,412].includes(error.status) && this.job.options.assist && !entry.recoveryAttempted) {
          if(this.io.sense){const plan=decide(this.job,await this.observe(),'navigation',this.now());if(plan.attention)throw new Paused(plan.reason);const otherWork=Object.values(this.job.entries).some(e=>e!==entry && e.status==='pending' && (!e.retryAt || e.retryAt<=this.now())) || this.job.sources.some(s=>!s.done&&!s.error);if(plan.until>this.now() && otherWork){entry.retryAt=plan.until;if(!entry.recoveryDeferredLogged){this.event(`Difficult-chat recovery queued once for later: ${entry.title}. Other work can continue.`);entry.recoveryDeferredLogged=true;}await this.save();return;}}
          entry.recoveryAttempted=true;entry.recoveryDeferredLogged=false;this.job.message=`Opening a difficult chat once: ${entry.title}`;await this.save();if(await this.gate('navigation')===false){entry.retryAt=this.now()+1000;await this.save();return;}
          const recovery=await this.io.recover(entry.id,this.job.scope,()=>this.stopped);
          if (recovery?.limit) {this.job.lastLimitSeen=Math.max(this.job.lastLimitSeen || 0,recovery.limit.at);limited(this.job.pace,recovery.limit.retryAfter,this.now(),Math.random(),'app');recordLimit(this.job);await this.save();}data=recovery?.data;
        }
        if (!data) {const now=this.now(),hard=[400,404,410,412,422].includes(error.status);entry.attempts=(entry.attempts || 0)+1;entry.error=error.message;entry.lastFailureAt=now;entry.lastFailureStatus=error.status || 0;if(hard){if([404,410].includes(error.status))markChatSourceUnavailable(this.job,entry.id,error.status,this.now());entry.status='failed';entry.retryAt=0;entry.brokenUntil=now+WEEKLY_BROKEN_MS;this.event(`Needs attention (parked 7 days): ${entry.title} — ${entry.error}`);}else{entry.status=entry.attempts<3?'pending':'failed';entry.retryAt=now+Math.min(600000,60000*entry.attempts);this.event(`${entry.status==='failed'?'Needs attention':'Deferred'}: ${entry.title} — ${entry.error}`);}await this.save();return;}
      }
      if (!conversationValid(data,entry.id)) {entry.status='failed';entry.error='Unexpected conversation format or mismatched conversation ID.';this.event(`${entry.title}: ${entry.error}`);await this.save();return;}
    }
    this.job.phase=usedLocal?'local':'network';this.job.message=usedLocal?`Writing existing local backup: ${entry.title}`:`Saving downloaded chat: ${entry.title}`;this.io.changed?.(this.job);
    const contentHash=await this.io.hash(data);const oldHash=entry.contentHash || null;
    observeChatFiles(this.job,entry.id,extractAttachments(data),this.now());
    if(oldHash && oldHash!==contentHash){if(this.job.options.attachments!==false){entry.attachmentPending=true;entry.attachmentRetryAt=0;entry.attachmentScannedAt=0;}entry.previousContentHash=oldHash;entry.revisionCount=(entry.revisionCount || 0)+1;entry.changedAt=this.now();this.event(`Changed chat detected — overwriting the previous export: ${entry.title}`);}
    entry.contentHash=contentHash;entry.create_time=entry.create_time || data.create_time || conversationTime(data) || null;
    // List metadata can be newer than the detail payload. A successful read has
    // checked that version; never downgrade it and queue the same read forever.
    entry.checkedUpdateTime=epoch(requestedUpdateTime)>epoch(entry.checkedUpdateTime)?requestedUpdateTime:entry.checkedUpdateTime;
    if(epoch(data.update_time)>epoch(entry.update_time))entry.update_time=data.update_time;
    const classification=classifyConversation(data,entry);entry.chatKind=classification.kind;entry.chatKindEvidence=classification.evidence;
    await this.io.cachePut(key,{data,at:this.now(),hash:contentHash,passive:false});this.cachedIds.add(entry.id);entry.refresh=false;await this.save();
    const basename=entry.basename || `${safeName(data.title || entry.title,65)}_${entry.id}`;
    await this.io.write(`json/${basename}.json`,JSON.stringify(data,null,2));await this.io.write(`markdown/${basename}.md`,markdown(data,entry.id));
    // Attachment retrieval is deliberately a later network phase. Finish chat
    // discovery/transcript backup first so attachment waits cannot stall it.
    if(this.job.options.attachments!==false && !entry.attachmentScannedAt)entry.attachmentPending=true;
    entry.basename=basename;entry.status='saved';entry.savedAt=this.now();entry.error=null;entry.retryAt=0;entry.refresh=false;entry.localDetectedRewrite=false;entry.localPreviouslySaved=false;entry.recoveryDeferredLogged=false;entry.changeReason=null;
    this.job.recentDone.push(this.now());this.job.recentDone=this.job.recentDone.slice(-30);this.job.phase=null;this.event(`${usedLocal?'Recovered/wrote local backup':'Downloaded'}: ${entry.title}`);await this.save();await this.io.report(this.job);
  }
  async processAttachments(entry) {
    this.attachmentTurnSaved=false;const savedBefore=new Set((entry.attachments || []).filter(f=>f.status==='saved').map(f=>`${f.id}:${f.path}:${f.sha256}`));
    entry.attachmentStateRevision=ATTACHMENT_STATE_REVISION;
    const key=`${this.job.scope.key}:${entry.id}`;let cached=await this.io.cacheGet(key);if(!cached?.data && this.io.diskRead)cached=await this.io.diskRead(entry.id);
    if(!cached?.data){entry.attachmentPending=false;entry.attachmentScannedAt=this.now();await this.save();return;}
    const eligible=extractAttachments(cached.data);observeChatFiles(this.job,entry.id,eligible,this.now());
    if(!eligible.length){entry.attachmentPending=false;entry.attachmentRetryAt=0;entry.attachmentScannedAt=this.now();await this.save();await this.io.report(this.job);return;}
    this.job.phase='attachments';this.job.message=`Retrieving ${eligible.length} eligible attachment${eligible.length===1?'':'s'}: ${entry.title}`;await this.save();
    try {
      const urgent=()=>assetsMustYield(this.job,this.now());
      const attachments=await this.io.attachments(entry,cached.data,entry.basename || entry.id,async()=>{await this.observe();if(urgent())throw new YieldAttachments('Attachment work yielded to queued chat updates.');if(await this.paceRequest('asset')===false)throw new Paused('A read check is required before attachment recovery.');if(urgent())throw new YieldAttachments('Attachment work yielded to queued chat updates.');},{maxTransfers:1,maxItems:25});
      if(attachments.length)entry.attachments=attachments;this.attachmentTurnSaved=attachments.some(f=>f.status==='saved'&&!savedBefore.has(`${f.id}:${f.path}:${f.sha256}`));entry.attachmentStateRevision=ATTACHMENT_STATE_REVISION;const retryable=attachments.filter(a=>a.status==='rate-limited' || a.status==='deferred');entry.attachmentPending=retryable.length>0;entry.attachmentRetryAt=entry.attachmentPending?this.now()+(attachments.some(a=>a.batchPending)?0:attachments.some(a=>a.yielded)?60000:attachments.some(a=>a.status==='rate-limited')?120000:6*3600000):0;entry.attachmentScannedAt=this.now();
      if(attachments.length){const local=attachments.filter(a=>a.status==='saved' && a.source!=='network').length,network=attachments.filter(a=>a.status==='saved' && a.source==='network').length,unavailable=attachments.filter(a=>['unavailable','permission-unavailable'].includes(a.status)).length,large=attachments.filter(a=>a.status==='skipped-too-large').length,deferred=retryable.length;if(network){const before=this.job.pace.tier || 0;for(let i=0;i<network;i++){succeeded(this.job.pace,this.now());recordSuccess(this.job,this.now());}if((this.job.pace.tier || 0)<before)this.event(`Successful attachment reads stepped pacing down to tier ${this.job.pace.tier}.`);}this.event(`Attachment pass: ${entry.title} — ${local} local, ${network} downloaded, ${unavailable} unavailable${large?`, ${large} too large`:''}${deferred?`, ${deferred} retryable`:''}.`);}else this.event(`Attachment pass: ${entry.title} — no eligible files.`);
    } catch(e){if(e instanceof Paused || localStorageFailure(e))throw e;entry.attachmentPending=true;entry.attachmentRetryAt=this.now()+6*3600000;entry.attachmentScannedAt=this.now();this.event(`Attachment pass transiently deferred: ${entry.title} — ${e.message || e}`);}
    entry.attachmentLastTurnAt=this.now();this.job.phase=null;await this.save();await this.io.report(this.job);
  }
  async discover(source) {
    this.job.message=`Discovering ${source.title || source.key} chats…`;await this.save();
    try {const data=await this.request(sourcePath(source));ingestPage(this.job,source,data);source.error=null;source.lastPageAt=this.now();await this.save();await this.io.index?.(this.job);}
    catch (error) {if (error instanceof Paused || !(error instanceof RequestError) && !/discovery|Discovery|page|cursor|List ended|list format|identifier/i.test(error.message)) throw error;source.error=error.message;source.failures=(source.failures || 0)+1;source.retryAt=this.now()+60000*source.failures;this.event(`Discovery deferred (${source.title || source.key}): ${error.message}`);await this.save();}
  }
  async checkRecentChats(){
    const s=ensureWatchSchedule(this.job,this.now());s.lastCheckAttemptAt=this.now();s.checkState='checking';this.job.phase='watch';
    const before=Object.keys(this.job.entries).length,pendingBefore=Object.values(this.job.entries).filter(e=>e.status==='pending').length;let pages=0,successful=false;
    try{
      for(const source of recentWatchSources(this.job)){const data=await this.request(sourcePath(source));ingestPage(this.job,source,data);pages++;await this.save();}
      s.lastCheckAt=this.now();s.checkState='current';s.checkError=null;s.checkWaitUntil=0;successful=true;
      this.event(`Automatic recent-chat check: ${pages} metadata pages checked; ${Object.keys(this.job.entries).length-before} new chat links indexed.`);
    }catch(e){if(e instanceof Paused)throw e;s.checkState='deferred';s.checkError=e.message;this.event(`Automatic recent-chat check deferred: ${e.message}`);}
    const activity=Object.keys(this.job.entries).length>before || Object.values(this.job.entries).filter(e=>e.status==='pending').length>pendingBefore;
      s.quietChecks=successful?(activity?0:Math.min(3,(s.quietChecks || 0)+1)):0;
      s.effectiveRecentIntervalMs=this.job.options.smartWatch===false?(s.recentIntervalMs || 300000):Math.min(1800000,(s.recentIntervalMs || 300000)*2**s.quietChecks);
      s.nextCheckAt=this.now()+(successful?s.effectiveRecentIntervalMs:Math.max(60000,s.recentIntervalMs || 300000));this.job.phase=null;await this.save();await this.io.index?.(this.job);
  }
  async run() {
    this.stopped=false;this.libraryChecked=new Set();this.job.status='running';this.job.started=true;this.job.version=VERSION;await this.save();
    try {
      await this.reconcileInventory(await this.io.inventory?.(this.job.scope) || []);await this.observe();
      this.job.discoveryAudit ||= {round:0,baseline:Object.keys(this.job.entries).length,stable:false};schedulerState(this.job,this.now());
      for (;;) {
        await this.holdPoint();await this.observe();
        const pending=Object.values(this.job.entries).filter(e=>e.status==='pending'),eligible=pending.filter(e=>!e.retryAt || e.retryAt<=this.now()).sort((a,b)=>calendarTime(a)-calendarTime(b) || String(a.id).localeCompare(String(b.id)));
        const indexOnly=this.job.options.mode==='index-only';
        const urgentReady=eligible.find(e=>e.refresh && (e.nativeWriteAt || e.changeReason)),ready=indexOnly?null:urgentReady || eligible.find(e=>this.cachedIds.has(e.id)&&!e.refresh) || eligible.find(e=>!e.recoveryPending) || eligible[0];
        const source=this.job.sources.filter(s=>!s.done && !s.error).sort((a,b)=>(a.lastPageAt || 0)-(b.lastPageAt || 0))[0],localReady=ready && this.cachedIds.has(ready.id) && !ready.refresh;
        const repair=this.job.options.verify!==false?this.job.sources.find(s=>s.error&&(s.failures || 0)<=2&&(s.retryAt || 0)<=this.now()):null;
        const attachment=!indexOnly&&this.job.options.attachments!==false?Object.values(this.job.entries).filter(e=>e.status==='saved'&&(!e.attachmentScannedAt||e.attachmentPending)&&(e.attachmentRetryAt || 0)<=this.now()).sort((a,b)=>(a.attachmentLastTurnAt || 0)-(b.attachmentLastTurnAt || 0)||calendarTime(a)-calendarTime(b))[0]:null;
        const verifyKey=f=>`${f.path}:${f.size}:${f.sha256 || ''}`;
        const verify=!indexOnly&&this.io.libraryList&&this.job.options.library&&this.io.libraryVerify?fileReferences(this.job).find(f=>f.status==='saved'&&f.path&&!this.libraryChecked.has(verifyKey(f))):null;
        const library=!indexOnly&&this.io.libraryList&&this.job.options.library?libraryWork(this.job,this.now()):null;
        let recent=null;
        if(watchCheckDue(this.job,this.now())){
          const plan=decide(this.job,[],'discovery',this.now());
          if(!plan.attention&&(!plan.until||['spacing','traffic-rest'].includes(plan.state)))recent=true;
          else {this.job.schedule.checkState=plan.attention?'needs-attention':'waiting';this.job.schedule.checkWaitReason=plan.reason;this.job.schedule.checkWaitUntil=plan.until || 0;}
        }
        const decision=pickWork(this.job,{chat:ready,'chat-scan':source || repair,attachment,library,verify,recent},{urgent:urgentReady===ready&&!!ready,local:!!localReady,now:this.now()});
        if(decision){
          beginWork(this.job,decision,this.now());
          if(decision.lane==='library'){const share=schedulerState(this.job,this.now()).library;const policy=libraryPolicy(this.job,this.now());if(share.loggedShare!==policy.downloadShare){share.loggedShare=policy.downloadShare;this.event(`Queue policy: ${policy.downloadShare}% Library download turns while both Library queues are ready. ${policy.reason}`,'info','library');}}
          this.io.changed?.(this.job);
          if(decision.lane==='chat'){
            try{await this.process(ready);}catch(error){
              if(error instanceof Paused || localStorageFailure(error))throw error;
              ready.attempts=(ready.attempts || 0)+1;ready.status=ready.attempts>=3?'failed':'pending';ready.retryAt=ready.status==='pending'?this.now()+60000*ready.attempts:0;ready.error=error.message || String(error);this.job.phase=null;
              this.event(`File work ${ready.status==='failed'?'needs attention':'deferred'}: ${ready.title} — ${ready.error}. Continuing other chats.`);await this.save();
            }
          }else if(decision.lane==='chat-scan'){
            const selected=decision.work;
            if(selected.error){Object.assign(selected,{error:null,done:false,offset:0,cursor:selected.kind==='project'?'0':null,seenPages:[],uniqueIds:[],emptyChecks:0,reportedTotal:0});this.event(`Repairing only the incomplete discovery route: ${selected.title || selected.key}.`);}
            await this.discover(selected);
          }else if(decision.lane==='attachment')await this.processAttachments(attachment);
          else if(decision.lane==='library')await processLibrary(this,library);
          else if(decision.lane==='recent')await this.checkRecentChats();
          else if(decision.lane==='verify'){
            this.libraryChecked.add(verifyKey(verify));
            if(!await this.io.libraryVerify(verify)){verify.status=verify.historical?'unavailable':'pending';verify.path=null;verify.retryAt=0;this.event(`Library saved copy needs repair: ${verify.name}.`,'warn','library');await this.save();}
          }
          if(decision.lane!=='library')finishWork(this.job,decision.lane,{savedFile:decision.lane==='attachment'&&this.attachmentTurnSaved,urgent:urgentReady===ready&&!!ready,local:!!localReady,now:this.now()});
          if((this.job.workScheduler?.completed || 0)%10===0){await this.holdPoint();await this.io.maintenance?.();}
          continue;
        }
        if(await this.io.maintenance?.())continue;
        const fileLookup=createFileLookup(this.job);
        const libraryWaits=!indexOnly&&this.job.options.library?[...fileReferences(this.job).filter(f=>!f.historical&&!f.external&&!f.parked&&['pending','deferred'].includes(f.status)&&(f.attempts || 0)<2&&!sharedFileBudget(this.job,f,fileLookup).parked&&(f.sourceKind!=='chat'||this.job.options.attachments!==false)).map(f=>f.retryAt),...(this.job.library?.sources || []).filter(s=>s.error&&s.failures<3).map(s=>s.retryAt)]:[];
        const waits=[...(indexOnly?[]:pending.map(e=>e.retryAt)),...(this.job.options.verify!==false?this.job.sources.filter(s=>s.error&&(s.failures || 0)<=2).map(s=>s.retryAt):[]),...libraryWaits].filter(t=>t>this.now());if (waits.length) {await this.wait(Math.min(...waits),'Waiting to revisit unresolved work after a quiet period…');continue;}
        const audit=this.job.discoveryAudit;
        if(this.job.options.verify!==false && this.job.sources.length && !this.job.sources.some(s=>s.error || !s.done) && !audit.stable){audit.stable=true;audit.verifiedAt=this.now();audit.round=0;this.event('Discovery traversal completed cleanly; skipped the old redundant full-list verification loop.');await this.save();}
        const c=counts(this.job);this.job.status=c.failed || c.discovery ? 'incomplete':indexOnly?'indexed':'complete';
        const assets=Object.values(this.job.entries).flatMap(e=>e.attachments || []),unavailable=assets.filter(a=>['unavailable','permission-unavailable','failed'].includes(a.status)).length,deferred=assets.filter(a=>['deferred','rate-limited'].includes(a.status)).length;
        this.job.message=this.job.status==='indexed' ? `${c.total} links indexed on disk. ${c.pending} chats remain to download.` : this.job.status==='complete' ? `Finished: ${c.saved} discovered chats saved; ${c.attachments} eligible attachments saved${unavailable?`; ${unavailable} attachments unavailable`:''}${deferred?`; ${deferred} attachments deferred for a later pass`:''}.` : `Finished available work: ${c.saved} saved; ${c.failed} chats and ${c.discovery} discovery sources need attention.`;
        if(this.job.options.library&&!indexOnly){const files=Object.values(this.job.library?.entries || {});if(files.length)this.job.message+=` Library: ${files.filter(f=>f.status==='saved').length} saved, ${files.filter(f=>f.parked).length} parked, ${files.filter(f=>f.status==='manual').length} manual downloads.`;}
        if(this.job.schedule?.fullScanPending && !this.job.sources.some(s=>s.error || !s.done)){this.job.schedule.fullScanPending=false;this.job.schedule.lastScanAt=this.now();}
        Object.assign(awareness(this.job),{state:this.job.status,reason:this.job.message,waitUntil:0});this.event(this.job.message);this.io.changed?.(this.job);await this.save();await this.io.report(this.job);break;
      }
    } catch (error) {this.job.status='paused';this.job.message=error instanceof Paused ? error.message : `Paused: ${error.message}. Resolve the issue and resume.`;Object.assign(awareness(this.job),{state:'paused',reason:this.job.message,waitUntil:0});this.event(this.job.message);this.io.changed?.(this.job);await this.save();}
    this.io.changed?.(this.job);
  }
}
