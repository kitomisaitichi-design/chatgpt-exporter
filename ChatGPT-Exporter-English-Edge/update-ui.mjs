import {updateStatus} from './updates.mjs';
import {IdleInstaller,INSTALL_KEY} from './installer.mjs';
export async function setupUpdates(document,runtime,version,{db,isIdle,block}){
 const get=id=>document.getElementById(id),select=get('extension-update-interval'),button=get('extension-update-check'),status=get('extension-update-status'),link=get('extension-update-link'),toggle=get('extension-update-install'),folder=get('extension-install-folder'),installStatus=get('extension-install-status');let busy=false,state=null,recoveryPending=false;
 const installer=new IdleInstaller({db,runtime,isIdle,block,isEnabled:()=>state?.autoInstall===true,onStatus:text=>installStatus.textContent=text});
 // The dashboard's exclusive writer lock covers backup, maintenance and installation.
 const prior=await db.get('meta',INSTALL_KEY);if(prior?.journal){block(true);try{await installer.recover(prior);}catch(e){recoveryPending=true;installStatus.textContent='Choose the original installation folder to restore the interrupted update: '+e.message;}finally{block(recoveryPending);}}else if(prior?.root)installStatus.textContent='Installation folder remembered. Automatic installation is '+(toggle.checked?'enabled.':'off until enabled.');
 const turn=()=>{if(state?.autoInstall&&state.available&&!installer.busy){installStatus.textContent=installer.attempted===state.latestVersion?installStatus.textContent:isIdle()?'Preparing idle update…':'Update waiting for backup and local work to stop.';void installer.turn(state);}};
 const render=value=>{state=value;select.value=state.interval;toggle.checked=state.autoInstall===true;button.disabled=busy||!!state.checking;status.textContent=updateStatus(state,version);link.hidden=!state.available;link.href=state.available?state.releaseUrl:'https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/latest';link.textContent=state.available?`View v${state.latestVersion} release & update instructions`:'View releases';turn();};
 const send=async args=>{const result=await runtime.sendMessage(args);if(!result?.ok)throw Error(result?.error || 'Update service unavailable.');render(result.state);return result.state;};
 select.addEventListener('change',()=>{select.disabled=true;void send({type:'extension-update-interval',interval:select.value}).catch(e=>status.textContent=e.message).finally(()=>select.disabled=false);});
 toggle.addEventListener('change',()=>{toggle.disabled=true;void send({type:'extension-update-install',enabled:toggle.checked}).catch(e=>status.textContent=e.message).finally(()=>toggle.disabled=false);});
 folder.addEventListener('click',async()=>{if(installer.busy||(!recoveryPending&&!isIdle()))return;folder.disabled=true;block(true);try{const root=await showDirectoryPicker({id:'exporter-installation',mode:'readwrite'});if(recoveryPending){if(!await prior.root.isSameEntry(root))throw Error('Choose the original installation folder for rollback recovery.');await installer.recover({...prior,root});recoveryPending=false;}await installer.configure(root);}catch(e){if(e.name!=='AbortError')installStatus.textContent=e.message;}finally{folder.disabled=false;block(recoveryPending);turn();}});
 button.addEventListener('click',()=>{if(busy)return;busy=true;button.disabled=true;status.textContent='Checking the official GitHub release…';void send({type:'extension-update-check'}).catch(e=>status.textContent=e.message).finally(()=>{busy=false;button.disabled=false;});});
 runtime.onMessage.addListener(message=>{if(message?.type==='extension-updates-changed')render(message.state);});
 await send({type:'extension-update-status'}).catch(e=>status.textContent=e.message);
 // One cheap status test per minute; no directory scan or hash occurs without a new release.
 setInterval(turn,60000);
}
