import {libraryIndex,manualFiles} from './library.mjs';
import {catalogHTML} from './interop.mjs';

// Persist a fresh snapshot every two seconds, and always flush at a stop or finish.
// Unchanged chat exports no longer rewrite four Library catalogs.
export class CatalogWriter {
  constructor(write,now=()=>Date.now()){this.write=write;this.now=now;this.root=null;this.signature='';this.lastAt=-Infinity;}
  async report(job,root,force=false){
    if(root!==this.root){this.root=root;this.signature='';this.lastAt=-Infinity;}
    const index=libraryIndex(job),signature=JSON.stringify({...index,generated_at:null});
    if(signature===this.signature || !force && this.now()-this.lastAt<2000)return false;
    await this.write('attachments/library-index.json',JSON.stringify(index,null,2));
    await this.write('attachments/manual-downloads.json',JSON.stringify({schema:'chatgpt-manual-downloads/v1',entries:manualFiles(job)},null,2));
    await this.write('attachments/library-catalog.html',catalogHTML(job));
    await this.write('attachments/manual-downloads.html',catalogHTML(job,true));
    this.signature=signature;this.lastAt=this.now();return true;
  }
}
