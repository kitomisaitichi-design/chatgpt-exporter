// Observable pacing policy. Network pacing is handled primarily by the tiered
// delay in core.mjs. This module only adds short rests for visible app activity
// and never throttles local disk/cache processing.
import {USER_QUIET_MS} from './live-settings.mjs';
export function awareness(job) {
  return job.awareness ||= {actions:[],native:[],seen:{},lastNavigation:0,lastSignal:0,lastUserInteraction:0,probe:false,probeRest:0,recoveries:[],state:'observing',reason:'Observing the app before adding network work.',confidence:0,pressure:0,quietSince:0,lastObservedAt:0};
}
export const costOf = kind => kind==='navigation' ? 6 : kind==='discovery' ? 2 : kind==='asset' ? 2 : 1;
export function recordAction(job, kind, now=Date.now()) {
  const a=awareness(job);a.actions=a.actions.filter(x=>now-x.at<300000);a.actions.push({at:now,cost:costOf(kind),kind,source:'exporter'});
  if(kind==='navigation'){a.lastNavigation=now;a.recoveries.push(now);a.recoveries=a.recoveries.filter(t=>now-t<3600000);}
}
export function observeActivity(job, snapshots, now=Date.now()) {
  const a=awareness(job),keys=new Set(a.native.map(e=>e.key));let newestLimit=null,newEvents=0,writeEvents=0;
  for(const s of snapshots || []) {
    a.lastUserInteraction=Math.max(a.lastUserInteraction || 0,Number(s.lastUserInteraction)||0);
    for(const e of s.events || []) {
      const key=`${s.tabId}:${s.documentId}:${e.seq}`;
      if(!keys.has(key) && now-e.at<300000) {a.native.push({key,at:e.at,cost:e.write?3:1,write:!!e.write,source:'native'});keys.add(key);newEvents++;if(e.write)writeEvents++;}
    }
    if(s.limit?.at>(job.lastLimitSeen || 0) && (!newestLimit || s.limit.at>newestLimit.at))newestLimit=s.limit;
  }
  a.native=a.native.filter(e=>now-e.at<300000);a.actions=a.actions.filter(e=>now-e.at<300000);a.lastObservedAt=now;
  const recent15=a.native.filter(e=>now-e.at<15000).reduce((n,e)=>n+e.cost,0);
  const recent60=a.native.filter(e=>now-e.at<60000).reduce((n,e)=>n+e.cost,0);
  const instant=Math.min(1,Math.max(recent15/12,recent60/30,writeEvents?0.65:0));
  a.pressure=Math.max(0,Math.min(1,(a.pressure || 0)*0.8+instant*0.2));
  if(newEvents)a.quietSince=0;else if(!a.quietSince)a.quietSince=now;
  return newestLimit;
}
function coalescedTraffic(a,now){
  // The exporter request is often visible again as a native page request. Treat
  // near-simultaneous exporter/native observations as one action, not two.
  const all=[...a.actions,...a.native].filter(e=>now-e.at<300000).sort((x,y)=>x.at-y.at),out=[];
  for(const e of all){const prev=out.at(-1);if(prev && e.at-prev.at<=1250 && prev.source!==e.source){prev.at=Math.max(prev.at,e.at);prev.cost=Math.max(prev.cost,e.cost);prev.write=prev.write||e.write;}else out.push({...e});}
  return out;
}
function windowRelease(events,duration,capacity,cost,now){
  const window=events.filter(e=>e.at>now-duration).sort((a,b)=>a.at-b.at);let sum=window.reduce((n,e)=>n+e.cost,0);
  if(sum+cost<=capacity)return 0;for(const e of window){sum-=e.cost;if(sum+cost<=capacity)return e.at+duration+250;}return now+duration;
}
export function decide(job,snapshots=[],kind='read',now=Date.now(),waitingSince=now){
  const a=awareness(job),waits=[];const wait=(until,state,reason)=>{if(until>now)waits.push({until,state,reason});};
  wait(job.pace.until,'cooldown','Waiting for the current ChatGPT limit cooldown to end.');
  wait(job.pace.next,'spacing',`Adaptive network spacing · tier ${job.pace.tier || 0}.`);
  wait(a.probeRest,'observing','The single check finished. Briefly observing before another network request.');
  const tier=job.pace.tier || 0;
  if(job.options?.yieldUser!==false && (a.lastUserInteraction || 0)>0)wait((a.lastUserInteraction || 0)+USER_QUIET_MS,'user-active','You are using ChatGPT. Export network work stays quiet until 6 minutes after your last click, keypress, wheel/scroll input, or touch.');
  for(const s of snapshots){
    if(s.blocked)return {state:'needs-attention',reason:s.blocked,until:0,attention:true};
    if(s.worker && (s.frozen || s.discarded))return {state:'needs-attention',reason:'The ChatGPT tab is asleep. Open it once, then resume; the exporter will not repeatedly reload it.',attention:true,until:0};
    if(s.worker && s.readyState==='loading')wait(now+3000,'settling','Waiting for the ChatGPT page to finish loading.');
    if(s.activeStreams>0)wait(now+5000,'app-busy','A chat response is still streaming. Waiting for the app to finish.');
    wait((s.loadedAt || 0)+20000,'settling','Letting page-load requests settle.');
    wait((s.routeAt || 0)+12000,'settling','Letting navigation finish before another network request.');
    if(s.inFlight>0 && now-(s.lastStart || 0)<120000)wait(now+3000,'app-busy','The app is already making requests. Waiting briefly.');
    wait((s.lastWrite || 0)+45000,'app-busy','Recent chat activity may share the account limit. Giving it a short quiet window.');
    const recent=(s.events || []).filter(e=>now-e.at<15000);if(recent.length>=4)wait(Math.max(...recent.map(e=>e.at))+12000,'burst-rest','Several app requests arrived together. Leaving a short quiet period.');
  }
  // These are burst guards, not a second long-term quota. Ordinary exporter
  // cadence should fit inside them at every tier.
  const traffic=coalescedTraffic(a,now),cost=costOf(kind);
  for(const [duration,capacity] of [[15000,8],[60000,18],[300000,64]])wait(windowRelease(traffic,duration,capacity,cost,now),'traffic-rest',`A short local traffic window is full (${duration/1000}s). Waiting only until the oldest activity leaves it.`);
  if(kind==='navigation'){
    wait(a.lastNavigation+(tier>=2?120000:90000),'recovery-rest','Spacing out page-opening recovery, which can generate several requests.');
    const recent=a.recoveries.filter(t=>now-t<3600000);if(recent.length>=6)wait(recent[recent.length-6]+3600000,'recovery-rest','Six recovery page loads occurred within an hour. Resting before opening another.');
  }
  const hard=waits.filter(w=>!['traffic-rest','spacing'].includes(w.state));
  if(kind!=='navigation' && now-waitingSince>=30000 && !hard.length && waits.some(w=>w.state==='traffic-rest'))return {until:0,state:'gentle-check',reason:'Only a local burst guard remains. Trying one low-cost read, then observing the result.',gentle:true};
  const decision=(hard.length?hard:waits).sort((x,y)=>y.until-x.until)[0] || {until:0,state:a.probe?'single-check':'ready',reason:a.probe?'Making one read after the cooldown, then observing.':`Network window available · adaptive tier ${tier}.`};
  if(!decision.until && kind==='navigation' && a.probe)return {until:0,state:'single-check',reason:'A read-only check is required before another recovery page load.',probeRequired:true};
  return decision;
}
export function recordLimit(job){const a=awareness(job);a.probe=true;a.confidence=0;a.pressure=Math.max(a.pressure || 0,0.75);}
export function recordSuccess(job,now=Date.now()){const a=awareness(job);if(a.probe){a.probe=false;a.probeRest=now+12000;}a.confidence=Math.min(20,(a.confidence || 0)+1);a.pressure=Math.max(0,(a.pressure || 0)*0.88);}
