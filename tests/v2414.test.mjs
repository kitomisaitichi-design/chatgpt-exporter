import test from 'node:test';
import assert from 'node:assert/strict';
import {scanTranscriptInventory,resolveBackupFolder} from '../ChatGPT-Exporter-English-Edge/local-detection.mjs';
class Dir{
 constructor(name,items={}){this.kind='directory';this.name=name;this.items=items;}
 async isSameEntry(h){return h===this;}
 async getDirectoryHandle(n){if(this.items[n]?.kind==='directory')return this.items[n];throw new DOMException('missing','NotFoundError');}
 async getFileHandle(n){if(this.items[n]?.kind==='file')return this.items[n];throw new DOMException('missing','NotFoundError');}
 async *entries(){yield*Object.entries(this.items);}
}
const file=data=>({kind:'file',async isSameEntry(h){return h===this;},async getFile(){return new Blob([JSON.stringify(data)]);}});
const id='chat_existing_one',body={conversation_id:id,title:'Fixture',update_time:2,mapping:{node:{message:{author:{role:'user'},content:{parts:['existing']}}}}};
function fixture(user='same-user',conflict=false){
 const scope={key:'older-key',user,account:'old'},header=JSON.stringify({schema:'english-autopilot-portable-state/v1',scope_key:conflict?'mismatched-key':scope.key,job:{scope}}).slice(0,-2)+',"entries":{';
 let reads=0,slices=0;
 const state={kind:'file',async getFile(){return {size:70*1024*1024,text:async()=>{reads++;throw Error('Full oversized state must never be read');},slice:(a,b)=>{slices++;assert.equal(a,0);assert.ok(b<=65536);return new Blob([header]);}};}};
 const root=new Dir('Older',{'conversation-index.json':file({schema:'chatgpt-conversation-index/v1',scope:'older-key',entries:[{id}]}),'portable-state.json':state,json:new Dir('json',{'one.json':file(body),'unrelated.json':file({...body,conversation_id:'chat_unrelated_one'})})});
 return {root,reads:()=>reads,slices:()=>slices};
}
test('oversized portable state identifies prior same-user bodies using a bounded header',async()=>{
 const f=fixture(),scan=await scanTranscriptInventory(f.root,'new-key',{scopeUser:'same-user',knownIds:new Set([id])});
 assert.deepEqual([...scan.files.keys()],[id]);assert.equal(f.reads(),0);assert.equal(f.slices(),1);assert.equal(scan.metadata.state,null);
 const nested=new Dir('Current',{'conversation-index.json':file({schema:'chatgpt-conversation-index/v1',scope:'new-key',entries:[]})});f.root.items.nested=nested;
 assert.equal((await resolveBackupFolder(f.root,'new-key')).root,nested);
});
test('bounded identity cannot import another user or conflicting scope header',async()=>{
 for(const f of [fixture('other-user'),fixture('same-user',true)])await assert.rejects(scanTranscriptInventory(f.root,'new-key',{scopeUser:'same-user',knownIds:new Set([id])}),e=>e.code==='FOREIGN_BACKUP');
});
test('permission loss while reading identity is surfaced',async()=>{
 const f=fixture();f.root.items['portable-state.json'].getFile=async()=>{throw new DOMException('denied','NotAllowedError');};
 await assert.rejects(scanTranscriptInventory(f.root,'new-key',{scopeUser:'same-user',knownIds:new Set([id])}),e=>e.name==='NotAllowedError');
});
