import test from 'node:test';import assert from 'node:assert/strict';
import {restoreAccountFolder,rememberBackupFolders,reconnectRememberedFolderAccess} from '../ChatGPT-Exporter-English-Edge/account-folders.mjs';
const A='a'.repeat(64),B='b'.repeat(64);
class Dir{
 constructor(name,items={},permission='granted'){Object.assign(this,{name,kind:'directory',items,permission,created:0,reads:0});}
 async queryPermission(){return this.permission;}
 async requestPermission(){throw Error('Automatic discovery must not request permission');}
 async isSameEntry(other){return this===other;}
 async getFileHandle(name){this.reads++;if(this.items[name]?.kind==='file')return this.items[name];throw new DOMException('Missing','NotFoundError');}
 async getDirectoryHandle(name,{create=false}={}){if(create){this.created++;if(!this.allowCreate)throw Error('Automatic discovery must not create directories');if(!this.items[name])this.items[name]=new Dir(name);}if(this.items[name]?.kind==='directory')return this.items[name];throw new DOMException('Missing','NotFoundError');}
 async *entries(){yield*Object.entries(this.items);}
}
const json=value=>({kind:'file',getFile:async()=>new Blob([JSON.stringify(value)])});
const archive=(name,key)=>new Dir(name,{'conversation-index.json':json({schema:'chatgpt-conversation-index/v1',scope:key,entries:[]}),json:new Dir('json')});
function database(rows={}){const records=new Map(Object.entries(rows)),calls=[];return {records,calls,get:async(store,key)=>records.get(key),put:async(store,key,value)=>{calls.push(key);records.set(key,value);},getPrefix:async(store,prefix)=>[...records].filter(([key])=>key.startsWith(prefix)).map(([,value])=>value)};}

