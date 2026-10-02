import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const source=path.join(root,'ChatGPT-Exporter-English-Edge');
const out=path.resolve(process.argv[2]||path.join(root,'dist'));
const require=createRequire(import.meta.url),Zip=require(path.join(source,'jszip.min.js'));
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
const version=manifest.version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version');
const zip=new Zip(),prefix='ChatGPT-Exporter-English-Edge/';
for(const relative of fs.readdirSync(source,{recursive:true}).map(p=>p.replaceAll('\\','/')).sort()){
  const file=path.join(source,relative);if(!fs.statSync(file).isFile())continue;
  zip.file(prefix+relative,fs.readFileSync(file),{date:new Date('2000-01-01T00:00:00Z'),createFolders:false});
}
const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',platform:'DOS'});
const checked=await Zip.loadAsync(bytes,{checkCRC32:true});
for(const file of [manifest.background.service_worker,...manifest.content_scripts.flatMap(x=>x.js),...Object.values(manifest.icons),'exporter.html','style.css','library.css','README.md',`CHANGELOG-v${version}.md`])if(!checked.file(prefix+file))throw Error('Missing release file: '+file);
for(const [name,file] of Object.entries(checked.files)){
  if(/node_modules|profiles|fixtures|(?:^|\/)tests\//.test(name))throw Error('Unexpected private/test data');
  if(!name.endsWith('.mjs'))continue;
  for(const match of (await file.async('string')).matchAll(/from\s+['"]\.\/([^'"]+)['"]/g))if(!checked.file(prefix+match[1]))throw Error('Missing imported module: '+match[1]);
}
const name=`ChatGPT-Exporter-English-Edge-v${version}.zip`;
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),bytes);
const sha=createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(path.join(out,name+'.sha256.txt'),sha+'  '+name+'\n');
console.log(JSON.stringify({version,name,bytes:bytes.length,sha256:sha},null,2));
