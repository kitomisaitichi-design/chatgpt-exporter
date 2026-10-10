export const VERSION = '2.4.19';
// Persisted chat attachments can legitimately lack a native file ID or label.
export const compareText = (a,b) => String(a ?? '').localeCompare(String(b ?? ''));
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const freshPace = () => ({delay:5000, floor:5000, next:0, until:0, strikes:0, ok:0, recent:[], lastLimit:0, tier:0, tierChangedAt:0, idleRelaxAt:0, stableSince:0, regimes:[]});
// Tiers are the network cadence. Local disk/cache work never consumes these delays.
export const WEEKLY_BROKEN_MS=7*24*60*60*1000;
const TIER_DELAY=[5000,8000,12000,20000,35000,60000];
const STEP_DOWN_OK=[0,6,7,8,9,10];
const STEP_DOWN_QUIET=[0,60000,90000,120000,180000,240000];
const LOCAL_COOLDOWN=[0,60000,90000,120000,180000,240000];
function regime(pace,event,now,extra={}) {
  (pace.regimes ||= []).push({at:now,event,tier:pace.tier || 0,delay:Math.round(pace.delay || 0),...extra});
  pace.regimes=pace.regimes.slice(-80);
}
export function retryAfter(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, (Date.parse(value) || now) - now);
}
export function limited(pace, header, now = Date.now(), random = Math.random(), origin = 'exporter') {
  const serverWait=retryAfter(header,now);
  pace.tier ||= 0;pace.regimes ||= [];
  // Multiple tabs may surface the same limit episode. Extend a real server wait,
  // but do not repeatedly escalate the locally inferred delay for one episode.
  if(pace.until>now){
    pace.lastLimit=now;
    if(serverWait)pace.until=Math.max(pace.until,now+serverWait);
    regime(pace,'limit-same-episode',now,{origin,retryAfter:serverWait});
    return pace;
  }
  pace.strikes = now - (pace.lastLimit || 0) < 3600000 ? (pace.strikes || 0) + 1 : 1;
  pace.lastLimit = now;pace.idleRelaxAt=now;pace.stableSince=0;pace.ok=0;
  pace.tier=Math.min(TIER_DELAY.length-1,(pace.tier || 0)+1);
  pace.tierChangedAt=now;
  pace.floor=TIER_DELAY[pace.tier];
  pace.delay=Math.min(TIER_DELAY.at(-1),Math.max(pace.floor,(pace.delay || 5000)*1.25));
  // A server Retry-After is authoritative. Without one, use a bounded local rest
  // keyed to the new tier instead of exponential strike multiplication.
  const localWait=LOCAL_COOLDOWN[pace.tier] || LOCAL_COOLDOWN.at(-1);
  pace.until=Math.max(pace.until,now+Math.max(serverWait,localWait)+(serverWait?0:random*1500));
  regime(pace,'step-up',now,{origin,retryAfter:serverWait,localWait:serverWait?0:localWait});
  return pace;
}
export function succeeded(pace, now = Date.now()) {
  pace.tier ||= 0;pace.regimes ||= [];pace.ok=(pace.ok || 0)+1;
  if(!pace.stableSince)pace.stableSince=now;
  const tier=pace.tier || 0,quietFor=now-(pace.lastLimit || 0);
  if(tier>0 && pace.ok>=STEP_DOWN_OK[tier] && quietFor>=STEP_DOWN_QUIET[tier]){
    pace.tier=tier-1;pace.tierChangedAt=now;pace.idleRelaxAt=now;pace.ok=0;
    pace.floor=TIER_DELAY[pace.tier];
    pace.delay=Math.max(pace.floor,Math.min(TIER_DELAY[tier],(pace.delay || TIER_DELAY[tier])*0.78));
    pace.until=0;
    regime(pace,'step-down',now,{quietFor});
  } else if(pace.ok>0 && pace.ok%6===0 && (pace.delay || 0)>TIER_DELAY[tier]){
    pace.delay=Math.max(TIER_DELAY[tier],pace.delay*0.9);
    pace.floor=TIER_DELAY[tier];
    regime(pace,'steady-trim',now,{quietFor});
  }
  return pace;
}
export function relaxIdle(pace, now = Date.now()) {
  pace.tier ||= 0;pace.regimes ||= [];if(!pace.tier || !pace.lastLimit || (pace.until || 0)>now)return false;
  let anchor=pace.idleRelaxAt || pace.lastLimit,changed=false;const step=6*60000;
  while(pace.tier>0 && now-anchor>=step){pace.tier--;anchor+=step;changed=true;pace.ok=0;pace.floor=TIER_DELAY[pace.tier];pace.delay=Math.max(pace.floor,Math.min(pace.delay || pace.floor,TIER_DELAY[Math.min(TIER_DELAY.length-1,pace.tier+1)]));pace.next=Math.min(pace.next || 0,now+pace.delay);regime(pace,'idle-step-down',anchor,{quietFor:anchor-pace.lastLimit});}
  if(changed){pace.idleRelaxAt=anchor;pace.tierChangedAt=anchor;if(!pace.tier){pace.strikes=0;pace.delay=TIER_DELAY[0];pace.floor=TIER_DELAY[0];}}
  return changed;
}
export function safeName(value, max = 90) {
  let name = Array.from(String(value || 'Untitled conversation').normalize('NFC').replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '-').replace(/[. ]+$/g, '')).slice(0,max).join('').replace(/[. ]+$/g,'');
  if (!name) name = 'Untitled';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
  return name;
}
export function validId(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]{8,160}$/.test(id); }
export function conversationValid(data, id) {
  const actual = data?.conversation_id || data?.id;
  return !!(data && data.mapping && typeof data.mapping === 'object' && !Array.isArray(data.mapping) && (!actual || actual === id));
}
export function activeNodes(data) {
  const mapping = data.mapping || {};
  let current = data.current_node;
  if (!mapping[current]) current = Object.keys(mapping).filter(id => !(mapping[id]?.children?.length)).sort((a,b) => (mapping[b]?.message?.create_time || 0) - (mapping[a]?.message?.create_time || 0))[0];
  const seen = new Set(), nodes = [];
  while (current && mapping[current] && !seen.has(current)) {seen.add(current); nodes.push(mapping[current]); current = mapping[current].parent;}
  return nodes.reverse();
}
export function epoch(value){if(typeof value==='number')return value>1e12?value:value*1000;if(typeof value==='string' && /^\d+(?:\.\d+)?$/.test(value))return epoch(Number(value));return Date.parse(value)||0;}
export function conversationTime(data){
  const own=epoch(data?.create_time); if(own)return own;
  let first=Infinity;
  for(const node of Object.values(data?.mapping || {})){const t=epoch(node?.message?.create_time);if(t && t<first)first=t;}
  return Number.isFinite(first)?first:0;
}
export function calendarTime(entry){return epoch(entry?.create_time) || epoch(entry?.calendar_time) || epoch(entry?.update_time) || Number.MAX_SAFE_INTEGER;}
function walkStrings(value,out=[],depth=0){
  if(depth>4 || value==null)return out;
  if(typeof value==='string'){out.push(value);return out;}
  if(Array.isArray(value)){for(const v of value.slice(0,80))walkStrings(v,out,depth+1);return out;}
  if(typeof value==='object')for(const [k,v] of Object.entries(value).slice(0,120)){out.push(k);walkStrings(v,out,depth+1);}return out;
}
export function classifyConversation(data, entry={}) {
  const m=data?.metadata || {};
  const explicit=[entry.chatKind,entry.kind,entry.surface,data?.conversation_mode?.kind,data?.conversation_mode,data?.product,m.surface,m.product,m.client,m.source,m.origin,m.conversation_type,data?.gizmo_id,data?.conversation_template_id].filter(Boolean).map(String);
  const probe=[...explicit,...walkStrings(data?.conversation_mode,[])].join(' ').toLowerCase();
  if(/\bcodex\b/.test(probe))return {kind:'codex',evidence:'explicit conversation metadata contains Codex'};
  if(/(?:^|[^a-z])work(?:[^a-z]|$)/.test(probe))return {kind:'work',evidence:'explicit conversation metadata contains Work'};
  if(entry.projectId || entry.project)return {kind:'project-chat',evidence:'discovered through a ChatGPT project'};
  return {kind:'normal-chat',evidence:'no Work/Codex marker observed'};
}
export function markdown(data, id) {
  const lines = [`# ${data.title || 'Untitled conversation'}`, '', `Conversation: https://chatgpt.com/c/${encodeURIComponent(id)}`, '', '> This is the selected conversation branch. The JSON file preserves all branches and original metadata. Eligible document/source attachments may also be saved under this conversation when attachment backup is enabled.', ''];
  for (const node of activeNodes(data)) {
    const m = node.message;
    if (!m || !['user','assistant','tool'].includes(m.author?.role) || m.metadata?.is_visually_hidden_from_conversation) continue;
    const parts = m.content?.parts;
    const text = Array.isArray(parts) ? parts.map(p => typeof p === 'string' ? p : p?.text || (p?.asset_pointer ? `[Media reference: ${p.asset_pointer}]` : `\n\`\`\`json\n${JSON.stringify(p,null,2)}\n\`\`\``)).join('\n\n') : m.content?.text || JSON.stringify(m.content || {});
    lines.push(`## ${m.author.role === 'user' ? 'You' : m.author.role === 'assistant' ? 'Assistant' : 'Tool'}${m.channel ? ` (${m.channel})` : ''}`, '', text, '');
    for (const a of m.metadata?.attachments || []) lines.push(`Attachment reference: ${a.name || a.filename || a.id || a.file_id}`, '');
  }
  return lines.join('\n');
}
export function newJob(scope, options={}, now = Date.now()) {
  const merged={archived:true,projects:true,assist:false,verify:true,mode:'index-first',attachments:true,downloadImages:true,passive:true,passiveHours:3,yieldUser:true,library:true,smartWatch:true,...options};
  return {version:VERSION, scope, created:now, updated:now, status:'ready', message:'Ready', options:merged, entries:{}, sources:[
    {key:'active', kind:'list', offset:0, done:false, seenPages:[], emptyChecks:0},
    ...(merged.archived ? [{key:'archived', kind:'list', offset:0, archived:true, done:false, seenPages:[], emptyChecks:0}] : []),
    ...(merged.projects ? [{key:'projects', kind:'projects', cursor:null, done:false, seenPages:[], emptyChecks:0}] : [])
  ], pace:freshPace(), events:[], recentDone:[], started:false,schedule:{enabled:merged.passive!==false,intervalMs:(Number(merged.passiveHours)||3)*3600000,nextScanAt:now+(Number(merged.passiveHours)||3)*3600000,lastScanAt:0,lastTelemetryAt:0}};
}
export function mergeEntry(job, item, project) {
  if(job.viewerDeletes?.[item?.id]?.verified || job.entries?.[item?.id]?.remoteDeletedAt)return false;
  const id = item?.id || item?.conversation_id;
  if (!validId(id)) return false;
  if(item.remote_deleted_at && item.deletion_verified){(job.viewerDeletes ||= {})[id]={at:item.remote_deleted_at,verified:true,contentHash:item.content_hash};job.entries[id]={...item,id,status:'viewer-deleted',remoteDeletedAt:item.remote_deleted_at,contentHash:item.content_hash};return true;}
  const prev = job.entries[id];
  const newer=prev?.update_time && item.update_time && epoch(item.update_time)>epoch(prev.update_time);
  const update_time=!prev?.update_time || newer ? item.update_time || prev?.update_time : prev.update_time;
  const create_time=prev?.create_time || item.create_time || item.created_at || null;
  const title=(!prev || newer || ['Untitled conversation','Added conversation'].includes(prev.title)) ? item.title || prev?.title || 'Untitled conversation' : prev.title;
  const surface=item.chat_kind || item.chatKind || item.surface || item.product || item.conversation_mode?.kind || prev?.surface;
  job.entries[id] = Object.assign(prev || {id,status:'pending',attempts:0}, {title,update_time,create_time,surface}, project ? {project:project.title, projectId:project.id} : {});
  const surfaceProbe=String(surface || '').toLowerCase();
  if(/\bcodex\b/.test(surfaceProbe))Object.assign(job.entries[id],{chatKind:'codex',chatKindEvidence:'conversation list metadata contains Codex'});
  else if(/(?:^|[^a-z])work(?:[^a-z]|$)/.test(surfaceProbe))Object.assign(job.entries[id],{chatKind:'work',chatKindEvidence:'conversation list metadata contains Work'});
  else if(project)Object.assign(job.entries[id],{chatKind:'project-chat',chatKindEvidence:'discovered through a ChatGPT project'});
  const local=item.localDetected || item.diskBacked || item.cacheBacked || ['local cache','existing backup file','imported portable state','existing conversation index'].includes(item.origin);
  if(newer && !local && epoch(item.update_time)>epoch(prev?.checkedUpdateTime))Object.assign(job.entries[id],{status:'pending',refresh:true,attempts:0,retryAt:0,changeReason:'newer server update timestamp',brokenUntil:0,lastFailureAt:0,lastFailureStatus:0});
  if(item.origin)job.entries[id].foundVia=[...new Set([...(prev?.foundVia || []),item.origin])];
  return !prev;
}
// Error envelopes must never masquerade as uploaded document bytes. Restrict
// detection to the service's error schema so legitimate JSON files remain valid.
export function attachmentError(text){
  try{const x=JSON.parse(String(text).replace(/^\uFEFF/,''));if(x && !Array.isArray(x) && (x.status==='error' && (x.error_code || x.error_type || x.error_message!==undefined) || x.error_code && x.error_type))return String(x.error_code || x.error_type || 'Attachment error response');}catch{}
  return null;
}
export function ingestPage(job, source, data) {
  if (!Array.isArray(data?.items)) throw new Error('The server returned an unexpected list format. Discovery is paused, not marked complete.');
  const items = data.items; source.uniqueIds ||= [];
  if(Number.isFinite(Number(data.total)) && data.total!==null)source.reportedTotal=Math.max(source.reportedTotal || 0,Number(data.total));
  const cursor = data.cursor || data.next_cursor || null;
  const fingerprint = items.map(x => x.id || x.conversation_id || x.gizmo?.gizmo?.id || x.gizmo?.id || '').join('|');
  if (items.length && source.seenPages.includes(fingerprint)) throw new Error('The server repeated a page. Discovery is incomplete; retry discovery later.');
  if (!items.length && (source.kind === 'list' || !cursor)) {
    if (!source.emptyChecks++) return;
    if (source.kind === 'list' && source.uniqueIds.length < (source.reportedTotal || 0)) throw new Error(`List ended early (${source.uniqueIds.length} unique of ${source.reportedTotal} reported). Discovery is incomplete.`);
    source.done = true; return;
  }
  source.emptyChecks = 0; if (items.length) source.seenPages.push(fingerprint);
  if (source.kind === 'projects') {
    for (const item of items) {
      const g = item.gizmo?.gizmo || item.gizmo || item;
      if (!validId(g.id)) throw new Error('Unexpected project identifier; discovery is incomplete.');
      const title = g.display?.name || item.gizmo?.display?.name || g.name || 'Untitled project';
      if (!job.sources.some(s => s.key === g.id)) job.sources.push({key:g.id,kind:'project',title,cursor:'0',done:false,seenPages:[],emptyChecks:0});
      for (const entry of item.conversations?.items || []) mergeEntry(job, {...entry,origin:'project preview'}, {id:g.id,title});
    }
  } else for (const item of items) {
    if (!validId(item?.id || item?.conversation_id)) throw new Error('A conversation identifier is missing; discovery is incomplete.');
    if(!source.uniqueIds.includes(item.id || item.conversation_id))source.uniqueIds.push(item.id || item.conversation_id);
    mergeEntry(job, {...item,origin:source.key}, source.kind === 'project' ? {id:source.key,title:source.title} : null);
  }
  if (source.kind === 'list') source.offset += items.length;
  else {if (cursor && cursor === source.cursor) throw new Error('The server repeated a cursor; discovery is incomplete.');source.cursor = cursor;if (!cursor) source.done = true;}
}
export function sourcePath(source) {
  if (source.kind === 'list') return `/backend-api/conversations?offset=${source.offset}&limit=50&order=updated&is_archived=${!!source.archived}`;
  if (source.kind === 'projects') return `/backend-api/gizmos/snorlax/sidebar?limit=50&conversations_per_gizmo=5${source.cursor ? '&cursor='+encodeURIComponent(source.cursor) : ''}`;
  return `/backend-api/gizmos/${encodeURIComponent(source.key)}/conversations?cursor=${encodeURIComponent(source.cursor || '0')}`;
}
export function counts(job) {
  const entries = Object.values(job?.entries || {});
  return {total:entries.length, saved:entries.filter(e => e.status === 'saved').length, pending:entries.filter(e => e.status === 'pending').length, failed:entries.filter(e => e.status === 'failed').length, changed:entries.filter(e=>e.revisionCount>0).length,attachments:entries.reduce((n,e)=>n+(e.attachments?.filter?.(a=>a.status==='saved').length || 0),0), discovery:(job?.sources?.filter(s => s.error || !s.done).length || 0)+(job?.discoveryUncertain?1:0)};
}
const DOC_EXT=new Set(['txt','md','markdown','doc','docx','xls','xlsx','xlsm','csv','tsv','html','htm','rtf','odt','ods','pdf','json','jsonl','yaml','yml','toml','xml','css','scss','less','py','js','mjs','cjs','ts','tsx','jsx','sql','ipynb','java','c','cc','cpp','h','hpp','cs','go','rs','rb','php','sh','bash','zsh','ps1','bat','cmd','ini','cfg','conf','env','log','tex','r','rmd','swift','kt','kts','dart','vue','svelte']);
const IMAGE_EXT=new Set(['png','jpg','jpeg','gif','webp','avif','bmp','svg','ico','tif','tiff','heic','heif','jxl']);
function pointerId(value){if(typeof value!=='string')return null;const m=value.match(/(?:file-service:\/\/|\/files\/download\/)([a-zA-Z0-9_-]{8,200})/);return m?.[1] || (/^[a-zA-Z0-9_-]{8,200}$/.test(value)?value:null);}
function attachmentFrom(a,nodeId,partIndex){
  if(!a || typeof a!=='object')return null;
  const name=a.name || a.filename || a.file_name || a.title || `attachment-${partIndex ?? 0}`;
  const ext=String(name).split('.').pop()?.toLowerCase();
  const mime=a.mime_type || a.mime || (a.content_type==='image_asset_pointer'?'image/unknown':a.content_type) || '';
  if(!(DOC_EXT.has(ext) || IMAGE_EXT.has(ext) || /^(?:image\/|text\/|application\/(?:json|xml|rtf|pdf|msword|vnd\.|octet-stream))/.test(mime)))return null;
  const size=Number(a.file_size_bytes ?? a.size_bytes ?? a.size ?? a.file_size ?? a.bytes ?? 0) || null;
  const rawId=a.file_id || a.id || a.asset_pointer || a.asset_id || null;
  const id=pointerId(rawId) || pointerId(a.asset_pointer);
  const urls=[a.download_url,a.download_link,a.url,a.href].filter(v=>typeof v==='string');
  return {key:String(id || a.asset_pointer || urls[0] || `${nodeId}:${name}`),id,library_file_id:a.library_file_id || null,name,mime,size,remoteSha256:/^[a-f0-9]{64}$/i.test(a.sha256 || a.content_sha256 || '')?String(a.sha256 || a.content_sha256).toLowerCase():null,asset_pointer:a.asset_pointer || null,urls,nodeId};
}
export function attachmentCandidates(a,conversationId){
  const out=[...(a.urls || [])];
  if(a.id){const id=encodeURIComponent(a.id),cid=encodeURIComponent(conversationId);
    out.push(`/backend-api/files/download/${id}?conversation_id=${cid}&inline=false`,
      `/backend-api/conversation/${cid}/attachment/${id}/download`,
      `/backend-api/files/${id}/download`, `/backend-api/files/download/${id}`);
  }
  return [...new Set(out)];
}
export function extractAttachments(data){
  const found=new Map();
  for(const [nodeId,node] of Object.entries(data?.mapping || {})){
    const m=node?.message;if(!m)continue;
    for(const a of m.metadata?.attachments || []){const x=attachmentFrom(a,nodeId);if(x)found.set(x.key,x);}
    for(const [i,p] of (Array.isArray(m.content?.parts)?m.content.parts:[]).entries())if(p && typeof p==='object' && (p.asset_pointer || p.file_id || p.filename || p.name)){const x=attachmentFrom(p,nodeId,i);if(x)found.set(x.key,x);}
  }
  return [...found.values()];
}
