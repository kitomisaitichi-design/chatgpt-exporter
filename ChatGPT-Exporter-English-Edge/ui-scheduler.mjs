// Coalesce bursts of worker notifications without delaying pointer controls.
export function createRenderScheduler(render,{schedule=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id)}={}){
  let pending=null;
  return {request(){if(pending!==null)return;pending=schedule(()=>{pending=null;render();});},flush(){if(pending!==null){cancel(pending);pending=null;}render();}};
}
