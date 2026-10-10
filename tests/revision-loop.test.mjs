import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {Engine} from '../ChatGPT-Exporter-English-Edge/engine.mjs';
import {newJob} from '../ChatGPT-Exporter-English-Edge/core.mjs';
import {conversationRevisionText} from '../ChatGPT-Exporter-English-Edge/conversation-revision.mjs';

const id='abcdefgh-1234';
const sha=value=>createHash('sha256').update(value).digest('hex');
const rawHash=data=>sha(JSON.stringify(data));
const revisionHash=data=>sha(conversationRevisionText(data));
const savedBody=()=>({
  conversation_id:id,title:'Genetic Co Transport Analysis',create_time:10,update_time:100,
  current_node:'answer-1',
  mapping:{
    'question-1':{id:'question-1',parent:null,children:['answer-1'],message:{id:'question-1',author:{role:'user'},content:{parts:['Question']}}},
    'answer-1':{id:'answer-1',parent:'question-1',children:[],message:{id:'answer-1',author:{role:'assistant'},content:{parts:['Answer']}}}
  }
});

async function runProcess(previous,received,{missingDisk=false,legacyRevision=false}={}) {
  const job=newJob({user:'test-user',account:null,key:'test-workspace'},{attachments:false,passive:false,library:false});
  const entry={id,title:previous.title,basename:'chat_'+id,contentHash:rawHash(previous),revisionHash:legacyRevision?null:revisionHash(previous),update_time:received.update_time,savedAt:100,status:'pending',refresh:true,attempts:0,retryAt:0};
  job.entries[id]=entry;
  const written=[],cached=[],requests=[];
  const io={
    now:()=>10000,save:async()=>{},changed:()=>{},report:async()=>{},
    hash:async data=>rawHash(data),revisionHash:async data=>revisionHash(data),
    cacheGet:async()=>({data:previous,hash:rawHash(previous),at:100}),
    cachePut:async(key,value)=>cached.push({key,value}),
    diskRead:async()=>missingDisk?null:{data:previous,hash:rawHash(previous)},
    write:async(path,value)=>written.push({path,value}),
    request:async path=>{requests.push(path);return {ok:true,status:200,data:received};}
  };
  await new Engine(job,io).process(entry);
  return {entry,job,written,cached,requests};
}

test('different envelope timestamps and metadata do not rewrite unchanged messages',async()=>{
  const original=savedBody();
  const updated=structuredClone(original);
  updated.update_time=101;
  updated.is_visible=true;
  updated.metadata={request_marker:'randomized-server-envelope'};
  updated.mapping['answer-1'].message.status='finished_successfully';
  updated.mapping['answer-1'].message.metadata={delivery_status:'complete'};
  assert.notEqual(rawHash(original),rawHash(updated));
  assert.equal(revisionHash(original),revisionHash(updated));
  const result=await runProcess(original,updated);
  assert.equal(result.requests.length,1);
  assert.equal(result.written.length,0);
  assert.equal(result.entry.contentHash,rawHash(original));
  assert.equal(result.entry.status,'saved');
  assert.equal(result.job.events.some(e=>e.message?.includes('Changed chat detected')),false);
  const checkedAgain=await runProcess(original,updated,{legacyRevision:true});
  assert.equal(checkedAgain.written.length,0,'legacy index derives the revision from the existing backup');
});

test('missing backup is recreated even if the server message revision is identical',async()=>{
  const original=savedBody();
  const result=await runProcess(original,original,{missingDisk:true});
  assert.equal(result.written.length,2);
  assert.equal(result.entry.status,'saved');
});

test('new reply, branch and title changes rewrite the full JSON and markdown',async()=>{
  const original=savedBody(),updated=structuredClone(original);
  updated.update_time=102;
  updated.mapping['answer-1'].children=['answer-2'];
  updated.mapping['answer-2']={id:'answer-2',parent:'answer-1',children:[],message:{id:'answer-2',author:{role:'assistant'},content:{parts:['New reply']}}};
  updated.current_node='answer-2';
  let result=await runProcess(original,updated);
  assert.equal(result.written.length,2);
  assert.equal(result.entry.revisionCount,1);
  assert.equal(result.entry.contentHash,rawHash(updated));
  assert.equal(result.written.find(x=>x.path.endsWith('.json')).value.includes('New reply'),true);
  const renamed=structuredClone(original);
  renamed.title+=' (renamed)';
  result=await runProcess(original,renamed);
  assert.equal(result.written.length,2);
});

test('fingerprint ignores mapping property order and child ordering',()=>{
  const original=savedBody(),permuted=structuredClone(original);
  permuted.mapping=Object.fromEntries(Object.entries(permuted.mapping).reverse());
  assert.equal(revisionHash(original),revisionHash(permuted));
});

test('native metadata PATCH/DELETE do not announce completed replies; generation POST does',async()=>{
  const code=await readFile(new URL('../ChatGPT-Exporter-English-Edge/bridge.js',import.meta.url),'utf8');
  const scope={user:'test-user',account:null};
  const respond=async resource=>{
    const url=String(resource);
    return new Response(url==='/api/auth/session'?JSON.stringify({user:{id:'test-user'},accessToken:'token'}):'{}',{status:200,headers:{'content-type':'application/json'}});
  };
  const window={fetch:respond,addEventListener(){}};
  const location={origin:'https://chatgpt.com',pathname:'/c/'+id,href:'https://chatgpt.com/c/'+id};
  const document={cookie:'',title:'ChatGPT',readyState:'complete',querySelector:()=>null,querySelectorAll:()=>[]};
  const context={window,location,document,crypto:{randomUUID:()=> 'document-id'},URL,Headers,Request,Response,AbortSignal,TextDecoder,Date,Promise,setTimeout,clearTimeout};
  runInNewContext(code,context,{filename:'bridge.js'});
  const rpc=window.__englishExporterBridgeV2419.rpc;
  const auth=await rpc({op:'context'});
  assert.equal(auth.ok,true);
  for(const method of ['PATCH','DELETE','PUT']){
    await window.fetch('https://chatgpt.com/backend-api/conversation/'+id,{method,body:JSON.stringify({is_visible:false})});
  }
  let snapshot=await rpc({op:'sense',scope});
  assert.equal(snapshot.changedChats.length,0);
  await window.fetch('https://chatgpt.com/backend-api/conversation',{method:'POST',body:JSON.stringify({conversation_id:id})});
  snapshot=await rpc({op:'sense',scope});
  assert.equal(snapshot.changedChats.length,1);
  assert.equal(snapshot.changedChats[0].id,id);
});
