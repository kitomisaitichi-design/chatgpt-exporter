// Same-origin/read-only ChatGPT bridge. Authentication remains inside ChatGPT.
(() => {
  if (window.__englishExporterBridgeV2411) return;
  const originalFetch = window.fetch.bind(window);
  const captured = new Map(), hints = new Map(), projects = new Map(), fileRoutes=new Map(), preparedAssets=new Map(), changedChats=new Map(), libraryItems=new Map(),libraryRoutes=new Map();
  const documentId=crypto.randomUUID(), loadedAt=Date.now();
  let routeAt=loadedAt,lastPath=location.pathname,inFlight=0,activeStreams=0,lastStart=0,lastWrite=0,lastUserInteraction=0,seq=0,events=[],blocked=null;
  const markUserInteraction=()=>{lastUserInteraction=Date.now();};
  for(const type of ['pointerdown','keydown','wheel','touchstart'])window.addEventListener(type,markUserInteraction,{capture:true,passive:true});
  let token = null, user = null, sessionAt = 0, accountHeader = null, accountHeaderSelector = null, pending = null, device = null,lastLimit = null;
  const frontendHeaders=new Map();
  const cookie = name => {const value = document.cookie.split('; ').find(x => x.startsWith(name+'='))?.slice(name.length+1);try { return value ? decodeURIComponent(value) : null; } catch { return value || null; }};
  // The personal selector cookie is a label, while native requests carry the
  // actual workspace UUID. Do not let the label override an observed UUID.
  const workspace = () => {const selected=cookie('_account');return selected==='personal'&&accountHeader&&accountHeaderSelector===selected?accountHeader:selected || accountHeader || null;};
  const snapshotScope = () => ({user, account:workspace()});
  const scoped = value => value && (!value.scope?.user || value.scope.user===user) && (value.scope?.account || null)===workspace();
  function hint(item,scope,origin) {
    const id=item?.id || item?.conversation_id;if(typeof id!=='string' || !/^[a-zA-Z0-9_-]{8,160}$/.test(id))return;
    const prev=hints.get(id);hints.set(id,{id,title:item.title || prev?.title || '',update_time:item.update_time || prev?.update_time,create_time:item.create_time || item.created_at || prev?.create_time,surface:item.surface || item.product || item.conversation_mode?.kind || prev?.surface,origin,scope});
    while(hints.size>7000)hints.delete(hints.keys().next().value);
  }
  const libraryAllowed=path=>/^\/backend-api\/files\/library\/(?:nodes|directories\/path)(?:\?|$)/.test(path) && !path.includes('..');
  const allowed = path => libraryAllowed(path) || /^\/backend-api\/(conversations\?|conversation\/[a-zA-Z0-9_-]+(?:$|\/interpreter\/download\?|\/attachment\/[a-zA-Z0-9_-]+\/download(?:\?|$))|gizmos\/snorlax\/sidebar\?|gizmos\/[a-zA-Z0-9_-]+\/conversations\?|files\/(?:download\/[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+\/download)(?:\?|$))/.test(path) && !path.includes('..');
  const assetAllowed = url => allowed(url.pathname+url.search) || url.pathname==='/backend-api/estuary/content' && !!url.searchParams.get('id') && !!url.searchParams.get('sig');
  function rememberFileRoute(url,scope){
    if(url.origin!==location.origin)return;const path=url.pathname+url.search;if(!allowed(path))return;
    if(!(/\/files\/download\//.test(url.pathname) || /\/(?:attachment|files)\/[^/]+\/download$/.test(url.pathname) || /\/interpreter\/download$/.test(url.pathname)))return;
    const ids=[url.pathname.match(/\/files\/download\/([a-zA-Z0-9_-]+)/)?.[1],url.pathname.match(/\/(?:attachment|files)\/([a-zA-Z0-9_-]+)\/download$/)?.[1],url.searchParams.get('file'),url.searchParams.get('file_id'),url.searchParams.get('id')].filter(Boolean);
    for(const id of ids)fileRoutes.set(id,{id,path,at:Date.now(),scope});while(fileRoutes.size>500)fileRoutes.delete(fileRoutes.keys().next().value);
  }
  const observe = async (response, url, scope) => {
    if (response.status === 429) lastLimit = {at:Date.now(), retryAfter:response.headers.get('retry-after'), scope};
    if(response.status===403 && allowed(url.pathname+url.search))blocked='ChatGPT denied a request. Complete any browser check in its tab, then resume.';
    rememberFileRoute(url,scope);
    if(response.ok && ['/backend-api/files/library','/backend-api/files/library/nodes'].includes(url.pathname)){
      try{const data=await response.clone().json(),body=data.data || data,items=body.items || body.nodes || body.files || body.results || (Array.isArray(body)?body:[]);
        for(const item of Array.isArray(items)?items:items.items || []){const f=item.file || item.library_file || item.file_metadata || item.metadata || item,id=f.file_id || item.file_id || item.id || f.id;if(!id)continue;libraryItems.set(String(id),{item,at:Date.now(),scope});const assetUrl=f.download_url || f.download_link;if(assetUrl)libraryRoutes.set(String(id),{url:assetUrl,scope});}
        while(libraryItems.size>5000)libraryItems.delete(libraryItems.keys().next().value);while(libraryRoutes.size>500)libraryRoutes.delete(libraryRoutes.keys().next().value);
      }catch{}
    }
    const match = url.pathname.match(/^\/backend-api\/conversation\/([a-zA-Z0-9_-]+)$/);
    if (match && response.ok) {try {const data = await response.clone().json();if (data.mapping) {captured.set(match[1], {data, at:Date.now(), scope});hint({id:match[1],title:data.title,update_time:data.update_time,create_time:data.create_time,surface:data.conversation_mode?.kind || data.metadata?.surface},scope,'already loaded chat');while (captured.size > 10) captured.delete(captured.keys().next().value);}} catch {}}
    const isSearch=/^\/backend-api\/conversations\/search\/?$/.test(url.pathname);
    if(response.ok && (isSearch || url.pathname==='/backend-api/conversations' || /^\/backend-api\/gizmos\/[^/]+\/conversations$/.test(url.pathname) || url.pathname==='/backend-api/gizmos/snorlax/sidebar')) {
      try {const data=await response.clone().json(),items=data.items || data.results || data.conversations?.items || data.conversations || [];
        for(const item of Array.isArray(items)?items:[]) {
          if(url.pathname.endsWith('/sidebar')){const g=item.gizmo?.gizmo || item.gizmo || item;if(typeof g.id==='string' && /^[a-zA-Z0-9_-]{8,160}$/.test(g.id))projects.set(g.id,{id:g.id,title:g.display?.name || item.gizmo?.display?.name || g.name || 'Observed project',scope});for(const c of item.conversations?.items || [])hint(c,scope,'app project preview');}
          else if(isSearch){const c=item.conversation || item.conversation_metadata || item;hint({...c,id:item.conversation_id || c.conversation_id || c.id},scope,'app search results');}
          else hint(item,scope,'app conversation list');
        }
      } catch {}
    }
  };
  window.fetch = async function(resource, options) {
    let url;try { url = new URL(typeof resource === 'string' || resource instanceof URL ? resource : resource.url, location.href); } catch {}
    const internal = url?.origin === location.origin && url.pathname.startsWith('/backend-api/');
    if (internal) {try {const headers = new Headers(resource instanceof Request ? resource.headers : undefined);new Headers(options?.headers).forEach((v,k) => headers.set(k,v));const auth = headers.get('authorization');if (auth?.startsWith('Bearer ') && auth !== 'Bearer dummy') token = auth.slice(7);if (headers.has('chatgpt-account-id')){accountHeader = headers.get('chatgpt-account-id');accountHeaderSelector=cookie('_account');}if (headers.has('oai-device-id')) device = headers.get('oai-device-id');if (headers.has('x-oai-is-pending-updates')) pending = headers.get('x-oai-is-pending-updates');for(const name of ['oai-did','originator','x-openai-web-frontend','x-openai-codex-window-type','x-oai-mcp-form-version']){const value=headers.get(name);if(value && value.length<=200 && !/[\r\n]/.test(value))frontendHeaders.set(name,value);}} catch {}}
    const scope = snapshotScope(),write=!['GET','HEAD'].includes(String(options?.method || (resource instanceof Request?resource.method:'GET')).toUpperCase());
    const conversationWrite=internal && write && /^\/backend-api\/(?:f\/)?conversation(?:\/[a-zA-Z0-9_-]+)?$/.test(url.pathname);
    const historyRead=internal && !write && (/^\/backend-api\/conversations(?:\/search)?\/?$/.test(url.pathname) || /^\/backend-api\/conversation\/[a-zA-Z0-9_-]+$/.test(url.pathname) || /^\/backend-api\/gizmos\/[^/]+\/conversations$/.test(url.pathname) || url.pathname==='/backend-api/gizmos/snorlax/sidebar' || /\/files\/download\//.test(url.pathname) || /\/interpreter\/download$/.test(url.pathname));
    let requestSeq=0;const relevant=conversationWrite || historyRead;if(relevant){lastStart=Date.now();if(write)lastWrite=lastStart;inFlight++;requestSeq=++seq;events.push({seq:requestSeq,at:lastStart,write});events=events.filter(e=>Date.now()-e.at<300000).slice(-1000);}
    try {
      const response = await originalFetch(resource, options);if (internal) void observe(response, url, scope);
      if(conversationWrite && response.ok){
        const writeSeq=requestSeq;let conversationId=url.pathname.match(/\/conversation\/([a-zA-Z0-9_-]+)$/)?.[1] || null;
        try{const raw=options?.body || (resource instanceof Request?await resource.clone().text():null);if(typeof raw==='string')conversationId=JSON.parse(raw).conversation_id || conversationId;}catch{}
        const completed=()=>{const id=conversationId || location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/)?.[1];if(typeof id!=='string' || !/^[a-zA-Z0-9_-]{8,160}$/.test(id))return;const at=Date.now();changedChats.set(id,{id,at,revision:`${documentId}:${writeSeq}`,scope});hint({id},scope,'completed ChatGPT reply');while(changedChats.size>500)changedChats.delete(changedChats.keys().next().value);};
        if(response.headers.get('content-type')?.includes('text/event-stream') && response.body){
          activeStreams++;const reader=response.clone().body.getReader(),decoder=new TextDecoder();let carry='';
          void (async()=>{try{for(;;){const part=await reader.read();if(part.done)break;if(!conversationId){carry=(carry+decoder.decode(part.value,{stream:true})).slice(-65536);const match=carry.match(/"conversation_id"\s*:\s*"([a-zA-Z0-9_-]{8,160})"/);if(match)conversationId=match[1];}}}catch{}finally{activeStreams--;lastWrite=Date.now();reader.releaseLock();completed();}})();
        }else completed();
      }
      if(url?.origin===location.origin && url.pathname==='/api/auth/session' && response.ok)void response.clone().json().then(data=>{if(!data?.user?.id || !data.accessToken)return;if(user && user!==data.user.id){captured.clear();hints.clear();projects.clear();fileRoutes.clear();changedChats.clear();libraryItems.clear();libraryRoutes.clear();pending=null;accountHeader=null;}user=data.user.id;token=data.accessToken;sessionAt=Date.now();}).catch(()=>{});
      return response;
    } finally {if(relevant)inFlight--;}
  };
  async function session(force = false) {
    if (!force && user && token && Date.now()-sessionAt < 45000) return;
    const response = await originalFetch('/api/auth/session', {credentials:'include', signal:AbortSignal.timeout(30000)});if (!response.ok) throw Object.assign(new Error('Session request failed'), {status:response.status, retryAfter:response.headers.get('retry-after')});
    const data = await response.json();if (!data?.accessToken || !data.user?.id) throw Object.assign(new Error('Please sign in to ChatGPT in the connected tab.'), {status:401});
    if (user && user !== data.user.id) {captured.clear();hints.clear();projects.clear();fileRoutes.clear();changedChats.clear();libraryItems.clear();libraryRoutes.clear(); pending = null; accountHeader = null;}token = data.accessToken; user = data.user.id; sessionAt = Date.now();if(force)blocked=null;
  }
  const matches = expected => expected && expected.user === user && (expected.account || null) === workspace();
  function authHeaders(scope){const headers={...Object.fromEntries(frontendHeaders),accept:'*/*',authorization:`Bearer ${token}`,'oai-language':'en-US'};const did=cookie('oai-did') || device;if(did){headers['oai-device-id']=did;headers['oai-did']=did;}if(scope.account)headers['chatgpt-account-id']=scope.account;if(pending)headers['x-oai-is-pending-updates']=pending;return headers;}
  const imageName=name=>/\.(?:png|jpe?g|gif|webp|avif|bmp|svg|ico|tiff?|heic|heif|jxl)$/i.test(String(name || ''));
  async function fetchAssetCandidate(candidate,scope,maxBytes,visited=new Set(),deadline=Date.now()+60000,excludeImages=false){
    let url;try{url=new URL(candidate,location.origin);}catch{return null;}
    if(!['https:'].includes(url.protocol))return null;
    if(visited.has(url.href) || visited.size>=4)return {status:502,error:'Attachment download-link cycle or excessive redirects.'};visited.add(url.href);
    if(url.origin===location.origin && !assetAllowed(url))return null;
    if(Date.now()>=deadline)return {status:504,error:'Attachment download timed out.'};
    let response=await originalFetch(url.href,{method:'GET',credentials:url.origin===location.origin?'include':'omit',headers:url.origin===location.origin?authHeaders(scope):undefined,signal:AbortSignal.timeout(Math.max(1,deadline-Date.now()))});
    if(!response.ok)return {status:response.status,retryAfter:response.headers.get('retry-after')};
    const length=Number(response.headers.get('content-length') || 0);if(length>maxBytes){await response.body?.cancel().catch(()=>{});return {tooLarge:true,size:length};}
    const type=response.headers.get('content-type') || '';
    const dispositionName=response.headers.get('content-disposition')?.match(/filename\s*=\s*"?([^";]+)/i)?.[1]?.trim();
    if(excludeImages && (/^image\//i.test(type) || imageName(dispositionName))){await response.body?.cancel().catch(()=>{});return {imageExcluded:true,type};}
    const chunks=[];let size=0;
    if(response.body){const reader=response.body.getReader();try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>maxBytes){await reader.cancel().catch(()=>{});return {tooLarge:true,size};}chunks.push(part.value);}}finally{reader.releaseLock();}}
    else{const bytes=new Uint8Array(await response.arrayBuffer());size=bytes.length;if(size>maxBytes)return {tooLarge:true,size};chunks.push(bytes);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    if(type.includes('json')){
      let obj;try{obj=await new Response(bytes).json();}catch{if(url.origin===location.origin && url.pathname!=='/backend-api/estuary/content')return {status:502,error:'Malformed attachment JSON response.'};}
      if(obj){
        if(obj.status==='error' || obj.error_code || obj.error_type || obj.error && url.origin===location.origin)return {status:/not_found|missing/i.test(String(obj.error_code || obj.error_type || obj.error))?404:502,error:String(obj.error_code || obj.error_type || 'Attachment service returned an error instead of a file.')};
        const next=obj.download_url || obj.download_link || obj.downloadUrl || (obj.status==='success'?obj.url:null);
        if(next){if(excludeImages && (/^image\//i.test(obj.mime_type || obj.content_type || obj.metadata?.mime_type || '') || imageName(obj.file_name || obj.filename || obj.metadata?.file_name)))return {imageExcluded:true,type:obj.mime_type || obj.content_type || obj.metadata?.mime_type || 'image/unknown'};const declared=Number(obj.file_size_bytes ?? obj.file_size ?? obj.size_bytes ?? 0);if(declared>maxBytes)return {tooLarge:true,size:declared};return await fetchAssetCandidate(next,scope,maxBytes,visited,deadline,excludeImages);}
        if(obj.status==='success' && url.pathname!=='/backend-api/estuary/content')return {status:502,error:'Attachment link response contained no download URL.'};
      }
    }
    if(type.includes('text/html') && url.origin===location.origin && url.pathname!=='/backend-api/estuary/content')return {status:403,error:'Attachment route returned a sign-in or browser-check page instead of a file.'};
    return {bytes,type,size,disposition:response.headers.get('content-disposition') || ''};
  }

  function toBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000)));return btoa(binary);}
  async function rpc(args) {
    try {
      if(args.op==='sense') {
        const verified=matches(args.scope);if(!verified && (user || workspace()!==(args.scope.account || null)))return {ok:false,status:409,kind:'unverified'};
        if(lastPath!==location.pathname){lastPath=location.pathname;routeAt=Date.now();}const scope=snapshotScope();const current=location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);if(current)hint({id:current[1]},scope,'open chat URL');
        for(const link of document.querySelectorAll('a[href]')) {try {const u=new URL(link.getAttribute('href'),location.origin);if(u.origin!==location.origin)continue;const m=u.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);if(m)hint({id:m[1],title:link.textContent?.trim().slice(0,300)},scope,'visible app link');} catch {}}
        const challenge=!!document.querySelector('iframe[src*="challenges.cloudflare.com"],iframe[src*="/challenge-platform/"]') || /^just a moment\.{0,3}$/i.test(document.title.trim()),links=[...hints.values()].filter(scoped);
        return {ok:true,status:200,verified,documentId,loadedAt,routeAt,readyState:document.readyState,inFlight,activeStreams,lastStart,lastWrite,lastUserInteraction,events:events.filter(e=>Date.now()-e.at<300000),blocked:challenge?'A browser check is visible. Complete it in the ChatGPT tab, then resume.':blocked,limit:verified&&scoped(lastLimit)?lastLimit:null,hints:verified?links.map(({scope,...h})=>h):links.filter(h=>['open chat URL','visible app link'].includes(h.origin)).map(h=>({id:h.id,origin:'open-tab link (server access checked on retrieval)'})),projects:verified?[...projects.values()].filter(scoped).map(({scope,...p})=>p):[],captured:verified?[...captured.entries()].filter(([,v])=>scoped(v)).map(([id,v])=>({id,at:v.at})):[],changedChats:verified?[...changedChats.values()].filter(scoped).map(({scope,...v})=>v):[],libraryObservations:verified?[...libraryItems.values()].filter(scoped).map(v=>({item:v.item,at:v.at})):[],libraryItems:verified?[...libraryItems.values()].filter(scoped).map(v=>v.item):[],fileRoutes:verified?[...fileRoutes.values()].filter(scoped).map(({scope,...r})=>r):[]};
      }
      if(args.op==='cached'){if(!matches(args.scope))return {ok:false,status:409};const entry=captured.get(args.id);return entry && scoped(entry) ? {ok:true,status:200,data:entry.data,at:entry.at} : {ok:true,status:204};}
      if (args.op === 'context') {await session(true);return {ok:true, scope:snapshotScope(), status:200};}
      await session();
      if(args.op==='assetPrepare'){
        // ChatGPT can issue native requests for more than one workspace in the same
        // page session. Do not let that volatile header flip invalidate a file read:
        // pin the explicit workspace saved with this backup, while still requiring
        // the same signed-in user.
        if(!args.scope || args.scope.user!==user)return {ok:false,status:409,kind:'account',error:'The signed-in user changed. Reconnect before retrieving attachments.'};
        const max=Math.min(10*1024*1024,Math.max(1,Number(args.maxBytes)||10*1024*1024)),candidates=[...(args.candidates || [])];
        const libraryRoute=args.library&&args.fileId?libraryRoutes.get(args.fileId):null;if(libraryRoute&&scoped(libraryRoute))candidates.unshift(libraryRoute.url);
        const remembered=args.fileId?fileRoutes.get(args.fileId):null;if(remembered?.path && (!remembered.scope?.user || remembered.scope.user===args.scope.user))candidates.unshift(remembered.path);
        const deadline=Date.now()+60000;let last=null;const attempts=[];for(const candidate of [...new Set(candidates)].slice(0,5)){const got=await fetchAssetCandidate(candidate,args.scope,max,new Set(),deadline,args.excludeImages===true);if(!got)continue;attempts.push({route:new URL(candidate,location.origin).pathname,status:got.status || (got.tooLarge?413:200)});if(got.status===429 || got.status===401)return {ok:false,status:got.status,retryAfter:got.retryAfter,error:got.error,attempts};if(got.status){last=got;continue;}if(got.imageExcluded)return {ok:false,status:200,imageExcluded:true,type:got.type,error:'Image downloads are switched off.',attempts};if(got.tooLarge)return {ok:false,status:413,size:got.size,error:'Attachment exceeds the 10 MB limit.',attempts};const key=crypto.randomUUID();preparedAssets.set(key,{...got,at:Date.now(),ownerUser:args.scope.user});while(preparedAssets.size>3)preparedAssets.delete(preparedAssets.keys().next().value);return {ok:true,status:200,key,size:got.size,type:got.type,disposition:got.disposition,attempts};}return {ok:false,status:last?.status || 404,error:last?.error || 'No readable attachment download route was available.',attempts};
      }
      // assetPrepare already authenticated and fetched the bytes. Chunking/releasing
      // those prepared bytes is local page-memory work, so a volatile workspace
      // header must not invalidate it. Keep the signed-in user boundary only.
      if(args.op==='assetChunk'){const a=preparedAssets.get(args.key);if(!a)return {ok:false,status:404,error:'Prepared attachment expired.'};if(a.ownerUser && a.ownerUser!==user)return {ok:false,status:409,kind:'account',error:'The signed-in user changed while reading a prepared attachment.'};const start=Math.max(0,Number(args.offset)||0),end=Math.min(a.bytes.length,start+Math.min(384*1024,Number(args.length)||384*1024));return {ok:true,status:200,offset:start,next:end,done:end>=a.bytes.length,base64:toBase64(a.bytes.subarray(start,end))};}
      if(args.op==='assetRelease'){const a=preparedAssets.get(args.key);if(a?.ownerUser && a.ownerUser!==user)return {ok:false,status:409,kind:'account',error:'The signed-in user changed while releasing a prepared attachment.'};preparedAssets.delete(args.key);return {ok:true,status:204};}
      if (!matches(args.scope)) return {ok:false,status:409,kind:'account',error:'The signed-in user or workspace changed. Reconnect to the original workspace before resuming.'};
      if (args.op === 'peek') {const entry = captured.get(args.id);if (entry && entry.at >= args.since && (!entry.scope.user || entry.scope.user === user) && (entry.scope.account || null) === (args.scope.account || null)) return {ok:true,status:200,data:entry.data};return {ok:true,status:204,limit:lastLimit};}
      if(args.op==='libraryList'){
        if(lastLimit && lastLimit.at>(args.lastLimitSeen || 0))return {ok:false,status:429,retryAfter:lastLimit.retryAfter,observedAt:lastLimit.at};
        const source=args.source || {},params=new URLSearchParams({entry_surface:'library',include_hidden_files:'false',include_files:'true',include_saved_entities:'true',include_sites:'false',include_folder_counts:'false',hydrate_folder_thumbnails:'true',limit:'100',offset:String(Math.max(0,Number(source.offset)||0))});if(source.parent)params.set('parent_directory_id',String(source.parent));if(source.cursor)params.set('cursor',String(source.cursor));
        const nodes=source.mode!=='files',path=nodes?'/backend-api/files/library/nodes?'+params:'/backend-api/files/library';
        const response=await originalFetch(path,{method:nodes?'GET':'POST',credentials:'include',headers:{...authHeaders(args.scope),accept:'application/json',...nodes?{}:{'content-type':'application/json'}},...nodes?{}:{body:JSON.stringify({limit:100,cursor:source.cursor || null,categories:[],source:null,include_hidden_files:false,include_saved_entities:true,include_sites:false,trashed_only:false,ranking:'recent',providers:[],offset:Math.max(0,Number(source.offset)||0)})},signal:AbortSignal.timeout(60000)});
        if(!response.ok)return {ok:false,status:response.status,retryAfter:response.headers.get('retry-after')};
        if(!(response.headers.get('content-type') || '').includes('json'))return {ok:false,status:403,error:'Open the Library in ChatGPT and finish sign-in or browser verification.'};
        const observed=response.clone(),data=await response.json();if(!matches(args.scope))return {ok:false,status:409,error:'Workspace changed during Library discovery.'};void observe(observed,new URL(path,location.origin),args.scope).catch(()=>{});return {ok:true,status:200,data};
      }
      if (args.op !== 'get' || !allowed(args.path)) return {ok:false,status:400,error:'Unsupported request'};
      if (lastLimit && lastLimit.at > (args.lastLimitSeen || 0)) return {ok:false,status:429,retryAfter:lastLimit.retryAfter,observedAt:lastLimit.at};
      const response = await originalFetch(args.path, {method:'GET', credentials:'include',headers:{...authHeaders(args.scope),accept:'application/json'},signal:AbortSignal.timeout(60000)});if (response.status === 401) {token = null; sessionAt = 0;}if (!response.ok) return {ok:false,status:response.status,retryAfter:response.headers.get('retry-after')};if (!(response.headers.get('content-type') || '').includes('json')) return {ok:false,status:403,kind:'challenge',error:'A web page was returned instead of conversation data. Open ChatGPT to check sign-in or browser verification, then resume.'};
      const data = await response.json();if (!matches(args.scope)) return {ok:false,status:409,kind:'account',error:'Workspace changed during the request.'};return {ok:true,status:200,data};
    } catch (error) {return {ok:false,status:error.status || 0,retryAfter:error.retryAfter,error:error.status ? error.message : 'Connection interrupted or request timed out.'};}
  }
  Object.defineProperty(window,'__englishExporterBridgeV2411',{value:{rpc,version:'2.4.11'}, configurable:false,writable:false});
  if(!window.__englishExporterBridgeV2410)Object.defineProperty(window,'__englishExporterBridgeV2410',{value:window.__englishExporterBridgeV2411});
  if(!window.__englishExporterBridgeV249)Object.defineProperty(window,'__englishExporterBridgeV249',{value:window.__englishExporterBridgeV2411});
  if(!window.__englishExporterBridgeV248)Object.defineProperty(window,'__englishExporterBridgeV248',{value:window.__englishExporterBridgeV2411});
  if(!window.__englishExporterBridgeV247)Object.defineProperty(window,'__englishExporterBridgeV247',{value:window.__englishExporterBridgeV2411});
  if(!window.__englishExporterBridgeV246)Object.defineProperty(window,'__englishExporterBridgeV246',{value:window.__englishExporterBridgeV2411});
  if(!window.__englishExporterBridgeV245)Object.defineProperty(window,'__englishExporterBridgeV245',{value:window.__englishExporterBridgeV2411});
  if(!window.__englishExporterBridgeV244)Object.defineProperty(window,'__englishExporterBridgeV244',{value:window.__englishExporterBridgeV2411});
  if(!window.__englishExporterBridgeV243)Object.defineProperty(window,'__englishExporterBridgeV243',{value:window.__englishExporterBridgeV2411});
  if(!window.__englishExporterBridgeV242)Object.defineProperty(window,'__englishExporterBridgeV242',{value:window.__englishExporterBridgeV2411});
  if(!window.__englishExporterBridgeV240)Object.defineProperty(window,'__englishExporterBridgeV240',{value:window.__englishExporterBridgeV2411});
  if(!window.__englishExporterBridgeV238)Object.defineProperty(window,'__englishExporterBridgeV238',{value:window.__englishExporterBridgeV2411});
})();
