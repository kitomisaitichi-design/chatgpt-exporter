import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {normalizeLibraryItem,mergeLibraryItem,verifyLibraryTransferSize,recoverLocalFileFailures} from '../ChatGPT-Exporter-English-Edge/library.mjs';
import {registerLocalCandidate,iterateLocalCopyCandidates,verifyLocalCopy} from '../ChatGPT-Exporter-English-Edge/local-files.mjs';
import {ContentStore} from '../ChatGPT-Exporter-English-Edge/file-intelligence.mjs';

globalThis.crypto ||= webcrypto;
const content=Buffer.from('same image bytes on disk and from ChatGPT, independent of stale listing size');
const checksum=createHash('sha256').update(content).digest('hex');
const libraryFile=(size=7,remoteSha256=checksum)=>({
  id:'file-example-123',fileId:'file-example-123',libraryId:'library-123',
  name:'original.png',size,reportedSize:size,remoteSha256,status:'pending'
});
const sha=async file=>createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');

test('complete Library bytes beat a stale listing size, but incomplete bytes do not',()=>{
  assert.equal(verifyLibraryTransferSize(content.length,content.length,7),true);
  assert.equal(verifyLibraryTransferSize(content.length,content.length,content.length),false);
  assert.throws(()=>verifyLibraryTransferSize(content.length+1,content.length,7),/prepared byte count/);
});

test('Library scan does not requeue a saved image because the server repeats its stale size',()=>{
  const raw={id:'file-example-123',file_size_bytes:7,name:'original.png'};
  const initial=normalizeLibraryItem(raw),state={entries:{}};
  mergeLibraryItem(state,initial);
  Object.assign(state.entries[initial.id],{size:content.length,sha256:checksum,status:'saved',path:'attachments/content/'+checksum+'/original.png',refresh:false});
  const changed=mergeLibraryItem(state,normalizeLibraryItem(raw));
  assert.equal(changed,false);
  assert.equal(state.entries[initial.id].status,'saved');
  assert.equal(state.entries[initial.id].size,content.length);
  assert.equal(state.entries[initial.id].reportedSize,7);
  const revised=normalizeLibraryItem({...raw,file_size_bytes:10,update_time:200});
  assert.equal(mergeLibraryItem(state,revised),true,'a different remote listing is still detected');
  assert.equal(state.entries[initial.id].status,'pending');
});

test('known SHA-256 recovers exact local bytes despite a different listed size',async()=>{
  const disk=new File([content],'original.png',{lastModified:123});
  const candidate={handle:{getFile:async()=>disk},name:'original.png',path:'original.png',source:'library',size:disk.size,lastModified:disk.lastModified,hash:checksum,identityHash:checksum,ids:['file-example-123']};
  const inventory={index:new Map(),byHash:new Map(),byId:new Map(),bySize:new Map(),hashCache:new Map(),records:new Map(),unclassified:new Map()};
  registerLocalCandidate(inventory,candidate);
  const found=[...iterateLocalCopyCandidates(inventory,libraryFile(7))];
  assert.equal(found.includes(candidate),true);
  const reused=await verifyLocalCopy(candidate,libraryFile(7),inventory,sha);
  assert.equal(reused?.size,content.length);
  const wrong=libraryFile(7,'f'.repeat(64));
  assert.equal([...iterateLocalCopyCandidates(inventory,wrong)].includes(candidate),false);
});

test('ContentStore saves true size and rejects a false remote checksum',async()=>{
  const f=libraryFile(),job={library:{entries:{[f.id]:f}},entries:{}};
  const blob=new Blob([content],{type:'image/png'});
  let writes=0;
  const store=new ContentStore(()=>job,{read:async()=>blob,write:async()=>{writes++;},remove:async()=>{},onWrite:async()=>blob});
  const saved=await store.save(blob,f);
  assert.equal(saved.status,'saved');
  assert.equal(saved.size,content.length);
  assert.equal(f.size,content.length);
  assert.equal(f.reportedSize,7);
  assert.equal(f.sha256,checksum);
  assert.equal(writes,1);
  const other=libraryFile(7,'a'.repeat(64));job.library.entries[other.id]=other;
  await assert.rejects(store.save(blob,other),/reported SHA-256/);
  assert.equal(writes,1);
});

test('upgrade un-parks only historical false size errors',()=>{
  const item={...libraryFile(),status:'unavailable',parked:true,attempts:2,error:'Library file size differs from its metadata.',failureHistory:[
    {at:1,attempt:1,error:'Library file size differs from its metadata.'},
    {at:2,attempt:2,error:'Library file size differs from its metadata.'}
  ]};
  const unrelated={...libraryFile(),id:'other-id',status:'unavailable',parked:true,attempts:2,error:'HTTP 403',failureHistory:[{at:1,error:'HTTP 403'},{at:2,error:'HTTP 403'}]};
  const job={library:{entries:{a:item,b:unrelated}},entries:{}};
  assert.equal(recoverLocalFileFailures(job,100),1);
  assert.equal(item.status,'pending');
  assert.equal(item.attempts,0);
  assert.equal(item.parked,false);
  assert.equal(unrelated.status,'unavailable');
  assert.equal(unrelated.attempts,2);
});
