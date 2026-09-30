chrome.runtime.onInstalled.addListener(()=>chrome.alarms.create('english-exporter-passive-tick',{periodInMinutes:15}));
chrome.runtime.onStartup.addListener(()=>chrome.alarms.create('english-exporter-passive-tick',{periodInMinutes:15}));
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='english-exporter-passive-tick')chrome.runtime.sendMessage({type:'passive-tick',at:Date.now()}).catch(()=>{});});
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('exporter.html');const tabs = await chrome.tabs.query({url});
  if (tabs.length) {await chrome.tabs.update(tabs[0].id, {active:true});await chrome.windows.update(tabs[0].windowId, {focused:true});}
  else await chrome.tabs.create({url});
});
