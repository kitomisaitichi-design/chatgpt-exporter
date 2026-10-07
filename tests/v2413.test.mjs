import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../ChatGPT-Exporter-English-Edge/app.mjs',import.meta.url),'utf8');
const code=app.slice(app.indexOf('async function folderReady('),app.indexOf('async function detectLocalState('));
test('Resume resolves metadata when a heartbeat left a root handle without detection',async()=>{
 const selected={queryPermission:async()=> 'granted',isSameEntry:async()=>false};
 const canonical={queryPermission:async()=> 'granted'};
 let resolves=0,saves=0;
 const metadata={state:{job:{entries:{saved:{contentHash:'keep-original'}}}},index:{entries:[]}};
 const c=vm.createContext({folder:selected,root:selected,rootDetection:null,scope:{key:'fixture'},backupInput:null,
  update:()=>{},Paused:Error,localSummary:'',resolveBackupFolder:async(h,key)=>{assert.equal(h,selected);assert.equal(key,'fixture');resolves++;return {root:canonical,metadata};},
  db:{put:async()=>{saves++;}},rememberLocation:async()=>{}});
 vm.runInContext(code,c);
 await vm.runInContext('folderReady(false)',c);
 assert.equal(c.root,canonical);assert.equal(c.folder,canonical);assert.equal(c.rootDetection.metadata,metadata);
 assert.equal(c.rootDetection.metadata.state.job.entries.saved.contentHash,'keep-original');
 assert.equal(c.backupInput,selected);assert.equal(resolves,1);assert.equal(saves,2);
 await vm.runInContext('folderReady(false)',c);assert.equal(resolves,1);assert.equal(saves,2);
});
test('Resume still surfaces lost folder permission without replacing the saved root',async()=>{
 const folder={queryPermission:async()=> 'denied'};
 const c=vm.createContext({folder,root:folder,rootDetection:null,scope:{key:'fixture'},Paused:Error});
 vm.runInContext(code,c);
 await assert.rejects(vm.runInContext('folderReady(false)',c),/Folder permission is needed/);
 assert.equal(c.root,folder);assert.equal(c.rootDetection,null);
});
