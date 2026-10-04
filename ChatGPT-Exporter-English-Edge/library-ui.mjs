import {createLibraryView} from './library-view.mjs';
import {LIBRARY_FAILURE_LIMIT} from './library.mjs';
import {analyzeFiles} from './file-intelligence.mjs';
import {epoch} from './core.mjs';

export const fileSize=n=>n==null?'Unknown size':n<1000?n+' B':n<1_000_000?(n/1000).toFixed(1)+' KB':(n/1_000_000).toFixed(2)+' MB';
const sourceDate=value=>new Date(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T12:00:00':epoch(value));
export function selectLibraryFiles(files,{search='',filter='all',sort='recent',page=0,pageSize=50,analysis=analyzeFiles(files)}={}) {
  const q=search.trim().toLocaleLowerCase(),selected=files.filter(f=>(!q||(f.name+' '+f.id).toLocaleLowerCase().includes(q)) && (filter==='all' || filter==='both'&&new Set((f.sourceRefs || []).map(r=>r.kind)).size===2 || filter==='chat-only'&&(f.sourceRefs || []).some(r=>r.kind==='chat')&&!(f.sourceRefs || []).some(r=>r.kind==='library') || filter==='retained'&&(f.sourceRefs || []).some(r=>r.presence!=='observed') || filter==='duplicates'&&(analysis.get(f.id)?.duplicate || f.duplicate) || filter==='versions'&&analysis.get(f.id)?.version || filter==='preferred'&&analysis.get(f.id)?.version?.role==='preferred' || filter==='images-off'&&f.imageExcluded || filter==='manual'&&f.status==='manual' || filter==='saved'&&f.status==='saved' || filter==='parked'&&f.parked || filter==='pending'&&['pending','deferred'].includes(f.status)&&!f.parked || filter==='attention'&&!['saved','manual'].includes(f.status)));
  selected.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='size'?(b.size??-1)-(a.size??-1):sort==='status'?a.status.localeCompare(b.status)||a.name.localeCompare(b.name):(epoch(b.updated)||epoch(b.uploaded)||epoch(b.created))-(epoch(a.updated)||epoch(a.uploaded)||epoch(a.created))||a.name.localeCompare(b.name));
  const size=pageSize==='all'?Math.max(1,Math.min(500,selected.length)):Math.max(1,Number(pageSize)||50),pages=Math.max(1,Math.ceil(selected.length/size)),current=Math.max(0,Math.min(pages-1,page));
  return {files:selected.slice(current*size,(current+1)*size),total:selected.length,page:current,pages,start:selected.length?current*size+1:0,end:Math.min(selected.length,(current+1)*size)};
}
const label=f=>f.parked?'Parked':f.imageExcluded?'Images off':f.duplicate&&f.status==='saved'?'Shared copy':({saved:'Saved',manual:'Manual',pending:'Queued',deferred:'Waiting',unavailable:'Unavailable','permission-unavailable':'Access denied'}[f.status] || f.status);
export class LibraryPanel {
  constructor(document,{retry,onError}) {
    this.doc=document;this.$=id=>document.getElementById(id);this.page=0;this.key='';this.view='list';this.getView=createLibraryView();this.inputKey='';this.retry=retry;this.onError=onError;
    for(const id of ['library-search','library-filter','library-sort','library-page-size'])this.$(id).addEventListener(id==='library-search'?'input':'change',()=>{this.page=0;this.key='';if(id==='library-search'){clearTimeout(this.searchTimer);this.searchTimer=setTimeout(()=>this.render(),120);}else this.render();});
    for(const id of ['library-first','library-prev','library-next','library-last'])this.$(id).addEventListener('click',()=>{this.page=id==='library-first'?0:id==='library-last'?this.pages-1:this.page+(id==='library-next'?1:-1);this.key='';this.render();this.$('library-files').scrollTop=0;});
    for(const view of ['list','grid'])this.$('library-'+view).addEventListener('click',()=>{this.view=view;this.key='';this.render();});
    this.$('library-files').addEventListener('click',e=>{const button=e.target.closest('button[data-retry]');if(button&&!button.disabled)Promise.resolve(this.retry(button.dataset.retry)).catch(this.onError);});
    for(const button of document.querySelectorAll('[data-library-filter]'))button.addEventListener('click',()=>{this.$('library-filter').value=button.dataset.libraryFilter;this.page=0;this.key='';this.render();});
  }
  node(tag,className,text){const n=this.doc.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
  update(job,controls={}){this.job=job;this.controls=controls;this.render();}
  render(){
    const model=this.getView(this.job),inputKey=JSON.stringify([this.$('library-search').value,this.$('library-filter').value,this.$('library-sort').value,this.$('library-page-size').value,this.page,this.view,this.controls]);
    if(model===this.model&&inputKey===this.inputKey&&this.key)return;this.model=model;this.inputKey=inputKey;
    const s=this.job?.library,{all,analysis,counts,sources,done,unsupported,external}=model;
    for(const [key,n] of Object.entries(counts))this.$('library-count-'+key).textContent=n.toLocaleString();
    this.$('library-total').textContent=all.length.toLocaleString()+' files';
    this.$('library-summary').textContent=all.length?fileSize(model.bytes)+' in unique local copies · automatic downloads under 10 MB':'Discover your files, save small downloads, and keep larger items within reach.';
    const duplicateCount=model.duplicates,versionCount=model.versions;
    this.$('library-intelligence-summary').textContent=duplicateCount+' identical-content aliases · '+versionCount+' version families · '+(this.job?.options?.downloadImages===false?'images excluded from new downloads':'image downloads on')+'.'+(s?.deduplication?' Last smart scan: '+s.deduplication.checked+' local files checked; '+fileSize(s.deduplication.reclaimedBytes || 0)+' reclaimed.':'');
    this.$('library-status').textContent=this.job?.options?.library===false?'Automatic Library backup is off.':sources.some(x=>x.error)?'Scan needs attention · '+sources.filter(x=>x.error).map(x=>x.error).join('; '):model.coverageComplete?'Inventory complete · '+done+' folders scanned'+(external?' · '+external+' connected folders available in ChatGPT':''):sources.length?'Discovering files · '+done+'/'+sources.length+' folders finished'+(unsupported?' · '+unsupported+' unsupported entries skipped':''):'Ready to discover · scan your Library to begin.';
    this.$('library-discovery').max=Math.max(1,sources.length);this.$('library-discovery').value=done;
    const result=selectLibraryFiles(all,{search:this.$('library-search').value,filter:this.$('library-filter').value,sort:this.$('library-sort').value,page:this.page,pageSize:this.$('library-page-size').value,analysis});this.page=result.page;this.pages=result.pages;
    this.$('library-range').textContent=result.total?result.start+'–'+result.end+' of '+result.total.toLocaleString()+' files'+(this.$('library-page-size').value==='all'&&result.total>500?' · 500 per page to keep browsing responsive':''):'0 files';this.$('library-page').textContent='Page '+(this.page+1)+' of '+result.pages;
    for(const id of ['first','prev','next','last'])this.$('library-'+id).disabled=['first','prev'].includes(id)?this.page===0:this.page===result.pages-1;
    for(const v of ['list','grid'])this.$('library-'+v).setAttribute('aria-pressed',String(v===this.view));
    const enabled=!this.controls.running&&this.controls.canEdit!==false&&!this.controls.initializing;
    const key=JSON.stringify([result.files.map(f=>[f.id,f.name,f.size,f.status,f.parked,f.attempts,f.error,f.path,f.updated,f.uploaded,f.created,f.firstModified,f.sha256,f.parent,f.sourceConversationId,f.sourceRefs?.map(r=>[r.kind,r.presence,r.name,r.conversationId]),f.routesTried,f.imageExcluded,f.duplicate,analysis.get(f.id)]),this.view,this.page,enabled]);if(key===this.key)return;this.key=key;
    const container=this.$('library-files'),expanded=new Set([...container.querySelectorAll('article[data-file-key]')].filter(row=>row.querySelector('details')?.open).map(row=>row.dataset.fileKey)),active=this.doc.activeElement,focusKey=active?.closest('.library-row')?.dataset.fileKey,focusSelector=active?.matches('summary')?'summary':active?.matches('[data-retry]')?'[data-retry]':active?.matches('.file-open')?'.file-open':null;
    container.className='library-files '+this.view;const fragment=this.doc.createDocumentFragment();
    for(const f of result.files){
      const row=this.node('article','library-row'),icon=this.node('span','file-icon',(f.name.split('.').at(-1) || 'FILE').slice(0,5).toUpperCase());icon.setAttribute('aria-hidden','true');
      const intel=analysis.get(f.id) || {},info=this.node('div','file-info'),name=this.node('strong','file-name',f.name),date=f.updated || f.uploaded || f.created,meta=this.node('span','file-meta',fileSize(f.size)+(epoch(date)?' · '+sourceDate(date).toLocaleDateString():''));info.append(name,meta);
      if(intel.version){const v=intel.version,badge=this.node('span','file-version',({preferred:'Preferred version',earlier:'Earlier version',identical:'Same content','larger-candidate':'Larger · review',review:'Version · review'}[v.role]));badge.dataset.role=v.role;info.append(badge);}
      const status=this.node('span','file-badge',label(f));status.dataset.status=f.parked?'parked':f.status;
      const actions=this.node('div','file-actions'),link=this.node('a','file-open','Open in ChatGPT ↗');link.href=f.retainedSource&&f.sourceKind==='chat'?'https://chatgpt.com/c/'+encodeURIComponent(f.sourceConversationId || f.conversationIds?.[0] || ''):f.parent?'https://chatgpt.com/library/d/'+encodeURIComponent(f.parent):'https://chatgpt.com/library';link.target='_blank';link.rel='noopener';actions.append(link);
      if(!['saved','manual','pending'].includes(f.status)||f.parked){const retry=this.node('button','file-retry','Retry this file');retry.dataset.retry=f.sourceKey || f.id;retry.disabled=!enabled;actions.append(retry);}
      row.dataset.fileKey=f.sourceKey || f.id;const details=this.node('details','file-details');details.open=expanded.has(row.dataset.fileKey);const summary=this.node('summary',null,'Details');details.append(summary);
      const reason=f.parked?`Skipped after ${f.attempts || LIBRARY_FAILURE_LIMIT} failed attempts. Scans and restarts keep it parked until you retry this file.`:f.imageExcluded?'Image downloads are switched off. Enable Download images to resume eligible images.':f.status==='manual'?(f.external?'Connected file · open its provider through ChatGPT.':'10 MB or larger · download it manually in ChatGPT, then import the copy in Viewer.'):f.status==='saved'?'Verified local copy · available in Viewer Files & Library.':f.attempts?`Attempt ${f.attempts}/${LIBRARY_FAILURE_LIMIT} failed; one more failure parks this file.`:'Waiting in the download queue.';
      const refs=f.sourceRefs || [],kinds=new Set(refs.map(r=>r.kind));
      info.append(this.node('span','file-meta',kinds.size===2?'Chat + Library · linked file':kinds.has('chat')?'Chat attachment · retained record':'Library file'));
      for(const ref of refs)if(ref.name&&ref.name!==f.name)details.append(this.node('small',null,(ref.kind==='chat'?'Chat attachment name: ':'Library name: ')+ref.name));
      for(const ref of refs)if(ref.presence!=='observed')details.append(this.node('p','file-reason',ref.presence==='previous-version'?'Previous verified version retained.':ref.presence==='chat-unavailable'?'Source chat is currently unavailable. Saved files remain available; Library routes can still be used.':ref.kind==='library'?'Not seen in the last complete Library scan. Saved copies remain available; a chat route may still work.':'Not seen in the latest saved chat body. The file and its Library references remain in the backup.'));
      details.append(this.node('p','file-reason',reason));if(f.error)details.append(this.node('p','file-error',f.error));if(f.path)details.append(this.node('small',null,f.path));
      if(intel.duplicate || f.duplicate)details.append(this.node('p','file-hash','SHA-256 verified · identical content shares a saved copy'+(intel.duplicate?' with '+intel.duplicate.canonicalName:'.')));
      if(f.sha256)details.append(this.node('small','file-hash',f.sha256));
      if(intel.version){const v=intel.version;details.append(this.node('p','file-version-reason',v.reason+(v.preferredName?' · candidate: '+v.preferredName:'')+' Distinct contents are retained.'));
        for(const [label,date] of [['Modified',f.updated],['Uploaded / created',f.uploaded || f.created],['First modified',f.firstModified]])if(epoch(date))details.append(this.node('small',null,label+': '+sourceDate(date).toLocaleString()));}
      if(f.routesTried?.length)details.append(this.node('small','file-route',f.routesTried.map(r=>r.route+' · HTTP '+r.status).join('\n')));
      for(const cid of f.conversationIds || []){const chat=this.node('a','file-source','Source chat ↗');chat.href='https://chatgpt.com/c/'+encodeURIComponent(cid);chat.target='_blank';chat.rel='noopener';details.append(chat);}
      row.append(icon,info,status,actions,details);fragment.append(row);
    }
    if(!result.files.length){const empty=this.node('div','library-empty');empty.append(this.node('span','empty-icon','◇'),this.node('h3',null,all.length?'No matching files':'Your Library, gathered here'),this.node('p',null,all.length?'Try another filter or search.':'Scan to browse files from your chats and folders. Larger files get a manual download link.'));fragment.append(empty);}
    container.replaceChildren(fragment);
    if(focusKey&&focusSelector)[...container.querySelectorAll('article[data-file-key]')].find(row=>row.dataset.fileKey===focusKey)?.querySelector(focusSelector)?.focus({preventScroll:true});
  }
}
