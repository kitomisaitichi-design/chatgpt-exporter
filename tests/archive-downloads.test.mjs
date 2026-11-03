import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {newJob} from '../ChatGPT-Exporter-English-Edge/core.mjs';
import {libraryState,libraryWork,mergeLibraryItem,normalizeLibraryItem} from '../ChatGPT-Exporter-English-Edge/library.mjs';
import {ARCHIVE_FILE_LIMIT,STANDARD_FILE_LIMIT,downloadLimit,refreshArchiveEligibility} from '../ChatGPT-Exporter-English-Edge/archive-downloads.mjs';
import {finishWork,pickWork} from '../ChatGPT-Exporter-English-Edge/work-scheduler.mjs';

const scope = {key:'fixture',user:'fixture',account:'workspace'};
const item = (id,name,size) => normalizeLibraryItem({file_id:id,file_name:name,file_size_bytes:size});

test('the opt-in raises only the archive cap and exact 125 MB is eligible', () => {
  const job=newJob(scope);
  assert.equal(downloadLimit({name:'project.ZIP'},job.options),STANDARD_FILE_LIMIT);
  job.options.prioritizeArchives=true;
  for(const name of ['project.ZIP','assets.rar','project.7z','project.tar.gz','project.tar.xz']){
    assert.equal(downloadLimit({name},job.options),ARCHIVE_FILE_LIMIT);
  }
  for(const name of ['archive.zip.exe','archive','movie.mp4']){
    assert.equal(downloadLimit({name},job.options),STANDARD_FILE_LIMIT);
  }
  const library=libraryState(job);
  mergeLibraryItem(library,item('file-edge','edge.zip',ARCHIVE_FILE_LIMIT),1,job.options);
  mergeLibraryItem(library,item('file-over','over.zip',ARCHIVE_FILE_LIMIT+1),1,job.options);
  mergeLibraryItem(library,item('file-text','text.pdf',STANDARD_FILE_LIMIT+1),1,job.options);
  assert.equal(library.entries['file-edge'].status,'pending');
  assert.equal(library.entries['file-over'].status,'manual');
  assert.equal(library.entries['file-text'].status,'manual');
});

test('archive priority fits inside existing file turns and leaves an oldest-first turn', () => {
  const job=newJob(scope,{prioritizeArchives:true});
  const library=libraryState(job);
  mergeLibraryItem(library,item('file-regular','small.txt',64),1,job.options);
  mergeLibraryItem(library,item('file-archive','big.zip',80_000_000),2,job.options);
  assert.equal(libraryWork(job,3).file.id,'file-archive');
  const chat={id:'chat-ready'};
  assert.equal(pickWork(job,{chat,library:libraryWork(job,3)},{urgent:true,now:3}).lane,'chat');
  for(let i=0;i<3;i++)finishWork(job,'library-file',{now:4+i});
  assert.equal(libraryWork(job,10).file.id,'file-regular');
  library.entries['file-archive'].retryAt=100;
  assert.equal(libraryWork(job,15).file.id,'file-regular');
});

test('toggle reopens size skips but respects saved bytes, cooldowns and parked files', () => {
  const job=newJob(scope,{prioritizeArchives:true});
  const archive={name:'retry.rar',size:120_000_000,status:'skipped-too-large',attempts:1,retryAt:12_345};
  job.entries.chat={status:'saved',attachmentScannedAt:10,attachments:[archive]};
  const library=libraryState(job);
  library.entries.saved={name:'kept.7z',size:110_000_000,status:'saved',path:'attachments/kept.7z'};
  library.entries.parked={name:'parked.zip',size:11_000_000,status:'manual',attempts:2};
  library.entries.external={name:'external.zip',size:11_000_000,status:'manual',external:true};
  library.entries.failed={name:'local.zip',size:11_000_000,status:'manual',localWriteSkipped:true};
  refreshArchiveEligibility(job);
  assert.equal(archive.status,'pending');
  assert.equal(archive.retryAt,12_345);
  assert.equal(job.entries.chat.attachmentPending,true);
  job.options.prioritizeArchives=false;
  refreshArchiveEligibility(job);
  assert.equal(archive.status,'manual');
  assert.equal(archive.attempts,1);
  assert.equal(library.entries.saved.status,'saved');
  for(const id of ['parked','external','failed'])assert.equal(library.entries[id].status,'manual');
});

test('bridge bounds large archives, follows link JSON and releases prepared chunks', async () => {
  const source=await fs.readFile(new URL('../ChatGPT-Exporter-English-Edge/bridge.js',import.meta.url),'utf8');
  const body=new Uint8Array(12_000_000);
  body.set([80,75,3,4]);
  body[body.length-1]=123;
  const origin='https://chatgpt.com';
  const window={addEventListener(){},async fetch(url){
    const {pathname}=new URL(url,origin);
    if(pathname==='/api/auth/session')return Response.json({accessToken:'fixture',user:{id:scope.user}});
    if(pathname.endsWith('file-over'))return new Response(null,{headers:{'content-length':String(ARCHIVE_FILE_LIMIT+1)}});
    if(pathname.endsWith('file-link'))return Response.json({download_url:origin+'/backend-api/estuary/content?id=file-fixture&sig=fixture'});
    return new Response(body,{headers:{'content-type':'application/zip','content-length':String(body.length)}});
  }};
  vm.runInNewContext(source,{window,location:{origin,href:origin+'/',pathname:'/'},document:{cookie:'_account=workspace'},crypto:webcrypto,URL,Headers,Request,Response,Blob,AbortSignal,Uint8Array,btoa,Date});
  const {rpc}=window.__englishExporterBridgeV2412;
  const prepare=(id,archive)=>rpc({op:'assetPrepare',scope,candidates:['/backend-api/files/download/'+id],archive,maxBytes:ARCHIVE_FILE_LIMIT});
  assert.equal((await prepare('file-link',false)).status,413);
  assert.equal((await prepare('file-over',true)).status,413);
  const file=await prepare('file-link',true);
  assert.equal(file.size,body.length);
  const part=await rpc({op:'assetChunk',key:file.key,offset:body.length-1});
  assert.equal(part.done,true);
  assert.equal(atob(part.base64).charCodeAt(0),123);
  await rpc({op:'assetRelease',key:file.key});
  assert.equal((await rpc({op:'assetChunk',key:file.key})).status,404);
});
