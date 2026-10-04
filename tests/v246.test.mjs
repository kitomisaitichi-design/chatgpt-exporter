import test from 'node:test';
import assert from 'node:assert/strict';
import {newJob,mergeEntry} from '../ChatGPT-Exporter-English-Edge/core.mjs';
import {Engine} from '../ChatGPT-Exporter-English-Edge/engine.mjs';
import {libraryState,mergeLibraryItem,normalizeLibraryItem,libraryWork} from '../ChatGPT-Exporter-English-Edge/library.mjs';
import {schedulerState,recordDiscovery,libraryPolicy,chooseLibrary,finishWork,pickWork,beginWork,assetsMustYield} from '../ChatGPT-Exporter-English-Edge/work-scheduler.mjs';
const scope={key:'scheduler-fixture',user:'fixture',account:null},start=1700000000000;
function files(n){const j=newJob(scope,{library:true,yieldUser:false,passive:false},start),s=libraryState(j,start);for(let i=0;i<n;i++)mergeLibraryItem(s,normalizeLibraryItem({file_id:'file_'+i,name:'File '+i+'.txt',size:i+3}),start);return j;}
test('ready files download before a long Library inventory completes',async()=>{
 let now=start,pages=0,downloadAtPage=null,downloads=0;const j=files(250);j.sources=[];j.options.attachments=false;j.options.archived=false;j.options.projects=false;j.options.verify=false;j.library.sources=[{key:'root',parent:null,mode:'nodes',cursor:null,offset:0,done:false,seen:[],seenIds:[],failures:0}];j.library.nextScanAt=now+1e9;
 const engine=new Engine(j,{now:()=>now,sleep:async ms=>now+=ms,save:async()=>{},sense:async()=>[],inventory:async()=>[],report:async()=>{},libraryList:async()=>({ok:true,data:{items:[{file_id:'file_new_'+(++pages),size:3}],cursor:'page_'+pages}}),libraryDownload:async(f,before)=>{await before();downloads++;downloadAtPage ??=pages;if(downloads===3)engine.stopped=true;return {status:'saved',path:'attachments/'+f.id+'.txt',size:f.size,sha256:'a'.repeat(64)};}});
 await engine.run();assert.ok(downloads>=3);assert.ok(downloadAtPage<5);assert.equal(j.library.sources[0].done,false);assert.equal(j.status,'paused');assert.ok(j.workScheduler.lastFileProgressAt);
});
test('continuous chat discovery and pending transcripts do not starve Library files',async()=>{
 let now=start,downloads=0;const j=files(5);j.options.attachments=false;j.options.verify=false;j.options.mode='index-first';j.library.nextScanAt=now+1e9;j.library.sources=[];j.sources=[{key:'active',kind:'list',offset:0,done:false,seenPages:[],uniqueIds:[],emptyChecks:0,reportedTotal:0}];for(let i=0;i<50;i++)mergeEntry(j,{id:'chat_'+i,title:'Fixture '+i});
 const engine=new Engine(j,{now:()=>now,sleep:async ms=>now+=ms,save:async()=>{},sense:async()=>[],inventory:async()=>[],report:async()=>{},write:async()=>{},cacheGet:async()=>null,cachePut:async()=>{},hash:async()=> 'hash',request:async path=>path.includes('/conversations?')?{ok:true,data:{items:Array.from({length:100},(_,i)=>({id:'page_'+now+'_'+i,title:'Fixture',update_time:1})),total:100000}}:{ok:true,data:{conversation_id:path.split('/').at(-1),title:'Fixture',mapping:{node:{message:{author:{role:'user'},content:{parts:['Fixture']}},children:[]}},current_node:'node'}},libraryList:async()=>{throw Error('No Library discovery due');},libraryDownload:async(f,before)=>{await before();downloads++;engine.stopped=true;return {status:'saved',path:'attachments/'+f.id+'.txt',size:f.size,sha256:'a'.repeat(64)};}});
 await engine.run();assert.equal(downloads,1);assert.ok(Object.values(j.entries).some(e=>e.status==='pending'));assert.equal(j.sources[0].done,false);
});
test('three-minute growth below two percent shifts Library turns to four files per page',()=>{
 const j=files(500),source={key:'root'},file=j.library.entries.file_0;schedulerState(j,start);recordDiscovery(j,0,500,start);const now=start+180001;assert.equal(libraryPolicy(j,now).slow,true);
 for(let i=0;i<4;i++){assert.ok(chooseLibrary(j,source,file,now).file);finishWork(j,'library-file',{now});}assert.ok(chooseLibrary(j,source,file,now).source);recordDiscovery(j,25,525,now);assert.equal(libraryPolicy(j,now).slow,false);
});
test('a fresh small inventory warms briefly and then starts bounded downloads',()=>{
 const j=files(2),source={},file=j.library.entries.file_0;schedulerState(j,start);assert.ok(chooseLibrary(j,source,file,start).source);recordDiscovery(j,0,2,start);recordDiscovery(j,0,2,start);assert.ok(chooseLibrary(j,source,file,start).file);
 const other=files(2);schedulerState(other,start);assert.ok(chooseLibrary(other,source,file,start+30001).file);
});
test('every ready lane gets turns even when changed chats arrive continuously',()=>{
 const j=files(250),available={chat:{},attachment:{},'chat-scan':{},library:{file:{}},verify:{},recent:true},seen=new Set();
 for(let i=0;i<40;i++){const decision=pickWork(j,available,{urgent:true,now:start+40000+i});seen.add(decision.lane);beginWork(j,decision,start+i);finishWork(j,decision.lane==='library'?'library-file':decision.lane,{urgent:decision.lane==='chat',now:start+40000+i});}
 assert.deepEqual(seen,new Set(Object.keys(available)));
});
test('normal pending chats no longer cancel a deliberately scheduled file turn',()=>{
 const j=files(1);mergeEntry(j,{id:'chat_pending',title:'Fixture'});beginWork(j,{lane:'library',work:{file:{}},reason:'Fair turn'},start);assert.equal(assetsMustYield(j,start),false);j.entries.chat_pending.refresh=true;j.entries.chat_pending.nativeWriteAt=start;assert.equal(assetsMustYield(j,start),true);j.workScheduler.urgentBurst=2;assert.equal(assetsMustYield(j,start),false);
});
test('bounded attachment batches resume immediately without spending file failure attempts',async()=>{
 const j=newJob(scope,{attachments:true,library:false,passive:false},start);j.sources=[];const e={id:'chat_one',status:'saved',attachmentPending:true};j.entries[e.id]=e;let options;
 const engine=new Engine(j,{now:()=>start,save:async()=>{},report:async()=>{},cacheGet:async()=>({data:{conversation_id:e.id,mapping:{n:{message:{author:{role:'user'},content:{content_type:'multimodal_text',parts:[{asset_pointer:'file-service://file_one',file_name:'one.txt'}]}},children:[]}}}}),attachments:async(_e,_d,_b,_before,opts)=>{options=opts;return [{id:'file_one',name:'one.txt',status:'deferred',batchPending:true}];}});
 await engine.processAttachments(e);assert.equal(options.maxTransfers,1);assert.equal(options.maxItems,25);assert.equal(e.attachmentRetryAt,start);assert.equal(e.attachmentPending,true);assert.equal(e.attachments[0].attempts,undefined);
});
test('age turn stops newly arriving small files from permanently starving old larger files',()=>{
 const j=files(2);Object.assign(j.library.entries.file_0,{size:3,firstSeenAt:start});Object.assign(j.library.entries.file_1,{size:9999999,firstSeenAt:start-100000});j.library.sources=[];schedulerState(j,start).lanes['library-file']={turns:3};assert.equal(libraryWork(j,start).file.id,'file_1');
});
test('scheduler state survives a portable checkpoint with growth and lane positions intact',()=>{
 const j=files(500);recordDiscovery(j,1,500,start);finishWork(j,'library-file',{savedFile:true,now:start+1000});const restored=JSON.parse(JSON.stringify(j));assert.equal(restored.workScheduler.library.filesSincePage,1);assert.equal(restored.workScheduler.lastFileProgressAt,start+1000);assert.equal(libraryPolicy(restored,start+180001).downloadShare,80);
});
test('ordinary spacing cannot starve a due recent-chat check during ongoing file downloads',async()=>{
 let now=start,downloads=0,checks=0;const j=files(20);j.options.passive=true;j.options.attachments=false;j.options.projects=false;j.options.archived=false;j.schedule.enabled=true;j.schedule.nextCheckAt=start;j.sources=[];j.library.nextScanAt=start+1e9;
 const engine=new Engine(j,{now:()=>now,sleep:async ms=>now+=ms,save:async()=>{},sense:async()=>[],inventory:async()=>[],report:async()=>{},request:async()=>{checks++;return {ok:true,data:{items:[]}};},libraryList:async()=>{throw Error('No scan due');},libraryDownload:async(f,before)=>{await before();downloads++;if(downloads===3)engine.stopped=true;return {status:'saved',path:'attachments/'+f.id+'.txt',size:f.size,sha256:'a'.repeat(64)};}});
 await engine.run();assert.equal(checks,1);assert.ok(j.schedule.lastCheckAt>=start);assert.ok(Object.values(j.library.entries).some(f=>f.status==='pending'));
});
