// Persist repair decisions independently of the transcript/discovery state.
export const ATTACHMENT_STATE_REVISION = 1;
export function repairAttachmentEntry(entry, force=false) {
  if(!force && entry.attachmentStateRevision>=ATTACHMENT_STATE_REVISION)return false;
  let work=false;
  for(const a of entry.attachments || []) {
    if(a.status==='skipped-too-large')continue;
    a.previousStatus=a.status;
    a.status=a.status==='saved'?'unverified':'deferred';
    a.autoRetry=true;
    if(a.status==='deferred')a.error='Queued for the corrected attachment routes.';
    work=true;
  }
  entry.attachmentStateRevision=ATTACHMENT_STATE_REVISION;
  if(work || entry.status==='saved'){
    // Scan even entries without records: a legacy scan may have omitted assets.
    entry.attachmentPending=true;entry.attachmentRetryAt=0;entry.attachmentScannedAt=0;
    work=true;
  }
  return work;
}
export function mergeInventoryAttachments(entry,item) {
  // A disk index is a recovery fallback. Never roll live repair/retry/validation
  // decisions back to an older snapshot on every engine start.
  if(entry.attachmentStateRevision>=ATTACHMENT_STATE_REVISION || entry.attachmentScannedAt || entry.attachments?.length)return;
  if(Array.isArray(item.attachments))entry.attachments=item.attachments;
  entry.attachmentStateRevision=item.attachmentStateRevision || 0;
  entry.attachmentScannedAt=item.attachmentScannedAt || 0;
  entry.attachmentPending=!!item.attachmentPending;
  entry.attachmentRetryAt=item.attachmentRetryAt || 0;
  if(entry.attachmentStateRevision<ATTACHMENT_STATE_REVISION)repairAttachmentEntry(entry);
  else if(entry.attachments?.some(a=>a.status==='saved')){
    // Even a current index cannot prove that its files still exist in a newly
    // selected/restored folder. Validate saved records once in this live state.
    for(const a of entry.attachments)if(a.status==='saved')a.status='unverified';
    entry.attachmentPending=true;entry.attachmentRetryAt=0;entry.attachmentScannedAt=0;
  }
}