test('account B discovers renamed nested archive from account A legacy parent grant',async()=>{
 const b=archive('Renamed B',B),a=archive('A',A),parent=new Dir('Downloads',{a,old:new Dir('old',{b})}),db=database({['folder:'+A]:a,['backupInput:'+A]:parent});
 const found=await restoreAccountFolder(db,B);assert.equal(found.folder,b);assert.equal(found.input,parent);assert.equal(found.recovered,true);assert.equal(parent.created,0);assert.equal(a.created,0);assert.equal(b.created,0);
});
test('explicit account folder wins over other matching copies',async()=>{
 const chosen=archive('Chosen',B),other=archive('Other',B),db=database();await rememberBackupFolders(db,A,[other]);assert.equal((await restoreAccountFolder(db,B,{folder:chosen})).folder,chosen);
});
test('automatic fallback never uses a name-only or unmarked legacy archive',async()=>{
 const spoof=new Dir('chatgpt-backup-'+B.slice(0,12),{json:new Dir('json')}),db=database();await rememberBackupFolders(db,A,[spoof]);const found=await restoreAccountFolder(db,B);assert.equal(found.folder,null);assert.equal(found.status,'not-found');assert.equal(spoof.created,0);
});
test('foreign or conflicting scope metadata cannot be restored',async()=>{
 const foreign=archive('chatgpt-backup-'+B.slice(0,12),A);foreign.items['portable-state.json']=json({schema:'english-autopilot-portable-state/v1',scope_key:B,job:{scope:{key:B,user:'b'}}});const db=database();await rememberBackupFolders(db,A,[foreign]);assert.equal((await restoreAccountFolder(db,B)).folder,null);
});
test('overlapping parent and direct grants resolve one matching directory',async()=>{
 const b=archive('B',B),parent=new Dir('Shared',{b}),db=database();await rememberBackupFolders(db,A,[parent,b,parent]);const found=await restoreAccountFolder(db,B);assert.equal(found.folder,b);assert.equal(db.records.get('knownBackupFolders').locations.length,2);
});
test('multiple matching archives require a deliberate folder choice',async()=>{
 const parent=new Dir('Shared',{one:archive('One',B),two:archive('Two',B)}),db=database();await rememberBackupFolders(db,A,[parent]);const found=await restoreAccountFolder(db,B);assert.equal(found.folder,null);assert.equal(found.status,'ambiguous');
});
test('permission loss never prompts or creates a new directory',async()=>{
 const parent=new Dir('Shared',{},'prompt'),db=database();await rememberBackupFolders(db,A,[parent]);const found=await restoreAccountFolder(db,B);assert.equal(found.folder,null);assert.equal(found.status,'permission-needed');assert.equal(parent.reads,0);assert.equal(parent.created,0);
});
test('stale handles are skipped while a later valid grant can recover',async()=>{
 const stale=new Dir('Gone');stale.getFileHandle=async()=>{throw new DOMException('Gone','NotFoundError');};stale.entries=async function*(){throw new DOMException('Gone','NotFoundError');};const b=archive('B',B),db=database();await rememberBackupFolders(db,A,[stale,b]);assert.equal((await restoreAccountFolder(db,B)).folder,b);
});
test('search uses a shared directory budget and does not bind an incomplete result',async()=>{
 const parent=new Dir('Shared',Object.fromEntries(Array.from({length:20},(_,i)=>['dir'+i,new Dir('dir'+i)]))),db=database();await rememberBackupFolders(db,A,[parent]);const found=await restoreAccountFolder(db,B,{maxDirectories:4});assert.equal(found.folder,null);assert.equal(found.status,'scan-limited');assert.ok(found.checked<=4);
});
test('discovery reads at most 64 KiB of each large metadata file',async()=>{
 let slices=0;const b=new Dir('B',{'portable-state.json':{kind:'file',getFile:async()=>({size:100_000_000,slice(start,end){assert.equal(start,0);assert.ok(end<=65536);slices++;return new Blob(['{"schema":"english-autopilot-portable-state/v1","scope_key":"'+B+'","job":{"scope":{"key":"'+B+'","user":"b"},"entries":{']);},text(){throw Error('Full large metadata read');}})}}),db=database();await rememberBackupFolders(db,A,[b]);assert.equal((await restoreAccountFolder(db,B)).folder,b);assert.ok(slices>0);
});
test('legacy backup-role locations migrate once and preserve existing account records',async()=>{
 const b=archive('B',B),library=new Dir('Library'),original={status:'paused',marker:'keep'},db=database({['localLocations:'+A]:[{handle:b,role:'backup'},{handle:library,role:'library'}],['jobs:'+A]:original});
 await restoreAccountFolder(db,B);assert.equal(db.records.get('knownBackupFolders').legacyImported,true);assert.equal(db.records.get('knownBackupFolders').locations.length,1);assert.equal(db.records.get('jobs:'+A),original);assert.ok(db.calls.every(key=>key==='knownBackupFolders'));
});
test('unexpected disk errors remain visible and the registry stays bounded',async()=>{
 const db=database();await rememberBackupFolders(db,A,Array.from({length:50},(_,i)=>new Dir('D'+i)));assert.equal(db.records.get('knownBackupFolders').locations.length,32);
 const broken=new Dir('Broken');broken.queryPermission=async()=>{throw Error('Unexpected disk error');};await assert.rejects(restoreAccountFolder(db,B,{folder:broken}),/Unexpected disk error/);
});
test('revoked comparison permission does not poison later accessible locations',async()=>{
 const denied=new Dir('Revoked'),b=archive('B',B),db=database();denied.isSameEntry=async()=>{throw new DOMException('Revoked','NotAllowedError');};denied.queryPermission=async()=>{throw new DOMException('Revoked','NotAllowedError');};await rememberBackupFolders(db,A,[denied,b]);assert.equal((await restoreAccountFolder(db,B)).folder,b);
});
test('a saved parent with multiple matches is still ambiguous',async()=>{
 const folder=new Dir('Shared',{one:archive('One',B),two:archive('Two',B)});assert.equal((await restoreAccountFolder(database(),B,{folder})).status,'ambiguous');
});
test('full candidate verification rejects conflicting duplicate header hints',async()=>{
 const b=new Dir('B',{'conversation-index.json':{kind:'file',getFile:async()=>new Blob(['{"schema":"chatgpt-conversation-index/v1","scope":"'+B+'","entries":[],"scope":"'+A+'"}'])}}),db=database();await rememberBackupFolders(db,A,[b]);assert.equal((await restoreAccountFolder(db,B)).folder,null);
});
test('high-fanout parents stop enumeration at the shared entry budget',async()=>{
 const parent=new Dir('Huge parent'),db=database();let yielded=0;parent.entries=async function*(){for(let i=0;i<10000;i++){yielded++;yield ['dir'+i,new Dir('dir'+i)];}};await rememberBackupFolders(db,A,[parent]);const found=await restoreAccountFolder(db,B,{maxEntries:50});assert.equal(found.status,'scan-limited');assert.equal(found.folder,null);assert.ok(yielded<=51);assert.ok(found.enumerated<=50);
});
test('omitted legacy grants are reported as limited rather than a complete miss',async()=>{
 const db=database(Object.fromEntries(Array.from({length:33},(_,i)=>['folder:'+i,new Dir('Legacy '+i)])));const found=await restoreAccountFolder(db,B);assert.equal(db.records.get('knownBackupFolders').locations.length,32);assert.equal(db.records.get('knownBackupFolders').legacyLimited,true);assert.equal(found.status,'scan-limited');
});
test('revoked exclusion handle cannot hide a later valid nested match',async()=>{
 const previous=archive('Previous',A),b=archive('B',B),parent=new Dir('Parent',{b}),db=database();let inspected=false;previous.entries=async function*(){inspected=true;};previous.isSameEntry=async other=>{if(inspected)throw new DOMException('Revoked','NotAllowedError');return previous===other;};await rememberBackupFolders(db,A,[previous,parent]);assert.equal((await restoreAccountFolder(db,B)).folder,b);
});
test('explicit connection prepares a dedicated new-account folder after a complete miss',async()=>{
 const a=archive('Account A',A),parent=new Dir('Backups',{a}),db=database();parent.allowCreate=true;await rememberBackupFolders(db,A,[parent]);const found=await restoreAccountFolder(db,B,{createIfMissing:true});assert.equal(found.status,'created');assert.equal(found.folder.name,'chatgpt-backup-'+B.slice(0,12));assert.equal(found.input,parent);assert.equal(found.resolved.created,true);assert.equal(parent.items.a,a);assert.equal(a.created,0);assert.equal(parent.created,1);assert.deepEqual(Object.keys(found.folder.items),[]);
});
test('no parent grant means no invented path or new folder',async()=>{
 const found=await restoreAccountFolder(database(),B,{createIfMissing:true});assert.equal(found.status,'not-found');assert.equal(found.folder,null);
});
test('background restoration keeps directory creation disabled by default',async()=>{
 const parent=new Dir('Backups'),db=database();parent.allowCreate=true;await rememberBackupFolders(db,A,[parent]);assert.equal((await restoreAccountFolder(db,B)).folder,null);assert.equal(parent.created,0);
});
test('new account can get a dedicated child under a remembered foreign archive without adopting it',async()=>{
 const parent=archive('Account A',A),db=database();parent.allowCreate=true;await rememberBackupFolders(db,A,[parent]);const found=await restoreAccountFolder(db,B,{createIfMissing:true});assert.notEqual(found.folder,parent);assert.equal(found.input,parent);assert.equal(found.folder.name,'chatgpt-backup-'+B.slice(0,12));assert.equal(found.resolved.metadata.foreign,false);assert.equal(parent.items['conversation-index.json'].kind,'file');
});
test('unverified occupied account-folder names preserve their existing files',async()=>{
 const name='chatgpt-backup-'+B.slice(0,12),occupied=new Dir(name,{'keep.txt':json({keep:true})}),parent=new Dir('Backups',{[name]:occupied}),db=database();parent.allowCreate=true;await rememberBackupFolders(db,A,[parent]);const found=await restoreAccountFolder(db,B,{createIfMissing:true});assert.equal(found.status,'folder-conflict');assert.equal(parent.created,0);assert.equal(occupied.items['keep.txt'].kind,'file');
});
test('empty account directory left by interruption is reused without nested duplicates',async()=>{
 const name='chatgpt-backup-'+B.slice(0,12),empty=new Dir(name),parent=new Dir('Backups',{[name]:empty}),db=database();await rememberBackupFolders(db,A,[parent]);const found=await restoreAccountFolder(db,B,{createIfMissing:true});assert.equal(found.status,'created');assert.equal(found.folder,empty);assert.equal(parent.created,0);assert.equal(empty.created,0);
});
test('ambiguity, scan limits and denied access never create a fallback',async()=>{
 for(const parent of [new Dir('Ambiguous',{one:archive('One',B),two:archive('Two',B)}),new Dir('Denied',{},'prompt'),new Dir('Large',{one:new Dir('One'),two:new Dir('Two')})]){parent.allowCreate=true;const db=database();await rememberBackupFolders(db,A,[parent]);const found=await restoreAccountFolder(db,B,{createIfMissing:true,maxEntries:parent.name==='Large'?1:4000});assert.equal(found.folder,null);assert.equal(parent.created,0);}
});
test('invalid scope cannot create a folder and matching backups still win',async()=>{
 const parent=new Dir('Backups'),db=database();parent.allowCreate=true;await rememberBackupFolders(db,A,[parent]);await assert.rejects(restoreAccountFolder(db,'unsafe/key',{createIfMissing:true}),/valid account scope/);assert.equal(parent.created,0);const b=archive('B',B);parent.items.b=b;assert.equal((await restoreAccountFolder(db,B,{createIfMissing:true})).folder,b);assert.equal(parent.created,0);
});
test('manual reconnect can renew one existing folder grant without a picker',async()=>{
 const parent=new Dir('Known parent',{},'prompt'),db=database();let requests=0;parent.requestPermission=async()=>{requests++;parent.permission='granted';return 'granted';};await rememberBackupFolders(db,A,[parent]);assert.equal(await reconnectRememberedFolderAccess(db),true);assert.equal(requests,1);assert.equal(await reconnectRememberedFolderAccess(db),false);assert.equal(requests,1);
});
test('reconnect never invents a grant or prompts for an already granted or denied folder',async()=>{
 const granted=new Dir('Granted'),denied=new Dir('Denied',{},'denied'),db=database();await rememberBackupFolders(db,A,[granted,denied]);assert.equal(await reconnectRememberedFolderAccess(db),false);assert.equal(await reconnectRememberedFolderAccess(database()),false);
});
test('renewing saved access prompts at most once and respects refusal',async()=>{
 const one=new Dir('One',{},'prompt'),two=new Dir('Two',{},'prompt'),db=database();let requests=0;one.requestPermission=async()=>{requests++;return 'denied';};two.requestPermission=async()=>{throw Error('Must not ask for a second grant');};await rememberBackupFolders(db,A,[one,two]);assert.equal(await reconnectRememberedFolderAccess(db),false);assert.equal(requests,1);
});
