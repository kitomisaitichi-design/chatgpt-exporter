import {scanLocalFileCopies,registerLocalCandidate,removeLocalCandidate} from './local-files.mjs';

// Session verification never survives reopening. Stored hashes only narrow candidates.
export class LocalIndexSession {
  constructor({load,save,scan=scanLocalFileCopies,onError=()=>{}}){Object.assign(this,{load,save,scan,onError});this.generation=0;this.dirty=new Map();this.index=null;this.building=null;this.timer=null;this.writing=null;this.scope=null;}
  async reset(){this.generation++;this.index=null;this.building=null;await this.flush();this.scope=null;}
  async build(roots,scope,{rescan=false,...options}={}){
    if(this.scope&&this.scope!==scope)await this.reset();this.scope=scope;
    if(this.building)return this.building;if(this.index&&!rescan){if(this.dirty.size)await this.flush();return this.index;}
    const generation=this.generation,old=this.index;const task=(async()=>{
      const prior=old || await this.load(scope),checkpoint=async()=>{if(generation!==this.generation)throw Object.assign(Error('Local folder selection changed.'),{name:'Paused'});await options.checkpoint?.();};
      const index=await this.scan(roots,scope,{...options,priorIndex:prior,checkpoint});await checkpoint();index.onDirty=c=>{if(generation===this.generation)this.changed(c);};this.index=index;
      for(const c of index.records.values())this.changed(c);for(const [key,c] of prior?.records || [])if(!index.records.has(key))this.changed({...c,key,deleted:true});
      await this.flush();await checkpoint();return index;
    })();this.building=task;try{return await task;}finally{if(this.building===task)this.building=null;}
  }
  changed(candidate){this.dirty.set(candidate.key,{...candidate});if(this.writing)return;if(this.dirty.size>=250)void this.flush().catch(this.onError);else if(!this.timer)this.timer=setTimeout(()=>{this.timer=null;void this.flush().catch(this.onError);},2000);}
  async flush(){if(this.timer){clearTimeout(this.timer);this.timer=null;}if(this.writing){await this.writing;if(this.dirty.size)return this.flush();return;}
    const scope=this.scope;if(!scope||!this.dirty.size)return;const task=(async()=>{while(this.dirty.size){const rows=[];for(const row of this.dirty){rows.push(row);if(rows.length>=250)break;}for(const [key] of rows)this.dirty.delete(key);try{await this.save(scope,rows.map(([,c])=>{const {verified,removed,...record}=c;return {...record,schema:2};}));}catch(e){for(const [key,c] of rows)if(!this.dirty.has(key))this.dirty.set(key,c);throw e;}}})();this.writing=task;try{await task;}finally{this.writing=null;}
  }
  register(candidate){if(this.index)registerLocalCandidate(this.index,candidate);}
  remove(source,path){const c=this.index?.records.get(JSON.stringify([source,path]));if(c)removeLocalCandidate(this.index,c);}
}
