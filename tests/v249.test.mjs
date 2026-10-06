import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {newJob,mergeEntry} from '../ChatGPT-Exporter-English-Edge/core.mjs';
import {Engine} from '../ChatGPT-Exporter-English-Edge/engine.mjs';
import {resolveBackupFolder,scanTranscriptInventory} from '../ChatGPT-Exporter-English-Edge/local-detection.mjs';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const scope={key:'fixture-key',user:'fixture',account:'workspace'},id='chat_existing_one';
const body=t=>({conversation_id:id,title:'Fixture',update_time:t,mapping:{node:{message:{author:{role:'user'},content:{parts:['existing']}}}}});
const hash=d=>createHash('sha256').update(JSON.stringify(d)).digest('hex');
test('a newer verified local body does not become a server refresh on resume',async()=>{
 const j=newJob(scope,{});mergeEntry(j,{id,update_time:1});j.entries[id].contentHash=hash(body(1));
 await new Engine(j,{save:async()=>{}}).reconcileInventory([{id,update_time:2,contentHash:hash(body(2)),validated:true,diskBacked:true,basename:'renamed',origin:'validated existing backup file'}]);
 assert.equal(j.entries[id].refresh,false);assert.equal(j.entries[id].status,'saved');assert.equal(j.entries[id].contentHash,hash(body(2)));
});
test('matching checked disk body repairs stale timestamp refresh without clearing a completed reply',async()=>{
 const j=newJob(scope,{});mergeEntry(j,{id,update_time:3});Object.assign(j.entries[id],{refresh:true,changeReason:'newer server update timestamp',contentHash:hash(body(2)),checkedUpdateTime:3});
 const item={id,update_time:2,checkedUpdateTime:3,contentHash:hash(body(2)),validated:true,diskBacked:true,basename:'renamed',origin:'validated existing backup file'};
 const e=new Engine(j,{save:async()=>{}});await e.reconcileInventory([item]);assert.equal(j.entries[id].status,'saved');assert.equal(j.entries[id].refresh,false);
 Object.assign(j.entries[id],{status:'pending',refresh:true,nativeWriteAt:9999,changeReason:'ChatGPT reply completed'});await e.reconcileInventory([item]);assert.equal(j.entries[id].status,'pending');assert.equal(j.entries[id].refresh,true);
});
test('a genuine newer server timestamp still forces a fresh read',async()=>{
 const j=newJob(scope,{});mergeEntry(j,{id,update_time:2});Object.assign(j.entries[id],{status:'saved',contentHash:hash(body(2)),checkedUpdateTime:2});mergeEntry(j,{id,update_time:3,origin:'active'});
 await new Engine(j,{save:async()=>{}}).reconcileInventory([{id,update_time:2,contentHash:hash(body(2)),validated:true,diskBacked:true,origin:'validated existing backup file'}]);assert.equal(j.entries[id].refresh,true);assert.equal(j.entries[id].status,'pending');
});
class Dir{
 constructor(name,items={}){this.kind='directory';this.name=name;this.items=items;}
 async isSameEntry(h){return h===this;}
 async getDirectoryHandle(n){if(this.items[n]?.kind==='directory')return this.items[n];throw Object.assign(Error('missing'),{name:'NotFoundError'});}
 async getFileHandle(n){if(this.items[n]?.kind==='file')return this.items[n];throw Object.assign(Error('missing'),{name:'NotFoundError'});}
 async *entries(){yield*Object.entries(this.items);}
}
const file=(name,data)=>({kind:'file',name,mtime:1,reads:0,async isSameEntry(h){return h===this;},async getFile(){const b=new Blob([JSON.stringify(data)]);Object.defineProperty(b,'lastModified',{value:this.mtime});const text=b.text.bind(b);b.text=()=>{this.reads++;return text();};return b;}});
const index=(key,entries=[])=>file('conversation-index.json',{schema:'chatgpt-conversation-index/v1',scope:key,entries});
test('a foreign outer root is searched for a matching nested root before rejection',async()=>{
 const child=new Dir('Current',{'conversation-index.json':index(scope.key)}),parent=new Dir('Older',{'conversation-index.json':index('older-key'),child});assert.equal((await resolveBackupFolder(parent,scope.key)).root,child);
 await assert.rejects(resolveBackupFolder(new Dir('Foreign',{'conversation-index.json':index('foreign')}),scope.key),/different account/);
});
test('explicit older same-user backups provide only IDs already in the current queue',async()=>{
 const root=new Dir('Older',{'conversation-index.json':index('older-key',[{id}]),'portable-state.json':file('portable-state.json',{job:{scope:{key:'older-key',user:scope.user}}}),json:new Dir('json',{'renamed.json':file('renamed.json',body(2)),'unrelated.json':file('unrelated.json',{...body(2),conversation_id:'chat_unrelated_one'})})});
 const scan=await scanTranscriptInventory(root,scope.key,{scopeUser:scope.user,knownIds:new Set([id]),hashData:async d=>hash(d)});assert.deepEqual([...scan.files.keys()],[id]);
 const expanded=await scanTranscriptInventory(root,scope.key,{scopeUser:scope.user,knownIds:new Set([id,'chat_unrelated_one']),hashData:async d=>hash(d),cache:scan.cache});assert.equal(expanded.files.size,2,'newly discovered queue IDs invalidate the prior filter');
 await assert.rejects(scanTranscriptInventory(root,scope.key,{scopeUser:'different-user',knownIds:new Set([id])}),/another workspace/);
});
test('unchanged same-handle scans reuse parsed fingerprints; changed metadata forces validation',async()=>{
 const f=file('renamed.json',body(2)),root=new Dir('Backup',{json:new Dir('json',{'renamed.json':f})});const a=await scanTranscriptInventory(root,scope.key,{hashData:async d=>hash(d)});assert.equal(f.reads,1);
 // Caller marks its found file external. That must not mutate the cached record.
 a.files.get(id).entry.diskBacked=false;
 const b=await scanTranscriptInventory(root,scope.key,{hashData:async d=>hash(d),cache:a.cache});assert.equal(f.reads,1);assert.equal(b.stats.reused,1);assert.equal(b.files.get(id).entry.diskBacked,true);
 f.mtime++;const c=await scanTranscriptInventory(root,scope.key,{hashData:async d=>hash(d),cache:b.cache});assert.equal(f.reads,2);assert.equal(c.stats.reused,0);
 root.items.json.items['renamed.json']=file('renamed.json',body(2));const d=await scanTranscriptInventory(root,scope.key,{hashData:async x=>hash(x),cache:c.cache});assert.equal(d.stats.reused,0);
});
test('overlapping parent scans do not reread an already scanned child',async()=>{
 const f=file('renamed.json',body(2)),child=new Dir('Child',{json:new Dir('json',{'renamed.json':f})}),parent=new Dir('Parent',{child});await scanTranscriptInventory(child,scope.key,{hashData:async d=>hash(d)});const scan=await scanTranscriptInventory(parent,scope.key,{excludeRoots:[child]});assert.equal(f.reads,1);assert.equal(scan.files.size,0);
});
test('a folder reset reuses identical saved bytes but preserves a newer passive body',async()=>{
 const j=newJob(scope,{});mergeEntry(j,{id,update_time:3});Object.assign(j.entries[id],{contentHash:hash(body(2)),nativeWriteAt:500,status:'pending',localPreviouslySaved:true});const item={id,update_time:2,contentHash:hash(body(2)),validated:true,diskBacked:true};const e=new Engine(j,{save:async()=>{}});await e.reconcileInventory([item]);assert.equal(j.entries[id].status,'saved');
 Object.assign(j.entries[id],{status:'pending',changeReason:'passively observed conversation body changed',observedBodyHash:hash(body(4))});await e.reconcileInventory([item]);assert.equal(j.entries[id].status,'pending');
});
test('newly discovered server metadata cannot be satisfied by an older index and body',async()=>{
 const j=newJob(scope,{attachments:false});mergeEntry(j,{id,update_time:3,origin:'active'});let requests=0;
 const e=new Engine(j,{save:async()=>{},cacheGet:async()=>({data:body(2),hash:hash(body(2))}),cachePut:async()=>{},hash:async d=>hash(d),write:async()=>{},report:async()=>{},request:async()=>{requests++;return {ok:true,data:body(3)};}});
 await e.reconcileInventory([{id,update_time:2,contentHash:hash(body(2)),origin:'existing conversation index'},{id,update_time:2,contentHash:hash(body(2)),validated:true,diskBacked:true}]);assert.equal(j.entries[id].status,'pending');await e.process(j.entries[id]);assert.equal(requests,1);assert.equal(j.entries[id].contentHash,hash(body(3)));
});
test('an interrupted newer revision uses matching cache and never silently writes stale disk bytes',async()=>{
 for(const cached of [false,true]){const j=newJob(scope,{attachments:false,passive:false,library:false});mergeEntry(j,{id,update_time:3});Object.assign(j.entries[id],{status:'pending',contentHash:hash(body(3))});let requests=0,written;
 const e=new Engine(j,{save:async()=>{},cacheGet:async()=>cached?{data:body(3),hash:hash(body(3))}:null,cachePut:async()=>{},diskRead:async()=>({data:body(2),hash:hash(body(2))}),hash:async d=>hash(d),write:async(p,s)=>{if(p.endsWith('.json'))written=JSON.parse(s);},report:async()=>{},request:async()=>{requests++;return {ok:true,data:body(3)};}});
 await e.reconcileInventory([{id,update_time:2,contentHash:hash(body(2)),diskBacked:true,validated:true}]);await e.process(j.entries[id]);assert.equal(written.update_time,3);assert.equal(requests,cached?0:1);
 }
});
test('personal selector uses the native UUID only when observed under that selector',async()=>{
 const document={cookie:'_account=workspace-old',readyState:'complete',title:'Fixture',querySelector:()=>null,querySelectorAll:()=>[]},sandbox={window:{addEventListener:()=>{},fetch:async url=>String(url).includes('/api/auth/session')?Response.json({user:{id:scope.user},accessToken:'fixture'}):Response.json({items:[]})},document,location:{origin:'https://chatgpt.com',href:'https://chatgpt.com/',pathname:'/'},crypto:webcrypto,URL,Headers,Request,Response,AbortSignal,Uint8Array,btoa,Date,TextDecoder};vm.runInNewContext(await fs.readFile(new URL('../ChatGPT-Exporter-English-Edge/bridge.js',import.meta.url),'utf8'),sandbox);const rpc=sandbox.window.__englishExporterBridgeV248.rpc;
 await rpc({op:'context'});await sandbox.window.fetch('https://chatgpt.com/backend-api/conversations',{headers:{'chatgpt-account-id':'workspace-old'}});document.cookie='_account=personal';assert.equal((await rpc({op:'context'})).scope.account,'personal');await sandbox.window.fetch('https://chatgpt.com/backend-api/conversations',{headers:{'chatgpt-account-id':'personal-uuid'}});assert.equal((await rpc({op:'context'})).scope.account,'personal-uuid');document.cookie='_account=workspace-new';assert.equal((await rpc({op:'context'})).scope.account,'workspace-new');
});
