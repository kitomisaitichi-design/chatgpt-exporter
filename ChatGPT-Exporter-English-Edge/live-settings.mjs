export const USER_QUIET_MS=6*60*1000;
export function setUserYield(job,enabled,now=Date.now()){
  job.options.yieldUser=!!enabled;job.updated=now;
  if(!enabled&&job.awareness?.state==='user-active')Object.assign(job.awareness,{state:'observing',waitUntil:0,reason:'User-activity pause is off. Checking other network conditions.'});
  return enabled?'User-activity pause is on. New network reads wait for six quiet minutes.':'User-activity pause is off. Network work can resume when other conditions allow.';
}
export function userYieldStatus(job,now=Date.now()){
  if(job?.options?.yieldUser===false)return 'Off · your ChatGPT activity does not pause new network reads.';
  const remaining=Math.max(0,(job?.awareness?.lastUserInteraction || 0)+USER_QUIET_MS-now);
  return remaining?'On · '+Math.ceil(remaining/1000)+' s of quiet time remaining.':'On · resume after six quiet minutes. Server cooldowns still apply.';
}
