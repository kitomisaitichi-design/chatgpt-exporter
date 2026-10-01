// Presentation only. Retrieval and saved-state policy stay in app/engine.
export function dashboardPresentation({job,connecting,initializing,notice,saved,total,failed}) {
  const status=job?.status || 'ready';
  const waiting=Math.max(job?.pace?.until || 0,job?.awareness?.waitUntil || 0,job?.schedule?.checkWaitUntil || 0)>Date.now();
  let tone='neutral',heading='Ready when you are';
  if(initializing)heading='Loading your saved progress';
  else if(connecting)heading='Connecting to ChatGPT';
  else if(notice){tone='error';heading='Attention is needed';}
  else if(status==='watching'){tone=waiting?'waiting':'positive';heading=waiting?'Watching · waiting for the network window':'Your backup is watching for changes';}
  else if(['running','ready'].includes(status)&&job){tone=waiting?'waiting':'positive';heading=waiting?'Progress kept · waiting to continue':status==='running'?'Your backup is in progress':'Ready to continue your backup';}
  else if(['held','paused','pausing'].includes(status)){tone='waiting';heading=status==='held'?'Held in place':status==='pausing'?'Stopping after the current item':'Paused · your progress is safe';}
  else if(['complete','indexed'].includes(status)){tone='positive';heading=status==='indexed'?'Your conversation index is ready':'Available conversations are backed up';}
  else if(status==='incomplete'){tone='waiting';heading='Backup saved · some items need attention';}
  const percent=total?Math.min(100,Math.floor(saved/total*100)):null;
  return {tone,heading,progressLabel:`${saved.toLocaleString()} of ${total.toLocaleString()} chats saved`,progressPercent:percent===null?'—':`${percent}%`,attention:failed>0};
}
export function renderDashboard(document,state) {
  const view=dashboardPresentation(state),get=id=>document.getElementById(id);
  get('status-heading').textContent=view.heading;get('state').dataset.tone=view.tone;get('status-dot').dataset.tone=view.tone;
  get('progress-label').textContent=view.progressLabel;get('progress-percent').textContent=view.progressPercent;
  get('failed').closest('.stat').dataset.active=String(view.attention);
  get('connection').dataset.tone=state.connecting?'waiting':state.connected?'positive':'neutral';
  get('connection-step').dataset.ready=String(state.connected);get('folder-step').dataset.ready=String(!!state.folder);
  get('setup-complete').textContent=`${Number(state.connected)+Number(!!state.folder)} of 2 ready`;
  get('watch-toggle-label').textContent=get('passive').checked?'Enabled':'Off';
  if(!state.job){get('passive-status').textContent=get('passive').checked?'Ready to watch after your first backup':'Passive watcher is off';get('watch-details').textContent=get('passive').checked?'Connect your account, choose a folder and start your backup. Watching continues after available export work finishes.':'Enable the watcher to keep checking after your backup finishes.';}
  get('connect').textContent=state.connecting?'Connecting…':state.connected?'Reconnect to ChatGPT':'Connect to ChatGPT';
  if(state.connecting){get('connect').disabled=true;get('connection').textContent='Connecting';get('message').textContent='Connecting to your signed-in ChatGPT session…';}
  const watching=state.connected && state.job?.status==='watching' && state.job.schedule?.enabled && !state.job.schedule.suspended;
  get('start').textContent=watching?'Watching for changes':state.running?'Backup in progress':state.job?'Resume backup':'Start backup';
  if(state.connected&&state.scope){get('account').textContent=state.scope.account?'Signed in · selected workspace':'Signed in · default workspace';get('account').title=`User ${state.scope.user} · workspace ${state.scope.account || 'default session'}`;}
}
