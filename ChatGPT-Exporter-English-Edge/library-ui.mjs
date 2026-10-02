import {libraryIndex,LIBRARY_FAILURE_LIMIT} from './library.mjs';

export const fileSize=n=>n==null?'Unknown size':n<1000?n+' B':n<1_000_000?(n/1000).toFixed(1)+' KB':(n/1_000_000).toFixed(2)+' MB';
export function selectLibraryFiles(files,{search='',filter='all',sort='recent',page=0,pageSize=50}={}) {
  const q=search.trim().toLocaleLowerCase(),selected=files.filter(f=>(!q||(f.name+' '+f.id).toLocaleLowerCase().includes(q)) && (filter==='all' || filter==='manual'&&f.status==='manual' || filter==='saved'&&f.status==='saved' || filter==='parked'&&f.parked || filter==='pending'&&['pending','deferred'].includes(f.status)&&!f.parked || filter==='attention'&&!['saved','manual'].includes(f.status)));
  selected.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='size'?(b.size??-1)-(a.size??-1):sort==='status'?a.status.localeCompare(b.status)||a.name.localeCompare(b.name):(Date.parse(b.updated)||0)-(Date.parse(a.updated)||0)||a.name.localeCompare(b.name));
  const size=pageSize==='all'?Math.max(1,selected.length):Math.max(1,Number(pageSize)||50),pages=Math.max(1,Math.ceil(selected.length/size)),current=Math.max(0,Math.min(pages-1,page));
  return {files:selected.slice(current*size,(current+1)*size),total:selected.length,page:current,pages,start:selected.length?current*size+1:0,end:Math.min(selected.length,(current+1)*size)};
}
const label=f=>f.parked?'Parked':({saved:'Saved',manual:'Manual',pending:'Queued',deferred:'Waiting',unavailable:'Unavailable','permission-unavailable':'Access denied'}[f.status] || f.status);
export class LibraryPanel {
  constructor(document,{retry,onError}) {
    this.doc=document;this.$=id=>document.getElementById(id);this.page=0;this.key='';this.view='list';this.retry=retry;this.onError=onError;
    for(const id of ['library-search','library-filter','library-sort','library-page-size'])this.$(id).addEventListener(id==='library-search'?'input':'change',()=>{this.page=0;this.key='';this.render();});
    for(const id of ['library-first','library-prev','library-next','library-last'])this.$(id).addEventListener('click',()=>{this.page=id==='library-first'?0:id==='library-last'?this.pages-1:this.page+(id==='library-next'?1:-1);this.key='';this.render();this.$('library-files').scrollTop=0;});
    for(const view of ['list','grid'])this.$('library-'+view).addEventListener('click',()=>{this.view=view;this.key='';this.render();});
    this.$('library-files').addEventListener('click',e=>{const button=e.target.closest('button[data-retry]');if(button&&!button.disabled)Promise.resolve(this.retry(button.dataset.retry)).catch(this.onError);});
    for(const button of document.querySelectorAll('[data-library-filter]'))button.addEventListener('click',()=>{this.$('library-filter').value=button.dataset.libraryFilter;this.page=0;this.key='';this.render();});
  }
  node(tag,className,text){const n=this.doc.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
  update(job,controls={}){this.job=job;this.controls=controls;this.render();}
  render(){
    const s=this.job?.library,all=Object.values(s?.entries || {}),counts={saved:0,pending:0,parked:0,manual:0};for(const f of all){if(f.parked)counts.parked++;else if(['pending','deferred'].includes(f.status))counts.pending++;else if(f.status in counts)counts[f.status]++;}
    for(const [key,n] of Object.entries(counts))this.$('library-count-'+key).textContent=n.toLocaleString();
    const index=this.job?libraryIndex(this.job):null,sources=s?.sources || [],done=sources.filter(x=>x.done&&!x.error).length,unsupported=sources.reduce((n,x)=>n+(x.unsupported || 0),0),external=Object.values(s?.directories || {}).filter(x=>x.external).length;
    this.$('library-total').textContent=all.length.toLocaleString()+' files';
    this.$('library-summary').textContent=all.length?fileSize(all.filter(f=>f.status==='saved').reduce((n,f)=>n+(f.size || 0),0))+' kept locally · automatic downloads under 10 MB':'Discover your files, save small downloads, and keep larger items within reach.';
    this.$('library-status').textContent=this.job?.options?.library===false?'Automatic Library backup is off.':sources.some(x=>x.error)?'Scan needs attention · '+sources.filter(x=>x.error).map(x=>x.error).join('; '):index?.coverage_complete?'Inventory complete · '+done+' folders scanned'+(external?' · '+external+' connected folders available in ChatGPT':''):sources.length?'Discovering files · '+done+'/'+sources.length+' folders finished'+(unsupported?' · '+unsupported+' unsupported entries skipped':''):'Ready to discover · scan your Library to begin.';
    this.$('library-discovery').max=Math.max(1,sources.length);this.$('library-discovery').value=done;
    const result=selectLibraryFiles(all,{search:this.$('library-search').value,filter:this.$('library-filter').value,sort:this.$('library-sort').value,page:this.page,pageSize:this.$('library-page-size').value});this.page=result.page;this.pages=result.pages;
    this.$('library-range').textContent=result.total?result.start+'–'+result.end+' of '+result.total.toLocaleString()+' files':'0 files';this.$('library-page').textContent='Page '+(this.page+1)+' of '+result.pages;
    for(const id of ['first','prev','next','last'])this.$('library-'+id).disabled=['first','prev'].includes(id)?this.page===0:this.page===result.pages-1;
    for(const v of ['list','grid'])this.$('library-'+v).setAttribute('aria-pressed',String(v===this.view));
    const enabled=!this.controls.running&&this.controls.canEdit!==false&&!this.controls.initializing;
    const key=JSON.stringify([result.files.map(f=>[f.id,f.name,f.size,f.status,f.parked,f.attempts,f.error,f.path,f.updated,f.routesTried]),this.view,this.page,enabled]);if(key===this.key)return;this.key=key;
    const container=this.$('library-files');container.className='library-files '+this.view;const fragment=this.doc.createDocumentFragment();
    for(const f of result.files){
      const row=this.node('article','library-row'),icon=this.node('span','file-icon',(f.name.split('.').at(-1) || 'FILE').slice(0,5).toUpperCase());icon.setAttribute('aria-hidden','true');
      const info=this.node('div','file-info'),name=this.node('strong','file-name',f.name),meta=this.node('span','file-meta',fileSize(f.size)+(f.updated&&Number.isFinite(Date.parse(f.updated))?' · '+new Date(f.updated).toLocaleDateString():''));info.append(name,meta);
      const status=this.node('span','file-badge',label(f));status.dataset.status=f.parked?'parked':f.status;
      const actions=this.node('div','file-actions'),link=this.node('a','file-open','Open in ChatGPT ↗');link.href=f.parent?'https://chatgpt.com/library/d/'+encodeURIComponent(f.parent):'https://chatgpt.com/library';link.target='_blank';link.rel='noopener';actions.append(link);
      if(!['saved','manual','pending'].includes(f.status)||f.parked){const retry=this.node('button','file-retry','Retry this file');retry.dataset.retry=f.id;retry.disabled=!enabled;actions.append(retry);}
      const details=this.node('details','file-details'),summary=this.node('summary',null,'Details');details.append(summary);
      const reason=f.parked?`Skipped after ${f.attempts || LIBRARY_FAILURE_LIMIT} failed attempts. Scans and restarts keep it parked until you retry this file.`:f.status==='manual'?(f.external?'Connected file · open its provider through ChatGPT.':'10 MB or larger · download it manually in ChatGPT, then import the copy in Viewer.'):f.status==='saved'?'Verified local copy · available in Viewer Files & Library.':f.attempts?`Attempt ${f.attempts}/${LIBRARY_FAILURE_LIMIT} failed; one more failure parks this file.`:'Waiting in the download queue.';
      details.append(this.node('p','file-reason',reason));if(f.error)details.append(this.node('p','file-error',f.error));if(f.path)details.append(this.node('small',null,f.path));
      if(f.routesTried?.length)details.append(this.node('small','file-route',f.routesTried.map(r=>r.route+' · HTTP '+r.status).join('\n')));
      for(const cid of f.conversationIds || []){const chat=this.node('a','file-source','Source chat ↗');chat.href='https://chatgpt.com/c/'+encodeURIComponent(cid);chat.target='_blank';chat.rel='noopener';details.append(chat);}
      row.append(icon,info,status,actions,details);fragment.append(row);
    }
    if(!result.files.length){const empty=this.node('div','library-empty');empty.append(this.node('span','empty-icon','◇'),this.node('h3',null,all.length?'No matching files':'Your Library, gathered here'),this.node('p',null,all.length?'Try another filter or search.':'Scan to browse files from your chats and folders. Larger files get a manual download link.'));fragment.append(empty);}
    container.replaceChildren(fragment);
  }
}
