// Installation is deliberately separate from account/job state and never deletes extra files.
export const INSTALL_KEY='extensionInstallation';
const REPO='https://github.com/kitomisaitichi-design/chatgpt-exporter',API='https://api.github.com/repos/kitomisaitichi-design/chatgpt-exporter/releases/tags/ChatGPT';
const PREFIX='ChatGPT-Exporter-English-Edge/',LIMIT=16*1024*1024;
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function boundedBytes(response,limit=LIMIT){if(!response.ok)throw Error(`Release download returned HTTP ${response.status}.`);if(Number(response.headers.get('content-length'))>limit)throw Error('Release exceeds the installation size limit.');const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Release exceeds the installation size limit.');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}return bytes;}
export async function releaseFiles(version,{fetch=globalThis.fetch,Zip=globalThis.JSZip}={}){
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version.');
 const signal=AbortSignal.timeout(60000),response=await fetch(API+version,{signal,cache:'no-cache'});if(!response.ok)throw Error(`Release lookup returned HTTP ${response.status}.`);const release=await response.json(),name=`ChatGPT-Exporter-English-Edge-v${version}.zip`,url=`${REPO}/releases/download/ChatGPT${version}/${name}`;
 if(release.tag_name!==`ChatGPT${version}`||release.draft||release.prerelease||release.html_url!==`${REPO}/releases/tag/ChatGPT${version}`)throw Error('Unexpected release metadata.');
 const asset=release.assets?.find(a=>a.name===name&&a.browser_download_url===url),checksum=release.assets?.find(a=>a.name===name+'.sha256.txt'&&a.browser_download_url===url+'.sha256.txt');if(!asset||!checksum)throw Error('Release ZIP or checksum is missing.');
 const bytes=await boundedBytes(await fetch(url,{signal})),sum=new TextDecoder().decode(await boundedBytes(await fetch(checksum.browser_download_url,{signal}),4096)),expected=sum.trim().split(/\s+/)[0],actual=await sha256(bytes);
 if(!/^[a-f0-9]{64}$/.test(expected)||actual!==expected||(asset.digest&&asset.digest!==`sha256:${actual}`))throw Error('Release checksum failed; no installed files changed.');
 const zip=await Zip.loadAsync(bytes),files=new Map();let total=0;
 for(const [path,entry] of Object.entries(zip.files)){if(entry.dir)continue;const original=entry.unsafeOriginalName||path,relative=path.slice(PREFIX.length);if(original!==path||!path.startsWith(PREFIX)||!relative||relative.split('/').some(p=>!p||p==='.'||p==='..'||/[\\:\x00-\x1f]/.test(p)||/[. ]$/.test(p)||/^(?:con|prn|aux|nul|com\d|lpt\d)(?:\.|$)/i.test(p))||((entry.unixPermissions||0)&0xf000)===0xa000)throw Error('Unsafe release path.');
  if(entry._data?.uncompressedSize>LIMIT||(total+(entry._data?.uncompressedSize||0))>LIMIT)throw Error('Expanded release is too large.');const data=await entry.async('uint8array');total+=data.length;if(total>LIMIT||files.size>=300)throw Error('Expanded release is too large.');files.set(relative,data);
 }
 const text=p=>new TextDecoder().decode(files.get(p)),manifest=JSON.parse(text('manifest.json'));
 if(manifest.version!==version||manifest.name!=='ChatGPT Exporter — English Autopilot'||manifest.manifest_version!==3)throw Error('Unexpected extension manifest.');
 for(const p of ['app.mjs','core.mjs','exporter.html','jszip.min.js',manifest.background?.service_worker,...Object.values(manifest.icons||{})])if(!files.has(p))throw Error('Incomplete release: '+p);
 for(const [path,data] of files)if(/\.(?:mjs|js)$/.test(path))for(const m of new TextDecoder().decode(data).matchAll(/from\s+['"]\.\/([^'"]+)['"]/g))if(!files.has(m[1]))throw Error('Missing release module: '+m[1]);
 return {files,sha256:actual,version};
}
export async function readFile(root,path){try{const bits=path.split('/');let dir=root;for(const bit of bits.slice(0,-1))dir=await dir.getDirectoryHandle(bit);return new Uint8Array(await(await dir.getFileHandle(bits.at(-1))).getFile().then(f=>f.arrayBuffer()));}catch(e){if(e.name==='NotFoundError')return null;throw e;}}
export async function writeFile(root,path,bytes){const bits=path.split('/');let dir=root;for(const bit of bits.slice(0,-1))dir=await dir.getDirectoryHandle(bit,{create:true});const writer=await(await dir.getFileHandle(bits.at(-1),{create:true})).createWritable();try{await writer.write(bytes);await writer.close();}catch(e){await writer.abort().catch(()=>{});throw e;}}
async function removeFile(root,path){const bits=path.split('/');let dir=root;for(const bit of bits.slice(0,-1))dir=await dir.getDirectoryHandle(bit);await dir.removeEntry(bits.at(-1));}
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>x===b[i]);
export async function validateInstallationFolder(root,runtime,{fetch=globalThis.fetch}={}){
 const manifest=JSON.parse(new TextDecoder().decode(await readFile(root,'manifest.json'))),current=runtime.getManifest();if(manifest.version!==current.version||manifest.name!==current.name)throw Error('Choose the currently loaded extension folder, not a backup folder.');
 const path=`exporter-install-probe-${crypto.randomUUID()}.txt`,nonce=crypto.randomUUID();await writeFile(root,path,new TextEncoder().encode(nonce));try{const response=await fetch(runtime.getURL(path),{cache:'no-store'});if(!response.ok||await response.text()!==nonce)throw Error('The selected folder is not the loaded extension directory.');}finally{await removeFile(root,path);}
 return true;
}
export class IdleInstaller{
 constructor({db,runtime,isIdle,block,load=releaseFiles,validate=validateInstallationFolder,isEnabled=()=>true,onStatus=()=>{}}){Object.assign(this,{db,runtime,isIdle,block,load,validate,isEnabled,onStatus});this.busy=false;this.attempted=null;}
 async configure(root){await this.validate(root,this.runtime);await this.db.put('meta',INSTALL_KEY,{root});this.attempted=null;this.onStatus('Installation folder verified. Updates will install while the dashboard is open and backup is stopped.');}
 async recover(record){if(!record?.journal)return;const {root,journal}=record;this.onStatus('Restoring an interrupted installation…');for(const p of journal.paths.filter(p=>p!=='manifest.json').concat('manifest.json')){if(journal.added.includes(p)){try{await removeFile(root,p);}catch(e){if(e.name!=='NotFoundError')throw e;}}else{const bytes=await readFile(root,journal.backup+'/'+p);if(!bytes)throw Error('Rollback copy is missing: '+p);await writeFile(root,p,bytes);}}delete record.journal;await this.db.put('meta',INSTALL_KEY,record);this.onStatus('Previous installation restored; rollback copy retained.');}
 async turn(state){if(this.busy||!state?.autoInstall||!state.available||!this.isIdle()||this.attempted===state.latestVersion)return;this.busy=true;this.block(true);try{const record=await this.db.get('meta',INSTALL_KEY);if(!record?.root)throw Error('Choose the installation folder once to enable silent installation.');if(await record.root.queryPermission({mode:'readwrite'})!=='granted')throw Error('Installation-folder permission expired. Choose the folder again.');await this.recover(record);await this.validate(record.root,this.runtime);if(!this.isIdle(true)||!this.isEnabled())return;
  this.onStatus('Verifying release and checking local customizations…');const current=this.runtime.getManifest().version,[baseline,next]=await Promise.all([this.load(current),this.load(state.latestVersion)]);
  // Extra files are retained. A modified managed file must be merged manually, never overwritten.
  for(const [p,bytes] of baseline.files)if(!same(await readFile(record.root,p),bytes))throw Error('Local or Viewer changes detected in '+p+'. Use the release instructions to preserve them; automatic installation deferred.');
  for(const p of next.files.keys())if(!baseline.files.has(p)&&await readFile(record.root,p))throw Error('A local file conflicts with the release: '+p+'. Install manually.');
  if(!this.isIdle(true))return;
  const backup=`.exporter-rollback/${current}-${Date.now()}`,paths=[...next.files.keys()].filter(p=>p!=='manifest.json').concat('manifest.json'),added=[];
  this.onStatus('Saving rollback copy…');for(const p of paths){const bytes=await readFile(record.root,p);if(bytes)await writeFile(record.root,backup+'/'+p,bytes);else added.push(p);}
  record.journal={backup,paths,added,from:current,to:state.latestVersion};await this.db.put('meta',INSTALL_KEY,record);
  try{this.onStatus('Installing verified update…');for(const p of paths){if(!this.isEnabled())throw Error('Automatic installation disabled; original version restored.');await writeFile(record.root,p,next.files.get(p));if(!same(await readFile(record.root,p),next.files.get(p)))throw Error('Installed file verification failed: '+p);}delete record.journal;record.lastInstall={from:current,to:state.latestVersion,backup,at:Date.now()};await this.db.put('meta',INSTALL_KEY,record);}catch(e){await this.recover({...record,journal:record.journal||{backup,paths,added}});throw e;}
  this.onStatus('Update installed; reloading extension. Rollback copy retained.');this.runtime.reload();
 }catch(e){this.attempted=state.latestVersion;this.onStatus(e.message||String(e));}finally{this.block(false);this.busy=false;}}
}
