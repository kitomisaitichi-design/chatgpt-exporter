import {UpdateChecker,UPDATE_ALARM} from './updates.mjs';
const updater=new UpdateChecker({storage:chrome.storage.local,alarms:chrome.alarms,version:chrome.runtime.getManifest().version,notify:state=>chrome.runtime.sendMessage({type:'extension-updates-changed',state}).catch(()=>{})});
void updater.initialize().catch(console.error);
chrome.runtime.onStartup.addListener(()=>void updater.initialize().catch(console.error));
chrome.runtime.onInstalled.addListener(()=>void updater.initialize().catch(console.error));
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===UPDATE_ALARM)void updater.check().catch(console.error);});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{if(!['extension-update-status','extension-update-check','extension-update-interval','extension-update-install'].includes(message?.type))return;if(sender.id&&sender.id!==chrome.runtime.id)return;
 const work=message.type==='extension-update-install'?updater.setAutoInstall(message.enabled):message.type==='extension-update-interval'?updater.setInterval(message.interval):message.type==='extension-update-check'?updater.check({manual:true}):updater.status();work.then(state=>respond({ok:true,state}),e=>respond({ok:false,error:e.message}));return true;
});
chrome.alarms.create('english-exporter-passive-tick',{periodInMinutes:1});
chrome.runtime.onInstalled.addListener(()=>chrome.alarms.create('english-exporter-passive-tick',{periodInMinutes:1}));
chrome.runtime.onStartup.addListener(()=>chrome.alarms.create('english-exporter-passive-tick',{periodInMinutes:1}));
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='english-exporter-passive-tick')chrome.runtime.sendMessage({type:'passive-tick',at:Date.now()}).catch(()=>{});});
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('exporter.html');const tabs = await chrome.tabs.query({url});
  if (tabs.length) {await chrome.tabs.update(tabs[0].id, {active:true});await chrome.windows.update(tabs[0].windowId, {focused:true});}
  else await chrome.tabs.create({url});
});
