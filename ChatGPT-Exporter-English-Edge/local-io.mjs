export const missingLocalFile=e=>['NotFoundError','TypeMismatchError'].includes(e?.name);
export async function sameLocalEntry(a,b){try{return a===b || !!a?.isSameEntry&&await a.isSameEntry(b);}catch(e){if(missingLocalFile(e))return false;throw e;}}
export async function availableLocalFile(handle,stats){try{return await handle.getFile();}catch(e){if(!missingLocalFile(e))throw e;if(stats)stats.errors=(stats.errors || 0)+1;return null;}}
export const localStorageFailure=e=>e?.code==='LOCAL_STORAGE_FAILURE'||['NotAllowedError','SecurityError','QuotaExceededError'].includes(e?.name);
export function localStorageError(error,operation,path=''){
  if(error?.code==='LOCAL_STORAGE_FAILURE')return error;
  const where=path?` (${path})`:'',help=error?.name==='QuotaExceededError'?' Free disk space on the system drive and backup drive, then resume. Browser storage can also be full; keep the current extension profile and saved progress.':missingLocalFile(error)?' Restore the selected folder or choose it again, then resume.':'';
  return Object.assign(new Error(`Local ${operation} failed${where}: ${String(error?.message || error).replace(/[. ]+$/,'')}.${help}`,{cause:error}),{name:error?.name || 'Error',code:'LOCAL_STORAGE_FAILURE',operation,path});
}
