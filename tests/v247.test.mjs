import test from 'node:test';
import assert from 'node:assert/strict';
import {newJob} from '../ChatGPT-Exporter-English-Edge/core.mjs';
import {libraryState,libraryWork,libraryIndex} from '../ChatGPT-Exporter-English-Edge/library.mjs';
import {analyzeFiles} from '../ChatGPT-Exporter-English-Edge/file-intelligence.mjs';
import {selectLibraryFiles} from '../ChatGPT-Exporter-English-Edge/library-ui.mjs';
import {Engine} from '../ChatGPT-Exporter-English-Edge/engine.mjs';
const now=1700000000000,scope={key:'null-id-fixture',user:'fixture',account:null};
function restoredJob(){
  const j=newJob(scope,{library:true,attachments:true,passive:false,yieldUser:false,verify:false},now);
  j.sources=[];libraryState(j,now).nextScanAt=now+1e9;
  j.fileLinks={schema:'chatgpt-file-links/v1',sources:{}};
  for(const [key,name] of [['chat:chat_one:alpha','alpha.txt'],['chat:chat_one:beta','beta.txt']])j.fileLinks.sources[key]={id:null,fileId:null,name,size:null,status:'pending',sourceKey:key,sourceKind:'chat',sourceConversationId:'chat_one',conversationIds:['chat_one'],presence:'observed'};
  return JSON.parse(JSON.stringify(j));
}
test('restored same-size attachments without native IDs retain deterministic queue turns',()=>{
  const j=restoredJob(),before=JSON.stringify(j.fileLinks.sources);
  assert.equal(libraryWork(j,now).file.sourceKey,'chat:chat_one:alpha');
  assert.equal(JSON.stringify(j.fileLinks.sources),before);
  j.fileLinks.sources['chat:chat_one:alpha'].status='saved';
  assert.equal(libraryWork(j,now).file.sourceKey,'chat:chat_one:beta');
});
test('duplicate analysis accepts a saved alias with a null native ID',()=>{
  const files=[{id:null,sourceKey:'chat:chat_one:alias',name:'alias.txt',sha256:'a'.repeat(64),savedAt:now},{id:'file_one',name:'one.txt',sha256:'a'.repeat(64),savedAt:now}];
  const analysis=analyzeFiles(files);assert.equal(analysis.get('file_one').duplicate.count,2);
  assert.equal(files[0].id,null);
});
test('legacy null labels can be catalogued without losing paths or source metadata',()=>{
  const j=restoredJob();Object.assign(j.fileLinks.sources['chat:chat_one:alpha'],{name:null,status:'saved',path:'attachments/legacy/alpha.txt',sha256:'a'.repeat(64)});
  const catalog=libraryIndex(j);assert.equal(catalog.entries.length,2);
  const saved=catalog.entries.find(f=>f.path==='attachments/legacy/alpha.txt');assert.ok(saved);assert.equal(saved.native_file_id,null);assert.equal(saved.source_refs[0].sourceKey,'chat:chat_one:alpha');
});
test('every Library sort handles null names and statuses in retained metadata',()=>{
  const files=[{id:'file_one',name:null,status:null,size:3},{id:null,sourceKey:'chat:chat_one:two',name:'two.txt',status:'pending',size:3}];
  for(const sort of ['name','status','recent','size'])assert.equal(selectLibraryFiles(files,{sort}).total,2);
});
test('a resumed engine reaches file saving instead of pausing on null-ID records',async()=>{
  const j=restoredJob();j.status='paused';j.message="Paused: Cannot read properties of null (reading 'localeCompare').";
  let clock=now,downloads=0;const engine=new Engine(j,{now:()=>clock,sleep:async ms=>clock+=ms,save:async()=>{},sense:async()=>[],inventory:async()=>[],report:async()=>{},libraryList:async()=>{throw Error('No scan due');},libraryDownload:async file=>{downloads++;if(downloads===2)engine.stopped=true;return {status:'saved',path:'attachments/'+file.name,size:3,sha256:(downloads===1?'a':'b').repeat(64)};}});
  await engine.run();assert.equal(downloads,2);assert.ok(!j.message.includes('localeCompare'));assert.equal(Object.values(j.fileLinks.sources).filter(f=>f.status==='saved').length,2);
});
