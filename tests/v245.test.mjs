import test from 'node:test';
import assert from 'node:assert/strict';
import {newJob} from '../ChatGPT-Exporter-English-Edge/core.mjs';
import {Engine} from '../ChatGPT-Exporter-English-Edge/engine.mjs';
import {awareness,decide} from '../ChatGPT-Exporter-English-Edge/awareness.mjs';
import {setUserYield,userYieldStatus,USER_QUIET_MS} from '../ChatGPT-Exporter-English-Edge/live-settings.mjs';
import {createFileLookup,relatedFiles,sharedFileBudget,seedFileSources,retainedFileRows} from '../ChatGPT-Exporter-English-Edge/file-links.mjs';
import {libraryWork} from '../ChatGPT-Exporter-English-Edge/library.mjs';
import {createLibraryView} from '../ChatGPT-Exporter-English-Edge/library-view.mjs';
import {createDashboardStats} from '../ChatGPT-Exporter-English-Edge/dashboard-state.mjs';
import {selectLibraryFiles} from '../ChatGPT-Exporter-English-Edge/library-ui.mjs';
import {createRenderScheduler} from '../ChatGPT-Exporter-English-Edge/ui-scheduler.mjs';
const scope={user:'fixture',account:'workspace',key:'fixture-key'},start=1700000000000;
test('turning off the six-minute pause wakes a running network gate within one tick',async()=>{
 let now=start,changed=false;const job=newJob(scope,{yieldUser:true,library:false},now);awareness(job).lastUserInteraction=now;
 const engine=new Engine(job,{now:()=>now,save:async()=>{},sense:async()=>[],sleep:async ms=>{now+=ms;if(!changed){changed=true;setUserYield(job,false,now);engine.wake();}}});
 await engine.gate();assert.equal(now,start+1000);assert.equal(job.options.yieldUser,false);assert.equal(job.awareness.waitUntil,0);assert.match(userYieldStatus(job,now),/^Off/);
});
test('turning off the activity pause preserves an independent server cooldown',async()=>{
 let now=start,changed=false;const job=newJob(scope,{yieldUser:true,library:false},now);awareness(job).lastUserInteraction=now;job.pace.until=now+10000;
 const engine=new Engine(job,{now:()=>now,save:async()=>{},sense:async()=>[],sleep:async ms=>{now+=ms;if(!changed){changed=true;setUserYield(job,false,now);engine.wake();}}});await engine.gate();assert.equal(now,start+10000);assert.equal(job.pace.until,start+10000);
});
test('enabled pause waits six minutes and a new interaction extends that deadline',()=>{
 const job=newJob(scope,{yieldUser:true},start);awareness(job).lastUserInteraction=start;assert.equal(decide(job,[],'read',start).until,start+USER_QUIET_MS);assert.equal(decide(job,[],'read',start+USER_QUIET_MS).until,0);
 job.awareness.lastUserInteraction=start+1000;assert.equal(decide(job,[],'read',start+USER_QUIET_MS).until,start+1000+USER_QUIET_MS);assert.match(userYieldStatus(job,start+1000),/360 s/);assert.equal(JSON.parse(JSON.stringify(job)).options.yieldUser,true);
});
test('indexed native aliases retain transitive shared attempts without touching unrelated files',()=>{
 const job=newJob(scope),a={id:'file_a',libraryId:'node_a',size:3},b={id:'node_a',libraryId:'node_b',size:3},c={id:'node_b',attempts:2,parked:true,size:3},other={id:'other',size:3};job.library={entries:{a,b,c,other},sources:[],directories:{}};const lookup=createFileLookup(job);
 assert.deepEqual(new Set(relatedFiles(job,a,lookup)),new Set([a,b,c]));assert.equal(sharedFileBudget(job,a,lookup).parked,true);assert.equal(sharedFileBudget(job,other,lookup).parked,false);
});
test('large queue skips linked failures and selects the next eligible file',()=>{
 const job=newJob(scope,{library:true,attachments:true});job.library={entries:{},sources:[],directories:{}};
 for(let i=0;i<4000;i++)job.library.entries['file_'+i]={id:'file_'+i,name:'Document '+i+'.txt',size:i+1,status:'pending'};
 seedFileSources(job,start);job.fileLinks.sources['library::file_0'].attempts=2;job.fileLinks.sources['library::file_0'].parked=true;
 assert.equal(libraryWork(job,start).file.id,'file_1');assert.equal(retainedFileRows(job).length,4000);
});
test('large All lists keep every file reachable without creating more than 500 rows at once',()=>{
 const files=Array.from({length:1201},(_,i)=>({id:'file_'+i,name:String(i).padStart(4,'0')+'.txt',status:'manual',size:10000000})),seen=[];
 for(let page=0;page<3;page++){const selected=selectLibraryFiles(files,{pageSize:'all',page,sort:'name'});assert.ok(selected.files.length<=500);seen.push(...selected.files.map(f=>f.id));assert.equal(selected.pages,3);}assert.equal(new Set(seen).size,files.length);
});
test('unchanged dashboard inventories are cached and persisted revisions refresh file status',()=>{
 const job=newJob(scope);job.library={entries:{file_one:{id:'file_one',name:'One.txt',size:3,status:'pending'}},directories:{},sources:[]};const view=createLibraryView(),stats=createDashboardStats(),first=view(job),metrics=stats(job);
 assert.equal(view(job),first);assert.equal(stats(job),metrics);job.library.entries.file_one.status='saved';job.uiRevision=1;assert.notEqual(view(job),first);assert.equal(view(job).counts.saved,1);assert.notEqual(stats(job),metrics);assert.equal(view(job).coverageComplete,false);
});
test('multiple progress notifications share one animation frame and flush cancels the queued frame',()=>{
 let callback,renders=0,cancelled;const scheduler=createRenderScheduler(()=>renders++,{schedule:fn=>{callback=fn;return 7;},cancel:id=>cancelled=id});for(let i=0;i<100;i++)scheduler.request();callback();assert.equal(renders,1);scheduler.request();scheduler.flush();assert.equal(renders,2);assert.equal(cancelled,7);
});
